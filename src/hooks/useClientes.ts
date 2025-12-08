import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Cliente = Tables<"clients"> & {
  client_aircraft?: Array<{
    aircraft_id: string;
    share_percentage: number;
    aircraft: {
      id: string;
      registration: string;
      manufacturer: string;
      model: string;
      year: string;
    };
  }>;
};

const clientesQueryKey = ["clients"];

/**
 * Hook para buscar todos os clientes cadastrados com suas aeronaves.
 * Retorna uma lista de clientes ordenada pelo nome da empresa.
 */
export const useClientes = () => {
  const query = useQuery<Cliente[] | null>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          client_aircraft (
            aircraft_id,
            share_percentage,
            aircraft:aircraft_id (
              id,
              registration,
              manufacturer,
              model,
              year
            )
          )
        `)
        .eq("status", "ativo")
        .order("company_name");

      if (error) {
        console.error("Erro ao buscar clientes:", error);
        throw error;
      }

      return (data as Cliente[]) || null;
    },
  });

  return {
    clientes: query.data ?? [],
    isLoadingClientes: query.isLoading,
    refetchClientes: query.refetch,
    errorClientes: query.error,
  };
};
