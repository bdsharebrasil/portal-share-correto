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

export const useClientes = () => {
  const query = useQuery<Cliente[]>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('company_name', { ascending: true });

        if (error) {
          console.error('Erro ao buscar clientes do Supabase:', error);
          throw error;
        }

        return (data || []) as Cliente[];
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        throw err;
      }
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    clientes: query.data ?? [],
    isLoadingClientes: query.isLoading,
    refetchClientes: query.refetch,
    errorClientes: query.error,
  };
};