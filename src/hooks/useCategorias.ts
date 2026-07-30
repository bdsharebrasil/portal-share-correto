import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Definimos os tipos permitidos para evitar erros de digitação
type TipoCaixa = "share" | "cliente";

export function useCategorias(tipoCaixa: TipoCaixa = "share") {
  const { data, isLoading, error } = useQuery({
    // A queryKey precisa incluir o tipoCaixa para o cache não misturar as listas
    queryKey: ["categorias", tipoCaixa],
    queryFn: async () => {
      
      // Lógica para o Caixa Share (tabela: categorias_movimentacao)
      if (tipoCaixa === "share") {
        const { data, error } = await supabase
          .from("categorias_movimentacao")
          .select("nome")
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (error) {
          console.error("Erro ao carregar categorias do caixa share:", error);
          throw error;
        }

        return Array.from(
          new Set(
            (data || [])
              .map((item: any) => item.nome)
              .filter((cat: string) => cat && cat.trim() !== "")
          )
        );
      } 
      
      // Lógica para o Caixa Cliente (tabela: expense_configu)
      else {
        const { data, error } = await supabase
          .from("expense_configu")
          .select("expense_type")
          .order("expense_type", { ascending: true });

        if (error) {
          console.error("Erro ao carregar categorias do caixa cliente:", error);
          throw error;
        }

        // Extrai apenas os tipos únicos de despesa
        return Array.from(
          new Set(
            (data || [])
              .map((item: any) => item.expense_type)
              .filter((cat: string) => cat && cat.trim() !== "")
          )
        );
      }
    },
  });

  return { data, isLoading, error };
}