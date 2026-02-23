import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (adaptado da sua estrutura 'crew_members')
export type Tripulante = Tables<"crew_members">;

// --- 2. Chave da Query (Identificador para o React Query)
const tripulantesQueryKey = ["tripulantes-crew-members"];

/**
 * Hook para buscar todos os membros ativos da tripulação.
 * Usa o backend remoto (Cloudflare Workers) para cache e proxy do Supabase.
 * Se o backend não está disponível, faz fallback direto para Supabase.
 * Retorna uma lista ordenada pelo nome completo.
 */
export const useTripulantes = () => {
  const query = useQuery<Tripulante[]>({
    queryKey: tripulantesQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('crew_members')
          .select('*')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('Erro ao buscar tripulantes do Supabase:', error);
          throw error;
        }

        return (data || []) as Tripulante[];
      } catch (err) {
        console.error('Erro ao buscar tripulantes:', err);
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutos (compatível com cache do backend)
    gcTime: 30 * 60 * 1000, // 30 minutos
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    tripulantes: query.data ?? [],
    isLoadingTripulantes: query.isLoading,
    refetchTripulantes: query.refetch,
    errorTripulantes: query.error,
  };
};
