import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "./StatusPill";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { List, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PipelineItem {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  data: string;
  tipo: string;
}

export function PipelineTable() {
  const navigate = useNavigate();

  const { data: pipelineData = [], isLoading } = useQuery({
    queryKey: ["pipeline-recente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("id, descricao, valor, status, data, tipo_movimento")
        .order("data", { ascending: false })
        .limit(8);

      if (error) throw error;

      return data?.map(item => ({
        id: item.id,
        descricao: item.descricao,
        valor: Number(item.valor),
        status: item.status || "pendente",
        data: item.data,
        tipo: item.tipo_movimento,
      })) || [];
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <List className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Pipeline de Transações
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Últimas movimentações registradas
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/financeiro")}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Ver todos
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Data
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pipelineData.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-secondary/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <span className="text-sm font-medium text-foreground truncate block max-w-[200px]">
                        {item.descricao}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                        item.tipo === "entrada" 
                          ? "bg-success/10 text-success" 
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {item.tipo === "entrada" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(item.data)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`text-sm font-semibold ${
                        item.tipo === "entrada" ? "text-success" : "text-destructive"
                      }`}>
                        {item.tipo === "entrada" ? "+" : "-"}
                        {formatCurrency(item.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
