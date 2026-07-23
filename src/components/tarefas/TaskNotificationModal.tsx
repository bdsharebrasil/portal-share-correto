import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface UserOption {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  atribuido_para: string | null;
  criado_por: string | null;
  prioridade: string | null;
  prazo: string | null;
}

interface Notificacao {
  id: string;
  id_da_tarefa: string;
  user_id: string;
  mensagem: string;
  lido: boolean | null;
  criado_em: string | null;
  tarefa?: Tarefa;
  criador?: UserOption;
}

function userInitials(u: UserOption | undefined): string {
  if (!u) return "?";
  const name = u.full_name || u.display_name || u.email || "?";
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function userColor(id: string | null | undefined): string {
  if (!id) return "hsl(215 20% 55%)";
  const palette = [
    "hsl(192 70% 60%)",
    "hsl(45 100% 60%)",
    "hsl(217 91% 65%)",
    "hsl(142 60% 55%)",
    "hsl(280 70% 65%)",
    "hsl(20 90% 60%)",
    "hsl(330 70% 60%)",
  ];
  let h = 0;
  for (let i = 0; i < (id || "").length; i++)
    h = (h * 31 + (id || "").charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function Avatar({ user, size = 30 }: { user: UserOption | undefined; size?: number }) {
  const color = userColor(user?.id);
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0 shadow-sm"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.4,
      }}
    >
      {userInitials(user)}
    </div>
  );
}

export default function TaskNotificationModal({
  meId,
  users,
}: {
  meId: string | null;
  users: UserOption[];
}) {
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const userById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // Load unread notifications
  useEffect(() => {
    if (!meId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tarefas_notificacoes")
        .select("*")
        .eq("user_id", meId)
        .eq("lido", false)
        .order("criado_em", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar notificações:", error);
      } else {
        const enriched = await Promise.all(
          (data || []).map(async (notif) => {
            const tarefasRes = await supabase
              .from("tarefas")
              .select("*")
              .eq("id", notif.id_da_tarefa)
              .single();

            const tarefa = tarefasRes.data as unknown as Tarefa | null;
            const criador = tarefa?.criado_por
              ? userById.get(tarefa.criado_por)
              : undefined;

            return {
              ...notif,
              tarefa,
              criador,
            } as Notificacao;
          })
        );

        setNotifications(enriched);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [meId, userById]);

  // Realtime subscription
  useEffect(() => {
    if (!meId) return;

    const channel = supabase
      .channel("task-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tarefas_notificacoes",
          filter: `user_id=eq.${meId}`,
        },
        (payload) => {
          setNotifications((prev) => {
            const n = payload.new as any;
            if (prev.find((notif) => notif.id === n.id)) return prev;
            return [{ ...n, tarefa: undefined, criador: undefined }, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId]);

  const handleMarkAsRead = async (notifId: string) => {
    const { error } = await supabase
      .from("tarefas_notificacoes")
      .update({ lido: true, atualizado_em: new Date().toISOString() })
      .eq("id", notifId);

    if (error) {
      toast.error("Erro ao marcar como visualizado");
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notifId));

    const notif = notifications.find((n) => n.id === notifId);
    if (notif?.tarefa?.criado_por) {
      await supabase.from("tarefas_notificacoes").insert({
        id_da_tarefa: notif.id_da_tarefa,
        user_id: notif.tarefa.criado_por,
        mensagem: `${userById.get(meId || "")?.full_name || "Usuário"} visualizou a tarefa "${notif.tarefa.titulo}"`,
        lido: false,
      });
    }

    if (notifications.length === 1) {
      toast.success("Tarefa marcada como visualizada");
    }
  };

  const handleDismiss = async () => {
    if (currentIndex < notifications.length) {
      const current = notifications[currentIndex];
      await handleMarkAsRead(current.id);
      if (currentIndex < notifications.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  if (loading || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  if (!current) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      {/* 
        A mágica do visual "Apple" acontece nesta className do DialogContent:
        - bg-[#1c1c1e]/80 : fundo escuro muito parecido com os modais do iOS
        - backdrop-blur-xl : efeito de vidro borrado (glassmorphism)
        - border-white/10 : borda super fina e levemente translúcida
        - rounded-[32px] : curvas super acentuadas
        - [&>button]:hidden : oculta o 'X' padrão do componente Dialog do Shadcn para usar o nosso
      */}
      <DialogContent className="max-w-sm sm:max-w-md !bg-[#1c1c1e]/80 backdrop-blur-xl border-white/10 shadow-2xl !rounded-[32px] p-6 text-white [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>Notificação de nova tarefa atribuída</DialogDescription>
        </VisuallyHidden>
        <div className="space-y-6 relative">
          
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 shrink-0">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-white tracking-tight">
                Nova Tarefa
              </h3>
              <p className="text-sm text-white/50 font-medium">
                {currentIndex + 1} de {notifications.length} notificações
              </p>
            </div>
            <button
              onClick={() => {
                notifications.forEach((n) => {
                  void handleMarkAsRead(n.id);
                });
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all"
              title="Fechar todas"
            >
              <X size={16} />
            </button>
          </div>

          {/* Message Area */}
          <div className="mt-2">
            <div className="flex items-center gap-3 mb-3">
              <Avatar user={current.criador} size={26} />
              <p className="text-white/60 font-medium text-sm">
                <span className="text-white">{current.criador?.full_name || current.criador?.display_name || "Alguém"}</span> delegou a você:
              </p>
            </div>
            <h4 className="text-xl font-semibold text-white tracking-tight leading-tight">
              {current.tarefa?.titulo || "Tarefa sem título"}
            </h4>
            {current.tarefa?.descricao && (
              <p className="text-sm text-white/50 mt-2 line-clamp-3 leading-relaxed">
                {current.tarefa.descricao}
              </p>
            )}
          </div>

          {/* Details (Glass Panel) */}
          <div className="space-y-3 text-sm bg-white/5 border border-white/5 p-4 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-white/50">Prioridade</span>
              <span className="font-medium text-white bg-white/10 px-2.5 py-1 rounded-md text-xs">
                {current.tarefa?.prioridade
                  ? current.tarefa.prioridade.charAt(0).toUpperCase() +
                    current.tarefa.prioridade.slice(1)
                  : "—"}
              </span>
            </div>
            {current.tarefa?.prazo && (
              <div className="flex justify-between items-center">
                <span className="text-white/50">Prazo</span>
                <span className="font-medium text-white bg-white/10 px-2.5 py-1 rounded-md text-xs">
                  {new Date(current.tarefa.prazo).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {notifications.length > 1 && (
              <button
                onClick={() => void handleDismiss()}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all"
              >
                Pular
              </button>
            )}
            <button
              onClick={() => void handleMarkAsRead(current.id)}
              className="flex-[2] py-3.5 rounded-2xl bg-blue-500 text-white font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(59,130,246,0.25)]"
            >
              Ciente
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}