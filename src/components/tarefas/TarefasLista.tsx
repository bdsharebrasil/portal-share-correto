import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Plus, Trash2, Send, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// CSS para checklist animado
const checklistStyles = `
#checklist {
  --background: #fff;
  --text: #414856;
  --check: #221d6d;
  --disabled: #c3c8de;
  --width: 100px;
  --height: 180px;
  --border-radius: 10px;
  background: var(--background);
  width: var(--width);
  height: var(--height);
  border-radius: var(--border-radius);
  position: relative;
  box-shadow: 0 10px 30px rgba(65, 72, 86, 0.05);
  padding: 30px 85px;
  display: grid;
  grid-template-columns: 30px auto;
  align-items: center;
  justify-content: center;
}

#checklist label {
  color: var(--text);
  position: relative;
  cursor: pointer;
  display: grid;
  align-items: center;
  width: fit-content;
  transition: color 0.3s ease;
  margin-right: 20px;
}

#checklist label::before, #checklist label::after {
  content: "";
  position: absolute;
}

#checklist label::before {
  height: 2px;
  width: 8px;
  left: -27px;
  background: var(--check);
  border-radius: 2px;
  transition: background 0.3s ease;
}

#checklist label:after {
  height: 4px;
  width: 4px;
  top: 8px;
  left: -25px;
  border-radius: 50%;
}

#checklist input[type="checkbox"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  position: relative;
  height: 15px;
  width: 15px;
  outline: none;
  border: 0;
  margin: 0 15px 0 0;
  cursor: pointer;
  background: var(--background);
  display: grid;
  align-items: center;
  margin-right: 20px;
}

#checklist input[type="checkbox"]::before, #checklist input[type="checkbox"]::after {
  content: "";
  position: absolute;
  height: 2px;
  top: auto;
  background: var(--check);
  border-radius: 2px;
}

#checklist input[type="checkbox"]::before {
  width: 0px;
  right: 60%;
  transform-origin: right bottom;
}

#checklist input[type="checkbox"]::after {
  width: 0px;
  left: 40%;
  transform-origin: left bottom;
}

#checklist input[type="checkbox"]:checked::before {
  animation: check-01 0.4s ease forwards;
}

#checklist input[type="checkbox"]:checked::after {
  animation: check-02 0.4s ease forwards;
}

#checklist input[type="checkbox"]:checked + label {
  color: var(--disabled);
  animation: move 0.3s ease 0.1s forwards;
}

#checklist input[type="checkbox"]:checked + label::before {
  background: var(--disabled);
  animation: slice 0.4s ease forwards;
}

#checklist input[type="checkbox"]:checked + label::after {
  animation: firework 0.5s ease forwards 0.1s;
}

@keyframes move {
  50% {
    padding-left: 8px;
    padding-right: 0px;
  }

  100% {
    padding-right: 4px;
  }
}

@keyframes slice {
  60% {
    width: 100%;
    left: 4px;
  }

  100% {
    width: 100%;
    left: -2px;
    padding-left: 0;
  }
}

@keyframes check-01 {
  0% {
    width: 4px;
    top: auto;
    transform: rotate(0);
  }

  50% {
    width: 0px;
    top: auto;
    transform: rotate(0);
  }

  51% {
    width: 0px;
    top: 8px;
    transform: rotate(45deg);
  }

  100% {
    width: 5px;
    top: 8px;
    transform: rotate(45deg);
  }
}

@keyframes check-02 {
  0% {
    width: 4px;
    top: auto;
    transform: rotate(0);
  }

  50% {
    width: 0px;
    top: auto;
    transform: rotate(0);
  }

  51% {
    width: 0px;
    top: 8px;
    transform: rotate(-45deg);
  }

  100% {
    width: 10px;
    top: 8px;
    transform: rotate(-45deg);
  }
}

@keyframes firework {
  0% {
    opacity: 1;
    box-shadow: 0 0 0 -2px #4f29f0, 0 0 0 -2px #4f29f0, 0 0 0 -2px #4f29f0, 0 0 0 -2px #4f29f0, 0 0 0 -2px #4f29f0, 0 0 0 -2px #4f29f0;
  }

  30% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    box-shadow: 0 -15px 0 0px #4f29f0, 14px -8px 0 0px #4f29f0, 14px 8px 0 0px #4f29f0, 0 15px 0 0px #4f29f0, -14px 8px 0 0px #4f29f0, -14px -8px 0 0px #4f29f0;
  }
}

/* Estilos customizados para lista de tarefas */
.checklist-item {
  display: grid;
  grid-template-columns: 30px auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.checklist-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
}

.checklist-item label {
  margin-right: 0;
  flex: 1;
  font-weight: 500;
  color: #414856;
}

.checklist-item-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.checklist-item:hover .checklist-item-actions {
  opacity: 1;
}

.checklist-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
}
`;

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

interface Props {
  myView?: boolean;
  isManager?: boolean;
}

