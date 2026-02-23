/**
 * Exemplo de Componente - Padrão para criar componentes no módulo
 * 
 * Componentes:
 * - Recebem dados via Props
 * - SÃO UI pura
 * - NÃO chamam Services diretamente
 * - NÃO contêm lógica complexa (isso fica no Hook)
 * - Handlers chamam funções passadas via props
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Balance } from '../types';

interface BalanceCardProps {
  balance: Balance | null;
  loading?: boolean;
  error?: Error | null;
  month?: string;
  className?: string;
}

/**
 * Componente que exibe o balanço formatado
 * 
 * @param balance - Dados do balanço
 * @param loading - Se está carregando
 * @param error - Se há erro
 * @param month - Mês para exibição (ex: "Dezembro/2024")
 * @param className - Classes CSS adicionais
 * 
 * @example
 * function MyPage() {
 *   const { balance, loading, error } = useMonthlyBalance(clientId, year, month);
 *   
 *   return (
 *     <BalanceCard
 *       balance={balance}
 *       loading={loading}
 *       error={error}
 *       month="Dezembro/2024"
 *     />
 *   );
 * }
 */
export function BalanceCard({
  balance,
  loading = false,
  error = null,
  month = '',
  className = '',
}: BalanceCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Balanço {month}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className} border-red-200`}>
        <CardHeader>
          <CardTitle className="text-red-600">Erro ao carregar balanço</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return null;
  }

  const netColor = balance.net >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Balanço {month}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Receitas</p>
            <p className="text-lg font-semibold text-green-600">
              R$ {balance.totalIncome.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Despesas</p>
            <p className="text-lg font-semibold text-red-600">
              R$ {balance.totalExpense.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Saldo</p>
            <p className={`text-lg font-semibold ${netColor}`}>
              R$ {balance.net.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
