import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Plus, MessageSquare, Trash2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ============================================================
// Constantes
// ============================================================
const COLUMNS = [
  { id: "a-fazer", label: "A Fazer", color: "hsl(192 70% 50%)" },
  { id: "em-andamento", label: "Em Andamento", color: "hsl(45 100% 55%)" },
  { id: "revisao", label: "Revisão", color: "hsl(217 91% 60%)" },
  { id: "concluido", label: "Concluído", color: "hsl(142 60% 45%)" },
] as const;

const PRIORITY = {
  baixa: {
    label: "Baixa",
    icon: "●",
    color: "hsl(142 60% 50%)",
    bg: "hsl(142 60% 50% / 0.15)",
    border: "hsl(142 60% 50% / 0.4)",
  },
  media: {
    label: "Média",
    icon: "●",
    color: "hsl(45 100% 55%)",
    bg: "hsl(45 100% 55% / 0.15)",
    border: "hsl(45 100% 55% / 0.4)",
  },
  alta: {
    label: "Alta",
    icon: "●",
    color: "hsl(20 90% 60%)",
    bg: "hsl(20 90% 60% / 0.15)",
    border: "hsl(20 90% 60% / 0.4)",
  },
  urgente: {
    label: "Urgente",
    icon: "▲",
    color: "hsl(0 75% 65%)",
    bg: "hsl(0 75% 65% / 0.15)",
    border: "hsl(0 75% 65% / 0.4)",
  },
} as const;

