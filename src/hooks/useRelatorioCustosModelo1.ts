import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinancePayorType } from "@/lib/financeConstants";

export interface CustoCotista {
  cliente_id: string;
  cliente_nome: string;
  percentual_rateio: number;
  valor_devido: number;
  valor_pago: number;
  saldo: number;
}

export interface RelatorioCustosAeronave {
  aeronave_id: string;
  aeronave_registro: string;
  total_despesas: number;
  total_terceiro_custo: number;
  custos_por_cotista: CustoCotista[];
  despesas_detalhadas: any[];
}

export function useRelatorioCustosModelo1(aeronaveId: string, dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ["relatorio-custos-modelo1", aeronaveId, dataInicio, dataFim],
    enabled: !!aeronaveId,
    queryFn: async (): Promise<RelatorioCustosAeronave> => {
      // 1. Buscar dados da aeronave
      const { data: aeronave } = await supabase
        .from("aeronaves")
        .select("id, prefixo")
        .eq("id", aeronaveId)
        .single();

      // 2. Buscar cotistas da aeronave
      const { data: cotistas } = await supabase
        .from("cotas_aeronave")
        .select("cliente_id, percentual_padrao, cliente:clientes(razao_social)")
        .eq("aeronave_id", aeronaveId)
        .eq("ativo", true);

      // 3. Buscar movimentações (despesas) da aeronave
      let query = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          valor,
          data_competencia,
          tipo,
          status,
          pago_por_tipo,
          clientes_id,
          categoria_id,
          categorias_movimentacao(nome)
        `)
        .eq("aeronave_id", aeronaveId)
        .eq("tipo", "despesa");

      if (dataInicio) query = query.gte("data_competencia", dataInicio);
      if (dataFim) query = query.lte("data_competencia", dataFim);

      const { data: movimentacoes } = await query;

      // 4. Buscar rateios específicos para estas movimentações
      const movIds = (movimentacoes || []).map(m => m.id);
      const { data: rateios } = await supabase
        .from("linhas_rateio")
        .select("*")
        .in("despesa_id", movIds);

      // 5. Processar lógica de custos
      const custosPorCotista: Record<string, CustoCotista> = {};
      (cotistas || []).forEach(c => {
        custosPorCotista[c.cliente_id] = {
          cliente_id: c.cliente_id,
          cliente_nome: c.cliente?.razao_social || "Desconhecido",
          percentual_rateio: Number(c.percentual_padrao) || 0,
          valor_devido: 0,
          valor_pago: 0,
          saldo: 0
        };
      });

      let totalDespesas = 0;
      let totalTerceiroCusto = 0;

      (movimentacoes || []).forEach(mov => {
        const valorTotal = Number(mov.valor) || 0;
        const isTerceiroCusto = mov.pago_por_tipo === FinancePayorType.THIRD_PARTY || 
                               mov.categorias_movimentacao?.nome?.toUpperCase() === "TERCEIRO CUSTO";

        if (isTerceiroCusto) {
          totalTerceiroCusto += valorTotal;
          // Terceiro custo não entra no rateio dos cotistas
          return;
        }

        totalDespesas += valorTotal;

        // Verificar se há rateio específico
        const rateiosMov = (rateios || []).filter(r => r.despesa_id === mov.id);
        
        if (rateiosMov.length > 0) {
          // Usar rateio específico da despesa
          rateiosMov.forEach(r => {
            if (custosPorCotista[r.entidade_id]) {
              custosPorCotista[r.entidade_id].valor_devido += Number(r.valor_rateado) || 0;
              // Se o caixa de origem for o do próprio cotista, ele já pagou
              if (r.origem_caixa === "cliente" || r.origem_caixa === "socio") {
                custosPorCotista[r.entidade_id].valor_pago += Number(r.valor_rateado) || 0;
              }
            }
          });
        } else {
          // Usar rateio padrão da aeronave
          (cotistas || []).forEach(c => {
            const valorRateado = valorTotal * (Number(c.percentual_padrao) / 100);
            custosPorCotista[c.cliente_id].valor_devido += valorRateado;
            
            // Lógica de pagamento: se a despesa foi paga por um cliente específico
            if (mov.clientes_id === c.cliente_id && mov.pago_por_tipo === FinancePayorType.CLIENT) {
              custosPorCotista[c.cliente_id].valor_pago += valorTotal;
            }
          });
        }
      });

      // Calcular saldos finais
      const listaCustos = Object.values(custosPorCotista).map(c => ({
        ...c,
        saldo: c.valor_pago - c.valor_devido
      }));

      return {
        aeronave_id: aeronaveId,
        aeronave_registro: aeronave?.prefixo || "N/A",
        total_despesas: totalDespesas,
        total_terceiro_custo: totalTerceiroCusto,
        custos_por_cotista: listaCustos,
        despesas_detalhadas: movimentacoes || []
      };
    }
  });
}
