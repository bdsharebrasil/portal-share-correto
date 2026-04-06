import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit2, Trash2, X, CheckSquare, Eye } from "lucide-react";
import { toast } from "sonner";
import TaskForm from "@/components/tasks/TaskForm";
import NotesTab from "@/components/tasks/NotesTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em progresso" | "concluida";
  assigned_to: string | null;
  requested_by: string | null;
  created_at: string;
  created_by?: string | null;
}

interface TaskNotification {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  status_changed_to: string;
  read: boolean;
  created_at: string;
}

export default function MinhasTarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  useEffect(() => {
    void fetchTasks();
    void fetchNotifications();

    // Subscribe to notification changes
    const channel = supabase
      .channel('task-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_notifications'
        },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar tarefas:", error);
      toast.error("Erro ao carregar tarefas");
      setLoadingTasks(false);
      return;
    }

    setTasks((data ?? []) as any);
    setLoadingTasks(false);
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("task_notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao carregar notificações:", error);
      setNotifications([]);
      return;
    }

    setNotifications((data ?? []) as TaskNotification[]);
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("task_notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }

    void fetchNotifications();
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`Deseja realmente excluir a tarefa "${task.title}"?`)) {
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      console.error("Erro ao deletar tarefa:", error);
      toast.error("Erro ao deletar tarefa");
      return;
    }

    toast.success("Tarefa deletada com sucesso!");
    void fetchTasks();
  };

  const toggleTask = async (task: Task, checked: boolean) => {
    const nextStatus: Task["status"] = checked ? "concluida" : "aberto";
    const { error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);
    if (error) {
      console.error("Erro ao atualizar tarefa:", error);
      toast.error("Erro ao atualizar tarefa");
      return;
    }

    // Criar notificação se a tarefa foi atribuída a alguém (assigned_to !== created_by)
    if (task.assigned_to && task.created_by && task.assigned_to !== task.created_by) {
      const statusMap = {
        "pendente": "Pendente",
        "em_progresso": "Em Progresso",
        "concluida": "Concluída"
      };

      const notificationMessage = `Tarefa "${task.title}" foi marcada como ${statusMap[nextStatus]}`;

      const { error: notificationError } = await supabase
        .from("task_notifications")
        .insert({
          task_id: task.id,
          user_id: task.created_by,
          message: notificationMessage,
          status_changed_to: nextStatus,
          read: false,
          created_at: new Date().toISOString()
        });

      if (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
        // Não impedir a atualização da tarefa se a notificação falhar
      }
    }

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
  };

  const handleSave = () => {
    void fetchTasks();
    void fetchNotifications();
    setShowForm(false);
    setEditingTask(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "alta":
        return "bg-red-500";
      case "media":
        return "bg-yellow-500";
      case "baixa":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "concluida":
        return "bg-green-600";
      case "em progresso":
        return "bg-blue-600";
      case "pendente":
        return "bg-gray-600";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "concluida":
        return "Concluída";
      case "em progresso":
        return "Em Progresso";
      case "pendente":
        return "Pendente";
      default:
        return status;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Minhas Tarefas</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas atividades, acompanhe o progresso e organize suas notas
            </p>
          </div>
        </div>

        <Tabs defaultValue="tarefas" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="border-b border-border bg-transparent w-full justify-start rounded-none px-0">
            <TabsTrigger value="tarefas" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="notas" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Notas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-4 mt-4 flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Minhas Tarefas</h2>
                </div>
                <Button onClick={handleNewTask} className="flex items-center gap-2">
                  {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showForm ? "Cancelar" : "Nova Tarefa"}
                </Button>
              </div>

              {showForm && (
                <div className="border-b border-border pb-4 mb-4 flex-shrink-0">
                  <Card className="border-dashed">
                    <CardContent className="p-6">
                      <TaskForm
                        task={editingTask ?? undefined}
                        onSave={handleSave}
                        onCancel={handleCancel}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0">
                {loadingTasks ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Carregando tarefas...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhuma tarefa encontrada
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {tasks.map((task) => (
                      <div key={task.id} className="space-y-0">
                        <Card
                          className="hover:shadow-md transition-all cursor-pointer"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={task.status === 'concluida'}
                                onCheckedChange={(v) => {
                                  toggleTask(task, Boolean(v));
                                }}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <h3 className={`text-sm font-semibold leading-tight break-words ${task.status === 'concluida'
                                        ? 'line-through text-muted-foreground'
                                        : 'text-foreground'
                                      }`}>
                                      {task.title}
                                    </h3>
                                    {task.descricao && (
                                      <p className="text-muted-foreground text-xs mt-1 line-clamp-1">
                                        {task.descricao}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingTask(viewingTask?.id === task.id ? null : task);
                                      }}
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      title="Ver detalhes"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(task);
                                      }}
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      title="Editar"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(task);
                                      }}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      title="Deletar"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex gap-2 mt-2 flex-wrap">
                                  <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </Badge>
                                  <Badge className={`${getStatusColor(task.status)} text-xs`}>
                                    {getStatusLabel(task.status)}
                                  </Badge>
                                  {task.due_date && (
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {viewingTask?.id === task.id && (
                          <Card className="rounded-t-none border-t-0 bg-muted/30 animate-in fade-in slide-in-from-top-1 duration-200">
                            <CardContent className="p-4 space-y-4">
                              {task.descricao && (
                                <div>
                                  <h3 className="font-semibold text-sm mb-2 text-foreground">Descrição</h3>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                    {task.descricao}
                                  </p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h3 className="font-semibold text-sm mb-2 text-foreground">Prioridade</h3>
                                  <Badge className={getPriorityColor(task.priority)}>
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </Badge>
                                </div>

                                <div>
                                  <h3 className="font-semibold text-sm mb-2 text-foreground">Status</h3>
                                  <Badge className={getStatusColor(task.status)}>
                                    {getStatusLabel(task.status)}
                                  </Badge>
                                </div>
                              </div>

                              {task.due_date && (
                                <div>
                                  <h3 className="font-semibold text-sm mb-2 text-foreground">Prazo</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={() => {
                                    handleEdit(task);
                                    setViewingTask(null);
                                  }}
                                  size="sm"
                                  className="flex-1"
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    handleDelete(task);
                                    setViewingTask(null);
                                  }}
                                  size="sm"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notas" className="flex-1 overflow-y-auto min-h-0 mt-4">
            <NotesTab />
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
}
