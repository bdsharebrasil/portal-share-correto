import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useControleBancario() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["controle_bancario"],
    queryFn: async () => {
      // Realizamos o select buscando as relações baseadas nas FKs do seu SQL
      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          *,
          categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria),
          clients:client_id(id, company_name, proprietario),
          fornecedores_favoritos:fornecedores_favoritos_id(id, nome_completo),
          user_profiles:colaborador_id(id, full_name, display_name),
          aircraft:aeronave_id(id, registration)
        `)
        .order("data", { ascending: false });

      if (error) {
        console.error("Erro ao buscar controle bancário:", error);
        throw error;
      }

      // Mapeamento dos dados para facilitar o uso nos componentes de Tabela
      return (data || []).map((item: any) => {
        // 1. Definição da Categoria
        const categoria_nome = item.categorias_movimentacao?.nome || item.grupo_categoria || '-';
        
        // 2. Definição da Referência (Quem recebeu/pagou: Fornecedor ou Colaborador)
        const referencia = 
          item.fornecedores_favoritos?.nome_completo || 
          item.user_profiles?.full_name || 
          item.user_profiles?.display_name || 
          '-';

        // 3. Definição do Cliente (Nome da empresa, proprietário ou o campo de texto direto)
        const cliente_nome = 
          item.clients?.company_name || 
          item.clients?.proprietario || 
          item.client_name || 
          '-';

        return {
          ...item,
          categoria_nome,
          grupo_categoria_nome: item.categorias_movimentacao?.grupo_categoria || item.grupo_categoria || '-',
          referencia,
          cliente_nome,
          // Adicionado para caso sua tabela mostre aeronave
          aeronave_nome: item.aircraft?.registration || item.aeronave_registro || '-'
        };
      });
    },
  });

  return { 
    data: data || [], 
    isLoading, 
    error 
  };
}