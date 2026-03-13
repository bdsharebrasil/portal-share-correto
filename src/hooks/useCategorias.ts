import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCategorias() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("nome")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        throw error;
      }

      // Extrai apenas as categorias únicas
      const categorias = Array.from(
        new Set(
          (data || [])
            .map((item: any) => item.nome)
            .filter((cat: string) => cat && cat.trim() !== "")
        )
      );

      return categorias;
    },
  });

  return { data, isLoading, error };
}
