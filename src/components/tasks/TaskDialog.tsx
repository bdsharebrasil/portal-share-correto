import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

interface TaskFormData {
  title: string;
  description: string;
  due_date: string;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em_progresso" | "concluida";
  assigned_to: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  onSave: () => void;
}

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em_progresso" | "concluida";
  assigned_to: string | null;
  requested_by: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  tipo: string | null;
}

export default function TaskDialog({ open, onOpenChange, task, onSave }: TaskDialogProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    due_date: "",
    priority: "media",
    status: "pendente",
    assigned_to: "",
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [canAssignToOthers, setCanAssignToOthers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const { roles } = useAuth();

  const fetchCurrentUser = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Erro ao obter usuário atual:", error);
      toast.error("Não foi possível obter o usuário atual");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    setCurrentUserId(user.id);

    const allowedRoles = new Set(["admin", "piloto_chefe", "financeiro_master"]);
    setCanAssignToOthers(roles.some((role) => allowedRoles.has(role)));
  }, [roles]);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true});

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Não foi possível carregar a lista de usuários");
      return;
    }

    // Adicionar tipo opcional
    setUsers((data ?? []).map(u => ({ ...u, tipo: null })) as UserProfile[]);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void fetchCurrentUser();
    void fetchUsers();
  }, [fetchCurrentUser, fetchUsers, open]);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title ?? "",
        description: task.descricao ?? "",
        due_date: task.data_vencimento ?? "",
        priority: task.priority ?? "media",
        status: task.situacao ?? "pendente",
        assigned_to: task.assigned_to ?? currentUserId,
      });
    } else {
      setFormData({
        title: "",
        description: "",
        due_date: "",
        priority: "media",
        status: "pendente",
        assigned_to: currentUserId,
      });
    }
  }, [task, currentUserId, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Por favor, preencha o título da tarefa");
      return;
    }

    if (canAssignToOthers && !formData.assigned_to) {
      toast.error("Selecione um responsável pela tarefa");
      return;
    }

    setLoading(true);

    const taskPayload = {
      title: formData.title.trim(),
      description: formData.descricao.trim() || null,
      due_date: formData.data_vencimento ? formData.data_vencimento : null,
      priority: formData.priority,
      status: formData.situacao,
      assigned_to: canAssignToOthers ? formData.assigned_to : currentUserId,
      created_by: currentUserId,
    };

    if (task) {
      const { error } = await supabase
        .from("tasks")
        .update(taskPayload)
        .eq("id", task.id);

      if (error) {
        console.error("Erro ao atualizar tarefa:", error);
        toast.error("Erro ao atualizar tarefa");
        setLoading(false);
        return;
      }

      toast.success("Tarefa atualizada com sucesso!");
    } else {
      const { error } = await supabase.from("tasks").insert([taskPayload]);

      if (error) {
        console.error("Erro ao criar tarefa:", error);
        toast.error("Erro ao criar tarefa");
        setLoading(false);
        return;
      }

      toast.success("Tarefa criada com sucesso!");
    }

    setLoading(false);
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, title: event.target.value }))
              }
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={formData.descricao}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Prazo</Label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {formData.data_vencimento
                      ? format(new Date(formData.data_vencimento), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={formData.data_vencimento ? new Date(formData.data_vencimento) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setFormData((prev) => ({ ...prev, due_date: formattedDate }));
                        setDueDateOpen(false);
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: TaskFormData["priority"]) =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
                disabled={loading}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-status">Status</Label>
            <Select
              value={formData.situacao}
              onValueChange={(value: TaskFormData["situacao"]) =>
                setFormData((prev) => ({ ...prev, status: value }))
              }
              disabled={loading}
            >
              <SelectTrigger id="task-status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_progresso">Em Progresso</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canAssignToOthers ? (
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Atribuir para</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, assigned_to: value }))
                }
                disabled={loading}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} {user.tipo ? `(${user.tipo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
