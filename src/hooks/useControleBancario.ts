import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useControleBancario() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["controle_bancario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          *,
          categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria)
        `)
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  return { data, isLoading, error };
}
