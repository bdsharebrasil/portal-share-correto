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

      // Buscar horas voadas do logbook
      let logbookQuery = supabase
        .from("logbook_entries")
        .select(`
          total_time,
          aircraft:aircraft_id (id, registration, fuel_consumption)
        `)
        .eq("client_id", clienteId)
        .gte("entry_date", periodo.inicio)
        .lte("entry_date", periodo.fim);

      if (aeronaveId) {
        logbookQuery = logbookQuery.eq("aircraft_id", aeronaveId);
      }

      const { data: logbookData, error: logbookError } = await logbookQuery;

      if (logbookError) throw logbookError;

      // Buscar abastecimentos diretamente do Supabase
      let abastecimentosQuery = supabase
        .from("abastecimentos")
        .select("litros, valor_total")
        .eq("client_id", clienteId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim);

      if (aeronaveId) {
        abastecimentosQuery = abastecimentosQuery.eq("aeronave_id", aeronaveId);
      }

      const { data: abastecimentos, error: abastecimentosError } = await abastecimentosQuery;

      if (abastecimentosError) throw abastecimentosError;

      // Calcular totais
      const horasVoadas = (logbookData || []).reduce(
        (sum, entry: any) => sum + (entry.total_time || 0),
        0
      );

      const litrosConsumidos = (abastecimentos || []).reduce(
        (sum: number, a: any) => sum + (a.litros || 0),
        0
      );

      const valorCombustivel = (abastecimentos || []).reduce(
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
