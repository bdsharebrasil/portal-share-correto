import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FornecedorFavorito {
  id: string;
  nome_completo: string;
  telefone?: string;
  documento?: string;
  categoria?: string;
  cidade?: string;
  apelido?: string;
}

/**
 * Hook para buscar fornecedores favoritos
 */
export function useFornecedoresFavoritos() {
  return useQuery({
    queryKey: ["fornecedores-favoritos"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("fornecedores_favoritos")
          .select("*")
          .order("nome_completo");

        if (error) {
          console.warn("Erro ao buscar fornecedores favoritos:", error);
          return [];
        }

        return (data || []) as FornecedorFavorito[];
      } catch (err) {
        console.warn("Erro ao buscar fornecedores favoritos:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
