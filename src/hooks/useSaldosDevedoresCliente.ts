// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SaldoDevedor {
  tipo: 'reembolso' | 'pagamento_direto' | 'combustivel';
  descricao: string;
  saldo: number;
  quantidade_registros: number;
  percentual_participacao?: number;
}

export interface ResumoPagamentos {
  total_geral: number;
  reembolsos: SaldoDevedor;
  pagamento_direto: SaldoDevedor;
  combustivel: SaldoDevedor;
}

export function useSaldosDevedoresCliente(clienteId?: string, aircraftId?: string) {
  return useQuery({
    queryKey: ['saldos-devedores', clienteId, aircraftId],
    queryFn: async () => {
      if (!clienteId) return null;

      try {
        // 1. Reembolsos pendentes
        let bankReembolsoQuery = supabase
          .from('conciliacoes_bancarias')
          .select('id, valor, status')
          .eq('clientes_id', clienteId)
          .eq('status', 'aguardando_reembolso');

        if (aircraftId) {
          bankReembolsoQuery = bankReembolsoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: reembolsosData, error: reembolsoError } = await bankReembolsoQuery;
        if (reembolsoError) throw new Error(`Erro ao buscar reembolsos: ${reembolsoError.message}`);

        let receiptsReembolsoQuery = supabase
          .from('recibos')
          .select('id, valor, status')
          .eq('cliente_id', clienteId)
          .eq('tipo_recibo', 'reembolso')
          .in('status', ['pendente', 'enviado', 'aberto']);

        if (aircraftId) {
          receiptsReembolsoQuery = receiptsReembolsoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: receiptsReembolsoData, error: receiptsReembolsoError } = await receiptsReembolsoQuery;
        if (receiptsReembolsoError) throw new Error(`Erro ao buscar recibos: ${receiptsReembolsoError.message}`);

        const reembolsos = [...(reembolsosData || []), ...(receiptsReembolsoData || [])];

        // 2. Pagamento direto
        let pagamentoDiretoQuery = (supabase as any)
          .from('despesas_cliente_direto')
          .select('id, valor, status, descricao')
          .eq('clientes_id', clienteId)
          .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado', 'comprovante_recebido']);

        if (aircraftId) {
          pagamentoDiretoQuery = pagamentoDiretoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: pagamentoDiretoData, error: pagamentoError } = await pagamentoDiretoQuery;
        if (pagamentoError) throw new Error(`Erro ao buscar despesas diretas: ${pagamentoError.message}`);

        const pagamentoDireto = pagamentoDiretoData || [];

        // 3. Combustível
        let abastecimentoQuery = supabase
          .from('abastecimentos')
          .select('id, valor_total, status')
          .eq('id_clientes', clienteId)
          .neq('status', 'pago');

        if (aircraftId) {
          abastecimentoQuery = abastecimentoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: abastecimentoData } = await abastecimentoQuery;
        const abastecimentos = abastecimentoData || [];

        // Totais
        const totalReembolsos = reembolsos.reduce((sum: number, item: any) => sum + (Number(item.valor) || 0), 0);
        const totalPagamentoDireto = pagamentoDireto.reduce((sum: number, item: any) => sum + (Number(item.valor) || 0), 0);
        const totalCombustivel = abastecimentos.reduce((sum: number, item: any) => sum + (Number(item.valor_total) || 0), 0);

        const resumo: ResumoPagamentos = {
          total_geral: totalReembolsos + totalPagamentoDireto + totalCombustivel,
          reembolsos: {
            tipo: 'reembolso',
            descricao: 'Despesas Aguardando Reembolso',
            saldo: totalReembolsos,
            quantidade_registros: reembolsos.length,
          },
          pagamento_direto: {
            tipo: 'pagamento_direto',
            descricao: 'Despesas Enviadas para Pagamento Direto',
            saldo: totalPagamentoDireto,
            quantidade_registros: pagamentoDireto.length,
          },
          combustivel: {
            tipo: 'combustivel',
            descricao: 'Saldo Devedor de Combustível',
            saldo: totalCombustivel,
            quantidade_registros: abastecimentos.length,
          },
        };

        return resumo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('Erro ao buscar saldos devedores:', errorMessage, error);
        throw new Error(errorMessage);
      }
    },
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 5,
  });
}
