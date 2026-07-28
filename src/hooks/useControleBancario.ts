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

      // Movimentações que não passam pelo caixa share (ex.: ENVIO DESPESA DIRETO
      // CAIXA CLIENTE) só existem em `movimentacoes`. Buscamos e normalizamos
      // para o mesmo formato do controle bancário.
      const { data: movData } = await (supabase as any)
        .from("movimentacoes")
        .select("*")
        .is("controle_bancario_id", null)
        .order("data_competencia", { ascending: false });

      const movimentacoes = (movData || []).map((m: any) => ({
        ...m,
        id: m.id,
        _origem: "movimentacoes" as const,
        data: m.data_competencia || m.data_vencimento || m.criado_em,
        tipo_movimento: m.tipo === "receita" || m.tipo === "entrada" ? "entrada" : "saída",
        numero_documento: m.numero_doc || m.numero_nf || m.numero_recibo || null,
        cliente_id: m.clientes_id || null,
        socios_cliente_id: m.socio_id || null,
        tipo_caixa: m.tipo_caixa || "cliente",
        banco_pagamento: m.banco_nome || null,
        aeronave_registro: null,
      }));

      const todas = [
        ...transacoes.map((t: any) => ({ ...t, _origem: "controle_bancario" as const })),
        ...movimentacoes,
      ];

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
      const mapeadas = todas.map((item: any) => {
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
            item.fornecedor_nome ||
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

      return mapeadas.sort((a: any, b: any) =>
        new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
      );
    },
  });

  return { data, isLoading, error };
}
