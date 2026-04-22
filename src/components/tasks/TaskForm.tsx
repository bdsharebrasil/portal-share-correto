// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TaskFormData {
  titulo: string;
  descricao: string;
  prazo: string;
  prioridade: "baixa" | "media" | "alta";
  status: "aberto" | "em_progresso" | "concluida";
  atribuido_para: string;
}

interface TaskFormProps {
  task?: Task;
  onSave: () => void;
  onCancel: () => void;
}

interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  prioridade: "baixa" | "media" | "alta";
  status: "aberto" | "em_progresso" | "concluida";
  atribuido_para: string | null;
  criado_por: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  tipo: string | null;
}

export default function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    titulo: "",
    descricao: "",
    prazo: "",
    prioridade: "media",
    status: "aberto",
    atribuido_para: "",
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
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Não foi possível carregar a lista de usuários");
      return;
    }

    setUsers((data ?? []).map(u => ({ ...u, tipo: null })) as UserProfile[]);
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
    void fetchUsers();
  }, [fetchCurrentUser, fetchUsers]);

  useEffect(() => {
    if (task) {
      setFormData({
        titulo: task.titulo ?? "",
        descricao: task.descricao ?? "",
        prazo: task.prazo ?? "",
        prioridade: task.prioridade ?? "media",
        status: task.status ?? "aberto",
        atribuido_para: task.atribuido_para ?? currentUserId,
      });
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        prazo: "",
        prioridade: "media",
        status: "aberto",
        atribuido_para: currentUserId,
      });
    }
  }, [task, currentUserId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Por favor, preencha o título da tarefa");
      return;
    }

    if (!currentUserId) {
      toast.error("Erro: usuário não identificado");
      console.error("currentUserId está vazio");
      return;
    }

    setLoading(true);

    try {
      const taskPayload = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        prazo: formData.prazo ? formData.prazo : null,
        prioridade: formData.prioridade,
        status: formData.status,
        atribuido_para: formData.atribuido_para && formData.atribuido_para !== currentUserId ? formData.atribuido_para : null,
        criado_por: currentUserId,
      };

      console.log("📋 Payload da tarefa:", taskPayload);
      console.log("👤 currentUserId:", currentUserId);
      console.log("🔐 auth.uid() será:", currentUserId);

      if (task) {
        console.log("✏️ Atualizando tarefa:", task.id);
        const { error } = await supabase
          .from("tarefas")
          .update(taskPayload)
          .eq("id", task.id);

        if (error) {
          console.error("❌ Erro ao atualizar tarefa:", error);
          toast.error(`Erro ao atualizar tarefa: ${error.message}`);
          return;
        }

        console.log("✅ Tarefa atualizada com sucesso!");
        toast.success("Tarefa atualizada com sucesso!");
      } else {
        console.log("➕ Criando nova tarefa");
        const { error } = await supabase.from("tarefas").insert([taskPayload]);

        if (error) {
          console.error("❌ Erro ao criar tarefa:", error);
          console.error("Detalhes do erro:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          
          let errorMsg = "Erro ao criar tarefa";
          if (error.message.includes("check constraint")) {
            errorMsg = "Valores inválidos no formulário (status ou prioridade)";
          } else if (error.message.includes("RLS")) {
            errorMsg = "Permissão negada. Você precisa estar autenticado como usuário comum.";
          }
          
          toast.error(errorMsg);
          return;
        }

        console.log("✅ Tarefa criada com sucesso!");
        toast.success("Tarefa criada com sucesso!");
      }

      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</CardTitle>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={formData.titulo}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, titulo: event.target.value }))
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
                setFormData((prev) => ({ ...prev, descricao: event.target.value }))
              }
              rows={3}
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
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.prazo
                      ? format(new Date(formData.prazo), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={formData.prazo ? new Date(formData.prazo) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setFormData((prev) => ({ ...prev, prazo: formattedDate }));
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
                value={formData.prioridade}
                onValueChange={(value: TaskFormData["prioridade"]) =>
                  setFormData((prev) => ({ ...prev, prioridade: value }))
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
              value={formData.status}
              onValueChange={(value: TaskFormData["status"]) =>
                setFormData((prev) => ({ ...prev, status: value }))
              }
              disabled={loading}
            >
              <SelectTrigger id="task-status">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_progresso">Em Progresso</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canAssignToOthers ? (
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Atribuir para (opcional)</Label>
              <Select
                value={formData.atribuido_para}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, atribuido_para: value }))
                }
                disabled={loading}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Selecione um usuário ou não atribuir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentUserId}>não atribuir</SelectItem>
                  {users
                    .filter((user) => user.id !== currentUserId)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} {user.tipo ? `(${user.tipo})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
