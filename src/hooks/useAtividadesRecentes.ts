import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Atividade {
  id: string;
  tipo_movimento: "entrada" | "saida";
  descricao: string;
  valor: number;
  client_name?: string;
  status: string | null;
  data_criacao: string;
  timeAgo: string;
}

export function useAtividadesRecentes(limit: number = 5) {
  return useQuery({
    queryKey: ["atividades-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("id, tipo_movimento, descricao, valor, client_name, status, data_criacao")
        .order("data_criacao", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        tipo_movimento: item.tipo_movimento,
        descricao: item.descricao,
        valor: Number(item.valor),
        client_name: item.client_name,
        status: item.status,
        data_criacao: item.data_criacao,
        timeAgo: formatDistanceToNow(new Date(item.data_criacao), {
          addSuffix: true,
          locale: ptBR,
        }),
      })) as Atividade[];
    },
  });
}
