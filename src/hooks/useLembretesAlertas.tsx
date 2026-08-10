import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LembreteAlerta {
  id: string;
  usuario_id: string;
  titulo: string;
  descricao: string | null;
  data: string; // yyyy-MM-dd
  hora: string | null; // HH:mm:ss
  visibilidade: "privado" | "todos";
  cor_categoria_id: string | null;
}

const FIRED_KEY = "lembretes_disparados";

function hojeKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

function lerDisparados(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { dia: string; ids: string[] };
    if (parsed.dia !== hojeKey()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function salvarDisparados(ids: Set<string>) {
  try {
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify({ dia: hojeKey(), ids: Array.from(ids) }),
    );
  } catch {
    /* ignore */
  }
}

function notificarNavegador(titulo: string, corpo: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(titulo, { body: corpo, icon: "/favicon.ico" });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Alertas de lembretes do calendário:
 * - avisa quando alguém cria um lembrete visível para todos os usuários;
 * - dispara uma notificação push na tela no horário do lembrete.
 * A cor mostrada é a cor da categoria escolhida por quem criou o lembrete.
 */
export function useLembretesAlertas() {
  const disparados = useRef<Set<string>>(lerDisparados());
  const lembretesRef = useRef<LembreteAlerta[]>([]);
  const coresRef = useRef<Map<string, string>>(new Map());
  const nomesRef = useRef<Map<string, string>>(new Map());
  const meRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cor = (l: LembreteAlerta) =>
      (l.cor_categoria_id && coresRef.current.get(l.cor_categoria_id)) || "#22d3ee";

    const nome = (id: string) => nomesRef.current.get(id) || "Outro usuário";

    const mostrar = (l: LembreteAlerta, prefixo: string) => {
      toast(
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: cor(l) }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{prefixo}</p>
            <p className="text-sm">{l.titulo}</p>
            {l.hora && (
              <p className="text-xs opacity-70">
                {l.hora.slice(0, 5)}
                {l.usuario_id !== meRef.current ? ` · ${nome(l.usuario_id)}` : ""}
              </p>
            )}
            {l.descricao && <p className="text-xs opacity-70">{l.descricao}</p>}
          </div>
        </div>,
        { duration: 10000 },
      );
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      meRef.current = user.id;

      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          void Notification.requestPermission();
        }
      } catch {
        /* ignore */
      }

      const [lembretesRes, categoriasRes, usersRes] = await Promise.all([
        supabase
          .from("lembretes_calendario")
          .select("id, usuario_id, titulo, descricao, data, hora, visibilidade, cor_categoria_id")
          .gte("data", hojeKey()),
        supabase.from("categorias_calendario").select("id, cor"),
        supabase.from("user_profiles").select("id, full_name, display_name"),
      ]);
      if (cancelled) return;

      if (!categoriasRes.error) {
        (categoriasRes.data as { id: string; cor: string }[] | null)?.forEach((c) =>
          coresRef.current.set(c.id, c.cor),
        );
      }
      if (!usersRes.error) {
        (
          usersRes.data as
            | { id: string; full_name: string | null; display_name: string | null }[]
            | null
        )?.forEach((u) =>
          nomesRef.current.set(u.id, u.full_name || u.display_name || "Usuário"),
        );
      }
      if (!lembretesRes.error) {
        lembretesRef.current = (lembretesRes.data || []) as LembreteAlerta[];
      }
    })();

    // Novos lembretes compartilhados com todos os usuários
    const channel = supabase.channel(`lembretes-alertas-${crypto.randomUUID()}`);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lembretes_calendario" },
      (payload) => {
        const novo = payload.new as unknown as LembreteAlerta;
        lembretesRef.current = [
          ...lembretesRef.current.filter((l) => l.id !== novo.id),
          novo,
        ];
        if (novo.visibilidade === "todos" && novo.usuario_id !== meRef.current) {
          mostrar(novo, `Novo lembrete de ${nome(novo.usuario_id)}`);
          notificarNavegador(
            `Novo lembrete de ${nome(novo.usuario_id)}`,
            novo.titulo,
          );
        }
      },
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "lembretes_calendario" },
      (payload) => {
        const atual = payload.new as unknown as LembreteAlerta;
        lembretesRef.current = lembretesRef.current.map((l) =>
          l.id === atual.id ? atual : l,
        );
      },
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "lembretes_calendario" },
      (payload) => {
        const old = payload.old as { id: string };
        lembretesRef.current = lembretesRef.current.filter((l) => l.id !== old.id);
      },
    );

    channel.subscribe();

    // Verificação de horário — push na tela quando dá a hora do lembrete
    const timer = window.setInterval(() => {
      const agora = new Date();
      const hoje = hojeKey();
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
      let mudou = false;

      for (const l of lembretesRef.current) {
        if (l.data !== hoje || !l.hora) continue;
        if (disparados.current.has(l.id)) continue;
        const [h, m] = l.hora.split(":").map(Number);
        const minutosLembrete = (h || 0) * 60 + (m || 0);
        if (minutosAgora < minutosLembrete || minutosAgora > minutosLembrete + 5) continue;

        disparados.current.add(l.id);
        mudou = true;
        mostrar(l, "⏰ Lembrete agora");
        notificarNavegador("⏰ Lembrete", `${l.hora.slice(0, 5)} — ${l.titulo}`);
      }

      if (mudou) salvarDisparados(disparados.current);
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
