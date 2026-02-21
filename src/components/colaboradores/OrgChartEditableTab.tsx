import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Edit, Trash2, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  departamento_pai_id: string | null;
}

interface ColaboradorDepartamento {
  id: string;
  colaborador_id: string;
  departamento_id: string;
  cargo: string | null;
  colaborador?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Colaborador {
  id: string;
  full_name: string;
  avatar_url: string | null;
  salario: number | null;
}

export function OrgChartEditableTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [newDept, setNewDept] = useState({ nome: "", descricao: "", cor: "#6366f1" });
  const [newMember, setNewMember] = useState({ colaborador_id: "", cargo: "", salario: "" });

  const { data: departamentos } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data as Departamento[];
    },
  });

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url, salario")
        .eq("tipo", "colaborador")
        .order("full_name");
      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const { data: membros } = useQuery({
    queryKey: ["colaborador-departamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_departamento")
        .select(`
          id,
          colaborador_id,
          departamento_id,
          cargo
        `);
      if (error) throw error;
      
      // Buscar dados dos colaboradores separadamente
      const colaboradorIds = data.map(m => m.colaborador_id);
      const { data: colaboradoresData } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url")
        .in("id", colaboradorIds);
      
      return data.map(m => ({
        ...m,
        colaborador: colaboradoresData?.find(c => c.id === m.colaborador_id)
      })) as ColaboradorDepartamento[];
    },
  });

  const addDeptMutation = useMutation({
    mutationFn: async (dept: typeof newDept) => {
      const { error } = await supabase.from("departamentos").insert({
        nome: dept.nome,
        descricao: dept.descricao || null,
        cor: dept.cor,
        criado_por: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      setIsAddDeptOpen(false);
      setNewDept({ nome: "", descricao: "", cor: "#6366f1" });
      toast.success("Departamento criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar departamento"),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast.success("Departamento removido!");
    },
    onError: () => toast.error("Erro ao remover departamento"),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (member: typeof newMember & { departamento_id: string }) => {
      // Atualiza o salário do colaborador
      if (member.salario) {
        await supabase
          .from("user_profiles")
          .update({ salario: parseFloat(member.salario) })
          .eq("id", member.colaborador_id);
      }

      const { error } = await supabase.from("colaborador_departamento").insert({
        colaborador_id: member.colaborador_id,
        departamento_id: member.departamento_id,
        cargo: member.cargo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaborador-departamento"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-list"] });
      setIsAddMemberOpen(false);
      setNewMember({ colaborador_id: "", cargo: "", salario: "" });
      setSelectedDept(null);
      toast.success("Colaborador adicionado ao departamento!");
    },
    onError: () => toast.error("Erro ao adicionar colaborador"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaborador_departamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaborador-departamento"] });
      toast.success("Colaborador removido do departamento!");
    },
    onError: () => toast.error("Erro ao remover colaborador"),
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getMembrosDoDepto = (deptId: string) => {
    return membros?.filter((m) => m.departamento_id === deptId) || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Organograma Editável</h2>
        <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Departamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Departamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Departamento</Label>
                <Input
                  value={newDept.nome}
                  onChange={(e) => setNewDept({ ...newDept, nome: e.target.value })}
                  placeholder="Ex: Financeiro"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={newDept.descricao}
                  onChange={(e) => setNewDept({ ...newDept, descricao: e.target.value })}
                  placeholder="Descrição do departamento"
                />
              </div>
              <div>
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={newDept.cor}
                  onChange={(e) => setNewDept({ ...newDept, cor: e.target.value })}
                  className="h-10 w-20"
                />
              </div>
              <Button
                onClick={() => addDeptMutation.mutate(newDept)}
                disabled={!newDept.nome || addDeptMutation.isPending}
                className="w-full"
              >
                Criar Departamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {departamentos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum departamento cadastrado</p>
            <p className="text-sm">Clique em "Novo Departamento" para começar</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departamentos?.map((dept) => (
          <Card
            key={dept.id}
            className="relative overflow-hidden"
            style={{ borderTopColor: dept.cor || "#6366f1", borderTopWidth: "4px" }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{dept.nome}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedDept(dept.id);
                      setIsAddMemberOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDeptMutation.mutate(dept.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {dept.descricao && (
                <p className="text-sm text-muted-foreground">{dept.descricao}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {getMembrosDoDepto(dept.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum colaborador
                  </p>
                ) : (
                  getMembrosDoDepto(dept.id).map((membro) => (
                    <div
                      key={membro.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={membro.colaborador?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {membro.colaborador ? getInitials(membro.colaborador.full_name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {membro.colaborador?.full_name || "Colaborador"}
                          </p>
                          {membro.cargo && (
                            <Badge variant="secondary" className="text-xs">
                              {membro.cargo}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeMemberMutation.mutate(membro.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador ao Departamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select
                value={newMember.colaborador_id}
                onValueChange={(v) => setNewMember({ ...newMember, colaborador_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cargo/Função</Label>
              <Input
                value={newMember.cargo}
                onChange={(e) => setNewMember({ ...newMember, cargo: e.target.value })}
                placeholder="Ex: Gerente, Analista..."
              />
            </div>
            <div>
              <Label>Salário (R$)</Label>
              <Input
                type="number"
                value={newMember.salario}
                onChange={(e) => setNewMember({ ...newMember, salario: e.target.value })}
                placeholder="Ex: 5000.00"
              />
            </div>
            <Button
              onClick={() =>
                selectedDept &&
                addMemberMutation.mutate({ ...newMember, departamento_id: selectedDept })
              }
              disabled={!newMember.colaborador_id || addMemberMutation.isPending}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
