import { supabase } from "@/integrations/supabase/client";
import { calculateReportTotals, extractPayerTotals, getValidExpenses } from "./travelReportUtils";

interface Expense {
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  id?: string;
}

/**
 * Função para corrigir conciliações bancárias de relatórios de viagem
 * que foram criadas com valores incorretos.
 * 
 * PROBLEMA: Anteriormente, conciliações estavam sendo criadas com total_amount
 * em vez de descontar o que o cliente já pagou.
 * 
 * SOLUÇÃO: Esta função recalcula o valor correto e atualiza a conciliação.
 * 
 * Exemplo:
 * - Total despesa: 568.67
 * - Cliente pagou: 260
 * - Valor INCORRETO anterior: 568.67
 * - Valor CORRETO agora: 308.67
 * 
 * @param reportId - ID do relatório de viagem
 * @returns Resumo das correções feitas
 */
export async function fixTravelReportReconciliations(reportId: string) {
  console.log(`🔧 Iniciando correção de conciliações para relatório ${reportId}`);
  
  try {
    // 1. Buscar o relatório de viagem
    const { data: report, error: reportError } = await supabase
      .from('travel_expense_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      const errorMessage = reportError?.message || String(reportError);
      console.error('❌ Relatório não encontrado:', errorMessage);
      return null;
    }

    // 2. Parsear as despesas
    let expenses: Expense[] = [];
    try {
      if (typeof report.expenses === 'string') {
        expenses = JSON.parse(report.expenses);
      } else {
        expenses = report.expenses || [];
      }
    } catch (e) {
      console.error('❌ Erro ao parsear despesas:', e);
      return null;
    }

    // 3. Validar e obter apenas despesas válidas
    const validExpenses = getValidExpenses(expenses);
    
    // 4. Recalcular totais corretos
    const totals = calculateReportTotals(validExpenses);
    const payerTotals = extractPayerTotals(validExpenses);
    
    const correctTotalForClient = payerTotals.totalSharebrasil + payerTotals.totalCrew1 + payerTotals.totalCrew2;
    const correctTotalForCrew1 = payerTotals.totalCrew1;
    const correctTotalForCrew2 = payerTotals.totalCrew2;

    console.log('📊 Totais calculados:', {
      total_geral: totals.total_amount,
      cliente_pagou: payerTotals.totalClient,
      cliente_deve_pagar: correctTotalForClient,
      tripulante_1_pagou: correctTotalForCrew1,
      tripulante_2_pagou: correctTotalForCrew2,
      sharebrasil: payerTotals.totalSharebrasil
    });

    // 5. Buscar conciliações atuais para este relatório
    const { data: currentReconciliations, error: reconcError } = await supabase
      .from('bank_reconciliations')
      .select('*')
      .eq('reference_id', reportId)
      .eq('reference_type', 'travel_report');

    if (reconcError) {
      const errorMessage = reconcError.message || String(reconcError);
      console.error('❌ Erro ao buscar conciliações:', errorMessage);
      return null;
    }

    console.log(`📋 Encontradas ${currentReconciliations?.length || 0} conciliações`);

    const corrections = {
      cliente: false,
      crew1: false,
      crew2: false,
      details: [] as any[]
    };

    // 6. Atualizar conciliação de cliente se necessário
    const clientRecon = currentReconciliations?.find(r => r.type === 'cliente');
    if (clientRecon) {
      if (Math.abs(clientRecon.amount - correctTotalForClient) > 0.01) {
        console.log(`🔄 Corrigindo conciliação de cliente: ${clientRecon.amount} → ${correctTotalForClient}`);
        
        const { error: updateError } = await supabase
          .from('bank_reconciliations')
          .update({ amount: correctTotalForClient })
          .eq('id', clientRecon.id);

        if (updateError) {
          const errorMessage = updateError.message || String(updateError);
          console.error('❌ Erro ao atualizar conciliação de cliente:', errorMessage);
        } else {
          corrections.cliente = true;
          corrections.details.push({
            type: 'cliente',
            valorAnterior: clientRecon.amount,
            valorCorreto: correctTotalForClient
          });
          console.log('✅ Conciliação de cliente corrigida');
        }
      }
    }

    // 7. Atualizar conciliação de tripulante 1 se necessário
    const crew1Recon = currentReconciliations?.find(
      r => r.type === 'colaborador' && r.description?.includes('TRIPULANTE 1')
    );
    if (crew1Recon && correctTotalForCrew1 > 0) {
      if (Math.abs(crew1Recon.amount - correctTotalForCrew1) > 0.01) {
        console.log(`🔄 Corrigindo reembolso tripulante 1: ${crew1Recon.amount} → ${correctTotalForCrew1}`);
        
        const { error: updateError } = await supabase
          .from('bank_reconciliations')
          .update({ amount: correctTotalForCrew1 })
          .eq('id', crew1Recon.id);

        if (updateError) {
          const errorMessage = updateError.message || String(updateError);
          console.error('❌ Erro ao atualizar reembolso tripulante 1:', errorMessage);
        } else {
          corrections.crew1 = true;
          corrections.details.push({
            type: 'crew1',
            valorAnterior: crew1Recon.amount,
            valorCorreto: correctTotalForCrew1
          });
          console.log('✅ Reembolso tripulante 1 corrigido');
        }
      }
    }

    // 8. Atualizar conciliação de tripulante 2 se necessário
    const crew2Recon = currentReconciliations?.find(
      r => r.type === 'colaborador' && r.description?.includes('TRIPULANTE 2')
    );
    if (crew2Recon && correctTotalForCrew2 > 0) {
      if (Math.abs(crew2Recon.amount - correctTotalForCrew2) > 0.01) {
        console.log(`🔄 Corrigindo reembolso tripulante 2: ${crew2Recon.amount} → ${correctTotalForCrew2}`);
        
        const { error: updateError } = await supabase
          .from('bank_reconciliations')
          .update({ amount: correctTotalForCrew2 })
          .eq('id', crew2Recon.id);

        if (updateError) {
          const errorMessage = updateError.message || String(updateError);
          console.error('❌ Erro ao atualizar reembolso tripulante 2:', errorMessage);
        } else {
          corrections.crew2 = true;
          corrections.details.push({
            type: 'crew2',
            valorAnterior: crew2Recon.amount,
            valorCorreto: correctTotalForCrew2
          });
          console.log('✅ Reembolso tripulante 2 corrigido');
        }
      }
    }

    // 9. Resumo final
    const wasFixed = corrections.cliente || corrections.crew1 || corrections.crew2;
    if (wasFixed) {
      console.log('✅ Conciliações corrigidas com sucesso!', corrections);
    } else {
      console.log('ℹ️ Conciliações já estavam corretas');
    }

    return corrections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro na correção de conciliações:', errorMessage);
    return null;
  }
}

