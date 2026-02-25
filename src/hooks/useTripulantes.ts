import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
        // Nota: O endpoint atual retorna usuários genéricos
        // Para tripulantes específicos, pode ser necessário criar um endpoint separado
        // Por enquanto, usamos getUsers e filtramos por role
        const data = await apiClient.getUsers() as any[];
        const normalize = (s: any) => {
          const st = String(s ?? '').trim().toLowerCase();
          if (!st) return 'ativo';
          if (st === 'active') return 'ativo';
          if (st === 'inactive') return 'inativo';
          return st;
        };
        // Filtrar apenas tripulantes (crew) e com status ativo
        return (data || []).filter((user: any) =>
          (user.role === 'crew' || user.role === 'pilot') && normalize(user.status) === 'ativo'
        ) as Tripulante[];
      } catch (error) {
        console.warn("Backend não disponível, usando Supabase direto:", error);

        // Fallback: busca direto do Supabase se o backend falhar
        try {
          const { data, error: supabaseError } = await supabase
            .from('crew_members')
            .select('*')
            .order('full_name', { ascending: true });

          if (supabaseError) {
            console.error("Erro ao buscar tripulantes do Supabase:", supabaseError);
            throw supabaseError;
          }

          console.info("Tripulantes carregados do Supabase (fallback)");
          const normalize = (s: any) => {
            const st = String(s ?? '').trim().toLowerCase();
            if (!st) return 'ativo';
            if (st === 'active') return 'ativo';
            if (st === 'inactive') return 'inativo';
            return st;
          };
          return (data || []).filter((t: any) => normalize(t.status) === 'ativo') as Tripulante[];
        } catch (fallbackError) {
          console.error("Erro ao buscar tripulantes (fallback):", fallbackError);
          throw fallbackError;
        }
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
