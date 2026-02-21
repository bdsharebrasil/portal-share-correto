import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  categoria_pai_id: string | null;
  descricao: string | null;
  ativo: boolean | null;
  grupo_categoria: string | null;
  reembolsavel: boolean | null;
}

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias-movimentacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Categoria[];
    },
  });
}
