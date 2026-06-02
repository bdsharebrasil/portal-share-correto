import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinanceCaixaType } from "@/lib/financeConstants";

export interface SócioCusto {
  socio_id: string;
  socio_nome: string;
  total_aportado: number;
  total_devido: number;
  saldo: number;
}

export interface RelatorioCustosHolding {
  cliente_id: string;
  cliente_nome: string;
  aeronave_registro: string;
  saldo_caixa_holding: number;
  total_despesas_pagas: number;
  total_aportes_socios: number;
  custos_por_socio: SócioCusto[];
  movimentacoes_caixa: any[];
}

export function useRelatorioCustosModelo2(clienteId: string, aeronaveId?: string, dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ["relatorio-custos-modelo2", clienteId, aeronaveId, dataInicio, dataFim],
    enabled: !!clienteId,
    queryFn: async (): Promise<RelatorioCustosHolding> => {
      const db = supabase as any;

      // 1. Buscar dados do cliente (Holding)
      const { data: cliente } = await db
        .from("clientes")
        .select("id, razao_social")
        .eq("id", clienteId)
        .single();

      // 2. Buscar sócios da holding
      const { data: socios } = await db
        .from("socios")
        .select("id, nome")
        .eq("cliente_id", clienteId)
        .eq("ativo", true);

      // 3. Buscar aeronave vinculada à holding
      let aeronaveRegistro = "N/A";
      if (aeronaveId) {
        const { data: aeronave } = await db
          .from("aeronaves")
          .select("prefixo")
          .eq("id", aeronaveId)
          .single();
        aeronaveRegistro = aeronave?.prefixo || "N/A";
      }

      // 4. Buscar movimentações do CAIXA DO CLIENTE (tipo_caixa = 'cliente')
      let query = db
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          valor,
          data_competencia,
          tipo,
          status,
          tipo_caixa,
          socios_id,
          categorias_movimentacao(nome)
        `)
        .eq("clientes_id", clienteId)
        .eq("tipo_caixa", FinanceCaixaType.CLIENTE);

      if (aeronaveId) query = query.eq("aeronave_id", aeronaveId);
      if (dataInicio) query = query.gte("data_competencia", dataInicio);
      if (dataFim) query = query.lte("data_competencia", dataFim);

      const { data: movimentacoes } = await query;

      // 5. Processar lógica de caixa e sócios
      let totalDespesasPagas = 0;
      let totalAportesSocios = 0;
      const custosPorSocio: Record<string, SócioCusto> = {};

      (socios || []).forEach(s => {
        custosPorSocio[s.id] = {
          socio_id: s.id,
          socio_nome: s.nome,
          total_aportado: 0,
          total_devido: 0,
          saldo: 0
        };
      });

      (movimentacoes || []).forEach(mov => {
        const valor = Number(mov.valor) || 0;
        
        if (mov.tipo === "despesa") {
          totalDespesasPagas += valor;
          
          // No Modelo 2, as despesas são divididas igualmente entre os sócios ativos
          const numSocios = socios?.length || 1;
          const valorPorSocio = valor / numSocios;
          
          (socios || []).forEach(s => {
            if (custosPorSocio[s.id]) {
              custosPorSocio[s.id].total_devido += valorPorSocio;
            }
          });
        } else if (mov.tipo === "receita") {
          // No Modelo 2, receitas no caixa do cliente geralmente são aportes dos sócios
          totalAportesSocios += valor;
          
          if (mov.socios_id && custosPorSocio[mov.socios_id]) {
            custosPorSocio[mov.socios_id].total_aportado += valor;
          }
        }
      });

      // Calcular saldos finais por sócio
      const listaCustos = Object.values(custosPorSocio).map(s => ({
        ...s,
        saldo: s.total_aportado - s.total_devido
      }));

      return {
        cliente_id: clienteId,
        cliente_nome: cliente?.razao_social || "Holding",
        aeronave_registro: aeronaveRegistro,
        saldo_caixa_holding: totalAportesSocios - totalDespesasPagas,
        total_despesas_pagas: totalDespesasPagas,
        total_aportes_socios: totalAportesSocios,
        custos_por_socio: listaCustos,
        movimentacoes_caixa: movimentacoes || []
      };
    }
  });
}
