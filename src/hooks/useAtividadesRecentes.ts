import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Atividade {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  tipo_movimento: string;
  timeAgo: string;
}

export function useAtividadesRecentes() {
  return useQuery({
    queryKey: ["atividades-recentes"],
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await (supabase as any).from("movimentacoes")
        .select(
          "id, descricao, valor_rateado, valor_original, status, tipo, data_pagamento, data_vencimento, data_competencia"
        )
        .order("data_competencia", { ascending: false })
        .limit(10);

      if (error) throw error;

      return (
        data?.map((item: any) => ({
          id: item.id,
          descricao: item.descricao,
          valor: Number(item.valor_rateado ?? item.valor_original ?? 0),
          status: item.status || "pending",
          tipo_movimento:
            item.tipo === "receita" || item.tipo === "entrada" ? "entrada" : "saida",
          timeAgo: getTimeAgo(
            item.data_pagamento || item.data_vencimento || item.data_competencia
          ),
        })) || []
      );

    },
  });
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  
  return date.toLocaleDateString("pt-BR");
}
