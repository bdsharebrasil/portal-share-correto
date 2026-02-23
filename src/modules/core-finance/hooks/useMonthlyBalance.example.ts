/**
 * Exemplo de Hook - Padrão para criar hooks no módulo
 * 
 * Hooks:
 * - Gerenciam estado e ciclo de vida
 * - Chamam Services para lógica de negócio
 * - Retornam dados já processados para componentes
 * - Tratam loading, error, e cache
 */

import { useState, useEffect } from 'react';
import { balanceService } from '../services/balance.example';
import type { Balance } from '../types';

interface UseBalanceResult {
  balance: Balance | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook para carregar balanço mensal de um cliente
 * 
 * @param clientId - ID do cliente
 * @param year - Ano do balanço
 * @param month - Mês do balanço
 * @returns { balance, loading, error }
 * 
 * @example
 * function MyComponent() {
 *   const { balance, loading, error } = useMonthlyBalance('client-123', 2024, 12);
 *   
 *   if (loading) return <div>Carregando...</div>;
 *   if (error) return <div>Erro: {error.message}</div>;
 *   
 *   return <div>Saldo: R$ {balance?.net}</div>;
 * }
 */
export function useMonthlyBalance(
  clientId: string,
  year: number,
  month: number
): UseBalanceResult {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await balanceService.getMonthlyBalance(clientId, year, month);
        setBalance(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      loadBalance();
    }
  }, [clientId, year, month]);

  return { balance, loading, error };
}
