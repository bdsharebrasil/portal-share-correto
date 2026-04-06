import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteCombo {
  id: string;
  razao_social: string;
}

export const useClientesCombo = () => {
  const query = useQuery<ClienteCombo[]>({
    queryKey: ["clients-combo-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social")
        .order("razao_social");

      if (error) {
        console.error("Erro ao buscar clientes:", error);
        throw error;
      }

      return (data as ClienteCombo[]) || [];
    },
  });

  return {
    clientes: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    error: query.error,
  };
};
