import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (adaptado da sua estrutura 'aircraft')
export type Aeronave = Tables<"aircraft">;

// --- 2. Chave da Query (Identificador para o React Query)
const aeronavesQueryKey = ["aeronaves-aircraft"];

/**
 * Hook para buscar todas as aeronaves cadastradas.
 * Usa o backend Express para cache e proxy do Supabase.
 * Se o backend não está disponível, faz fallback direto para Supabase.
 * Ordena pelo registro (prefixo).
 */
export const useAeronaves = () => {
  const query = useQuery<Aeronave[]>({
    queryKey: aeronavesQueryKey,
    queryFn: async () => {
      try {
        const response = await apiClient.getAircraft();
        // The API client already returns data.data || data, so this should be an array
        if (Array.isArray(response)) {
          return response;
        } else if (response && typeof response === 'object' && 'data' in response && Array.isArray((response as any).data)) {
          return (response as any).data;
        } else {
          console.warn("Unexpected data format from API:", response);
          return [];
        }
      } catch (error) {
        console.warn("Backend não disponível, usando Supabase direto:", error);

        // Fallback: busca direto do Supabase se o backend falhar
        try {
          const { data, error: supabaseError } = await supabase
            .from('aircraft')
            .select('*')
            .order('registration', { ascending: true });

          if (supabaseError) {
            console.error("Erro ao buscar aeronaves do Supabase:", supabaseError);
            throw supabaseError;
          }

          console.info("Aeronaves carregadas do Supabase (fallback)");
          // Ensure we return an array
          return Array.isArray(data) ? data : [];
        } catch (fallbackError) {
          console.error("Erro ao buscar aeronaves (fallback):", fallbackError);
          // Return empty array instead of throwing, to allow app to function
          return [];
        }
      }
    },
    staleTime: 20 * 60 * 1000, // 20 minutos (compatível com cache do backend)
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
