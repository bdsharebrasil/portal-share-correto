import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock3,
  Users2,
  Plus,
  Pencil,
  Trash2,
  X,
  Lock,
  Globe2,
} from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  status: string;
  prioridade: string;
  prazo: string | null;
  progresso: number | null;
  atribuido_para: string[] | null;
  criado_por: string | null;
}

interface CategoriaCor {
  id: string;
  usuario_id: string;
  nome: string;
  cor: string;
}

interface Lembrete {
  id: string;
  usuario_id: string;
  titulo: string;
  descricao: string | null;
  data: string; // yyyy-MM-dd
  hora: string | null; // HH:mm:ss
  visibilidade: "privado" | "todos";
  cor_categoria_id: string | null;
}

const PRIORITY_TONE: Record<string, { dot: string; ring: string; text: string }> = {
  baixa: { dot: "bg-emerald-400", ring: "ring-emerald-400/25", text: "text-emerald-300" },
  media: { dot: "bg-amber-400", ring: "ring-amber-400/25", text: "text-amber-300" },
  alta: { dot: "bg-orange-400", ring: "ring-orange-400/25", text: "text-orange-300" },
  urgente: { dot: "bg-rose-400", ring: "ring-rose-400/25", text: "text-rose-300" },
};

const PALETA_PADRAO = [
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#f97316",
];

function tone(p: string | null | undefined) {
  return PRIORITY_TONE[(p || "media").toLowerCase()] ?? PRIORITY_TONE.media;
}

function initials(u?: UserOption) {
  const name = u?.full_name || u?.display_name || u?.email || "?";
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function AvatarBubble({ user, size = 24 }: { user?: UserOption; size?: number }) {
  const label = user?.full_name || user?.display_name || user?.email || "—";
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={label}
        title={label}
        className="rounded-full object-cover ring-2 ring-background shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      title={label}
      className="flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold ring-2 ring-background shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(user)}
    </div>
  );
}

