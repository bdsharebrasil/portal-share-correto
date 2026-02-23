/**
 * Exemplo de Service - Padrão para criar serviços no módulo
 * 
 * Services contêm:
 * - Lógica de negócio
 * - Chamadas a APIs
 * - Transformação de dados
 * - SEM dependências React
 * 
 * Devem ser usados por Hooks, nunca diretamente em componentes
 */

import { supabase } from '@/integrations/supabase/client';
import type { Transaction, Balance } from '../types';

export const balanceService = {
  /**
   * Calcula o balanço a partir de uma lista de transações
   */
  calculateBalance: (transactions: Transaction[]): Balance => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
    };
  },

  /**
   * Carrega transações de um cliente
   */
  async getClientTransactions(clientId: string, startDate?: Date, endDate?: Date) {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId);

    if (startDate) {
      query = query.gte('date', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('date', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Transaction[];
  },

  /**
   * Carrega balanço de um cliente para um período específico
   */
  async getMonthlyBalance(clientId: string, year: number, month: number): Promise<Balance> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const transactions = await balanceService.getClientTransactions(
      clientId,
      startDate,
      endDate
    );

    return balanceService.calculateBalance(transactions);
  },
};
