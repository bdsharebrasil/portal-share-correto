import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Plus, Trash2 } from "lucide-react";

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
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
}

export function OrgChartEditableTab() {
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

  const { data: membros } = useQuery({
    queryKey: ["colaborador-departamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_departamento")
        .select(`id, colaborador_id, departamento_id, cargo`);
      if (error) throw error;

      const colaboradorIds = data.map((m) => m.colaborador_id);
      const { data: colaboradoresData } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url")
        .in("id", colaboradorIds);

      return data.map((m) => ({
        ...m,
        colaborador: colaboradoresData?.find((c) => c.id === m.colaborador_id),
      })) as ColaboradorDepartamento[];
    },
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [selectedColabId, setSelectedColabId] = useState("");
  const [cargo, setCargo] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url")
        .eq("tipo", "colaborador")
        .eq("employment_status", "ativo")
        .order("full_name");

      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!activeDeptId || !selectedColabId) {
        throw new Error("Selecione um departamento e um colaborador");
      }

      const { error } = await supabase
        .from("colaborador_departamento")
        .insert({
          departamento_id: activeDeptId,
          colaborador_id: selectedColabId,
          cargo: cargo || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaborador-departamento"] });
      toast({ title: "Colaborador adicionado ao departamento" });
      setAssignOpen(false);
      setSelectedColabId("");
      setCargo("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar colaborador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("colaborador_departamento")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaborador-departamento"] });
      toast({ title: "Colaborador removido do departamento" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover colaborador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openAssignDialog = (deptId: string) => {
    setActiveDeptId(deptId);
    setSelectedColabId("");
    setCargo("");
    setAssignOpen(true);
  };

  const handleAssign = () => {
    assignMutation.mutate();
  };

  const handleRemove = (id: string) => {
    removeMutation.mutate(id);
  };

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
      <h2 className="text-lg font-semibold">Organograma Editável</h2>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar colaborador ao departamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Departamento</p>
              <div className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                {departamentos?.find((d) => d.id === activeDeptId)?.nome ?? "Selecione um departamento"}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Colaborador</p>
              <Select value={selectedColabId} onValueChange={setSelectedColabId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colab) => (
                    <SelectItem key={colab.id} value={colab.id}>
                      {colab.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Cargo (opcional)</p>
              <Input
                value={cargo}
                onChange={(event) => setCargo(event.target.value)}
                placeholder="Ex: Analista, Coordenador"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedColabId || assignMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {departamentos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum departamento cadastrado</p>
          </CardContent>
        </Card>
      )}

      {/* Estrutura visual do organograma */}
      <div className="flex min-w-0 flex-col items-center gap-8">
        {/* Empresa no topo */}
        <Card className="w-full max-w-[16rem] bg-primary text-primary-foreground">

          <CardContent className="py-4 text-center">
            <Building2 className="h-8 w-8 mx-auto mb-2" />
            <h3 className="font-bold text-lg">Share Brasil</h3>
            <p className="text-sm opacity-80">Aviação Executiva</p>
          </CardContent>
        </Card>

        {/* Linha conectora */}
        {departamentos && departamentos.length > 0 && (
          <div className="w-0.5 h-8 bg-border"></div>
        )}

        {/* Departamentos */}
        <div className="flex w-full flex-wrap justify-center gap-6">
          {departamentos?.map((dept, index) => (
            <div key={dept.id} className="flex w-full max-w-[14rem] flex-col items-center sm:w-56">
              {/* Linha horizontal para conectar */}
              {index === 0 && departamentos.length > 1 && (
                <div className="absolute top-0 left-1/2 w-full h-0.5 bg-border -translate-y-8"></div>
              )}

              <Card
                className="relative w-full"

                style={{
                  borderTopColor: dept.cor || "#6366f1",
                  borderTopWidth: "4px",
                }}
              >
                <CardContent className="py-4">
                  <div className="text-center mb-3">
                    <h4 className="font-semibold">{dept.nome}</h4>
                    {dept.descricao && (
                      <p className="text-xs text-muted-foreground">{dept.descricao}</p>
                    )}
                    <Badge variant="outline" className="mt-2">
                      <Users className="h-3 w-3 mr-1" />
                      {getMembrosDoDepto(dept.id).length} membros
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => openAssignDialog(dept.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-2 mt-4">
                    {getMembrosDoDepto(dept.id).map((membro) => (
                      <div
                        key={membro.id}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={membro.colaborador?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {membro.colaborador
                              ? getInitials(membro.colaborador.full_name)
                              : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {membro.colaborador?.full_name}
                          </p>
                          {membro.cargo && (
                            <p className="text-xs text-muted-foreground">{membro.cargo}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto p-0"
                          onClick={() => handleRemove(membro.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {getMembrosDoDepto(dept.id).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Sem membros
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
