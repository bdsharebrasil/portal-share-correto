// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Cliente = Tables<"clientes"> & {
  client_aircraft?: Array<{
    aeronave_id: string;
    percentual_sociedade: number;
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
export type ClientPartner = Tables<"socios">;

const clientesQueryKey = ["clientes"];

export const useClientes = () => {
  const query = useQuery<Cliente[]>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          // Se precisar trazer as aeronaves vinculadas, use o select abaixo:
          // .select('*, client_aircraft(aeronave_id, percentual_sociedade, aircraft(id, matricula, fabricante, modelo, year))')
          .select('*')
          .order('razao_social', { ascending: true });

        if (error) {
          console.error('Erro ao buscar clientes do Supabase:', error);
          throw error;
        }

        return (data || []) as Cliente[];
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
        .from("socios")
        .select("*")
        .eq("cliente_id", clientId)
        .order("nome");

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
        .from("socios")
        .select("*")
        .order("nome");

      if (error) {
        console.error("[useAllClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
  });
}