function buildMonthGrid(reference: Date) {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dataKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function TarefasCalendario({
  myView,
  isManager,
}: {
  myView: boolean;
  isManager: boolean;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCor[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  // painel de criação/edição de lembrete
  const [modoForm, setModoForm] = useState<"fechado" | "criar" | "editar">("fechado");
  const [lembreteEmEdicao, setLembreteEmEdicao] = useState<Lembrete | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formData, setFormData] = useState("");
  const [formHora, setFormHora] = useState("");
  const [formVisibilidade, setFormVisibilidade] = useState<"privado" | "todos">("privado");

  const [formCorId, setFormCorId] = useState<string | null>(null);
  const [criandoCor, setCriandoCor] = useState(false);
  const [novaCorNome, setNovaCorNome] = useState("");
  const [novaCorHex, setNovaCorHex] = useState(PALETA_PADRAO[0]);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setMe(user?.id ?? null);

      const [tarefasRes, usersRes, lembretesRes, categoriasRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("id, titulo, descricao, status, prioridade, prazo, progresso, atribuido_para, criado_por")
          .order("prazo", { ascending: true }),
        supabase
          .from("user_profiles")
          .select("id, full_name, display_name, email, avatar_url")
          .order("full_name", { ascending: true }),
        supabase
          .from("lembretes_calendario")
          .select("id, usuario_id, titulo, descricao, data, hora, visibilidade, cor_categoria_id")
          .order("data", { ascending: true }),
        supabase
          .from("categorias_calendario")
          .select("id, usuario_id, nome, cor")
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (!tarefasRes.error) setTarefas((tarefasRes.data || []) as Tarefa[]);
      if (!usersRes.error) setUsers((usersRes.data || []) as UserOption[]);
      if (!lembretesRes.error) setLembretes((lembretesRes.data || []) as Lembrete[]);
      if (!categoriasRes.error) setCategorias((categoriasRes.data || []) as CategoriaCor[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // ao trocar o dia selecionado, fecha qualquer formulário aberto
    setModoForm("fechado");
    setLembreteEmEdicao(null);
    setCriandoCor(false);
  }, [selected]);

  const userMap = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const categoriaMap = useMemo(() => {
    const m = new Map<string, CategoriaCor>();
    categorias.forEach((c) => m.set(c.id, c));
    return m;
  }, [categorias]);

  const visibleTasks = useMemo(() => {
    if (!me) return [];
    // Cada usuário vê apenas o que criou ou o que lhe foi atribuído
    const mine = tarefas.filter(
      (t) => t.criado_por === me || (t.atribuido_para || []).includes(me),
    );
    if (!isManager) return mine;
    if (myView) {
      return mine.filter(
        (t) => t.criado_por === me && (t.atribuido_para || []).every((a) => a === me),
      );
    }
    return mine.filter(
      (t) => t.criado_por === me && (t.atribuido_para || []).some((a) => a !== me),
    );
  }, [tarefas, myView, isManager, me]);

  const withDate = useMemo(
    () => visibleTasks.filter((t) => !!t.prazo),
    [visibleTasks],
  );

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const tasksOn = (d: Date) =>
    withDate.filter((t) => {
      try {
        return isSameDay(parseISO(t.prazo as string), d);
      } catch {
        return false;
      }
    });

  const lembretesOn = (d: Date) => {
    const key = dataKey(d);
    return lembretes.filter((l) => l.data === key);
  };

  const corDoLembrete = (l: Lembrete) =>
    (l.cor_categoria_id && categoriaMap.get(l.cor_categoria_id)?.cor) || "#8892a6";

  const nomeCorDoLembrete = (l: Lembrete) =>
    (l.cor_categoria_id && categoriaMap.get(l.cor_categoria_id)?.nome) || "Sem categoria";

  const selectedTasks = tasksOn(selected);
  const selectedLembretes = lembretesOn(selected);
  const monthLabel = format(cursor, "MMMM yyyy", { locale: ptBR });

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  function abrirCriacao() {
    setLembreteEmEdicao(null);
    setFormTitulo("");
    setFormDescricao("");
    setFormData(dataKey(selected));
    setFormHora("");
    setFormVisibilidade("privado");
    setFormCorId(null);
    setCriandoCor(false);
    setModoForm("criar");
  }

  function abrirEdicao(l: Lembrete) {
    setLembreteEmEdicao(l);
    setFormTitulo(l.titulo);
    setFormDescricao(l.descricao || "");
    setFormData(l.data);
    setFormHora(l.hora ? l.hora.slice(0, 5) : "");
    setFormVisibilidade(l.visibilidade);
    setFormCorId(l.cor_categoria_id);
    setCriandoCor(false);
    setModoForm("editar");
  }

  function fecharForm() {
    setModoForm("fechado");
    setLembreteEmEdicao(null);
    setCriandoCor(false);
  }

  async function salvarLembrete() {
    if (!me || !formTitulo.trim() || salvando) return;
    setSalvando(true);
    const dataFinal = formData || dataKey(selected);
    const payload = {
      usuario_id: me,
      titulo: formTitulo.trim(),
      descricao: formDescricao.trim() || null,
      data: dataFinal,
      hora: formHora ? `${formHora}:00` : null,
      visibilidade: formVisibilidade,
      cor_categoria_id: formCorId,
    };

    if (modoForm === "editar" && lembreteEmEdicao) {
      const { data, error } = await supabase
        .from("lembretes_calendario")
        .update(payload)
        .eq("id", lembreteEmEdicao.id)
        .select("id, usuario_id, titulo, descricao, data, hora, visibilidade, cor_categoria_id")
        .single();
      if (!error && data) {
        setLembretes((prev) => prev.map((l) => (l.id === data.id ? (data as Lembrete) : l)));
      }
    } else {
      const { data, error } = await supabase
        .from("lembretes_calendario")
        .insert(payload)
        .select("id, usuario_id, titulo, descricao, data, hora, visibilidade, cor_categoria_id")
        .single();
      if (!error && data) {
        setLembretes((prev) => [...prev, data as Lembrete]);
      }
    }
    setSalvando(false);
    fecharForm();
    // segue o lembrete se a data foi alterada
    if (dataFinal !== dataKey(selected)) {
      const alvo = parseISO(`${dataFinal}T00:00:00`);
      setSelected(alvo);
      setCursor(alvo);
    }
  }


  async function excluirLembrete(id: string) {
    if (!window.confirm("Excluir este lembrete?")) return;
    setExcluindoId(id);
    const { error } = await supabase.from("lembretes_calendario").delete().eq("id", id);
    if (!error) {
      setLembretes((prev) => prev.filter((l) => l.id !== id));
      if (lembreteEmEdicao?.id === id) fecharForm();
    }
    setExcluindoId(null);
  }

  async function criarCategoria() {
    if (!me || !novaCorNome.trim()) return;
    const { data, error } = await supabase
      .from("categorias_calendario")
      .insert({ usuario_id: me, nome: novaCorNome.trim(), cor: novaCorHex })
      .select("id, usuario_id, nome, cor")
      .single();
    if (!error && data) {
      setCategorias((prev) => [...prev, data as CategoriaCor]);
      setFormCorId((data as CategoriaCor).id);
      setNovaCorNome("");
      setCriandoCor(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 p-5">
      {/* Calendário */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <header className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calendário</p>
            <h2 className="text-2xl font-semibold text-foreground capitalize">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              className="h-9 w-9 grid place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCursor(now);
                setSelected(now);
              }}
              className="h-9 px-4 rounded-full border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => shiftMonth(1)}
              className="h-9 w-9 grid place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const outside = d.getMonth() !== cursor.getMonth();
            const isToday = isSameDay(d, new Date());
            const isSelected = isSameDay(d, selected);
            const dayTasks = tasksOn(d);
            const dayLembretes = lembretesOn(d);
            const totalItems = dayTasks.length + dayLembretes.length;
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "group relative flex flex-col items-start gap-1 rounded-xl border p-2 min-h-[86px] text-left transition-all",
                  outside ? "border-transparent opacity-40" : "border-border/50 hover:border-border",
                  isSelected && "border-primary/60 bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-1 w-full">
                  {dayTasks.slice(0, 2).map((t) => (
                    <span
                      key={`t-${t.id}`}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md bg-muted/40 px-1.5 py-1 text-[11px] leading-tight text-foreground/80 truncate ring-1",
                        tone(t.prioridade).ring,
                      )}
                    >
                      <i className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone(t.prioridade).dot)} />
                      <span className="truncate">{t.titulo}</span>
                    </span>
                  ))}
                  {dayLembretes.slice(0, Math.max(0, 2 - dayTasks.length)).map((l) => (
                    <span
                      key={`l-${l.id}`}
                      className="flex items-center gap-1.5 rounded-md bg-muted/40 px-1.5 py-1 text-[11px] leading-tight text-foreground/80 truncate ring-1 ring-border/40"
                      title={nomeCorDoLembrete(l)}
                    >
                      <i
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: corDoLembrete(l) }}
                      />
                      <span className="truncate">{l.titulo}</span>
                    </span>
                  ))}
                  {totalItems > 2 && (
                    <span className="text-[11px] text-muted-foreground pl-1">
                      +{totalItems - 2} mais
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Painel do dia */}
      <aside className="rounded-2xl border border-border/60 bg-card/40 p-5 flex flex-col gap-4 max-h-[calc(100vh-2.5rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agenda</p>
            <h3 className="text-lg font-semibold text-foreground capitalize">
              {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>
          {modoForm === "fechado" && (
            <button
              onClick={abrirCriacao}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo lembrete
            </button>
          )}
        </div>

        {/* Formulário de criação/edição de lembrete */}
        {modoForm !== "fechado" && (
          <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {modoForm === "editar" ? "Editar lembrete" : "Novo lembrete"}
              </p>
              <button
                onClick={fecharForm}
                className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Título"
              className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />

            <textarea
              value={formDescricao}
              onChange={(e) => setFormDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />

            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={formData}
                onChange={(e) => setFormData(e.target.value)}
                className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-[11px] text-muted-foreground">dia do lembrete</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="time"
                value={formHora}
                onChange={(e) => setFormHora(e.target.value)}
                className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-[11px] text-muted-foreground">horário opcional</span>
            </div>


            {/* Visibilidade */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Visibilidade</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFormVisibilidade("privado")}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs transition-colors",
                    formVisibilidade === "privado"
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Lock className="h-3 w-3" />
                  Somente eu
                </button>
                <button
                  onClick={() => setFormVisibilidade("todos")}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs transition-colors",
                    formVisibilidade === "todos"
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Globe2 className="h-3 w-3" />
                  Todos os usuários
                </button>
              </div>
            </div>

            {/* Categoria de cor */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cor / significado</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFormCorId(null)}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] transition-colors",
                    formCorId === null
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <i className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  Sem cor
                </button>
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFormCorId(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] transition-colors",
                      formCorId === c.id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <i className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                    {c.nome}
                  </button>
                ))}
                <button
                  onClick={() => setCriandoCor((v) => !v)}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Nova cor
                </button>
              </div>

              {criandoCor && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PALETA_PADRAO.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setNovaCorHex(hex)}
                        className={cn(
                          "h-6 w-6 rounded-full ring-2 transition-all",
                          novaCorHex === hex ? "ring-foreground scale-110" : "ring-transparent",
                        )}
                        style={{ backgroundColor: hex }}
                        aria-label={hex}
                      />
                    ))}
                    <input
                      type="color"
                      value={novaCorHex}
                      onChange={(e) => setNovaCorHex(e.target.value)}
                      className="h-6 w-6 rounded-full border-0 bg-transparent cursor-pointer"
                      aria-label="Cor personalizada"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={novaCorNome}
                      onChange={(e) => setNovaCorNome(e.target.value)}
                      placeholder="Significado (ex: Pessoal, Urgente...)"
                      className="flex-1 h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={criarCategoria}
                      disabled={!novaCorNome.trim()}
                      className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={salvarLembrete}
                disabled={!formTitulo.trim() || salvando}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {salvando ? "Salvando…" : modoForm === "editar" ? "Salvar alterações" : "Criar lembrete"}
              </button>
              <button
                onClick={fecharForm}
                className="h-9 px-4 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de lembretes do dia */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Lembretes {selectedLembretes.length > 0 && `(${selectedLembretes.length})`}
          </p>
          {selectedLembretes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum lembrete para este dia.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedLembretes.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <i
                    className="h-2.5 w-2.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: corDoLembrete(l) }}
                    title={nomeCorDoLembrete(l)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{l.titulo}</p>
                      {l.visibilidade === "todos" ? (
                        <Globe2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {l.hora && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock3 className="h-3 w-3" />
                        {l.hora.slice(0, 5)}
                      </p>
                    )}
                    {l.usuario_id !== me && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <AvatarBubble user={userMap.get(l.usuario_id)} size={18} />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {userMap.get(l.usuario_id)?.full_name ||
                            userMap.get(l.usuario_id)?.display_name ||
                            "Outro usuário"}
                        </span>
                      </div>
                    )}
                    {l.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{l.descricao}</p>
                    )}

                  </div>
                  {l.usuario_id === me && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => abrirEdicao(l)}
                        className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        aria-label="Editar lembrete"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => excluirLembrete(l.id)}
                        disabled={excluindoId === l.id}
                        className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 disabled:opacity-40"
                        aria-label="Excluir lembrete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarefas agendadas (somente leitura, vindas do quadro de tarefas) */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Tarefas {selectedTasks.length > 0 && `(${selectedTasks.length})`}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando tarefas…</p>
          ) : selectedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CalendarDays className="h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa para este dia.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedTasks.map((t) => {
                const assignees = (t.atribuido_para || []).map((id) => userMap.get(id));
                const progress = Math.max(0, Math.min(100, Number(t.progresso) || 0));
                return (
                  <article
                    key={t.id}
                    className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">{t.titulo}</h4>
                        {t.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.descricao}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted/50",
                          tone(t.prioridade).text,
                        )}
                      >
                        {(t.prioridade || "média").toString()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {t.status?.replace(/-/g, " ") || "a fazer"}
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {assignees.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex -space-x-2">
                          {assignees.slice(0, 4).map((u, i) => (
                            <AvatarBubble key={u?.id ?? i} user={u} size={22} />
                          ))}
                        </div>
                        {assignees.length > 4 && (
                          <span className="text-[11px] text-muted-foreground">+{assignees.length - 4}</span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
