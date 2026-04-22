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
    titulo: "",
    descricao: "",
    status: "aberto",
    prioridade: "media",
    prazo: "",
    atribuido_para: ""
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
      .from("tarefas")
      .select("*")
      .eq("id", taskId)
      .single();

    if (data) {
      setFormData({
        titulo: data.titulo,
        descricao: data.descricao || "",
        status: data.status,
        prioridade: data.prioridade,
        prazo: data.prazo || "",
        atribuido_para: data.atribuido_para || ""
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
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        prazo: formData.prazo || null,
        prioridade: formData.prioridade,
        status: formData.status,
        atribuido_para: formData.atribuido_para || null,
        criado_por: user.id,
      };

      console.log("📋 Dados da tarefa:", taskData);

      if (taskId) {
        console.log("✏️ Atualizando tarefa:", taskId);
        const { error } = await supabase
          .from("tarefas")
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
          .from("tarefas")
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
        titulo: "",
        descricao: "",
        status: "aberto",
        prioridade: "media",
        prazo: "",
        atribuido_para: ""
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
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
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
                  <SelectItem value="em_progresso">Em Progresso</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="atribuido_para">Atribuir para</Label>
              <Select
                value={formData.atribuido_para}
                onValueChange={(value) => setFormData({ ...formData, atribuido_para: value })}
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
              <Label htmlFor="prazo">Data de Vencimento</Label>
              <Input
                id="prazo"
                type="date"
                value={formData.prazo}
                onChange={(e) => setFormData({ ...formData, prazo: e.target.value })}
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
