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

/**
 * Hook para buscar saldos devedores do cliente
 * Retorna:
 * - Saldo devedor de despesas que precisam reembolso (de bank_reconciliations)
 * - Saldo devedor de despesas para pagamento direto (de despesas_cliente_direto)
 * - Saldo devedor de combustível
 */
export function useSaldosDevedoresCliente(clienteId?: string, aircraftId?: string) {
  return useQuery({
    queryKey: ['saldos-devedores', clienteId, aircraftId],
    queryFn: async () => {
      if (!clienteId) return null;

      try {
        // 1. Buscar despesas para reembolso da tabela bank_reconciliations
        let bankReembolsoQuery = supabase
          .from('bank_reconciliations')
          .select('id, amount, status')
          .eq('client_id', clienteId)
          .eq('status', 'aguardando_reembolso');

        if (aircraftId) {
          bankReembolsoQuery = bankReembolsoQuery.eq('aircraft_id', aircraftId);
        }

        const { data: reembolsosData, error: reembolsoError } = await bankReembolsoQuery;

        if (reembolsoError) {
          throw new Error(`Erro ao buscar reembolsos: ${reembolsoError.message}`);
        }

        // 1b. Buscar recibos de reembolso pendentes da tabela receipts
        let receiptsReembolsoQuery = supabase
          .from('receipts')
          .select('id, amount, status')
          .eq('client_id', clienteId)
          .eq('receipt_type', 'reembolso')
          .in('status', ['pendente', 'enviado', 'aberto']);

        if (aircraftId) {
          receiptsReembolsoQuery = receiptsReembolsoQuery.eq('aircraft_id', aircraftId);
        }

        const { data: receiptsReembolsoData, error: receiptsReembolsoError } = await receiptsReembolsoQuery;

        if (receiptsReembolsoError) {
          throw new Error(`Erro ao buscar recibos de reembolso: ${receiptsReembolsoError.message}`);
        }

        const reembolsos = [...(reembolsosData || []), ...(receiptsReembolsoData || [])];

        // 2. Buscar despesas para pagamento direto da tabela despesas_cliente_direto
        // Status pendentes: enviado, visualizado_cliente, aguardando_pagamento, atrasado
        let pagamentoDiretoQuery = supabase
          .from('despesas_cliente_direto')
          .select('id, valor, status, descricao')
          .eq('client_id', clienteId)
          .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado', 'comprovante_recebido']);

        if (aircraftId) {
          pagamentoDiretoQuery = pagamentoDiretoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: pagamentoDiretoData, error: pagamentoError } = await pagamentoDiretoQuery;

        if (pagamentoError) {
          throw new Error(`Erro ao buscar despesas diretas: ${pagamentoError.message}`);
        }

        const pagamentoDireto = pagamentoDiretoData || [];

        // 3. Buscar despesas de combustível (pode vir de três tabelas)
        // Do bank_reconciliations
        let combustivelBankQuery = supabase
          .from('bank_reconciliations')
          .select('id, amount, status, description')
          .eq('client_id', clienteId)
          .ilike('description', '%combustivel%');

        if (aircraftId) {
          combustivelBankQuery = combustivelBankQuery.eq('aircraft_id', aircraftId);
        }

        const { data: combustivelBankData, error: combustivelBankError } = await combustivelBankQuery;

        // Do despesas_cliente_direto
        let combustivelDiretoQuery = supabase
          .from('despesas_cliente_direto')
          .select('id, valor, status, descricao')
          .eq('client_id', clienteId)
          .ilike('descricao', '%combustivel%');

        if (aircraftId) {
          combustivelDiretoQuery = combustivelDiretoQuery.eq('aeronave_id', aircraftId);
        }

        const { data: combustivelDiretoData, error: combustivelDiretoError } = await combustivelDiretoQuery;

        // Da tabela abastecimentos (combustível pendente de pagamento)
        let abastecimentoQuery = supabase
          .from('abastecimentos')
          .select('id, valor_total, status_pagamento')
          .eq('client_id', clienteId)
          .neq('status_pagamento', 'pago');

        if (aircraftId) {
          abastecimentoQuery = abastecimentoQuery.eq('aircraft_id', aircraftId);
        }

        const { data: abastecimentoData, error: abastecimentoError } = await abastecimentoQuery;

        const combustivelBank = combustivelBankData || [];
        const combustivelDireto = combustivelDiretoData || [];
        const abastecimentos = abastecimentoData || [];

        // Calcular totais
        const totalReembolsos = reembolsos.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);
        const totalPagamentoDireto = pagamentoDireto.reduce((sum, item: any) => sum + (Number(item.valor) || 0), 0);
        const totalCombustivel =
          combustivelBank.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0) +
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
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para buscar detalhes de saldo devedor por tipo
 */
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
          // Buscar de bank_reconciliations
          let query = supabase
            .from('bank_reconciliations')
            .select('id, amount, status, description, date')
            .eq('client_id', clienteId)
            .eq('status', 'aguardando_reembolso');

          if (aircraftId) {
            query = query.eq('aircraft_id', aircraftId);
          }

          const { data, error } = await query.order('date', { ascending: false });

          if (error) throw error;
          return data || [];
        } else if (tipo === 'pagamento_direto') {
          // Buscar de despesas_cliente_direto
          let query = supabase
            .from('despesas_cliente_direto')
            .select('id, valor, status, descricao, data_vencimento, data_envio')
            .eq('client_id', clienteId)
            .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado', 'comprovante_recebido']);

          if (aircraftId) {
            query = query.eq('aeronave_id', aircraftId);
          }

          const { data, error } = await query.order('data_vencimento', { ascending: false });

          if (error) throw error;
          return data || [];
        } else if (tipo === 'combustivel') {
          // Buscar de três tabelas
          let bankQuery = supabase
            .from('bank_reconciliations')
            .select('id, amount, status, description, date')
            .eq('client_id', clienteId)
            .ilike('description', '%combustivel%');

          if (aircraftId) {
            bankQuery = bankQuery.eq('aircraft_id', aircraftId);
          }

          const { data: bankData, error: bankError } = await bankQuery.order('date', { ascending: false });

          let diretoQuery = supabase
            .from('despesas_cliente_direto')
            .select('id, valor, status, descricao, data_vencimento')
            .eq('client_id', clienteId)
            .ilike('descricao', '%combustivel%');

          if (aircraftId) {
            diretoQuery = diretoQuery.eq('aeronave_id', aircraftId);
          }

          const { data: diretoData, error: diretoError } = await diretoQuery.order('data_vencimento', { ascending: false });

          let abastecimentoQuery = supabase
            .from('abastecimentos')
            .select('id, valor_total as valor, status_pagamento as status, data')
            .eq('client_id', clienteId)
            .neq('status_pagamento', 'pago');

          if (aircraftId) {
            abastecimentoQuery = abastecimentoQuery.eq('aircraft_id', aircraftId);
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
