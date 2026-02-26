import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DadosBalancoCompleto {
  horasVoadas: number;
  litrosConsumidos: number;
  valorCombustivel: number;
  aeronave?: string;
}

/**
 * Hook para buscar dados completos do balanço do cliente (horas voadas e combustível)
 * Usa horas_mensais_consolidadas para horas e abastecimentos para combustível
 */
export function useBalancoClienteCompleto(
  clienteId: string | undefined,
  periodo: { inicio: string; fim: string },
  aeronaveId?: string
) {
  return useQuery({
    queryKey: ["balanco-cliente-completo", clienteId, periodo, aeronaveId],
    queryFn: async (): Promise<DadosBalancoCompleto[]> => {
      if (!clienteId) return [];

      // Fonte 1: horas_mensais_consolidadas
      const anoInicio = new Date(periodo.inicio).getFullYear();
      const mesInicio = new Date(periodo.inicio).getMonth() + 1;
      const anoFim = new Date(periodo.fim).getFullYear();
      const mesFim = new Date(periodo.fim).getMonth() + 1;

      let horasQuery = supabase
        .from("horas_mensais_consolidadas")
        .select("horas_voadas, aeronave_registro, ano, mes")
        .eq("cliente_id", clienteId);

      if (aeronaveId) {
        horasQuery = horasQuery.eq("aeronave_id", aeronaveId);
      }

      const { data: horasData, error: horasError } = await horasQuery;
      if (horasError) throw horasError;

      // Filtrar por período no JS (mais confiável que filtros OR complexos)
      const horasFiltradas = (horasData || []).filter((h: any) => {
        const val = h.ano * 100 + h.mes;
        return val >= anoInicio * 100 + mesInicio && val <= anoFim * 100 + mesFim;
      });

      // Fonte 2: abastecimentos (para litros e valor combustível)
      let abastQuery = supabase
        .from("abastecimentos")
        .select("litros, valor_total")
        .eq("client_id", clienteId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim);

      if (aeronaveId) {
        abastQuery = abastQuery.eq("aeronave_id", aeronaveId);
      }

      const { data: abastData, error: abastError } = await abastQuery;
      if (abastError) throw abastError;

      // Fallback: se não há dados consolidados, tentar logbook_entries
      let horasVoadas = horasFiltradas.reduce(
        (sum: number, h: any) => sum + (h.horas_voadas || 0),
        0
      );

      if (horasVoadas === 0) {
        let logbookQuery = supabase
          .from("logbook_entries")
          .select("total_time")
          .eq("client_id", clienteId)
          .gte("entry_date", periodo.inicio)
          .lte("entry_date", periodo.fim);

        if (aeronaveId) {
          logbookQuery = logbookQuery.eq("aircraft_id", aeronaveId);
        }

        const { data: logbookData } = await logbookQuery;
        horasVoadas = (logbookData || []).reduce(
          (sum: number, e: any) => sum + (e.total_time || 0),
          0
        );
      }

      const litrosConsumidos = (abastData || []).reduce(
        (sum: number, a: any) => sum + (a.litros || 0),
        0
      );

      const valorCombustivel = (abastData || []).reduce(
        (sum: number, a: any) => sum + (a.valor_total || 0),
        0
      );

      return [
        {
          horasVoadas,
          litrosConsumidos,
          valorCombustivel,
        },
      ];
    },
    enabled: !!clienteId,
  });
}

/**
 * Calcula resumo de horas e combustível
 */
export function calcularResumoHorasCombustivel(
  dados: DadosBalancoCompleto[],
  fator: number = 1
) {
  const totais = dados.reduce(
    (acc, item) => ({
      horasVoadas: acc.horasVoadas + item.horasVoadas,
      litrosConsumidos: acc.litrosConsumidos + item.litrosConsumidos,
      valorCombustivel: acc.valorCombustivel + item.valorCombustivel,
    }),
    { horasVoadas: 0, litrosConsumidos: 0, valorCombustivel: 0 }
  );

  return {
    horasVoadas: totais.horasVoadas * fator,
    litrosConsumidos: totais.litrosConsumidos * fator,
    valorCombustivel: totais.valorCombustivel * fator,
  };
}

/**
 * Formata horas decimais para HH:MM
 */
export function formatarHoras(horasDecimais: number): string {
  const horas = Math.floor(horasDecimais);
  const minutos = Math.round((horasDecimais - horas) * 60);
  return `${horas}h${minutos.toString().padStart(2, "0")}min`;
}
