import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Plus, Trash2, Send, MessageSquare, Users2 } from "lucide-react";
import { EQUIPES, getEquipe, equipesDoUsuario, type Equipe } from "@/lib/tarefas-teams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// CSS do checklist animado (tema escuro)
const checklistStyles = `
.tl-check {
  --check: #22d3ee;
  --disabled: #64748b;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1;
}

.tl-check input[type="checkbox"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  position: relative;
  height: 22px;
  width: 22px;
  flex: 0 0 auto;
  margin: 0;
  outline: none;
  cursor: pointer;
  border: 2px solid var(--check);
  border-radius: 6px;
  background: transparent;
  display: grid;
  align-items: center;
  transition: border-color 0.3s ease, background 0.3s ease;
}

.tl-check input[type="checkbox"]::before,
.tl-check input[type="checkbox"]::after {
  content: "";
  position: absolute;
  height: 2px;
  top: auto;
  background: var(--check);
  border-radius: 2px;
}

.tl-check input[type="checkbox"]::before {
  width: 0px;
  right: 60%;
  transform-origin: right bottom;
}

.tl-check input[type="checkbox"]::after {
  width: 0px;
  left: 40%;
  transform-origin: left bottom;
}

.tl-check input[type="checkbox"]:checked {
  border-color: transparent;
}

.tl-check input[type="checkbox"]:checked::before {
  animation: tl-check-01 0.4s ease forwards;
}

.tl-check input[type="checkbox"]:checked::after {
  animation: tl-check-02 0.4s ease forwards;
}

.tl-check .tl-label {
  position: relative;
  min-width: 0;
  cursor: pointer;
  color: #e2e8f0;
  transition: color 0.3s ease;
}

.tl-check .tl-label::before,
.tl-check .tl-label::after {
  content: "";
  position: absolute;
}

.tl-check .tl-label::before {
  height: 2px;
  width: 0px;
  left: 0;
  top: 11px;
  background: var(--check);
  border-radius: 2px;
  opacity: 0;
}

.tl-check .tl-label::after {
  height: 4px;
  width: 4px;
  top: 8px;
  left: -14px;
  border-radius: 50%;
}

.tl-check input[type="checkbox"]:checked + .tl-label {
  color: var(--disabled);
  animation: tl-move 0.3s ease 0.1s forwards;
}

.tl-check input[type="checkbox"]:checked + .tl-label::before {
  opacity: 1;
  animation: tl-slice 0.4s ease forwards;
}

.tl-check input[type="checkbox"]:checked + .tl-label::after {
  animation: tl-firework 0.5s ease forwards 0.1s;
}

@keyframes tl-move {
  50% { padding-left: 8px; padding-right: 0px; }
  100% { padding-right: 4px; }
}

@keyframes tl-slice {
  60% { width: 100%; left: 4px; }
  100% { width: 100%; left: -2px; padding-left: 0; }
}

@keyframes tl-check-01 {
  0% { width: 4px; top: auto; transform: rotate(0); }
  50% { width: 0px; top: auto; transform: rotate(0); }
  51% { width: 0px; top: 8px; transform: rotate(45deg); }
  100% { width: 5px; top: 8px; transform: rotate(45deg); }
}

@keyframes tl-check-02 {
  0% { width: 4px; top: auto; transform: rotate(0); }
  50% { width: 0px; top: auto; transform: rotate(0); }
  51% { width: 0px; top: 8px; transform: rotate(-45deg); }
  100% { width: 10px; top: 8px; transform: rotate(-45deg); }
}

@keyframes tl-firework {
  0% {
    opacity: 1;
    box-shadow: 0 0 0 -2px #22d3ee, 0 0 0 -2px #22d3ee, 0 0 0 -2px #22d3ee, 0 0 0 -2px #22d3ee, 0 0 0 -2px #22d3ee, 0 0 0 -2px #22d3ee;
  }
  30% { opacity: 1; }
  100% {
    opacity: 0;
    box-shadow: 0 -15px 0 0px #22d3ee, 14px -8px 0 0px #22d3ee, 14px 8px 0 0px #22d3ee, 0 15px 0 0px #22d3ee, -14px 8px 0 0px #22d3ee, -14px -8px 0 0px #22d3ee;
  }
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
  atribuido_para: string[] | string | null;
  criado_por: string | null;
  prazo: string | null;
  publico: boolean | null;
  criado_em: string | null;
  origem?: string | null;
  equipes?: string[] | null;
  progresso?: number | null;
}

function assignees(t: Tarefa): string[] {
  const a = t.atribuido_para;
  if (!a) return [];
  return Array.isArray(a) ? a.filter(Boolean) : [a];
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

const TASK_STATUS_LABELS: Record<string, string> = {
  "a-fazer": "A Fazer",
  pendente: "Pendente",
  "em-andamento": "Em Andamento",
  "em_andamento": "Em Andamento",
  revisao: "Revisão",
  "revisão": "Revisão",
  concluido: "Concluído",
  concluído: "Concluído",
};

function normalizeTaskStatus(status: string | null | undefined) {
  if (!status) return "a-fazer";
  const normalized = status.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "em-andamento") return "em-andamento";
  if (normalized === "revisao" || normalized === "revisão") return "revisao";
  if (normalized === "concluido" || normalized === "concluído") return "concluido";
  if (normalized === "pendente" || normalized === "a-fazer") return "a-fazer";
  return normalized;
}

function taskStatusLabel(status: string | null | undefined) {
  return TASK_STATUS_LABELS[status?.trim().toLowerCase().replace(/_/g, "-")] || "Pendente";
}

function Avatar({
  user,
  size = 30,
}: {
  user: UserOption | undefined;
  size?: number;
}) {
  const color = userColor(user?.id);
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={userName(user)}
        title={userName(user)}
        className="rounded-full object-cover shrink-0 ring-2 ring-[#0f1115]"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      title={userName(user)}
      className="flex items-center justify-center rounded-full font-bold text-[#0f1115] shrink-0 shadow-sm ring-2 ring-[#0f1115]"
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
  const { isAdmin, isGestorMaster, userRoles, isLoading: roleLoading } = useUserRole();
  const actualIsManager = isManager || isAdmin || isGestorMaster;
  const myTeams = useMemo(() => equipesDoUsuario(userRoles || []), [userRoles]);

  const [me, setMe] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Tarefa | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

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
          .eq("origem", "lista")
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
              if (n.origem !== "lista") return prev;
              if (prev.find((t) => t.id === n.id)) return prev;
              return [n, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as Tarefa;
              if (n.origem !== "lista") return prev;
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

  // Visibilidade: cada usuário vê apenas as tarefas que criou
  // ou as que foram atribuídas a ele.
  const visibleTasks = useMemo(() => {
    if (!me) return [];
    const mine = tarefas.filter(
      (t) => t.criado_por === me || assignees(t).includes(me),
    );
    if (actualIsManager) {
      // "Minhas": criadas por mim e não delegadas a outra pessoa
      if (myView) {
        return mine.filter(
          (t) =>
            t.criado_por === me &&
            assignees(t).every((a) => a === me),
        );
      }
      // "Equipe": tarefas que deleguei a outras pessoas
      return mine.filter(
        (t) => t.criado_por === me && assignees(t).some((a) => a !== me),
      );
    }
    return mine;
  }, [tarefas, me, myView, actualIsManager]);

  const canEditTaskStatus = (task: Tarefa) => {
    return (
      actualIsManager ||
      task.criado_por === me ||
      assignees(task).includes(me || "")
    );
  };


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

  const handleChangeStatus = async (taskId: string, newStatus: string) => {
    const task = tarefas.find((t) => t.id === taskId);
    if (!task) return;
    if (!canEditTaskStatus(task)) {
      toast.error("Você não tem permissão para alterar o status desta tarefa");
      return;
    }

    const previous = tarefas;
    setTarefas((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    const { error } = await supabase
      .from("tarefas")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
      .eq("id", taskId);
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

  const handleCreate = async (form: {
    titulo: string;
    descricao: string;
    prazo: string;
    prioridade: string;
  }) => {
    if (!me) return;
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      atribuido_para: [me],
      criado_por: me,
      prioridade: form.prioridade,
      status: "a-fazer",
      prazo: form.prazo || null,
      publico: false,
      origem: "lista",
      equipes: [],
      progresso: 0,
    } as unknown as Database["public"]["Tables"]["tarefas"]["Insert"];
    const { data, error } = await supabase.from("tarefas").insert(payload).select().single();
    if (error) {
      console.error(error);
      toast.error("Erro ao criar tarefa");
      return;
    }
    if (data) {
      setTarefas((prev) =>
        prev.some((t) => t.id === (data as Tarefa).id)
          ? prev
          : [data as unknown as Tarefa, ...prev],
      );
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
      
      {/* Contêiner principal com paleta azul/slate moderna, bordas arredondadas e sombra */}
      <div className="w-full overflow-hidden rounded-2xl border border-border/50 bg-[rgba(5,11,25,0.8)] text-foreground shadow-xl backdrop-blur-sm">
        {/* Header com espaçamento corrigido (padding maior) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card-secondary/40 px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {myView ? "Minhas Tarefas" : "Tarefas em Lista"}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {myView
                ? "Tarefas privadas criadas por você"
                : actualIsManager
                  ? "Tarefas que você delegou para a equipe"
                  : "Tarefas atribuídas a você"}
            </p>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="group flex items-center gap-2 rounded-xl bg-[#225345] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
          >
            <Plus size={18} className="transition-transform group-hover:rotate-90" />
            Nova Tarefa
          </button>
        </div>

        {/* Content com margens confortáveis */}
        <div className="space-y-6 p-6 sm:p-8">
          {visibleTasks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-card-secondary/20 px-4 py-12 text-center text-muted-foreground">
              Nenhuma tarefa cadastrada
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((task) => {
                const isCompleted = normalizeTaskStatus(task.status) === "concluido";
                const canDelete = task.criado_por === me || actualIsManager;

                return (
                  <div
                    key={task.id}
                    className={`group flex items-center gap-3 rounded-xl border px-5 py-4 transition-all ${
                      isCompleted
                        ? "border-border/40 bg-card/50 hover:border-emerald-500/30"
                        : "border-border/60 bg-card-secondary/40 hover:border-cyan-500/50 hover:bg-card-secondary/60"
                    }`}
                  >
                    <div className="tl-check">
                      <input
                        id={`tl-${task.id}`}
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => void handleToggleTask(task.id, e.target.checked)}
                      />
                      <label htmlFor={`tl-${task.id}`} className="tl-label min-w-0 flex-1">
                        <span
                          className={`block truncate font-medium transition-colors ${
                            isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                          }`}
                        >
                          {task.titulo}
                        </span>
                        {task.descricao && (
                          <span
                            className={`mt-0.5 block line-clamp-1 text-sm transition-opacity ${
                              isCompleted ? "opacity-50 text-muted-foreground line-through" : "text-muted-foreground"
                            }`}
                          >
                            {task.descricao}
                          </span>
                        )}
                      </label>
                    </div>

                    <button
                      onClick={() => setDetailTask(task)}
                      className={`shrink-0 transition-colors ${
                        isCompleted ? "text-muted-foreground hover:text-emerald-400" : "text-muted-foreground hover:text-cyan-400"
                      }`}
                      title="Abrir detalhes"
                    >
                      <MessageSquare size={18} />
                    </button>

                    {task.prazo && (
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                          isCompleted ? "bg-card text-muted-foreground" : "bg-card-secondary/80 text-muted-foreground"
                        }`}
                      >
                        {new Date(task.prazo).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => void handleDelete(task.id)}
                        className="shrink-0 p-1.5 text-muted-foreground opacity-0 transition-colors hover:text-rose-400 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <CreateListaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
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
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: {
    titulo: string;
    descricao: string;
    prazo: string;
    prioridade: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    prazo: "",
    prioridade: "media",
  });

  useEffect(() => {
    if (open) {
      setForm({ titulo: "", descricao: "", prazo: "", prioridade: "media" });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-white">Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Título *
            </label>
            <input
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Descreva a tarefa..."
              className="w-full mt-1 bg-card-secondary border border-border focus:border-cyan-500 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Descrição
            </label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Detalhes (opcional)"
              rows={2}
              className="w-full mt-1 bg-card-secondary border border-border focus:border-cyan-500 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Prioridade
              </label>
              <select
                value={form.prioridade}
                onChange={(e) => setForm((p) => ({ ...p, prioridade: e.target.value }))}
                className="w-full mt-1 bg-card-secondary border border-border focus:border-cyan-500 rounded-md px-3 py-2 text-sm text-foreground outline-none transition-colors"
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
                onChange={(e) => setForm((p) => ({ ...p, prazo: e.target.value }))}
                className="w-full mt-1 bg-card-secondary border border-border focus:border-cyan-500 rounded-md px-3 py-2 text-sm text-foreground outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" className="border-border bg-card-secondary hover:bg-secondary hover:text-white" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
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
  const [progresso, setProgresso] = useState(0);
  const [savingProgresso, setSavingProgresso] = useState(false);

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
    setProgresso(Math.max(0, Math.min(100, Number(task.progresso) || 0)));
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

  const assigned = userById.get(assignees(task)[0] || "");
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

  const podeEditarProgresso =
    canManage || task.criado_por === meId || assignees(task).includes(meId || "");

  const salvarProgresso = async (valor: number) => {
    setSavingProgresso(true);
    const { error } = await (supabase as any)
      .from("tarefas")
      .update({ progresso: valor, atualizado_em: new Date().toISOString() })
      .eq("id", task.id);
    setSavingProgresso(false);
    if (error) toast.error("Erro ao salvar progresso");
    else toast.success("Progresso atualizado");
  };


  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="truncate text-white">{task.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm mt-2">
          {task.descricao && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {task.descricao}
            </p>
          )}

          <div className="flex flex-wrap gap-4 rounded-lg bg-card-secondary/50 p-4 border border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Atribuído:</span>
              <Avatar user={assigned} size={22} />
              <span>{assigned ? (assigned.full_name || assigned.display_name || assigned.email) : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Criado por:</span>
              <Avatar user={creator} size={22} />
              <span>{creator ? (creator.full_name || creator.display_name || creator.email) : "—"}</span>
            </div>
            {task.prazo && (
              <div className="flex items-center gap-1.5">
                 <span className="font-semibold text-muted-foreground">Prazo:</span>
                📅 {new Date(task.prazo).toLocaleDateString("pt-BR")}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Status:</span>
              <span className="px-2 py-0.5 rounded-full bg-card-secondary border border-border">
                {task.status === "concluido" || task.status === "concluído" ? "✅ Concluída" : task.status?.toLowerCase().includes("em") ? "⏳ Em Andamento" : "⏳ Pendente"}
              </span>
            </div>
          </div>

          {/* Progresso da tarefa */}
          <div className="rounded-lg border border-border/50 bg-card-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Progresso
              </label>
              <span className="text-xs font-semibold text-foreground">{progresso}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progresso}
              disabled={!podeEditarProgresso}
              onChange={(e) => setProgresso(Number(e.target.value))}
              onMouseUp={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
              className="w-full mt-3 disabled:opacity-50 accent-cyan-500 cursor-pointer"
            />
            {savingProgresso && (
              <p className="text-[10.5px] text-cyan-400 mt-1">Salvando…</p>
            )}
          </div>



          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={14} /> Comentários ({comments.length})
              </label>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {loading ? (
                <div className="text-xs text-muted-foreground text-center py-4">Carregando...</div>
              ) : comments.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  Nenhum comentário ainda.
                </div>
              ) : (
                comments.map((c) => {
                  const u = userById.get(c.usuario_id);
                  const mine = c.usuario_id === meId;
                  return (
                    <div
                      key={c.id}
                      className="flex gap-3 items-start p-3 rounded-xl bg-card-secondary/50 border border-border/30"
                    >
                      <Avatar user={u} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-muted-foreground truncate">
                            {u ? (u.full_name || u.display_name || u.email) : "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
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
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                          {c.comentario}
                        </div>
                      </div>
                      {(mine || canManage) && (
                        <button
                          onClick={() => void handleDeleteComment(c.id)}
                          className="text-muted-foreground hover:text-rose-400 transition-colors pt-0.5"
                          aria-label="Excluir comentário"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row relative">
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
                className="flex-1 bg-card-secondary border border-border focus:border-cyan-500 rounded-lg pl-4 pr-12 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground"
              />
              <Button 
                onClick={() => void handleSend()} 
                size="icon" 
                className="absolute right-1 top-1 bottom-1 h-auto w-9 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
