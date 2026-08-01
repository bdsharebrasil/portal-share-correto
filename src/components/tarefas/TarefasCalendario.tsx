import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, Clock3, Users2 } from "lucide-react";
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

const PRIORITY_TONE: Record<string, { dot: string; ring: string; text: string }> = {
  baixa: { dot: "bg-emerald-400", ring: "ring-emerald-400/25", text: "text-emerald-300" },
  media: { dot: "bg-amber-400", ring: "ring-amber-400/25", text: "text-amber-300" },
  alta: { dot: "bg-orange-400", ring: "ring-orange-400/25", text: "text-orange-300" },
  urgente: { dot: "bg-rose-400", ring: "ring-rose-400/25", text: "text-rose-300" },
};

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

export default function TarefasCalendario({
  myView,
  isManager,
}: {
  myView: boolean;
  isManager: boolean;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setMe(user?.id ?? null);

      const [tarefasRes, usersRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("id, titulo, descricao, status, prioridade, prazo, progresso, atribuido_para, criado_por")
          .order("prazo", { ascending: true }),
        supabase
          .from("user_profiles")
          .select("id, full_name, display_name, email, avatar_url")
          .order("full_name", { ascending: true }),
      ]);
      if (cancelled) return;
      if (!tarefasRes.error) setTarefas((tarefasRes.data || []) as Tarefa[]);
      if (!usersRes.error) setUsers((usersRes.data || []) as UserOption[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const userMap = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const visibleTasks = useMemo(() => {
    if (!isManager || !me) return tarefas;
    return tarefas.filter((t) => {
      const mine = t.criado_por === me || (t.atribuido_para || []).includes(me);
      return myView ? mine : !mine || (t.atribuido_para || []).length > 0;
    });
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

  const selectedTasks = tasksOn(selected);
  const monthLabel = format(cursor, "MMMM yyyy", { locale: ptBR });

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 p-5">
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
                      key={t.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md bg-muted/40 px-1.5 py-1 text-[11px] leading-tight text-foreground/80 truncate ring-1",
                        tone(t.prioridade).ring,
                      )}
                    >
                      <i className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone(t.prioridade).dot)} />
                      <span className="truncate">{t.titulo}</span>
                    </span>
                  ))}
                  {dayTasks.length > 2 && (
                    <span className="text-[11px] text-muted-foreground pl-1">
                      +{dayTasks.length - 2} mais
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Painel do dia */}
      <aside className="rounded-2xl border border-border/60 bg-card/40 p-5 flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agendadas</p>
          <h3 className="text-lg font-semibold text-foreground capitalize">
            {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando tarefas…</p>
        ) : selectedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
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
      </aside>
    </div>
  );
}
