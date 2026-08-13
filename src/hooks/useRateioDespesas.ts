// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca o rateio de despesas por cotista (socios) a partir da tabela
 * `rateio_despesas`. Diferente de `movimentacoes`, essa tabela já vem
 * desnormalizada (socios_nome, clientes_nome, aeronave_registro), então
 * não é necessário fazer join.
 */

export interface RateioDespesaRow {
  id: string;
  despesa_id: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao_despesa: string | null;
  fonte_despesa: string | null;
  tipo_rateio: string | null;
  fluxo: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  cliente_id: string | null;
  clientes_nome: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  percentual_sociedade: number | null;
  percentual_uso: number | null;
  valor_total: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  status: string | null;
  pago_por: string | null;
  pago_diretamente: boolean;
  categoria_custo: string | null;
}

export function useRateioDespesas() {
  return useQuery({
    queryKey: ["rateio-despesas"],
    queryFn: async (): Promise<RateioDespesaRow[]> => {
      const { data, error } = await supabase
        .from("rateio_despesas")
        .select("*")
        .order("data_vencimento", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        despesa_id: row.despesa_id,
        data_vencimento: row.data_vencimento,
        data_pagamento: row.data_pagamento,
        descricao_despesa: row.descricao_despesa,
        fonte_despesa: row.fonte_despesa,
        tipo_rateio: row.tipo_rateio,
        fluxo: row.fluxo,
        socio_id: row.socio_id,
        socios_nome: row.socios_nome,
        cliente_id: row.cliente_id,
        clientes_nome: row.clientes_nome,
        aeronave_id: row.aeronave_id,
        aeronave_registro: row.aeronave_registro,
        percentual_sociedade: row.percentual_sociedade,
        percentual_uso: row.percentual_uso,
        valor_total: row.valor_total,
        valor_rateado: row.valor_rateado,
        valor_pago_real: row.valor_pago_real,
        status: row.status,
        pago_por: row.pago_por,
        pago_diretamente: row.pago_diretamente,
        categoria_custo: row.categoria_custo,
      }));
    },
  });
}

/**
 * Agrupa o rateio por cotista (socio), somando valores rateados/pagos.
 * Útil para uma visão resumida "quanto cada cotista deve/pagou".
 */
export function groupRateioBySocio(rows: RateioDespesaRow[]) {
  const grouped: Record<
    string,
    { socio_id: string; socios_nome: string; total_rateado: number; total_pago: number; count: number }
  > = {};

  rows.forEach((r) => {
    const key = r.socio_id || "sem-socio";
    if (!grouped[key]) {
      grouped[key] = {
        socio_id: key,
        socios_nome: r.socios_nome || "Não identificado",
        total_rateado: 0,
        total_pago: 0,
        count: 0,
      };
    }
    grouped[key].total_rateado += Number(r.valor_rateado || 0);
    grouped[key].total_pago += Number(r.valor_pago_real || 0);
    grouped[key].count += 1;
  });

  return Object.values(grouped);
}
