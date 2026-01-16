/**
 * Financial Sync Client
 *
 * ✅ Frontend client que chama endpoints SEGUROS do backend
 * ✅ Sem lógica de negócio sensível no frontend
 * ✅ Simples delegação de requisições HTTP
 * ✅ Tratamento de erros padronizado
 */

import { ApiClient } from '@/lib/api-client';

interface SalaryPaymentData {
  base_salary_holerite?: number | null;
  horas_voo?: string | null;
  benefit?: string | null;
  extra?: string | null;
  ferias?: number | null;
  decimo_terceiro_parcela1?: number | null;
  decimo_terceiro_parcela2?: number | null;
  comprovante_url?: string | null;
  obs?: string | null;
  banco?: string | null;
  data_pagamento?: string | null;
}

interface SyncResult {
  success: boolean;
  controleBancarioId?: string;
  contaAreceberId?: string;
  error?: string;
}

interface SalarySyncResult {
  success: boolean;
  entriesCreated?: number;
  error?: string;
  details?: any;
}

interface ApiSyncResponse {
  success: boolean;
  error?: string;
  data?: { controleBancarioId?: string; contaAreceberId?: string };
}

interface ApiSalarySyncResponse {
  success: boolean;
  error?: string;
  details?: any;
  data?: { entriesCreated?: number; details?: any };
}

interface ApiDeleteResponse {
  success?: boolean;
}

// Usar o cliente de API existente (evita duplicação de configuração)
const apiClient = new ApiClient();

/**
 * Sincroniza uma bank_reconciliation com controle_bancario e contas_areceber
 * 
 * Executa no SERVIDOR - sem exposição de credenciais
 */
export async function syncBankReconciliationToFinancial(
  reconciliationId: string,
  userId: string
): Promise<SyncResult> {
  try {
    const result = await apiClient.post<ApiSyncResponse>('/api/financial/sync-bank-reconciliation', {
      reconciliationId,
      userId
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to sync bank reconciliation'
      };
    }

    return {
      success: true,
      controleBancarioId: result.data?.controleBancarioId,
      contaAreceberId: result.data?.contaAreceberId,
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error syncing bank reconciliation:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Sincroniza um pagamento de salário com movimentações de controle_bancario
 * 
 * Executa no SERVIDOR - sem exposição de credenciais
 */
export async function syncSalaryPaymentToFinancial(
  paymentId: string,
  userId: string,
  employeeName: string,
  employeeId: string,
  paymentData: SalaryPaymentData
): Promise<SalarySyncResult> {
  try {
    const result = await apiClient.post<ApiSalarySyncResponse>('/api/financial/sync-salary-payment', {
      paymentId,
      userId,
      employeeName,
      employeeId,
      paymentData
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to sync salary payment',
        details: result.details
      };
    }

    return {
      success: true,
      entriesCreated: result.data?.entriesCreated,
      details: result.data?.details
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error syncing salary payment:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Deleta todas as movimentações de um pagamento de salário
 *
 * Executa no SERVIDOR
 */
export async function deleteSalaryPaymentFromFinancial(paymentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await apiClient.delete<ApiDeleteResponse>(`/api/financial/salary-payment/${paymentId}`);

    return {
      success: result.success || false,
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error deleting salary payment:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Deleta todas as movimentações de uma reconciliação
 *
 * Executa no SERVIDOR
 */
export async function deleteReconciliationFromFinancial(reconciliationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await apiClient.delete<ApiDeleteResponse>(`/api/financial/bank-reconciliation/${reconciliationId}`);

    return {
      success: result.success || false,
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error deleting bank reconciliation:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}