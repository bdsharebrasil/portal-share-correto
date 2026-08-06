import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import {
  Plus,
  MessageSquare,
  Trash2,
  Send,
  AlertTriangle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  MoreHorizontal,
  Calendar,
  Search,
  Inbox,
} from "lucide-react";
import { getEquipe, equipesDoUsuario, type Equipe } from "@/lib/tarefas-teams";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check as CheckIcon, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ============================================================
// NOTA DE MIGRAÇÃO (rodar uma vez no Supabase antes de usar este arquivo):
//
//   alter table public.tarefas
//     add column if not exists status_por_usuario jsonb not null default '{}'::jsonb;
//
// Depois disso, rode `supabase gen types typescript` de novo pra atualizar
// o Database type — esse arquivo já lida com o campo via cast local
// (StatusMap) enquanto os types gerados não são atualizados.
// ============================================================

const COLUMNS = [
  { id: "a-fazer", label: "A Fazer", dot: "bg-zinc-400" },
  { id: "em-andamento", label: "Em Andamento", dot: "bg-amber-400" },
  { id: "revisao", label: "Revisão", dot: "bg-blue-400" },
  { id: "concluido", label: "Concluído", dot: "bg-emerald-400" },
] as const;

const PRIORITY = {
  baixa: { label: "Baixa", icon: SignalLow, color: "text-emerald-400" },
  media: { label: "Média", icon: SignalMedium, color: "text-amber-400" },
  alta: { label: "Alta", icon: SignalHigh, color: "text-orange-400" },
  urgente: { label: "Urgente", icon: AlertTriangle, color: "text-rose-400" },
} as const;

type Priority = keyof typeof PRIORITY;
type Status = (typeof COLUMNS)[number]["id"];
type StatusMap = Record<string, string>;

// Map de status legacy (banco) -> coluna kanban
function statusToColumn(s: string | null | undefined): Status {
  if (!s) return "a-fazer";
  const normalized = s.trim().toLowerCase().replace(/_/g, "-");
  if (COLUMNS.find((c) => c.id === normalized)) return normalized as Status;
  switch (normalized) {
    case "aberto":
    case "pendente":
    case "a-fazer":
      return "a-fazer";
    case "em andamento":
    case "em-andamento":
      return "em-andamento";
    case "em progresso":
    case "em-progresso":
    case "em_progresso":
      return "em-andamento";
    case "revisao":
    case "revisão":
      return "revisao";
    case "concluida":
    case "concluído":
    case "concluido":
      return "concluido";
    default:
      return "a-fazer";
  }
}

/**
 * Status "efetivo" de uma tarefa para uma pessoa específica.
 *
 * Antes, todas as pessoas atribuídas a uma tarefa compartilhavam a mesma
 * coluna `status` — então quando uma pessoa movia o card, o card "andava"
 * para todo mundo, como se todos tivessem concluído junto.
 *
 * Agora cada responsável tem sua própria entrada em `status_por_usuario`
 * (um JSON { userId: status }). Se a pessoa ainda não tem entrada própria
 * (tarefas antigas, ou tarefa recém-criada), cai no `status` legado como
 * ponto de partida — mas a partir da primeira mudança, o andamento dela
 * passa a ser só dela.
 */
function getEffectiveStatus(task: Tarefa, viewerId: string | null): string {
  if (viewerId) {
    const own = task.status_por_usuario?.[viewerId];
    if (own) return own;
  }
  return task.status;
}

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
  status_por_usuario: StatusMap | null;
  prioridade: string;
  criado_por: string | null;
  prazo: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  publico: boolean | null;
  origem: string;
  equipes: string[];
  progresso: number;
  atribuido_para: string[];
}

interface Comentario {
  id: string;
  tarefa_id: string;
  usuario_id: string;
  comentario: string;
  criado_em: string | null;
}

// ============================================================
// Helpers UI
// ============================================================
function userInitials(u: UserOption | undefined): string {
  if (!u) return "?";
  const name = u.full_name || u.display_name || u.email || "?";
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}
function userName(u: UserOption | undefined): string {
  if (!u) return "—";
  return u.full_name || u.display_name || u.email || "—";
}

