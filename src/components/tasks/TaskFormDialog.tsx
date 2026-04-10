// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface TaskFormDialogProps {
  taskId?: string;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function TaskFormDialog({ taskId, onSuccess, children }: TaskFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "aberto",
    priority: "media",
    due_date: "",
    assigned_to: ""
  });

  useEffect(() => {
    if (open) {
      loadUsers();
      if (taskId) {
        loadTask();
      }
    }
  }, [open, taskId]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .order("full_name");
    
    if (data) setUsers(data);
  };

  const loadTask = async () => {
    if (!taskId) return;
    
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();
    
    if (data) {
      setFormData({
        title: data.title,
        description: data.descricao || "",
        status: data.status,
        priority: data.priority,
        due_date: data.data_vencimento || "",
        assigned_to: data.assigned_to || ""
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      console.log("👤 Usuário logado:", user.id);

      const taskData = {
        title: formData.title,
        description: formData.descricao || null,
        due_date: formData.data_vencimento || null,
        priority: formData.priority,
        status: formData.status,
        assigned_to: formData.assigned_to || null,
        created_by: user.id,
      };

      console.log("📋 Dados da tarefa:", taskData);

      if (taskId) {
        console.log("✏️ Atualizando tarefa:", taskId);
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", taskId);
        
        if (error) {
          console.error("❌ Erro ao atualizar:", error);
          throw error;
        }
        console.log("✅ Tarefa atualizada");
        toast.success("Tarefa atualizada com sucesso!");
      } else {
        console.log("➕ Criando nova tarefa");
        const { error } = await supabase
          .from("tasks")
          .insert([taskData]);
        
        if (error) {
          console.error("❌ Erro ao criar:", error);
          console.error("Detalhes:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          
          let errorMsg = error.message || "Erro ao salvar tarefa";
          if (error.message.includes("check constraint")) {
            errorMsg = "Valores inválidos no formulário (status ou prioridade)";
          } else if (error.message.includes("RLS")) {
            errorMsg = "Permissão negada. Verifique as permissões do usuário.";
          }
          throw new Error(errorMsg);
        }
        console.log("✅ Tarefa criada");
        toast.success("Tarefa criada com sucesso!");
      }

      setOpen(false);
      setFormData({
        title: "",
        description: "",
        status: "aberto",
        priority: "media",
        due_date: "",
        assigned_to: ""
      });
      onSuccess?.();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao salvar tarefa";
      console.error("💥 Erro final:", errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{taskId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigned_to">Atribuir para</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data_vencimento">Data de Vencimento</Label>
              <Input
                id="data_vencimento"
                type="data"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
