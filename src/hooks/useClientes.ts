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

// Sugestão: usar a tipagem gerada pelo Supabase em vez de uma interface manual
export type ClientPartner = Tables<"client_partners">;

const clientesQueryKey = ["clients"];

export const useClientes = () => {
  const query = useQuery<Cliente[]>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          // Se precisar trazer as aeronaves vinculadas, use o select abaixo:
          // .select('*, client_aircraft(aircraft_id, share_percentage, aircraft(id, registration, manufacturer, model, year))')
          .select('*')
          .order('company_name', { ascending: true });

        if (error) {
          console.error('Erro ao buscar clientes do Supabase:', error);
          throw error;
        }

        const normalize = (s: any) => {
          const st = String(s ?? '').trim().toLowerCase();
          if (!st) return 'ativo';
          if (st === 'active') return 'ativo';
          if (st === 'inactive') return 'inativo';
          return st;
        };

        return (data || []).map((d: any) => ({ ...d, status: normalize(d.status) })) as Cliente[];
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        throw error;
      }
    },
    staleTime: 15 * 60 * 1000, // 15 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
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

/**
 * Hook para buscar parceiros (sócios) de um cliente
 */
export function useClientPartners(clientId: string | null) {
  return useQuery({
    queryKey: ["client-partners", clientId],
    queryFn: async () => {
      // O 'enabled' já barra a execução se for nulo, mas mantido por segurança
      if (!clientId) return [];

      const { data, error } = await supabase
        .from("client_partners")
        .select("*")
        .eq("client_id", clientId)
        .order("name");

      if (error) {
        console.error("[useClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
    enabled: !!clientId,
  });
}

/**
 * Hook para buscar todos os parceiros de múltiplos clientes
 */
export function useAllClientPartners() {
  return useQuery({
    queryKey: ["all-client-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_partners")
        .select("*")
        .order("name");

      if (error) {
        console.error("[useAllClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
  });
}