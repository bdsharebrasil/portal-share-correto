import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PercentualVooData {
  client_id: string;
  percentual_voo: number;
  total_hours: number;
}

interface RateioDespesaRow {
  id: string;
  despesa_id: string;
  client_id: string;
  client_name: string;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  partner_name: string | null;
  percentual: number | null; // percentual_socio (ownership %)
  valor_rateado: number; // valor por propriedade
  valor_por_voo?: number; // valor por uso (calculated)
  percentual_voo?: number; // flight hours percentage
  horas_voadas?: number; // flight hours
  valor: number | null;
  status: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_id: string | null;
  forma_pagamento: string | null;
  pago_diretamente: boolean | null;
}

interface UseRateioDespesasParams {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

/**
 * Calculate flight hours percentage for each client in a given aircraft and period
 * Handles loan flights by using loan_recipient_client_id as effective client
 */
async function calculatePercentualVoo(
  aeronaveId: string,
  inicio: string,
  fim: string
): Promise<Map<string, PercentualVooData>> {
  try {
    const { data, error } = await supabase
      .from("logbook_entries")
      .select("client_id, total_time, is_loan, loan_recipient_client_id")
      .eq("aircraft_id", aeronaveId)
      .gte("entry_date", inicio)
      .lte("entry_date", fim);

    if (error) throw error;
    if (!data || data.length === 0) return new Map();

    // Group by effective client (considering loan flights)
    const horasPorCliente: Map<string, number> = new Map();
    let totalHoras = 0;

    data.forEach((entry: any) => {
      const clienteEfetivo = entry.is_loan ? entry.loan_recipient_client_id : entry.client_id;
      const horas = entry.total_time || 0;

      if (clienteEfetivo) {
        horasPorCliente.set(clienteEfetivo, (horasPorCliente.get(clienteEfetivo) || 0) + horas);
        totalHoras += horas;
      }
    });

    // Convert to percentages
    const resultado: Map<string, PercentualVooData> = new Map();
    horasPorCliente.forEach((horas, clienteId) => {
      const percentual = totalHoras > 0 ? (horas / totalHoras) * 100 : 0;
      resultado.set(clienteId, {
        client_id: clienteId,
        percentual_voo: Math.round(percentual * 100) / 100, // 2 decimal places
        total_hours: Math.round(horas * 100) / 100,
      });
    });

    return resultado;
  } catch (error) {
    console.error("Error calculating percentual_voo:", error);
    return new Map();
  }
}

/**
 * Hook to fetch rateio_despesas with calculated percentual_voo
 * Consolidates expenses from three sources and calculates both property-based and usage-based allocations
 */
export function useRateioDespesas({
  clienteId,
  aeronaveId,
  periodo,
}: UseRateioDespesasParams) {
  return useQuery({
    queryKey: ["rateio-despesas", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      // 1. Fetch rateio_despesas records
      let query = supabase
        .from("rateio_despesas")
        .select("*")
        .eq("client_id", clienteId)
        .gte("data_vencimento", periodo.inicio)
        .lte("data_vencimento", periodo.fim);

      if (aeronaveId) {
        query = query.eq("aeronave_id", aeronaveId);
      }

      const { data: rateioDespesas, error: rdErr } = await query;
      if (rdErr) throw rdErr;

      if (!rateioDespesas || rateioDespesas.length === 0) {
        return {
          despesas: [],
          percentualVoo: new Map(),
          totalPorPropriedade: 0,
          totalPorUso: 0,
        };
      }

      // 2. Get unique aircraft and calculate percentual_voo for each
      const aeronaves = Array.from(
        new Set(rateioDespesas.map((d: any) => d.aeronave_id).filter(Boolean))
      ) as string[];

      const percentualVooPorAeronave: Map<string, Map<string, PercentualVooData>> = new Map();

      for (const aerId of aeronaves) {
        const vooData = await calculatePercentualVoo(aerId, periodo.inicio, periodo.fim);
        percentualVooPorAeronave.set(aerId, vooData);
      }

      // 3. Enrich rateio_despesas with percentual_voo and valor_por_voo
      const despesasEnriquecidas: RateioDespesaRow[] = rateioDespesas.map((despesa: any) => {
        const vooDataMap = despesa.aeronave_id
          ? percentualVooPorAeronave.get(despesa.aeronave_id)
          : undefined;

        const vooData = vooDataMap?.get(despesa.client_id);

        // Calculate valor_por_voo based on flight hours percentage
        const valorPorVoo = vooData
          ? Math.round(((despesa.valor || 0) * vooData.percentual_voo) / 100 * 100) / 100
          : despesa.valor_rateado;

        return {
          ...despesa,
          percentual_voo: vooData?.percentual_voo,
          horas_voadas: vooData?.total_hours,
          valor_por_voo: valorPorVoo,
        };
      });

      // 4. Calculate totals
      const totalPorPropriedade = despesasEnriquecidas.reduce(
        (sum, d) => sum + (d.valor_rateado || 0),
        0
      );
      const totalPorUso = despesasEnriquecidas.reduce(
        (sum, d) => sum + (d.valor_por_voo || 0),
        0
      );

      return {
        despesas: despesasEnriquecidas,
        percentualVoo: percentualVooPorAeronave,
        totalPorPropriedade,
        totalPorUso,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get partner-level consolidated view
 * Groups despesas by partner and calculates totals owed by property vs usage
 */
export function useRateioDespesasPartners({
  clienteId,
  aeronaveId,
  periodo,
}: UseRateioDespesasParams) {
  const { data: rateioData } = useRateioDespesas({
    clienteId,
    aeronaveId,
    periodo,
  });

  const despesas = rateioData?.despesas || [];
  const totalPorPropriedade = rateioData?.totalPorPropriedade || 0;
  const totalPorUso = rateioData?.totalPorUso || 0;

  // Group by partner
  const partnerView: Map<
    string,
    {
      partner_name: string;
      client_name: string;
      totalPorPropriedade: number;
      totalPorUso: number;
      diferenca: number;
      despesas: RateioDespesaRow[];
    }
  > = new Map();

  (despesas as RateioDespesaRow[]).forEach((despesa) => {
    const partnerId = despesa.partner_name || despesa.client_name;
    const existing = partnerView.get(partnerId) || {
      partner_name: despesa.partner_name || "",
      client_name: despesa.client_name || "",
      totalPorPropriedade: 0,
      totalPorUso: 0,
      diferenca: 0,
      despesas: [],
    };

    existing.totalPorPropriedade += despesa.valor_rateado || 0;
    existing.totalPorUso += despesa.valor_por_voo || 0;
    existing.diferenca = existing.totalPorUso - existing.totalPorPropriedade;
    existing.despesas.push(despesa);

    partnerView.set(partnerId, existing);
  });

  return {
    partners: Array.from(partnerView.values()),
    totalPorPropriedade,
    totalPorUso,
    totalDiferenca: totalPorUso - totalPorPropriedade,
  };
}

/**
 * Get percentual_voo for specific aircraft and period
 * Used in forms to auto-populate flight hours percentages
 */
export async function getPercentualVooForAeronave(
  aeronaveId: string,
  clientId: string,
  inicio: string,
  fim: string
): Promise<number> {
  const vooData = await calculatePercentualVoo(aeronaveId, inicio, fim);
  const clientData = vooData.get(clientId);
  return clientData?.percentual_voo ?? 0;
}
