import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useControleBancario() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["controle_bancario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("controle_bancario")
        .select("*")
        .order("data", { ascending: false });

      if (error) throw error;

      const transacoes = data || [];

      const [categoriasRes, clientesRes, sociosRes, fornecedoresRes, colaboradoresRes] = await Promise.all([
        (supabase as any).from("categorias_movimentacao").select("id, nome, tipo, grupo_categoria"),
        (supabase as any).from("clientes").select("id, razao_social, proprietario"),
        (supabase as any).from("socios").select("id, nome"),
        (supabase as any).from("fornecedores_favoritos").select("id, nome_completo"),
        (supabase as any).from("user_profiles").select("id, full_name, display_name"),
      ]);

      const byId = (rows?: any[] | null) => new Map((rows || []).map((row: any) => [row.id, row]));
      const categoriasById = byId(categoriasRes.data);
      const clientesById = byId(clientesRes.data);
      const sociosById = byId(sociosRes.data);
      const fornecedoresById = byId(fornecedoresRes.data);
      const colaboradoresById = byId(colaboradoresRes.data);

      // Map the data to include categoria_nome, referencia e cliente_nome
      // Referência pode ser: fornecedor ou colaborador (user_profile)
      // Cliente é separado para ter sua própria coluna
      return transacoes.map((item: any) => {
        const categoria = categoriasById.get(item.categoria_id);
        const cliente = clientesById.get(item.cliente_id);
        const socio = sociosById.get(item.socios_cliente_id);
        const fornecedor = fornecedoresById.get(item.fornecedores_favoritos_id);
        const colaborador = colaboradoresById.get(item.colaborador_id);

        return {
          ...item,
          categorias_movimentacao: categoria,
          clientes: cliente,
          socios: socio,
          fornecedores_favoritos: fornecedor,
          user_profiles: colaborador,
          categoria_nome: categoria?.nome || item.grupo_categoria || '-',
          grupo_categoria_nome: categoria?.grupo_categoria || item.grupo_categoria || '-',
          // Referência: fornecedor favorito ou colaborador
          referencia: fornecedor?.nome_completo ||
            colaborador?.full_name ||
            colaborador?.display_name ||
            '-',
          // Cliente: se houver partner use o nome do partner, senão empresa/proprietário
          cliente_nome: socio?.nome ||
            cliente?.razao_social ||
            cliente?.proprietario ||
            item.clientes_nome ||
            item.client_name ||
            '-'
        };
      });
    },
  });

  return { data, isLoading, error };
}
