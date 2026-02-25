import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (suporta ambas as tabelas)
export type Tripulante = Tables<"crew_members"> | (Tables<"crew"> & { source?: "crew_members" | "crew" });

// --- 2. Chave da Query (Identificador para o React Query)
const tripulantesQueryKey = ["tripulantes-crew-members-e-crew"];

/**
 * Hook para buscar todos os membros ativos da tripulação.
 * Busca de duas tabelas: crew_members (primeira prioridade) e crew
 * Retorna uma lista ordenada com crew_members primeiro, depois crew.
 */
export const useTripulantes = () => {
  const query = useQuery<Tripulante[]>({
    queryKey: tripulantesQueryKey,
    queryFn: async () => {
      try {
        // Buscar de ambas as tabelas
        const [crewMembersRes, crewRes] = await Promise.all([
          supabase
            .from('crew_members')
            .select('*')
            .eq('status', 'ativo')
            .order('full_name', { ascending: true }),
          supabase
            .from('crew')
            .select('*')
            .eq('status', 'ativo')
            .order('full_name', { ascending: true }),
        ]);

        // Processar resultados
        const crewMembers = (crewMembersRes.data || []).map((t: any) => ({
          ...t,
          source: 'crew_members' as const,
        }));

        const crew = (crewRes.data || []).map((t: any) => ({
          ...t,
          source: 'crew' as const,
        }));

        // Combinar: crew_members primeiro, depois crew
        const combined = [...crewMembers, ...crew];

        console.info(`Tripulantes carregados: ${crewMembers.length} de crew_members + ${crew.length} de crew`);
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
