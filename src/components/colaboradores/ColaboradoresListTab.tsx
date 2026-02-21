import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Mail, Phone, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Colaborador {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  departamento: string | null;
  employment_status: string | null;
  admission_date: string | null;
  salario: number | null;
}

export function ColaboradoresListTab() {
  const [search, setSearch] = useState("");

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("tipo", "colaborador")
        .order("full_name");

      if (error) throw error;
      return data as Colaborador[];
    },
  });

  const filteredColaboradores = colaboradores?.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.departamento?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "ativo":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "inativo":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "ferias":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="px-4 py-2">
          {filteredColaboradores?.length || 0} colaboradores
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredColaboradores?.map((colaborador) => (
          <Card key={colaborador.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={colaborador.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(colaborador.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground truncate">
                      {colaborador.display_name || colaborador.full_name}
                    </h3>
                    <Badge className={getStatusColor(colaborador.employment_status)}>
                      {colaborador.employment_status || "N/A"}
                    </Badge>
                  </div>
                  
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{colaborador.email}</span>
                    </div>
                    {colaborador.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{colaborador.phone}</span>
                      </div>
                    )}
                    {colaborador.departamento && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{colaborador.departamento}</span>
                      </div>
                    )}
                    {colaborador.admission_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Admissão: {format(new Date(colaborador.admission_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredColaboradores?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum colaborador encontrado
        </div>
      )}
    </div>
  );
}