type Priority = keyof typeof PRIORITY;
type Status = (typeof COLUMNS)[number]["id"];

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
  status: string | null;
  prioridade: string | null;
  atribuido_para: string | null;
  criado_por: string | null;
  prazo: string | null;
  publico: boolean | null;
  criado_em: string | null;
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
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function Avatar({
  user,
  size = 30,
}: {
  user: UserOption | undefined;
  size?: number;
}) {
  const color = userColor(user?.id);
  return (
    <div
      title={userName(user)}
      className="flex items-center justify-center rounded-full font-bold text-[#0f1115] shrink-0 shadow-sm ring-2 ring-background"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.4,
        boxShadow: `0 0 8px ${color}40`,
      }}
    >
      {userInitials(user)}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const key = (priority as Priority) in PRIORITY ? (priority as Priority) : "media";
  const p = PRIORITY[key];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border"
      style={{
        background: p.bg,
        color: p.color,
        borderColor: p.border,
      }}
    >
      <span className="text-[8px]">{p.icon}</span>
      {p.label}
    </span>
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
  const { isAdmin, isGestorMaster, isLoading: roleLoading } = useUserRole();
  const isManager = isAdmin || isGestorMaster;

  const [me, setMe] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<Status>("a-fazer");
  const [detailTask, setDetailTask] = useState<Tarefa | null>(null);

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
        setTarefas((tarefasRes.data || []) as Tarefa[]);
      }
      if (!usersRes.error) {
        setUsers((usersRes.data || []) as UserOption[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
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
              const n = payload.new as Tarefa;
              if (prev.find((t) => t.id === n.id)) return prev;
              return [n, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as Tarefa;
              return prev.map((t) => (t.id === n.id ? n : t));
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as Tarefa;
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
  const visibleTasks = useMemo(() => {
    if (isManager) {
      // Admin/Gestor: tem duas visualizações
      if (myView) {
        // "Minhas": apenas tarefas PRIVADAS criadas por ele
        return tarefas.filter(
          (t) => t.criado_por === me && t.publico === false,
        );
      }
      // "Equipe": apenas tarefas PÚBLICAS criadas por ele (delegadas)
      return tarefas.filter(
        (t) => t.criado_por === me && t.publico === true,
      );
    }
    // Usuário comum: visão única com tarefas privadas + tarefas públicas atribuídas
    return tarefas.filter(
      (t) => (t.criado_por === me && t.publico === false) || (t.atribuido_para === me && t.publico === true),
    );
  }, [tarefas, me, myView, isManager]);

  const getColTasks = (colId: Status) =>
    visibleTasks.filter((t) => statusToColumn(t.status) === colId);

  // -------------------------------------------------- Mutations
  const canChangeStatus = (task: Tarefa): boolean => {
    if (isManager) {
      // Admin/Gestor sempre pode mudar status em qualquer visualização
      return true;
    }
    // Usuário comum: pode mudar status em tarefas que criou ou nas que recebeu para executar
    return task.criado_por === me || task.atribuido_para === me;
  };

  const handleStatusChange = async (id: string, newStatus: Status) => {
    const task = tarefas.find((t) => t.id === id);
    if (!task) return;

    // Verificar permissão
    if (!canChangeStatus(task)) {
      toast.error("Você não tem permissão para alterar o status desta tarefa");
      return;
    }

    const previous = tarefas;
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)),
    );
    const { error } = await supabase
      .from("tarefas")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
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

  const handleDrop = (colId: Status) => {
    if (!dragId) return;
    void handleStatusChange(dragId, colId);
    setDragId(null);
  };

  const handleCreate = async (form: {
    titulo: string;
    descricao: string;
    atribuido_para: string;
    prazo: string;
    prioridade: Priority;
    status: Status;
    publico: boolean;
  }) => {
    if (!me) return;
    const payload: Database["public"]["Tables"]["tarefas"]["Insert"] = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      atribuido_para: form.atribuido_para || me,
      criado_por: me,
      prioridade: form.prioridade,
      status: form.status,
      prazo: form.prazo || null,
      publico: form.publico,
    };
    const { data, error } = await supabase.from("tarefas").insert(payload).select().single();
    if (error) {
      console.error(error);
      toast.error("Erro ao criar tarefa");
      return;
    }

    // Criar notificação para o usuário atribuído (se diferente do criador)
    if (data && form.atribuido_para && form.atribuido_para !== me) {
      const atribuidoPara = form.atribuido_para;
      const usuario = users.find((u) => u.id === atribuidoPara);
      const nomeCriador = users.find((u) => u.id === me)?.full_name || me;

      await supabase.from("tarefas_notificacoes").insert({
        id_da_tarefa: data.id,
        user_id: atribuidoPara,
        mensagem: `${nomeCriador} delegou uma nova tarefa: "${form.titulo}"`,
        lido: false,
      });
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
        (t) => statusToColumn(t.status) === "concluido",
      ).length,
    };
  }, [visibleTasks]);

  if (loading || roleLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
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
    <div className="bg-[#0f1115] rounded-2xl border border-white/5 text-slate-200 font-sans overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Sub-header Premium */}
      <div className="bg-white/[0.02] border-b border-white/5 px-6 py-5 flex items-center justify-between flex-wrap gap-4 backdrop-blur-md">
        <div className="flex gap-6 items-center flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              {headingTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {headingSubtitle}
            </p>
          </div>

          <div className="hidden md:flex gap-3">
            {[
              { label: "Total", val: stats.total, color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
              { label: "Urgentes", val: stats.urgente, color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" },
              { label: "Concluídas", val: stats.concluido, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
            ].map((s) => (
              <div key={s.label} className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl border ${s.bg} ${s.border}`}>
                <span className={`text-lg font-black leading-none ${s.color}`}>{s.val}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setDefaultStatus("a-fazer");
            setCreateOpen(true);
          }}
          className="group relative flex items-center gap-2 bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-none rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95"
        >
          <Plus size={18} className="transition-transform group-hover:rotate-90" />
          Nova Tarefa
        </button>
      </div>

      {/* Board Kanban */}
      <div className="flex gap-5 p-6 overflow-x-auto min-h-[500px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {COLUMNS.map((col) => {
          const colTasks = getColTasks(col.id);
          const isOver = dragOver === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.id); setDragOver(null); }}
              onDragLeave={() => setDragOver(null)}
              className={`w-[290px] shrink-0 rounded-2xl p-4 flex flex-col transition-all duration-300 border ${
                isOver ? "bg-white/[0.04] border-white/20 shadow-lg" : "bg-black/20 border-white/5"
              }`}
            >
              {/* Header da Coluna */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: col.color, boxShadow: `0 0 10px ${col.color}80` }} />
                  <span className="font-bold text-sm text-slate-100 tracking-wide">{col.label}</span>
                  <span className="bg-white/10 text-slate-300 text-[10px] font-bold rounded-full px-2 py-0.5 ml-1">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => { setDefaultStatus(col.id); setCreateOpen(true); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Lista de Tarefas */}
              <div className="flex flex-col gap-3 flex-1">
                {colTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/5 rounded-xl text-slate-500">
                    <span className="text-xs font-medium">Nenhuma tarefa</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const assigned = task.atribuido_para ? userById.get(task.atribuido_para) : undefined;
                    const pKey = (task.prioridade as Priority) in PRIORITY ? (task.prioridade as Priority) : "media";
                    const p = PRIORITY[pKey];
                    const canDelete = task.criado_por === me || (isManager && task.publico);
                    const isDragging = dragId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => { setDragId(task.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setDetailTask(task)}
                        className={`group relative bg-[#15181e] rounded-xl p-4 cursor-grab active:cursor-grabbing border-l-4 transition-all duration-200 ${
                          isDragging ? "opacity-50 scale-95 shadow-none" : "hover:-translate-y-1 hover:shadow-xl border-y border-r border-transparent hover:border-white/10"
                        }`}
                        style={{ borderLeftColor: p.color }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <PriorityBadge priority={task.prioridade} />
                          <Avatar user={assigned} size={24} />
                        </div>

                        <h3 className="text-sm font-semibold text-slate-200 leading-snug mb-4 line-clamp-2">
                          {task.titulo}
                        </h3>

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-3">
                            {task.prazo && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-white/5 px-2 py-1 rounded-md">
                                📅 {new Date(task.prazo).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors">
                              <MessageSquare size={12} /> Abrir
                            </div>
                          </div>

                          {/* Ações (Aparecem suavemente no hover ou no mobile) */}
                          <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {canChangeStatus(task) && (
                              <select
                                value={statusToColumn(task.status)}
                                onChange={(e) => void handleStatusChange(task.id, e.target.value as Status)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] bg-black/40 border border-white/10 rounded px-1.5 py-1 text-slate-300 cursor-pointer hover:bg-white/10 transition-colors appearance-none"
                              >
                                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                              </select>
                            )}
                            {canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); void handleDelete(task.id); }}
                                className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
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
    atribuido_para: string;
    prazo: string;
    prioridade: Priority;
    status: Status;
    publico: boolean;
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
    atribuido_para: meId || "",
    prazo: "",
    prioridade: "media" as Priority,
    status: defaultStatus,
    /** Tarefas privadas: só o usuário vê. publico=true permite admin/gestor verem. */
    publico: canAssignOthers,
  });

  useEffect(() => {
    if (open) {
      setForm({
        titulo: "",
        descricao: "",
        atribuido_para: meId || "",
        prazo: "",
        prioridade: "media",
        status: defaultStatus,
        publico: canAssignOthers,
      });
    }
  }, [open, defaultStatus, meId, canAssignOthers]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Título *
            </label>
            <input
              value={form.titulo}
              onChange={(e) =>
                setForm((p) => ({ ...p, titulo: e.target.value }))
              }
              placeholder="Descreva a tarefa..."
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Descrição
            </label>
            <textarea
              value={form.descricao}
              onChange={(e) =>
                setForm((p) => ({ ...p, descricao: e.target.value }))
              }
              placeholder="Detalhes (opcional)"
              rows={2}
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {canAssignOthers && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Atribuir para
              </label>
              <select
                value={form.atribuido_para}
                onChange={(e) =>
                  setForm((p) => ({ ...p, atribuido_para: e.target.value }))
                }
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value={meId || ""}>Eu mesmo</option>
                {users
                  .filter((u) => u.id !== meId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {userName(u)}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Prioridade
            </label>
            <div className="flex gap-2 mt-1">
              {(Object.keys(PRIORITY) as Priority[]).map((key) => {
                const p = PRIORITY[key];
                const active = form.prioridade === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, prioridade: key }))
                    }
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 11,
                      background: active ? p.bg : "hsl(222 25% 14%)",
                      color: active ? p.color : "hsl(215 20% 60%)",
                      border: `1.5px solid ${
                        active ? p.border : "hsl(222 20% 24%)"
                      }`,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Prazo
              </label>
              <input
                type="date"
                value={form.prazo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, prazo: e.target.value }))
                }
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Coluna
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value as Status }))
                }
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Privacidade */}
          {!canAssignOthers && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.publico}
                onChange={(e) =>
                  setForm((p) => ({ ...p, publico: e.target.checked }))
                }
              />
              Tornar visível para administradores
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
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

  const assigned = task.atribuido_para ? userById.get(task.atribuido_para) : undefined;
  const creator = task.criado_por ? userById.get(task.criado_por) : undefined;

  // Permite editar status apenas se:
  // - É uma tarefa privada (criada_por === meId)
  // - OU é o criador da tarefa
  // - OU é manager (admin/gestor_master)
  const canEditStatus = task.criado_por === meId || canManage;

  const handleSend = async () => {
    if (!text.trim() || !meId) return;
    const { error } = await supabase
      .from("tarefas_comentarios")
      .insert({
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

  const handleStatus = async (s: Status) => {
    const { error } = await supabase
      .from("tarefas")
      .update({ status: s, atualizado_em: new Date().toISOString() })
      .eq("id", task.id);
    if (error) toast.error("Erro ao atualizar status");
    else toast.success("Status atualizado");
  };

  const handleDeleteComment = async (id: string) => {
    const { error } = await supabase
      .from("tarefas_comentarios")
      .delete()
      .eq("id", id);
    if (error) toast.error("Sem permissão para excluir");
  };

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PriorityBadge priority={task.prioridade} />
            <span className="truncate">{task.titulo}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {task.descricao && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {task.descricao}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Atribuído:</span>
              <Avatar user={assigned} size={22} />
              <span>{userName(assigned)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Criado por:</span>
              <Avatar user={creator} size={22} />
              <span>{userName(creator)}</span>
            </div>
            {task.prazo && (
              <div>
                📅 {new Date(task.prazo).toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Status
              {!canEditStatus && (
                <span className="ml-2 text-[10px] text-amber-500">
                  (Somente leitura - apenas o criador pode editar)
                </span>
              )}
            </label>
            <select
              defaultValue={statusToColumn(task.status)}
              onChange={(e) => canEditStatus && void handleStatus(e.target.value as Status)}
              disabled={!canEditStatus}
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <MessageSquare size={12} /> Comentários ({comments.length})
              </label>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-xs text-muted-foreground">Carregando...</div>
              ) : comments.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nenhum comentário ainda.
                </div>
              ) : (
                comments.map((c) => {
                  const u = userById.get(c.usuario_id);
                  const mine = c.usuario_id === meId;
                  return (
                    <div
                      key={c.id}
                      className="flex gap-2 items-start p-2 rounded-md bg-muted/40"
                    >
                      <Avatar user={u} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">
                            {userName(u)}
                          </span>
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
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {c.comentario}
                        </div>
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
