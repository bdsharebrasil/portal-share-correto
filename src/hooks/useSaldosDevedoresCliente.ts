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
        // 1. Buscar despesas para reembolso
        let bankReembolsoQuery = supabase
          .from('conciliacoes_bancarias')
          .select('id, valor, status')
          .eq('cliente_id', clienteId)
          .eq('status', 'aguardando_reembolso');

        if (aircraftId) {
          bankReembolsoQuery = bankReembolsoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: reembolsosData, error: reembolsoError } = await bankReembolsoQuery;

        if (reembolsoError) {
          throw new Error(`Erro ao buscar reembolsos: ${reembolsoError.message}`);
        }

        // 1b. Buscar recibos de reembolso pendentes
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

        if (receiptsReembolsoError) {
          throw new Error(`Erro ao buscar recibos de reembolso: ${receiptsReembolsoError.message}`);
        }

        const reembolsos = [...(reembolsosData || []), ...(receiptsReembolsoData || [])];

        // 2. Buscar despesas para pagamento direto
        let pagamentoDiretoQuery = supabase
          .from('despesas_cliente_direto')
          .select('id, valor, status, descricao')
          .eq('cliente_id', clienteId)
          .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado', 'comprovante_recebido']);

        if (aircraftId) {
          pagamentoDiretoQuery = pagamentoDiretoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: pagamentoDiretoData, error: pagamentoError } = await pagamentoDiretoQuery;

        if (pagamentoError) {
          throw new Error(`Erro ao buscar despesas diretas: ${pagamentoError.message}`);
        }

        const pagamentoDireto = pagamentoDiretoData || [];

        // 3. Buscar despesas de combustível
        let combustivelBankQuery = supabase
          .from('conciliacoes_bancarias')
          .select('id, valor, status, descricao')
          .eq('cliente_id', clienteId)
          .ilike('descricao', '%combustivel%');

        if (aircraftId) {
          combustivelBankQuery = combustivelBankQuery.eq('aeronave_id', aircraftId);
        }

        const { data: combustivelBankData } = await combustivelBankQuery;

        let combustivelDiretoQuery = supabase
          .from('despesas_cliente_direto')
          .select('id, valor, status, descricao')
          .eq('cliente_id', clienteId)
          .ilike('descricao', '%combustivel%');

        if (aircraftId) {
          combustivelDiretoQuery = combustivelDiretoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: combustivelDiretoData } = await combustivelDiretoQuery;

        let abastecimentoQuery = supabase
          .from('abastecimentos')
          .select('id, valor_total, status_pagamento')
          .eq('id_clientes', clienteId)
          .neq('status_pagamento', 'pago');

        if (aircraftId) {
          abastecimentoQuery = abastecimentoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: abastecimentoData } = await abastecimentoQuery;

        const combustivelBank = combustivelBankData || [];
        const combustivelDireto = combustivelDiretoData || [];
        const abastecimentos = abastecimentoData || [];

        // Calcular totais
        const totalReembolsos = reembolsos.reduce((sum, item: any) => sum + (Number(item.valor) || 0), 0);
        const totalPagamentoDireto = pagamentoDireto.reduce((sum, item: any) => sum + (Number(item.valor) || 0), 0);
        const totalCombustivel =
          combustivelBank.reduce((sum, item: any) => sum + (Number(item.valor) || 0), 0) +
          combustivelDireto.reduce((sum, item: any) => sum + (Number(item.valor) || 0), 0) +
          abastecimentos.reduce((sum, item: any) => sum + (Number(item.valor_total) || 0), 0);

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
            quantidade_registros: combustivelBank.length + combustivelDireto.length + abastecimentos.length,
          },
        };

        return resumo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar dados';
        console.error('Erro ao buscar saldos devedores:', errorMessage, error);
        throw new Error(errorMessage);
      }
    },
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaldosDevedoresDetalhes(
  clienteId?: string,
  tipo?: 'reembolso' | 'pagamento_direto' | 'combustivel',
  aircraftId?: string
) {
  return useQuery({
    queryKey: ['saldos-devedores-detalhes', clienteId, tipo, aircraftId],
    queryFn: async () => {
      if (!clienteId || !tipo) return [];

      try {
        if (tipo === 'reembolso') {
          let query = supabase
            .from('conciliacoes_bancarias')
            .select('id, valor, status, descricao, data')
            .eq('cliente_id', clienteId)
            .eq('status', 'aguardando_reembolso');

          if (aircraftId) {
            query = query.eq('aeronave_id', aircraftId);
          }

          const { data, error } = await query.order('data', { ascending: false });
          if (error) throw error;
          return data || [];
        } else if (tipo === 'pagamento_direto') {
          let query = supabase
            .from('despesas_cliente_direto')
            .select('id, valor, status, descricao, data_vencimento, data_envio')
            .eq('cliente_id', clienteId)
            .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado', 'comprovante_recebido']);

          if (aircraftId) {
            query = query.eq('aeronave_id', aircraftId);
          }

          const { data, error } = await query.order('data_vencimento', { ascending: false });
          if (error) throw error;
          return data || [];
        } else if (tipo === 'combustivel') {
          let bankQuery = supabase
            .from('conciliacoes_bancarias')
            .select('id, valor, status, descricao, data')
            .eq('cliente_id', clienteId)
            .ilike('descricao', '%combustivel%');

          if (aircraftId) {
            bankQuery = bankQuery.eq('aeronave_id', aircraftId);
          }

          const { data: bankData, error: bankError } = await bankQuery.order('data', { ascending: false });

          let diretoQuery = supabase
            .from('despesas_cliente_direto')
            .select('id, valor, status, descricao, data_vencimento')
            .eq('cliente_id', clienteId)
            .ilike('descricao', '%combustivel%');

          if (aircraftId) {
            diretoQuery = diretoQuery.eq('aeronave_id', aircraftId);
          }

          const { data: diretoData, error: diretoError } = await diretoQuery.order('data_vencimento', { ascending: false });

          let abastecimentoQuery = supabase
            .from('abastecimentos')
            .select('id, valor_total, status_pagamento, data')
            .eq('id_clientes', clienteId)
            .neq('status_pagamento', 'pago');

          if (aircraftId) {
            abastecimentoQuery = abastecimentoQuery.eq('aeronave_id', aircraftId);
          }

          const { data: abastecimentosData, error: abastecimentosError } = await abastecimentoQuery.order('data', { ascending: false });

          if (bankError || diretoError || abastecimentosError) throw bankError || diretoError || abastecimentosError;
          return [...(bankData || []), ...(diretoData || []), ...(abastecimentosData || [])];
        }

        return [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('Erro ao buscar detalhes de saldos devedores:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    enabled: !!clienteId && !!tipo,
    staleTime: 1000 * 60 * 5,
  });
}
