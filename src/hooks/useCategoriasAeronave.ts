import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoriaMovimentacao {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  grupo_categoria: string | null;
  reembolsavel: boolean | null;
  ativo: boolean | null;
}

export function useCategoriasAeronave() {
  return useQuery({
    queryKey: ["categorias-aeronave"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("*")
        .eq("ativo", true)
        .or('grupo_categoria.eq.Despesas Aeronave,reembolsavel.eq.true')
        .order("grupo_categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        throw error;
      }

      return (data || []) as CategoriaMovimentacao[];
    },
  });
}

export function useAllCategorias() {
  return useQuery({
    queryKey: ["all-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("*")
        .eq("ativo", true)
        .order("grupo_categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        throw error;
      }

      return (data || []) as CategoriaMovimentacao[];
    },
  });
}

export function groupCategoriesByGroup(categories: CategoriaMovimentacao[]) {
  return categories.reduce((acc, cat) => {
    const group = cat.grupo_categoria || 'Outras';
    if (!acc[group]) acc[group] = [];
    acc[group].push(cat);
    return acc;
  }, {} as Record<string, CategoriaMovimentacao[]>);
}
