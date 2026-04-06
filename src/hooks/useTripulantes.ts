import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (suporta ambas as tabelas)
export type Tripulante = Tables<"membros_tripulacao"> | (Tables<"tripulacao"> & { source?: "membros_tripulacao" | "tripulacao" });

// --- 2. Chave da Query (Identificador para o React Query)
const tripulantesQueryKey = ["tripulantes-membros-tripulacao-e-tripulacao"];

/**
 * Hook para buscar todos os membros ativos da tripulação.
 * Busca de duas tabelas: membros_tripulacao (primeira prioridade) e tripulacao
 * Retorna uma lista ordenada com membros_tripulacao primeiro, depois tripulacao.
 */
export const useTripulantes = () => {
  const query = useQuery<Tripulante[]>({
    queryKey: tripulantesQueryKey,
    queryFn: async () => {
      try {
        // Buscar de ambas as tabelas
        const [crewMembersRes, crewRes] = await Promise.all([
          supabase
            .from('membros_tripulacao')
            .select('*')
            .eq('status', 'ativo')
            .order('nome_completo', { ascending: true }),
          supabase
            .from('tripulacao')
            .select('*')
            .eq('status', 'ativo')
            .order('nome_completo', { ascending: true }),
        ]);

        // Processar resultados
        const crewMembers = (crewMembersRes.data || []).map((t: any) => ({
          ...t,
          source: 'membros_tripulacao' as const,
        }));

        const crew = (crewRes.data || []).map((t: any) => ({
          ...t,
          source: 'tripulacao' as const,
        }));

        // Combinar: crew_members primeiro, depois crew
        const combined = [...crewMembers, ...crew];

        console.info(`Tripulantes carregados: ${crewMembers.length} de membros_tripulacao + ${crew.length} de tripulacao`);
        return combined as Tripulante[];
      } catch (error) {
        console.error("Erro ao buscar tripulantes:", error);
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
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