/**
 * Função para verificar se há conciliações incorretas em todos os relatórios de viagem
 * @returns Lista de relatórios com conciliações incorretas
 */
export async function findIncorrectReconciliations() {
  console.log('🔍 Procurando conciliações incorretas...');
  
  try {
    const { data: reports, error: reportsError } = await supabase
      .from('travel_expense_reports')
      .select('id, report_number, status')
      .in('status', ['Finalizado', 'Enviado']);

    if (reportsError || !reports) {
      const errorMessage = reportsError?.message || String(reportsError);
      console.error('❌ Erro ao buscar relatórios:', errorMessage);
      return [];
    }

    const incorrectReports = [];

    for (const report of reports) {
      // Buscar conciliações
      const { data: recons } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('reference_id', report.id)
        .eq('reference_type', 'travel_report');

      // Buscar despesas
      const { data: reportData } = await supabase
        .from('travel_expense_reports')
        .select('expenses')
        .eq('id', report.id)
        .single();

      if (reportData && recons) {
        let expenses: Expense[] = [];
        try {
          if (typeof reportData.expenses === 'string') {
            expenses = JSON.parse(reportData.expenses);
          } else {
            expenses = reportData.expenses || [];
          }
        } catch (e) {
          continue;
        }

        const validExpenses = getValidExpenses(expenses);
        const payerTotals = extractPayerTotals(validExpenses);
        
        const correctClientTotal = payerTotals.totalSharebrasil + payerTotals.totalCrew1 + payerTotals.totalCrew2;
        const clientRecon = recons.find(r => r.type === 'cliente');

        if (clientRecon && Math.abs(clientRecon.amount - correctClientTotal) > 0.01) {
          incorrectReports.push({
            reportId: report.id,
            reportNumber: report.report_number,
            reconAmount: clientRecon.amount,
            correctAmount: correctClientTotal,
            difference: clientRecon.amount - correctClientTotal
          });
        }
      }
    }

    if (incorrectReports.length > 0) {
      console.log(`⚠️ Encontradas ${incorrectReports.length} conciliações incorretas:`, incorrectReports);
    } else {
      console.log('✅ Todas as conciliações estão corretas!');
    }

    return incorrectReports;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao procurar conciliações incorretas:', errorMessage);
    return [];
  }
}
