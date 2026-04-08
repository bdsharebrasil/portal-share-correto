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
          clientes:cliente_id(id, razao_social, proprietario),
          socios_cliente:socios_cliente_id(id, nome),
          fornecedores_favoritos:fornecedores_favoritos_id(id, nome_completo),
          user_profiles:colaborador_id(id, full_name, display_name)
        `)
        .order("data", { ascending: false });

      if (error) throw error;

      // Map the data to include categoria_nome, referencia e cliente_nome
      // Referência pode ser: fornecedor ou colaborador (user_profile)
      // Cliente é separado para ter sua própria coluna
      return (data || []).map((item: any) => ({
        ...item,
        categoria_nome: item.categorias_movimentacao?.nome || item.grupo_categoria || '-',
        grupo_categoria_nome: item.categorias_movimentacao?.grupo_categoria || item.grupo_categoria || '-',
        // Referência: fornecedor favorito ou colaborador
        referencia: item.fornecedores_favoritos?.nome_completo ||
          item.user_profiles?.full_name ||
          item.user_profiles?.display_name ||
          '-',
        // Cliente: se houver partner use o nome do partner, senão empresa/proprietário
        cliente_nome: item.socios_cliente?.nome ||
          item.clientes?.razao_social ||
          item.clientes?.proprietario ||
          item.client_name ||
          '-'
      }));
    },
  });

  return { data, isLoading, error };
}