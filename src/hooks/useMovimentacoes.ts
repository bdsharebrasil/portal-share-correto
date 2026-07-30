// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A tabela `controle_bancario` não existe mais — os dados agora vêm de
 * `movimentacoes` (que já contém a coluna `tipo_caixa`: 'share' | 'cliente').
 *
 * ATENÇÃO / AJUSTE NECESSÁRIO:
 * - O join abaixo assume que `categoria_id` referencia a tabela `expense_configu`
 *   (mesma tabela usada em rateio_despesas.categoria_custo) e que ela tem uma
 *   coluna `nome`. Ajuste o nome da tabela/coluna se for diferente no seu schema.
 * - `clientes` e `aeronave` são assumidos com colunas `nome` e `registro`
 *   respectivamente, como já utilizado no restante do projeto.
 */

export interface MovimentacaoRow {
  id: string;
  data: string; // usada para exibição/ordenação na tabela
  tipo_movimento: "entrada" | "saida";
  descricao: string;
  categoria_nome: string | null;
  tipo_caixa: "share" | "cliente";
  cliente_id: string | null;
  cliente_nome: string | null;
  valor: number;
  conta_banco: string | null;
  aeronave_registro: string | null;
  numero_documento: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  comprovante_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  recibo_url: string | null;
  status: string | null;
}

// movimentacoes.tipo pode ser: 'receita' | 'entrada' | 'saida' | 'despesa'
function normalizeTipoMovimento(tipo: string): "entrada" | "saida" {
  return tipo === "receita" || tipo === "entrada" ? "entrada" : "saida";
}

export function useMovimentacoes() {
  return useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async (): Promise<MovimentacaoRow[]> => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(
          `
          id,
          descricao,
          tipo,
          tipo_caixa,
          valor,
          data_competencia,
          data_vencimento,
          data_pagamento,
          status,
          numero_doc,
          numero_nf,
          numero_boleto,
          numero_recibo,
          comprovante_url,
          nf_url,
          boleto_url,
          recibo_url,
          conta_bancaria,
          banco_nome,
          aeronave_id,
          clientes_id,
          categoria_id
        `
        )
        .order("data_competencia", { ascending: false });

      if (error) throw error;

      const movimentacoes = data || [];
      const categoriaIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.categoria_id).filter(Boolean))
      );
      const clienteIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.clientes_id).filter(Boolean))
      );
      const aeronaveIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.aeronave_id).filter(Boolean))
      );

      let categoriasById = new Map<string, string>();
      let clientesById = new Map<string, string>();
      let aeronavesById = new Map<string, string>();

      if (categoriaIds.length > 0) {
        const { data: categoriasData } = await supabase
          .from("categorias_movimentacao")
          .select("id, nome")
          .in("id", categoriaIds);

        if (categoriasData) {
          categoriasById = new Map(categoriasData.map((categoria: any) => [categoria.id, categoria.nome]));
        }
      }

      // Nome do cliente: `clientes` não possui coluna `nome` — usamos
      // razao_social/proprietario e, quando a movimentação não tem cliente
      // vinculado, resolvemos pelo cotista da aeronave (cotistas_aeronave).
      const clienteNomeFromRow = (c: any) =>
        c?.razao_social || c?.proprietario || c?.codigo_cliente || null;

      // cotistas_aeronave: mapeia aeronave -> cliente (fallback)
      const clientePorAeronave = new Map<string, string>();
      if (aeronaveIds.length > 0) {
        const { data: cotistas } = await supabase
          .from("cotistas_aeronave")
          .select("id_clientes, id_aeronave")
          .in("id_aeronave", aeronaveIds);
        (cotistas || []).forEach((c: any) => {
          if (c.id_aeronave && c.id_clientes && !clientePorAeronave.has(c.id_aeronave)) {
            clientePorAeronave.set(c.id_aeronave, c.id_clientes);
            if (!clienteIds.includes(c.id_clientes)) clienteIds.push(c.id_clientes);
          }
        });
      }

      if (clienteIds.length > 0) {
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, razao_social, proprietario, codigo_cliente")
          .in("id", clienteIds);

        if (clientesData) {
          clientesById = new Map(
            clientesData.map((cliente: any) => [cliente.id, clienteNomeFromRow(cliente)])
          );
        }
      }

      if (aeronaveIds.length > 0) {
        const { data: aeronavesData } = await supabase
          .from("aeronave")
          .select("id, registro")
          .in("id", aeronaveIds);

        if (aeronavesData) {
          aeronavesById = new Map(aeronavesData.map((aeronave: any) => [aeronave.id, aeronave.registro]));
        }
      }

      return movimentacoes.map((row: any) => {
        const clienteId = row.clientes_id || clientePorAeronave.get(row.aeronave_id) || null;
        return {
          id: row.id,
          data: row.data_pagamento || row.data_vencimento || row.data_competencia,
          tipo_movimento: normalizeTipoMovimento(row.tipo),
          descricao: row.descricao,
          categoria_nome: categoriasById.get(row.categoria_id) ?? null,
          tipo_caixa: (row.tipo_caixa || "share") as "share" | "cliente",
          cliente_id: clienteId,
          cliente_nome: (clienteId && clientesById.get(clienteId)) || null,
          valor: Number(row.valor),
          conta_banco: row.conta_bancaria || row.banco_nome || null,
          aeronave_registro: aeronavesById.get(row.aeronave_id) ?? null,
          numero_documento:
            row.numero_doc || row.numero_nf || row.numero_boleto || row.numero_recibo || null,
          numero_nf: row.numero_nf || null,
          numero_boleto: row.numero_boleto || null,
          numero_recibo: row.numero_recibo || null,
          comprovante_url: row.comprovante_url,
          nf_url: row.nf_url,
          boleto_url: row.boleto_url,
          recibo_url: row.recibo_url,
          status: row.status,
        };
      });
    },
  });
}
