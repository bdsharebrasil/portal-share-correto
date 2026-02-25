import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
 * Usa o backend remoto (Cloudflare Workers) para cache e proxy do Supabase.
 * Se o backend não está disponível, faz fallback direto para Supabase.
 * Retorna uma lista de clientes ordenada pelo nome da empresa.
 */
export const useClientes = () => {
  const query = useQuery<Cliente[]>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      try {
        // Buscar diretamente do Supabase (evita depender do backend Workers)
        const { data, error } = await supabase
          .from('clients')
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
    staleTime: 15 * 60 * 1000, // 15 minutos (compatível com cache do backend)
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
