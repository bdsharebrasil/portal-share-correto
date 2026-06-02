import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustoCotista {
  cliente_id: string;
  cliente_nome: string;
  percentual_rateio: number;
  valor_devido: number;
  valor_pago: number;
  saldo: number;
}

export interface DespesaDetalhada {
  id: string;
  data_competencia: string;
  descricao: string;
  valor: number;
  status: string;
  categorias_movimentacao?: { nome: string } | null;
}

export interface RelatorioCustosModelo1Data {
  aeronave_registro: string;
  total_despesas: number;
  total_terceiro_custo: number;
  custos_por_cotista: CustoCotista[];
  despesas_detalhadas: DespesaDetalhada[];
}

export function useRelatorioCustosModelo1(
  aeronaveId: string | undefined,
  dataInicio?: string,
  dataFim?: string,
) {
  return useQuery<RelatorioCustosModelo1Data | null>({
    queryKey: ["relatorio-custos-modelo1", aeronaveId, dataInicio, dataFim],
    enabled: !!aeronaveId,
    queryFn: async () => {
      let q = supabase
        .from("rateio_despesas")
        .select(
          "id, despesa_id, cliente_id, clientes_nome, aeronave_registro, categoria_custo, categoria_id, descricao_despesa, valor_total_despesa, valor_rateado, valor_pago_real, percentual_sociedade, data_pagamento, data_vencimento, status, tipo_rateio, fluxo",
        )
        .eq("aeronave_id", aeronaveId as string);
      if (dataInicio) q = q.gte("data_vencimento", dataInicio);
      if (dataFim) q = q.lte("data_vencimento", dataFim);

      const { data: rows, error } = await q;
      if (error) throw error;
      const list = (rows as any[]) || [];

      // categorias for join
      const categoriaIds = Array.from(
        new Set(list.map((r) => r.categoria_id).filter(Boolean)),
      );
      const categoriasMap: Record<string, string> = {};
      if (categoriaIds.length) {
        const { data: cats } = await supabase
          .from("categorias_movimentacao")
          .select("id, nome")
          .in("id", categoriaIds as string[]);
        (cats || []).forEach((c: any) => (categoriasMap[c.id] = c.nome));
      }

      // Agregar por cotista
      const porCotista = new Map<string, CustoCotista>();
      let totalTerceiro = 0;
      let totalDespesasRateaveis = 0;
      const despesasVistas = new Map<string, any>();

      for (const r of list) {
        const isTerceiro =
          (r.tipo_rateio || "").toUpperCase() === "TERCEIRO_CUSTO" ||
          (r.fluxo || "").toUpperCase() === "TERCEIRO_CUSTO";

        const valRateado = Number(r.valor_rateado) || 0;
        const valPago = Number(r.valor_pago_real) || 0;

        if (isTerceiro) {
          totalTerceiro += valRateado;
        } else if (r.cliente_id) {
          const existing = porCotista.get(r.cliente_id) || {
            cliente_id: r.cliente_id,
            cliente_nome: r.clientes_nome || "—",
            percentual_rateio: 0,
            valor_devido: 0,
            valor_pago: 0,
            saldo: 0,
          };
          existing.cliente_nome = r.clientes_nome || existing.cliente_nome;
          existing.percentual_rateio = Math.max(
            existing.percentual_rateio,
            Number(r.percentual_sociedade) || 0,
          );
          existing.valor_devido += valRateado;
          existing.valor_pago += valPago;
          existing.saldo = existing.valor_pago - existing.valor_devido;
          porCotista.set(r.cliente_id, existing);
        }

        // Despesas únicas (uma por despesa_id)
        const key = r.despesa_id || r.id;
        if (!despesasVistas.has(key)) {
          despesasVistas.set(key, {
            id: key,
            data_competencia: r.data_pagamento || r.data_vencimento || "",
            descricao: r.descricao_despesa || r.categoria_custo || "—",
            valor: Number(r.valor_total_despesa) || 0,
            status: r.status || "pendente",
            categorias_movimentacao: r.categoria_id
              ? { nome: categoriasMap[r.categoria_id] || r.categoria_custo || "Geral" }
              : { nome: r.categoria_custo || "Geral" },
          });
          if (!isTerceiro) {
            totalDespesasRateaveis += Number(r.valor_total_despesa) || 0;
          }
        }
      }

      const aeronave_registro = list[0]?.aeronave_registro || "—";

      return {
        aeronave_registro,
        total_despesas: totalDespesasRateaveis,
        total_terceiro_custo: totalTerceiro,
        custos_por_cotista: Array.from(porCotista.values()).sort((a, b) =>
          a.cliente_nome.localeCompare(b.cliente_nome),
        ),
        despesas_detalhadas: Array.from(despesasVistas.values()).sort((a, b) =>
          (b.data_competencia || "").localeCompare(a.data_competencia || ""),
        ),
      };
    },
  });
}
