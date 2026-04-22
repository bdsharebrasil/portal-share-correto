import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Plus, MessageSquare, X, Trash2, Send } from "lucide-react";
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
  if (COLUMNS.find((c) => c.id === s)) return s as Status;
  switch (s) {
    case "aberto":
    case "pendente":
      return "a-fazer";
    case "em progresso":
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
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.37,
        fontWeight: 700,
        color: "hsl(222 25% 8%)",
        flexShrink: 0,
        letterSpacing: 0.4,
        boxShadow: `0 0 0 2px hsl(222 25% 12%), 0 0 8px ${color}55`,
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 8 }}>{p.icon}</span>
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
    if (myView) {
      // "Minhas": apenas tarefas PRIVADAS criadas pelo usuário
      return tarefas.filter(
        (t) => t.criado_por === me && t.publico === false,
      );
    }
    // "Equipe": tarefas PÚBLICAS atribuídas ao usuário (criadas por admin/gestor_master)
    return tarefas.filter(
      (t) => t.atribuido_para === me && t.publico === true,
    );
  }, [tarefas, me, myView]);

  const getColTasks = (colId: Status) =>
    visibleTasks.filter((t) => statusToColumn(t.status) === colId);

  // -------------------------------------------------- Mutations
  const canChangeStatus = (task: Tarefa): boolean => {
    // Em "Minhas" (visão privada), usuário sempre pode mudar
    if (!myView) {
      // Em "Equipe" (tarefas públicas):
      // - Apenas o criador ou admin/gestor_master podem mudar status
      // - O usuário atribuído NÃO pode mudar status, apenas comentar
      if (task.criado_por === me || isManager) {
        return true;
      }
      return false;
    }
    return true;
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
    const { error } = await supabase.from("tarefas").insert(payload);
    if (error) {
      console.error(error);
      toast.error("Erro ao criar tarefa");
      return;
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

  // -------------------------------------------------- Cores de tema
  const BG = "hsl(222 25% 8%)";
  const SURF = "hsl(222 25% 10%)";
  const BORDER = "hsl(222 20% 20%)";
  const CYAN = "hsl(192 70% 50%)";
  const TEXT = "hsl(210 40% 92%)";
  const MUTED = "hsl(215 20% 55%)";

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
    <div
      style={{
        background: BG,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Sub-header */}
      <div
        style={{
          background: SURF,
          borderBottom: `1px solid ${BORDER}`,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4 }}>
              {headingTitle}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
              {headingSubtitle}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Total", val: stats.total, color: CYAN },
              { label: "Urgentes", val: stats.urgente, color: "hsl(0 75% 65%)" },
              { label: "Concluídas", val: stats.concluido, color: "hsl(142 60% 50%)" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.color + "15",
                  borderRadius: 10,
                  padding: "6px 14px",
                  textAlign: "center",
                  border: `1px solid ${s.color}30`,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setDefaultStatus("a-fazer");
            setCreateOpen(true);
          }}
          style={{
            background: `linear-gradient(135deg,${CYAN},hsl(217 91% 55%))`,
            color: "hsl(222 25% 8%)",
            border: "none",
            borderRadius: 10,
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 4px 16px ${CYAN}44`,
          }}
        >
          <Plus size={16} /> Adicionar Tarefa
        </button>
      </div>

      {/* Board */}
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "20px",
          overflowX: "auto",
          minHeight: 480,
        }}
      >
        {COLUMNS.map((col) => {
          const colTasks = getColTasks(col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.id);
                setDragOver(null);
              }}
              onDragLeave={() => setDragOver(null)}
              style={{
                minWidth: 268,
                width: 268,
                flexShrink: 0,
                background:
                  dragOver === col.id ? "hsl(222 25% 13%)" : "hsl(222 25% 10%)",
                borderRadius: 16,
                padding: "14px 12px",
                border: `1.5px solid ${
                  dragOver === col.id ? col.color : BORDER
                }`,
                transition: "background 0.15s, border-color 0.15s",
                minHeight: 420,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: col.color,
                      boxShadow: `0 0 6px ${col.color}`,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: TEXT,
                    }}
                  >
                    {col.label}
                  </span>
                  <span
                    style={{
                      background: col.color + "22",
                      color: col.color,
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 20,
                      padding: "1px 8px",
                      border: `1px solid ${col.color}44`,
                    }}
                  >
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setDefaultStatus(col.id);
                    setCreateOpen(true);
                  }}
                  style={{
                    background: "none",
                    border: `1.5px solid ${col.color}66`,
                    borderRadius: 8,
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: col.color,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>

              {colTasks.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "hsl(215 20% 38%)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.4 }}>
                    📋
                  </div>
                  Nenhuma tarefa aqui.
                </div>
              ) : (
                colTasks.map((task) => {
                  const assigned = task.atribuido_para
                    ? userById.get(task.atribuido_para)
                    : undefined;
                  const pKey =
                    (task.prioridade as Priority) in PRIORITY
                      ? (task.prioridade as Priority)
                      : "media";
                  const p = PRIORITY[pKey];
                  const canDelete =
                    task.criado_por === me ||
                    (isManager && task.publico);
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(task.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setDetailTask(task)}
                      style={{
                        background: "hsl(222 25% 11%)",
                        borderRadius: 12,
                        padding: "13px 13px 10px",
                        marginBottom: 10,
                        boxShadow:
                          dragId === task.id
                            ? "0 12px 32px hsl(192 70% 50% / 0.18)"
                            : "0 2px 8px hsl(222 25% 5% / 0.4)",
                        border: `1px solid ${
                          dragId === task.id ? p.border : "hsl(222 20% 22%)"
                        }`,
                        borderLeft: `3px solid ${p.color}`,
                        cursor: "grab",
                        opacity: dragId === task.id ? 0.45 : 1,
                        transition:
                          "box-shadow 0.2s, border-color 0.2s, opacity 0.15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 9,
                        }}
                      >
                        <PriorityBadge priority={task.prioridade} />
                        <Avatar user={assigned} />
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: TEXT,
                          lineHeight: 1.45,
                          marginBottom: 10,
                        }}
                      >
                        {task.titulo}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          {task.prazo && (
                            <span
                              style={{
                                fontSize: 11,
                                color: MUTED,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              📅 {new Date(task.prazo).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              color: MUTED,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <MessageSquare size={11} /> Abrir
                          </span>
                        </div>
                        <div
                          style={{ display: "flex", gap: 5 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canChangeStatus(task) ? (
                            <select
                              value={statusToColumn(task.status)}
                              onChange={(e) =>
                                void handleStatusChange(
                                  task.id,
                                  e.target.value as Status,
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: 10,
                                border: "1px solid hsl(222 20% 26%)",
                                borderRadius: 6,
                                padding: "2px 4px",
                                color: "hsl(210 40% 75%)",
                                cursor: "pointer",
                                background: "hsl(222 25% 15%)",
                              }}
                              title="Mudar status"
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div
                              style={{
                                fontSize: 10,
                                border: "1px solid hsl(222 20% 26%)",
                                borderRadius: 6,
                                padding: "2px 4px",
                                color: "hsl(215 20% 55%)",
                                background: "hsl(222 25% 15%)",
                                cursor: "not-allowed",
                                opacity: 0.6,
                              }}
                              title="Apenas o criador pode mudar o status desta tarefa"
                            >
                              {statusToColumn(task.status) === "a-fazer"
                                ? "A Fazer"
                                : statusToColumn(task.status) === "em-andamento"
                                  ? "Em Andamento"
                                  : statusToColumn(task.status) === "revisao"
                                    ? "Revisão"
                                    : "Concluído"}
                            </div>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(task.id);
                              }}
                              style={{
                                fontSize: 10,
                                background: "hsl(0 75% 60% / 0.15)",
                                color: "hsl(0 75% 65%)",
                                border: "1px solid hsl(0 75% 60% / 0.3)",
                                borderRadius: 6,
                                padding: "2px 7px",
                                cursor: "pointer",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              aria-label="Excluir"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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
