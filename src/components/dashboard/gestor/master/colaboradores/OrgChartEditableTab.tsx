import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, Users } from "lucide-react";

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

      {departamentos?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum departamento cadastrado</p>
          </CardContent>
        </Card>
      )}

      {/* Estrutura visual do organograma */}
      <div className="flex flex-col items-center gap-8">
        {/* Empresa no topo */}
        <Card className="w-64 bg-primary text-primary-foreground">
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
        <div className="flex flex-wrap justify-center gap-6">
          {departamentos?.map((dept, index) => (
            <div key={dept.id} className="flex flex-col items-center">
              {/* Linha horizontal para conectar */}
              {index === 0 && departamentos.length > 1 && (
                <div className="absolute top-0 left-1/2 w-full h-0.5 bg-border -translate-y-8"></div>
              )}

              <Card
                className="w-56 relative"
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
