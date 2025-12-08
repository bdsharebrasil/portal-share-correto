import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// --- 1. Definição do Tipo (adaptado da sua estrutura 'aircraft')
// Usamos 'Tables<"aircraft">' para tipar, assumindo que seu types.ts está atualizado.
export type Aeronave = Tables<"aircraft">;

// --- 2. Chave da Query (Identificador para o React Query)
const aeronavesQueryKey = ["aeronaves-aircraft"];

/**
 * Hook para buscar todas as aeronaves cadastradas na tabela 'aircraft'.
 * Ordena pelo registro (prefixo).
 */
export const useAeronaves = () => {
  const query = useQuery<Aeronave[] | null>({
    queryKey: aeronavesQueryKey,
    queryFn: async () => {
      // 🎯 Correção: Tabela é 'aircraft'
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, manufacturer") // Seleciona colunas essenciais
        .eq("status", "Ativa") // Filtra apenas aeronaves ativas
        // 🎯 Correção: Ordena pela coluna 'registration' (o prefixo)
        .order("registration", { ascending: true });

      if (error) {
        console.error("Erro ao buscar aeronaves:", error);
        throw error;
      }

      // Retorna os dados, garantindo que seja um array se não houver erro.
      return (data as Aeronave[]) || null;
    },
  });

  return {
    aeronaves: query.data ?? [],
    isLoadingAeronaves: query.isLoading,
    refetchAeronaves: query.refetch,
    errorAeronaves: query.error,
  };
};
