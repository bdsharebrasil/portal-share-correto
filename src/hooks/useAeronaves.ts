import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (adaptado da sua estrutura 'aircraft')
export type Aeronave = Tables<"aircraft">;

// --- 2. Chave da Query (Identificador para o React Query)
const aeronavesQueryKey = ["aeronaves-aircraft"];

/**
 * Hook para buscar todas as aeronaves cadastradas diretamente do Supabase.
 * Não usa API backend - dados vêm direto da base de dados.
 * Ordena pelo registro (prefixo).
 */
export const useAeronaves = () => {
  const query = useQuery<Aeronave[]>({
    queryKey: aeronavesQueryKey,
    queryFn: async () => {
      try {
        const { data, error: supabaseError } = await supabase
          .from('aircraft')
          .select('*')
          .eq('status', 'ativa')
          .order('registration', { ascending: true });

        if (supabaseError) {
          console.error("Erro ao buscar aeronaves do Supabase:", supabaseError);
          throw supabaseError;
        }

        // Ensure we return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Erro ao buscar aeronaves:", error);
        // Return empty array instead of throwing, to allow app to function
        return [];
      }
    },
    staleTime: 20 * 60 * 1000, // 20 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Ensure aeronaves is always an array, even if something goes wrong
  const aeronavesData = Array.isArray(query.data) ? query.data : [];

  return {
    aeronaves: aeronavesData,
    isLoadingAeronaves: query.isLoading,
    refetchAeronaves: query.refetch,
    errorAeronaves: query.error,
  };
};
