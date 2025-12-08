import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteCombo {
  id: string;
  company_name: string;
}

export const useClientesCombo = () => {
  const query = useQuery<ClienteCombo[]>({
    queryKey: ["clients-combo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("status", "ativo")
        .order("company_name");

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
