import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FuelSupplier {
  id: string;
  nome_cidade: string;
  codigo_icao: string | null;
  nome_fornecedor: string;
  pessoa_contato: string | null;
  telefone: string | null;
  preco_avgas: number | null;
  preco_jet: number | null;
}

/**
 * Hook para buscar fornecedores de combustível
 */
export function useFuelSuppliers() {
  return useQuery({
    queryKey: ["fuel-suppliers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("fornecedores_combustivel")
          .select("*")
          .order("nome_fornecedor");

        if (error) {
          console.warn("Erro ao buscar fornecedores de combustível:", error);
          return [];
        }

        return (data || []) as FuelSupplier[];
      } catch (err) {
        console.warn("Erro ao buscar fornecedores de combustível:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
