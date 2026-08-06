import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Users, Phone, MapPin, Calendar, DollarSign, FileText } from "lucide-react";

interface Colaborador {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  endereco: string | null;
  telefone: string | null;
  admission_date: string | null;
  cpf: string | null;
  rg: string | null;
  canac: string | null;
  salario: number | null;
  employment_status: string;
  tipo: string | null;
}

export function ColaboradoresListTab() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: colaboradores = [], isLoading, error } = useQuery({
    queryKey: ["colaboradores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url, endereco, telefone, admission_date, cpf, rg, canac, salario, employment_status, tipo")
        .neq("tipo", null)
        .order("full_name");

      if (error) throw error;
      return data as unknown as Colaborador[];
    },
  });

  const filteredColaboradores = colaboradores.filter((c) =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email?.toLowerCase() ?? "").includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-green-500/10 text-green-500";
      case "inativo":
        return "bg-red-500/10 text-red-500";
      case "afastado":
        return "bg-yellow-500/10 text-yellow-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando colaboradores...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            <p>Erro ao carregar colaboradores</p>
          </CardContent>
        </Card>
      ) : filteredColaboradores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum colaborador encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredColaboradores.map((colab) => (
            <Card key={colab.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                {/* Header com Avatar e Nome */}
                <div className="flex items-start gap-4 mb-4 pb-4 border-b border-border">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={colab.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {getInitials(colab.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{colab.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{colab.email}</p>
                    <Badge className={`${getStatusColor(colab.employment_status)} mt-2`}>
                      {colab.employment_status}
                    </Badge>
                  </div>
                </div>

                {/* Informações Pessoais */}
                <div className="space-y-3 text-sm">
                  {/* Telefone */}
                  {colab.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{colab.telefone}</span>
                    </div>
                  )}

                  {/* Endereço */}
                  {colab.endereco && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-xs break-words">{colab.endereco}</span>
                    </div>
                  )}

                  {/* Data de Admissão */}
                  {colab.admission_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {new Date(colab.admission_date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}

                  {/* Salário */}
                  {colab.salario && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        R$ {colab.salario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {/* Documentos */}
                  <div className="pt-2 border-t border-border space-y-1">
                    {colab.cpf && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">CPF: {colab.cpf}</span>
                      </div>
                    )}
                    {colab.rg && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">RG: {colab.rg}</span>
                      </div>
                    )}
                    {colab.canac && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">CANAC: {colab.canac}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
