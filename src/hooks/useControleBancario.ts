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
          categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria),
          clients:client_id(id, company_name, proprietario),
          fornecedores_favoritos:fornecedores_favoritos_id(id, nome),
          user_profiles:receiver_id(id, full_name, display_name)
        `)
        .order("data", { ascending: false });

      if (error) throw error;
      
      // Map the data to include categoria_nome and referencia
      // Referência pode ser: cliente, fornecedor ou colaborador (user_profile)
      return (data || []).map((item: any) => ({
        ...item,
        categoria_nome: item.categorias_movimentacao?.nome || item.grupo_categoria || '-',
        grupo_categoria_nome: item.categorias_movimentacao?.grupo_categoria || item.grupo_categoria || '-',
        referencia: item.client_name || 
                    item.clients?.company_name || 
                    item.clients?.proprietario ||
                    item.fornecedores_favoritos?.nome ||
                    item.user_profiles?.full_name ||
                    item.user_profiles?.display_name ||
                    '-'
      }));
    },
  });

  return { data, isLoading, error };
}
