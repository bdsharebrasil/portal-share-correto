// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Substitui o antigo useControleBancario.
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
  cliente_nome: string | null;
  valor: number;
  conta_banco: string | null;
  aeronave_registro: string | null;
  numero_documento: string | null;
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
          aeronave:aeronave_id ( registro ),
          clientes:clientes_id ( nome ),
          categoria:categoria_id ( nome )
        `
        )
        .order("data_competencia", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        data: row.data_pagamento || row.data_vencimento || row.data_competencia,
        tipo_movimento: normalizeTipoMovimento(row.tipo),
        descricao: row.descricao,
        categoria_nome: row.categoria?.nome ?? null,
        tipo_caixa: (row.tipo_caixa || "share") as "share" | "cliente",
        cliente_nome: row.clientes?.nome ?? null,
        valor: Number(row.valor),
        conta_banco: row.conta_bancaria || row.banco_nome || null,
        aeronave_registro: row.aeronave?.registro ?? null,
        numero_documento:
          row.numero_doc || row.numero_nf || row.numero_boleto || row.numero_recibo || null,
        comprovante_url: row.comprovante_url,
        nf_url: row.nf_url,
        boleto_url: row.boleto_url,
        recibo_url: row.recibo_url,
        status: row.status,
      }));
    },
  });
}
