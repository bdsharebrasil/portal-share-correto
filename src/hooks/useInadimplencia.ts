import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

interface InadimplenciaItem {
  id: string;
  cliente_nome: string;
  data_vencimento: string;
  valor: number;
  descricao: string;
}

export function useInadimplencia() {
  const { data: transacoes, isLoading, error } = useQuery({
    queryKey: ["controle_bancario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          id,
          data,
          valor,
          descricao,
          tipo_movimento,
          clientes:cliente_id(razao_social)
        `)
        .eq("tipo_movimento", "entrada")
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Filtrar apenas as transações vencidas
  const inadimplentes = transacoes
    ?.map((t: any) => ({
      id: t.id,
      cliente_nome: t.clientes?.razao_social || "Cliente Desconhecido",
      data_vencimento: t.data,
      valor: t.valor,
      descricao: t.descricao || "",
    }))
    .filter((item: InadimplenciaItem) => {
      const diasAtraso = differenceInDays(new Date(), parseISO(item.data_vencimento));
      return diasAtraso > 0; // Apenas itens vencidos
    }) || [];

  return {
    data: inadimplentes as InadimplenciaItem[],
    isLoading,
    error,
  };
}
