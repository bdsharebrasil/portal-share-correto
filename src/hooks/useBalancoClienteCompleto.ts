import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BalancoClienteCompleto {
  cliente_id: string;
  cliente_nome: string;
  cliente_cnpj: string | null;
  socio1_nome: string | null;
  socio1_cpf: string | null;
  socio1_percentual: number | null;
  socio2_nome: string | null;
  socio2_cpf: string | null;
  socio2_percentual: number | null;
  socio3_nome: string | null;
  socio3_cpf: string | null;
  socio3_percentual: number | null;
  aeronaves: string | null;
  ano: number;
  mes: number;
  mes_ano: string;
  horas_voadas: number;
  horas_totais_aeronave: number;
  percentual_uso: number;
  litros_consumidos: number;
  valor_combustivel: number;
  qtd_abastecimentos: number;
  total_movimentacoes: number;
  total_despesas: number;
  valor_empresa_adiantou: number;
  valor_cliente_pagou_direto: number;
  valor_reembolsado: number;
  saldo_pendente: number;
}

export interface ResumoHorasCombustivel {
  horasVoadas: number;
  horasTotaisAeronave: number;
  percentualUso: number;
  litrosConsumidos: number;
  valorCombustivel: number;
  qtdAbastecimentos: number;
}

/**
 * Hook para buscar dados completos do balanço do cliente incluindo horas voadas e combustível
 */
export function useBalancoClienteCompleto(
  clienteId: string | undefined,
  periodo: { inicio: string; fim: string }
) {
  return useQuery({
    queryKey: ["balanco-cliente-completo", clienteId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      // Extrair ano e mês do período
      const dataInicio = new Date(periodo.inicio);
      const dataFim = new Date(periodo.fim);
      const anoInicio = dataInicio.getFullYear();
      const mesInicio = dataInicio.getMonth() + 1;
      const anoFim = dataFim.getFullYear();
      const mesFim = dataFim.getMonth() + 1;

      const { data, error } = await supabase
        .from("vw_resumo_cliente_completo")
        .select("*")
        .eq("cliente_id", clienteId)
        .or(
          `and(ano.gte.${anoInicio},mes.gte.${mesInicio}),and(ano.lte.${anoFim},mes.lte.${mesFim})`
        )
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (error) {
        console.error("Erro ao buscar balanço completo:", error);
        // Fallback: buscar sem filtro de período se falhar
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("vw_resumo_cliente_completo")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("ano", { ascending: false })
          .order("mes", { ascending: false });

        if (fallbackError) throw fallbackError;
        return (fallbackData || []) as BalancoClienteCompleto[];
      }

      return (data || []) as BalancoClienteCompleto[];
    },
    enabled: !!clienteId,
  });
}

/**
 * Calcula o resumo de horas voadas e combustível para um período
 */
export function calcularResumoHorasCombustivel(
  dados: BalancoClienteCompleto[],
  fatorProporcao: number = 1
): ResumoHorasCombustivel {
  if (!dados || dados.length === 0) {
    return {
      horasVoadas: 0,
      horasTotaisAeronave: 0,
      percentualUso: 0,
      litrosConsumidos: 0,
      valorCombustivel: 0,
      qtdAbastecimentos: 0,
    };
  }

  const resumo = dados.reduce(
    (acc, item) => ({
      horasVoadas: acc.horasVoadas + (Number(item.horas_voadas) || 0),
      horasTotaisAeronave:
        acc.horasTotaisAeronave + (Number(item.horas_totais_aeronave) || 0),
      litrosConsumidos:
        acc.litrosConsumidos + (Number(item.litros_consumidos) || 0),
      valorCombustivel:
        acc.valorCombustivel + (Number(item.valor_combustivel) || 0),
      qtdAbastecimentos:
        acc.qtdAbastecimentos + (Number(item.qtd_abastecimentos) || 0),
    }),
    {
      horasVoadas: 0,
      horasTotaisAeronave: 0,
      litrosConsumidos: 0,
      valorCombustivel: 0,
      qtdAbastecimentos: 0,
    }
  );

  // Calcular percentual de uso médio
  const percentualUso =
    resumo.horasTotaisAeronave > 0
      ? (resumo.horasVoadas / resumo.horasTotaisAeronave) * 100
      : 0;

  return {
    horasVoadas: resumo.horasVoadas * fatorProporcao,
    horasTotaisAeronave: resumo.horasTotaisAeronave,
    percentualUso,
    litrosConsumidos: resumo.litrosConsumidos * fatorProporcao,
    valorCombustivel: resumo.valorCombustivel * fatorProporcao,
    qtdAbastecimentos: resumo.qtdAbastecimentos,
  };
}

/**
 * Formata horas decimais para formato HH:MM
 */
export function formatarHoras(horasDecimais: number): string {
  const horas = Math.floor(horasDecimais);
  const minutos = Math.round((horasDecimais - horas) * 60);
  return `${horas}h${minutos.toString().padStart(2, "0")}m`;
}