function Avatar({
  user,
  size = 24,
  ring = true,
}: {
  user: UserOption | undefined;
  size?: number;
  ring?: boolean;
}) {
  const label = userName(user);
  const ringClass = ring ? "ring-2 ring-background" : "";
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={label}
        title={label}
        className={`rounded-full object-cover shrink-0 ${ringClass}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      title={label}
      className={`flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold shrink-0 ${ringClass}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {userInitials(user)}
    </div>
  );
}

/** Pilha de avatares sobrepostos, com "+N" para o excedente. */
function AvatarStack({
  users,
  max = 3,
  size = 22,
}: {
  users: (UserOption | undefined)[];
  max?: number;
  size?: number;
}) {
  const visible = users.filter(Boolean).slice(0, max) as UserOption[];
  const overflow = users.filter(Boolean).length - visible.length;
  if (visible.length === 0) return null;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background font-semibold shrink-0"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function TeamBadges({ equipes }: { equipes: string[] | null | undefined }) {
  if (!equipes || equipes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {equipes.map((id) => {
        const e = getEquipe(id);
        if (!e) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: e.color }}
            />
            {e.short}
          </span>
        );
      })}
    </div>
  );
}

/** Indicador de progresso compacto, em anel. */
function CircularProgress({ value, size = 15 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = size / 2 - 1.5;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  const colorClass = v >= 100 ? "text-emerald-400" : v > 0 ? "text-primary" : "text-muted-foreground/40";
  return (
    <div className="flex items-center gap-1" title={`${v}% concluído`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} className="text-muted-foreground/20" stroke="currentColor" strokeWidth={2} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={colorClass}
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[11px] font-medium text-muted-foreground">{v}%</span>
    </div>
  );
}

function PriorityIcon({ priority }: { priority: string | null | undefined }) {
  const key = (priority as Priority) in PRIORITY ? (priority as Priority) : "media";
  const p = PRIORITY[key];
  const Icon = p.icon;
  return <Icon size={14} className={`${p.color} shrink-0`} strokeWidth={2.25} />;
}

/**
 * Pequena legenda de bolinhas mostrando em que coluna cada responsável está,
 * pra dar visibilidade do andamento coletivo sem misturar o status de
 * ninguém — cada bolinha reflete o `status_por_usuario` daquela pessoa.
 */
function StatusLegend({
  task,
  users,
}: {
  task: Tarefa;
  users: (UserOption | undefined)[];
}) {
  const assignees = users.filter(Boolean) as UserOption[];
  if (assignees.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {assignees.map((u) => {
        const col = statusToColumn(getEffectiveStatus(task, u.id));
        const dot = COLUMNS.find((c) => c.id === col)?.dot || "bg-zinc-400";
        return (
          <span
            key={u.id}
            title={`${userName(u)}: ${COLUMNS.find((c) => c.id === col)?.label}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted/40 pl-0.5 pr-1.5 py-0.5"
          >
            <Avatar user={u} size={14} ring={false} />
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          </span>
        );
      })}
    </div>
  );
}

/**
 * Combobox de múltipla seleção: busca por nome e marca vários usuários
 * com checkbox, sem fechar o popover a cada clique.
 */
function MultiUserCombobox({
  items,
  value,
  onChange,
  placeholder = "Selecionar responsáveis...",
  searchPlaceholder = "Buscar usuário...",
  emptyMessage = "Nenhum usuário encontrado.",
}: {
  items: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const selectedLabels = items
    .filter((item) => value.includes(item.id))
    .map((item) => item.label);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-10 px-3 bg-background hover:bg-accent/50 transition-colors",
            "border-border/60 shadow-sm rounded-lg font-normal",
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            ) : selectedLabels.length <= 2 ? (
              <span className="truncate text-sm">{selectedLabels.join(", ")}</span>
            ) : (
              <span className="truncate text-sm">
                {selectedLabels[0]} +{selectedLabels.length - 1}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl shadow-lg border-border/50 z-[10000]" align="start" side="bottom">
        <Command className="overflow-hidden rounded-xl" shouldFilter={false}>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[220px] overflow-y-auto p-1">
            {filteredItems.length === 0 && (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
            )}
            <CommandGroup>
              {filteredItems.map((item) => {
                const checked = value.includes(item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => toggle(item.id)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer aria-selected:bg-primary/10 transition-colors"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        checked ? "bg-primary border-primary" : "border-border",
                      )}
                    >
                      {checked && <CheckIcon className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    <span className={cn("truncate", checked ? "font-semibold" : "font-medium text-foreground/80")}>
                      {item.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selectedLabels.length > 0 && (
            <div className="border-t border-border/50 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {selectedLabels.length} selecionado(s)
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Componente principal
// ============================================================
interface Props {
  /** Se true, mostra apenas as tarefas atribuídas/criadas pelo usuário (visão "minhas"). */
  myView?: boolean;
  /** Se true, o usuário é admin ou gestor_master e tem duas visualizações. */
  isManager?: boolean;
  title?: string;
  subtitle?: string;
}

export default function TarefasKanban({
  myView = false,
  title,
  subtitle,
}: Props) {
  const { isAdmin, isGestorMaster, userRoles, isLoading: roleLoading } = useUserRole();
  const isManager = isAdmin || isGestorMaster;
  const myTeams = useMemo(() => equipesDoUsuario(userRoles || []), [userRoles]);

  const [me, setMe] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<Status>("a-fazer");
  const [detailTask, setDetailTask] = useState<Tarefa | null>(null);

  // Menu "···" de cada coluna: qual está aberta + modo de ordenação por coluna
  const [openColMenu, setOpenColMenu] = useState<Status | null>(null);
  const [colSort, setColSort] = useState<Record<Status, "padrao" | "prioridade" | "prazo">>({
    "a-fazer": "padrao",
    "em-andamento": "padrao",
    "revisao": "padrao",
    "concluido": "padrao",
  });

  // -------------------------------------------------- Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setMe(user.id);

      const [tarefasRes, usersRes] = await Promise.all([
        supabase
          .from("tarefas")
          .select("*")
          .or("origem.eq.kanban,origem.is.null")
          .order("criado_em", { ascending: false }),
        supabase
          .from("user_profiles")
          .select("id, full_name, display_name, email, avatar_url")
          .order("full_name", { ascending: true }),
      ]);
      if (cancelled) return;

      if (tarefasRes.error) {
        console.error(tarefasRes.error);
        toast.error("Erro ao carregar tarefas");
      } else {
        setTarefas((tarefasRes.data || []) as unknown as Tarefa[]);
      }
      if (!usersRes.error) {
        setUsers((usersRes.data || []) as UserOption[]);
      }
      // Contagem de comentários por tarefa
      const { data: commentsData } = await supabase
        .from("tarefas_comentarios")
        .select("tarefa_id");
      if (!cancelled && commentsData) {
        const counts: Record<string, number> = {};
        for (const c of commentsData as { tarefa_id: string }[]) {
          counts[c.tarefa_id] = (counts[c.tarefa_id] || 0) + 1;
        }
        setCommentCounts(counts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: contagem de comentários
  useEffect(() => {
    const channel = supabase
      .channel("tarefas-comment-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas_comentarios" },
        (payload) => {
          setCommentCounts((prev) => {
            const next = { ...prev };
            if (payload.eventType === "INSERT") {
              const n = payload.new as { tarefa_id: string };
              next[n.tarefa_id] = (next[n.tarefa_id] || 0) + 1;
            } else if (payload.eventType === "DELETE") {
              const o = payload.old as { tarefa_id: string };
              next[o.tarefa_id] = Math.max(0, (next[o.tarefa_id] || 0) - 1);
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -------------------------------------------------- Realtime
  useEffect(() => {
    const channel = supabase
      .channel("tarefas-kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        (payload) => {
          setTarefas((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as unknown as Tarefa;
              if (n.origem === "lista") return prev;
              if (prev.find((t) => t.id === n.id)) return prev;
              return [n, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as unknown as Tarefa;
              if (n.origem === "lista") return prev;
              return prev.map((t) => (t.id === n.id ? n : t));
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as unknown as Tarefa;
              return prev.filter((t) => t.id !== o.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const userById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // -------------------------------------------------- Filtragem
  // Cada usuário vê somente as tarefas que criou ou que lhe foram atribuídas.
  const visibleTasks = useMemo(() => {
    if (!me) return [];
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
  }, [tarefas, me, myView, isManager]);


  const PRIORITY_ORDER: Record<Priority, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

  const getColTasks = (colId: Status) => {
    const list = visibleTasks.filter((t) => statusToColumn(getEffectiveStatus(t, me)) === colId);
    const mode = colSort[colId];
    if (mode === "prioridade") {
      return [...list].sort(
        (a, b) =>
          (PRIORITY_ORDER[(a.prioridade as Priority) || "media"] ?? 2) -
          (PRIORITY_ORDER[(b.prioridade as Priority) || "media"] ?? 2),
      );
    }
    if (mode === "prazo") {
      return [...list].sort((a, b) => {
        if (!a.prazo && !b.prazo) return 0;
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      });
    }
    return list;
  };

  // -------------------------------------------------- Mutations

  /**
   * Quem pode usar a troca rápida (drag-and-drop / seletor no card).
   * A troca rápida sempre reflete o status individual de quem está
   * manuseando o board — então só faz sentido diretamente quando:
   *  - a pessoa logada é uma das responsáveis (mexe no próprio status), ou
   *  - a tarefa tem um único responsável e quem mexe é o criador/gestor
   *    (não há ambiguidade sobre de quem é o status).
   * Tarefas com vários responsáveis, onde eu não sou um deles, só dá pra
   * administrar pelo detalhe da tarefa (status por pessoa).
   */
  const canChangeStatus = (task: Tarefa): boolean => {
    const assignees = task.atribuido_para || [];
    if (assignees.includes(me || "")) return true;
    if (assignees.length <= 1) return isManager || task.criado_por === me;
    return false;
  };

  const handleStatusChange = async (id: string, newStatus: Status, targetUserId?: string) => {
    const task = tarefas.find((t) => t.id === id);
    if (!task) return;

    if (!canChangeStatus(task)) {
      toast.error("Você não tem permissão para alterar o status desta tarefa");
      return;
    }

    const assignees = task.atribuido_para || [];
    const forUser = targetUserId || (assignees.includes(me || "") ? me : assignees[0]) || me;
    if (!forUser) return;

    const mergedMap: StatusMap = { ...(task.status_por_usuario || {}), [forUser]: newStatus };
    const syncLegacy = assignees.length <= 1;

    const previous = tarefas;
    setTarefas((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status_por_usuario: mergedMap, status: syncLegacy ? newStatus : t.status }
          : t,
      ),
    );

    const updatePayload: Record<string, unknown> = {
      status_por_usuario: mergedMap,
      atualizado_em: new Date().toISOString(),
    };
    if (syncLegacy) updatePayload.status = newStatus;

    const { error } = await supabase
      .from("tarefas")
      .update(updatePayload as Database["public"]["Tables"]["tarefas"]["Update"])
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
      setTarefas(previous);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const previous = tarefas;
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) {
      toast.error("Sem permissão para excluir");
      setTarefas(previous);
    } else {
      toast.success("Tarefa excluída");
    }
  };

  const handleClearCompleted = async () => {
    const completed = getColTasks("concluido").filter(
      (t) => t.criado_por === me || (isManager && t.publico),
    );
    if (completed.length === 0) {
      toast.info("Nenhuma tarefa concluída para limpar");
      return;
    }
    if (!confirm(`Excluir ${completed.length} tarefa(s) concluída(s)?`)) return;

    const ids = completed.map((t) => t.id);
    const previous = tarefas;
    setTarefas((prev) => prev.filter((t) => !ids.includes(t.id)));
    const { error } = await supabase.from("tarefas").delete().in("id", ids);
    if (error) {
      toast.error("Erro ao limpar tarefas concluídas");
      setTarefas(previous);
    } else {
      toast.success("Tarefas concluídas removidas");
    }
  };

  const handleDrop = (colId: Status) => {
    if (!dragId) return;
    void handleStatusChange(dragId, colId);
    setDragId(null);
  };

  const handleCreate = async (form: {
    titulo: string;
    descricao: string;
    atribuido_para: string[];
    prazo: string;
    prioridade: Priority;
    status: Status;
    publico: boolean;
    equipes: string[];
    progresso: number;
  }) => {
    if (!me) return;
    const assignees = form.atribuido_para.length > 0 ? form.atribuido_para : [me];
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      atribuido_para: assignees,
      criado_por: me,
      prioridade: form.prioridade,
      status: form.status,
      status_por_usuario: {},
      prazo: form.prazo || null,
      publico: form.publico || (form.equipes && form.equipes.length > 0),
      origem: "kanban",
      equipes: form.equipes || [],
      progresso: Math.max(0, Math.min(100, form.progresso || 0)),
    } as unknown as Database["public"]["Tables"]["tarefas"]["Insert"];
    const { data, error } = await supabase.from("tarefas").insert(payload).select().single();
    if (error) {
      console.error(error);
      toast.error("Erro ao criar tarefa");
      return;
    }

    if (data) {
      const nomeCriador = users.find((u) => u.id === me)?.full_name || me;
      const outrosResponsaveis = assignees.filter((id) => id !== me);
      await Promise.all(
        outrosResponsaveis.map((userId) =>
          supabase.from("tarefas_notificacoes").insert({
            id_da_tarefa: data.id,
            user_id: userId,
            mensagem: `${nomeCriador} delegou uma nova tarefa: "${form.titulo}"`,
            lido: false,
          }),
        ),
      );
    }

    toast.success("Tarefa criada");
    setCreateOpen(false);
  };

  // -------------------------------------------------- Stats
  const stats = useMemo(() => {
    return {
      total: visibleTasks.length,
      urgente: visibleTasks.filter((t) => t.prioridade === "urgente").length,
      concluido: visibleTasks.filter(
        (t) => statusToColumn(getEffectiveStatus(t, me)) === "concluido",
      ).length,
    };
  }, [visibleTasks, me]);

  if (loading || roleLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Carregando tarefas...
      </div>
    );
  }

  const canCreateForOthers = isManager;
  const headingTitle =
    title || (myView ? "Minhas Tarefas" : "Painel de Tarefas");
  const headingSubtitle =
    subtitle ||
    (myView
      ? "Tarefas atribuídas a você ou criadas por você"
      : isManager
        ? "Gerencie e acompanhe todas as tarefas da equipe"
        : "Suas tarefas");

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 text-foreground font-sans overflow-hidden flex flex-col h-full">
      {/* Sub-header */}
      <div className="border-b border-border/60 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-5 items-center flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Kanban</p>
            <h1 className="text-2xl font-semibold text-foreground">
              {headingTitle}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{headingSubtitle}</p>
          </div>

          <div className="hidden md:flex gap-1.5">
            {[
              { label: "Total", val: stats.total },
              { label: "Urgentes", val: stats.urgente },
              { label: "Concluídas", val: stats.concluido },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/60"
              >
                <span className="text-sm font-semibold text-foreground">{s.val}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setDefaultStatus("a-fazer");
            setCreateOpen(true);
          }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Nova Tarefa
        </button>
      </div>

      {/* Board Kanban */}
      <div className="flex gap-4 p-5 overflow-x-auto min-h-[500px]">
        {COLUMNS.map((col) => {
          const colTasks = getColTasks(col.id);
          const isOver = dragOver === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.id); setDragOver(null); }}
              onDragLeave={() => setDragOver(null)}
              className={`w-[280px] shrink-0 rounded-xl p-2.5 flex flex-col transition-colors duration-150 border ${
                isOver ? "bg-primary/10 border-primary/60" : "bg-background/30 border-border/40"
              }`}
            >
              {/* Header da Coluna */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                  <span className="font-medium text-[13px] text-foreground">{col.label}</span>
                  <span className="text-[11px] text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="relative flex items-center gap-0.5">
                  <button
                    onClick={() => { setDefaultStatus(col.id); setCreateOpen(true); }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => setOpenColMenu((prev) => (prev === col.id ? null : col.id))}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      openColMenu === col.id
                        ? "bg-muted/70 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {openColMenu === col.id && (
                    <>
                      {/* Camada invisível pra fechar o menu ao clicar fora */}
                      <div className="fixed inset-0 z-40" onClick={() => setOpenColMenu(null)} />
                      <div className="absolute right-0 top-7 z-50 w-48 rounded-xl border border-border/60 bg-card py-1 shadow-lg">
                        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Ordenar por
                        </div>
                        {[
                          { key: "padrao" as const, label: "Padrão (mais recente)" },
                          { key: "prioridade" as const, label: "Prioridade" },
                          { key: "prazo" as const, label: "Prazo" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setColSort((prev) => ({ ...prev, [col.id]: opt.key }));
                              setOpenColMenu(null);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-muted/40 ${
                              colSort[col.id] === opt.key ? "text-foreground font-medium" : "text-muted-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {col.id === "concluido" && (
                          <>
                            <div className="my-1 border-t border-border/60" />
                            <button
                              onClick={() => {
                                setOpenColMenu(null);
                                void handleClearCompleted();
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              Limpar concluídas
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Lista de Tarefas */}
              <div className="flex flex-col gap-2 flex-1">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-xl border border-dashed border-border/50 text-center">
                    <Inbox className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground">Nenhuma tarefa</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const assignedUsers = (task.atribuido_para || []).map((id) => userById.get(id));
                    const canDelete = task.criado_por === me || (isManager && task.publico);
                    const isDragging = dragId === task.id;
                    const draggable = canChangeStatus(task);

                    return (
                      <div
                        key={task.id}
                        draggable={draggable}
                        onDragStart={(e) => { if (!draggable) { e.preventDefault(); return; } setDragId(task.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setDetailTask(task)}
                        className={`group relative rounded-xl border border-border/60 bg-background/40 p-4 transition-colors duration-150 ${
                          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                        } ${isDragging ? "opacity-40" : "hover:border-border"}`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
                            {task.titulo}
                          </h3>
                          <PriorityIcon priority={task.prioridade} />
                        </div>

                        {task.descricao && (
                          <p className="text-[11.5px] text-muted-foreground leading-snug line-clamp-2 mb-2">
                            {task.descricao}
                          </p>
                        )}

                        {(task.equipes && task.equipes.length > 0) && (
                          <div className="mb-2">
                            <TeamBadges equipes={task.equipes} />
                          </div>
                        )}

                        {assignedUsers.length > 1 && (
                          <div className="mb-2">
                            <StatusLegend task={task} users={assignedUsers} />
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2.5 text-muted-foreground">
                            {task.prazo && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Calendar size={11} />
                                {new Date(task.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[11px]" title={`${commentCounts[task.id] || 0} comentário(s)`}>
                              <MessageSquare size={11} />
                              {commentCounts[task.id] || 0}
                            </div>
                            <CircularProgress value={task.progresso ?? 0} />
                          </div>

                          <AvatarStack users={assignedUsers} size={20} />
                        </div>

                        {/* Ações — só aparecem no hover, discretas */}
                        <div
                          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 border border-border/60 backdrop-blur-sm rounded-md p-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {draggable && (
                            <select
                              value={statusToColumn(getEffectiveStatus(task, me))}
                              onChange={(e) => void handleStatusChange(task.id, e.target.value as Status)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] bg-background border border-border rounded px-1 py-0.5 text-foreground cursor-pointer hover:bg-muted/40 transition-colors"
                            >
                              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleDelete(task.id); }}
                              className="p-1 text-muted-foreground hover:text-rose-400 rounded transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de criação */}
      <CreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        defaultStatus={defaultStatus}
        users={users}
        canAssignOthers={canCreateForOthers}
        myView={myView}
        meId={me}
      />

      {/* Modal de detalhes / comentários */}
      <DetailDialog
        task={detailTask}
        onClose={() => setDetailTask(null)}
        users={users}
        meId={me}
        canManage={isManager}
      />
    </div>
  );
}

// ============================================================
// CreateModal
// ============================================================
function CreateModal({
  open,
  onClose,
  onSave,
  defaultStatus,
  users,
  canAssignOthers,
  myView,
  meId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: {
    titulo: string;
    descricao: string;
    atribuido_para: string[];
    prazo: string;
    prioridade: Priority;
    status: Status;
    publico: boolean;
    equipes: string[];
    progresso: number;
  }) => Promise<void>;
  defaultStatus: Status;
  users: UserOption[];
  canAssignOthers: boolean;
  myView: boolean;
  meId: string | null;
}) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    atribuido_para: meId ? [meId] : ([] as string[]),
    prazo: "",
    prioridade: "media" as Priority,
    status: defaultStatus,
    publico: canAssignOthers,
    equipes: [] as string[],
    progresso: 0,
  });

  useEffect(() => {
    if (open) {
      setForm({
        titulo: "",
        descricao: "",
        atribuido_para: meId ? [meId] : [],
        prazo: "",
        prioridade: "media",
        status: defaultStatus,
        publico: canAssignOthers,
        equipes: [],
        progresso: 0,
      });
    }
  }, [open, defaultStatus, meId, canAssignOthers]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Descreva a tarefa..."
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Detalhes (opcional)"
              rows={2}
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {canAssignOthers && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Atribuir para</label>
              <div className="mt-1">
                <MultiUserCombobox
                  items={[
                    { id: meId || "", label: "Eu mesmo" },
                    ...users
                      .filter((u) => u.id !== meId)
                      .map((u) => ({ id: u.id, label: userName(u) })),
                  ]}
                  value={form.atribuido_para}
                  onChange={(ids) => setForm((p) => ({ ...p, atribuido_para: ids }))}
                  placeholder="Selecionar responsáveis..."
                  searchPlaceholder="Buscar usuário..."
                  emptyMessage="Nenhum usuário encontrado."
                />
              </div>
              {form.atribuido_para.length > 1 && (
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  Mais de um responsável: cada um vai ter seu próprio andamento no board.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <div className="flex gap-1.5 mt-1">
              {(Object.keys(PRIORITY) as Priority[]).map((key) => {
                const p = PRIORITY[key];
                const Icon = p.icon;
                const active = form.prioridade === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, prioridade: key }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                      active
                        ? "bg-muted/50 border-border text-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Icon size={12} className={p.color} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prazo</label>
              <input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm((p) => ({ ...p, prazo: e.target.value }))}
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Coluna</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Status }))}
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!canAssignOthers && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.publico}
                onChange={(e) => setForm((p) => ({ ...p, publico: e.target.checked }))}
              />
              Tornar visível para administradores
            </label>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Progresso</label>
              <span className="text-xs font-medium text-foreground">{form.progresso}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progresso}
              onChange={(e) => setForm((p) => ({ ...p, progresso: Number(e.target.value) }))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.titulo.trim()) {
                toast.error("Informe o título");
                return;
              }
              void onSave(form);
            }}
          >
            Criar Tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// StatusPorPessoa: controle de status individual por responsável,
// usado no detalhe da tarefa quando há mais de um assignee.
// ============================================================
function StatusPorPessoa({
  task,
  users,
  meId,
  canManage,
  onChange,
}: {
  task: Tarefa;
  users: UserOption[];
  meId: string | null;
  canManage: boolean;
  onChange: (userId: string, status: Status) => void;
}) {
  const userById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const assignees = task.atribuido_para || [];
  if (assignees.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {assignees.map((uid) => {
        const u = userById.get(uid);
        const currentCol = statusToColumn(getEffectiveStatus(task, uid));
        const editable = uid === meId || canManage || task.criado_por === meId;
        return (
          <div key={uid} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar user={u} size={20} ring={false} />
              <span className="text-xs font-medium text-foreground truncate">{userName(u)}</span>
            </div>
            <select
              value={currentCol}
              disabled={!editable}
              onChange={(e) => onChange(uid, e.target.value as Status)}
              className="text-[11px] bg-background border border-border rounded px-1.5 py-1 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DetailDialog: comentários + status
// ============================================================
function DetailDialog({
  task,
  onClose,
  users,
  meId,
  canManage,
}: {
  task: Tarefa | null;
  onClose: () => void;
  users: UserOption[];
  meId: string | null;
  canManage: boolean;
}) {
  const [comments, setComments] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const userById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  useEffect(() => {
    if (!task) {
      setComments([]);
      setText("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tarefas_comentarios")
        .select("*")
        .eq("tarefa_id", task.id)
        .order("criado_em", { ascending: true });
      if (cancelled) return;
      if (!error) setComments((data || []) as Comentario[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`tarefa-coments-${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tarefas_comentarios",
          filter: `tarefa_id=eq.${task.id}`,
        },
        (payload) => {
          setComments((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as Comentario;
              if (prev.find((c) => c.id === n.id)) return prev;
              return [...prev, n];
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as Comentario;
              return prev.filter((c) => c.id !== o.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [task]);

  if (!task) return null;

  const assignedUsers = (task.atribuido_para || [])
    .map((id) => userById.get(id))
    .filter(Boolean) as UserOption[];
  const creator = task.criado_por ? userById.get(task.criado_por) : undefined;
  const soleAssigneeId = (task.atribuido_para || [])[0];
  const canEditSoleStatus =
    (task.atribuido_para || []).length <= 1 &&
    (soleAssigneeId === meId || canManage || task.criado_por === meId);

  const handleSend = async () => {
    if (!text.trim() || !meId) return;
    const { error } = await supabase.from("tarefas_comentarios").insert({
      tarefa_id: task.id,
      usuario_id: meId,
      comentario: text.trim(),
    });
    if (error) {
      toast.error("Erro ao enviar comentário");
      return;
    }
    setText("");
  };

  const handleStatusForUser = async (userId: string, s: Status) => {
    const merged: StatusMap = { ...(task.status_por_usuario || {}), [userId]: s };
    const syncLegacy = (task.atribuido_para || []).length <= 1;
    const payload: Record<string, unknown> = {
      status_por_usuario: merged,
      atualizado_em: new Date().toISOString(),
    };
    if (syncLegacy) payload.status = s;

    const { error } = await supabase
      .from("tarefas")
      .update(payload as Database["public"]["Tables"]["tarefas"]["Update"])
      .eq("id", task.id);
    if (error) toast.error("Erro ao atualizar status");
    else toast.success("Status atualizado");
  };

  const handleDeleteComment = async (id: string) => {
    const { error } = await supabase.from("tarefas_comentarios").delete().eq("id", id);
    if (error) toast.error("Sem permissão para excluir");
  };

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PriorityIcon priority={task.prioridade} />
            <span className="truncate">{task.titulo}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {task.descricao && (
            <p className="text-muted-foreground whitespace-pre-wrap">{task.descricao}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Atribuído:</span>
              {assignedUsers.length > 0 ? (
                <>
                  <AvatarStack users={assignedUsers} size={20} />
                  <span>{assignedUsers.map((u) => userName(u)).join(", ")}</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Criado por:</span>
              <Avatar user={creator} size={20} ring={false} />
              <span>{userName(creator)}</span>
            </div>
            {task.prazo && (
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(task.prazo).toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>

          {assignedUsers.length > 1 ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status por pessoa</label>
              <div className="mt-1">
                <StatusPorPessoa
                  task={task}
                  users={users}
                  meId={meId}
                  canManage={canManage}
                  onChange={(uid, s) => void handleStatusForUser(uid, s)}
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-1.5">
                Cada responsável tem seu próprio andamento — mudar o status de uma pessoa não afeta as demais.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Status
                {!canEditSoleStatus && (
                  <span className="ml-2 text-[10px] text-amber-500">
                    (Somente leitura - apenas o responsável, criador ou gestor podem editar)
                  </span>
                )}
              </label>
              <select
                value={statusToColumn(getEffectiveStatus(task, soleAssigneeId ?? meId))}
                onChange={(e) => canEditSoleStatus && void handleStatusForUser(soleAssigneeId ?? meId ?? "", e.target.value as Status)}
                disabled={!canEditSoleStatus}
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare size={12} /> Comentários ({comments.length})
              </label>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-xs text-muted-foreground">Carregando...</div>
              ) : comments.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nenhum comentário ainda.</div>
              ) : (
                comments.map((c) => {
                  const u = userById.get(c.usuario_id);
                  const mine = c.usuario_id === meId;
                  return (
                    <div key={c.id} className="flex gap-2 items-start p-2 rounded-md bg-muted/40">
                      <Avatar user={u} size={22} ring={false} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{userName(u)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {c.criado_em
                              ? new Date(c.criado_em).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{c.comentario}</div>
                      </div>
                      {(mine || canManage) && (
                        <button
                          onClick={() => void handleDeleteComment(c.id)}
                          className="text-destructive opacity-60 hover:opacity-100"
                          aria-label="Excluir comentário"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Escreva um comentário..."
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
              <Button onClick={() => void handleSend()} size="icon">
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}