export default function TarefasLista({ myView = false, isManager = false }: Props) {
  const { isAdmin, isGestorMaster, isLoading: roleLoading } = useUserRole();
  const actualIsManager = isManager || isAdmin || isGestorMaster;

  const [me, setMe] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Tarefa | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Load data
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tarefas-lista")
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

  // Filter visible tasks
  const visibleTasks = useMemo(() => {
    if (actualIsManager) {
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
    // Usuário comum
    return tarefas.filter(
      (t) => (t.criado_por === me && t.publico === false) || (t.atribuido_para === me && t.publico === true),
    );
  }, [tarefas, me, myView, actualIsManager]);

  // Separa tarefas pendentes e concluídas
  const { pending, completed } = useMemo(() => {
    return {
      pending: visibleTasks.filter((t) => t.status !== "concluido"),
      completed: visibleTasks.filter((t) => t.status === "concluido"),
    };
  }, [visibleTasks]);

  const handleToggleTask = async (taskId: string, isComplete: boolean) => {
    const task = tarefas.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = isComplete ? "concluido" : "a-fazer";
    const previous = tarefas;
    
    setTarefas((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    const { error } = await supabase
      .from("tarefas")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
      .eq("id", taskId);
    
    if (error) {
      toast.error("Erro ao atualizar tarefa");
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

  const handleCreate = async (form: {
    titulo: string;
    descricao: string;
    atribuido_para: string;
    prazo: string;
    prioridade: string;
    publico: boolean;
  }) => {
    if (!me) return;
    const payload: Database["public"]["Tables"]["tarefas"]["Insert"] = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      atribuido_para: form.atribuido_para || me,
      criado_por: me,
      prioridade: form.prioridade,
      status: "a-fazer",
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

  if (loading || roleLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando tarefas...
      </div>
    );
  }

  return (
    <>
      <style>{checklistStyles}</style>
      
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {myView ? "Minhas Tarefas" : "Tarefas em Lista"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {myView
                ? "Tarefas privadas criadas por você"
                : actualIsManager
                  ? "Tarefas que você delegou para a equipe"
                  : "Tarefas atribuídas a você"}
            </p>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Nova Tarefa
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Tarefas Pendentes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {pending.length}
                </span>
                Pendentes
              </h2>
            </div>

            <div className="space-y-2">
              {pending.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma tarefa pendente
                </div>
              ) : (
                pending.map((task) => {
                  const assigned = task.atribuido_para
                    ? userById.get(task.atribuido_para)
                    : undefined;
                  const canDelete =
                    task.criado_por === me || (actualIsManager && task.publico);

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-md transition-all group"
                    >
                      <input
                        type="checkbox"
                        onChange={(e) =>
                          void handleToggleTask(task.id, e.target.checked)
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />

                      <div
                        className="flex-1 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setDetailTask(task)}
                      >
                        <div className="font-medium text-foreground">
                          {task.titulo}
                        </div>
                        {task.descricao && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {task.descricao}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {task.prazo && (
                          <div className="text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                            📅 {new Date(task.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </div>
                        )}
                        <Avatar user={assigned} size={28} />

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => void setDetailTask(task)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Abrir"
                          >
                            <MessageSquare size={16} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => void handleDelete(task.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
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

          {/* Tarefas Concluídas */}
          {completed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    {completed.length}
                  </span>
                  Concluídas
                </h2>
              </div>

              <div className="space-y-2">
                {completed.map((task) => {
                  const assigned = task.atribuido_para
                    ? userById.get(task.atribuido_para)
                    : undefined;
                  const canDelete =
                    task.criado_por === me || (actualIsManager && task.publico);

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg hover:shadow-md transition-all group line-through text-muted-foreground"
                    >
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={(e) =>
                          void handleToggleTask(task.id, e.target.checked)
                        }
                        className="w-5 h-5 rounded border-emerald-300 text-emerald-600 cursor-pointer"
                      />

                      <div
                        className="flex-1 cursor-pointer hover:text-emerald-700 transition-colors"
                        onClick={() => setDetailTask(task)}
                      >
                        <div className="font-medium text-foreground">
                          {task.titulo}
                        </div>
                        {task.descricao && (
                          <div className="text-sm line-clamp-1">
                            {task.descricao}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {task.prazo && (
                          <div className="text-xs bg-emerald-100 px-2 py-1 rounded">
                            📅 {new Date(task.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </div>
                        )}
                        <Avatar user={assigned} size={28} />

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => void setDetailTask(task)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 transition-colors"
                            title="Abrir"
                          >
                            <MessageSquare size={16} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => void handleDelete(task.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <CreateListaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        users={users}
        canAssignOthers={actualIsManager}
        meId={me}
      />

      {/* Detail Dialog */}
      <DetailDialog
        task={detailTask}
        onClose={() => setDetailTask(null)}
        users={users}
        meId={me}
        canManage={actualIsManager}
      />
    </>
  );
}

// ============================================================
// CreateListaModal
// ============================================================
function CreateListaModal({
  open,
  onClose,
  onSave,
  users,
  canAssignOthers,
  meId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: {
    titulo: string;
    descricao: string;
    atribuido_para: string;
    prazo: string;
    prioridade: string;
    publico: boolean;
  }) => Promise<void>;
  users: UserOption[];
  canAssignOthers: boolean;
  meId: string | null;
}) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    atribuido_para: meId || "",
    prazo: "",
    prioridade: "media",
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
        publico: canAssignOthers,
      });
    }
  }, [open, meId, canAssignOthers]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa em Lista</DialogTitle>
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
                      {u.full_name || u.display_name || u.email}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Prioridade
            </label>
            <select
              value={form.prioridade}
              onChange={(e) =>
                setForm((p) => ({ ...p, prioridade: e.target.value }))
              }
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

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
// DetailDialog
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
      .channel(`tarefa-lista-coments-${task.id}`)
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

  const assigned = task.atribuido_para
    ? userById.get(task.atribuido_para)
    : undefined;
  const creator = task.criado_por ? userById.get(task.criado_por) : undefined;

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
          <DialogTitle className="truncate">{task.titulo}</DialogTitle>
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
              <span>{assigned ? (assigned.full_name || assigned.display_name || assigned.email) : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Criado por:</span>
              <Avatar user={creator} size={22} />
              <span>{creator ? (creator.full_name || creator.display_name || creator.email) : "—"}</span>
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
            </label>
            <div className="text-sm font-medium mt-1">
              {task.status === "concluido" ? "✅ Concluída" : "⏳ Pendente"}
            </div>
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
                            {u ? (u.full_name || u.display_name || u.email) : "—"}
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
