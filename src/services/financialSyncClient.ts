/**
 * Financial Sync Client
 *
 * ✅ Sincroniza pagamentos de salário com controle_bancario
 * ✅ Executa diretamente via Supabase (sem backend Express)
 * ✅ Tratamento de erros padronizado
 */

import { supabase } from '@/integrations/supabase/client';

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

// Mapping de nomes de categoria para campos de salário
const SALARY_CATEGORY_MAPPING: Record<string, { field: string; label: string }> = {
  'Salários Holerite': { field: 'base_salary_holerite', label: 'Salário Base' },
  'Pagamento de Horas de Voo': { field: 'horas_voo', label: 'Horas de Voo' },
  'Cartão Benefício': { field: 'benefit', label: 'Benefício' },
  'Bônus ou Extra': { field: 'extra', label: 'Extra/Bônus' },
  'Pagamento de Férias': { field: 'ferias', label: 'Férias' },
  'Décimo Terceiro Salário': { field: 'decimo_terceiro', label: '13º Salário' },
};

/**
 * Busca uma categoria de movimentação existente (NÃO cria novas)
 * Usa busca case-insensitive para evitar duplicatas
 */
async function getOrCreateCategory(nomeCategoria: string, userId: string): Promise<string | null> {
  try {
    console.log(`🔍 Buscando categoria: "${nomeCategoria}"`);

    // Busca case-insensitive para encontrar categorias existentes
    const { data, error } = await (supabase as any)
      .from("categorias_movimentacao")
      .select("id, nome")
      .ilike("nome", nomeCategoria)
      .eq("grupo_categoria", "FOLHA DE PAGAMENTO")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`❌ Erro ao buscar categoria "${nomeCategoria}":`, error);
      return null;
    }

    if (!data) {
      // NÃO criar novas categorias - apenas logar aviso
      console.warn(`⚠️ Categoria "${nomeCategoria}" não encontrada no grupo FOLHA DE PAGAMENTO.`);
      console.warn(`📋 Verifique se as categorias de folha de pagamento estão cadastradas corretamente.`);
      return null;
    }

    console.log(`✅ Categoria "${nomeCategoria}" encontrada: ${data.nome} (${data.id})`);
    return data.id;
  } catch (error) {
    console.error(`❌ Exceção ao buscar categoria "${nomeCategoria}":`, error);
    return null;
  }
}

/**
 * Sincroniza um pagamento de salário com movimentações de controle_bancario
 * Executa diretamente via Supabase
 */
export async function syncSalaryPaymentToFinancial(
  paymentId: string,
  userId: string,
  employeeName: string,
  employeeId: string,
  paymentData: SalaryPaymentData
): Promise<SalarySyncResult> {
  try {
    console.log(`💰 [Financial Sync] Sincronizando pagamento de ${employeeName}`);
    console.log('📋 Dados do pagamento:', paymentData);

    // Buscar categorias necessárias
    const categoriasIds: Record<string, string | null> = {};
    for (const [categoriaNome] of Object.entries(SALARY_CATEGORY_MAPPING)) {
      categoriasIds[categoriaNome] = await getOrCreateCategory(categoriaNome, userId);
    }

    const dataPagamento = paymentData.data_pagamento || new Date().toISOString().split('T')[0];
    const banco = paymentData.banco || 'Não informado';
    const entries: any[] = [];

    // Helper para criar entrada
    const createEntry = async (
      valor: number,
      categoriaId: string | null,
      descricao: string,
      grupoCategoria: string = 'FOLHA DE PAGAMENTO'
    ) => {
      if (!categoriaId) {
        console.warn(`⚠️ Categoria não encontrada para: ${descricao}`);
        return null;
      }

      const entry = {
        data: dataPagamento,
        tipo_movimento: 'saida',
        categoria_id: categoriaId,
        descricao: `${descricao} - ${employeeName}`,
        valor: valor,
        conta_banco: banco,
        status: 'pago',
        colaborador_id: employeeId,
        comprovante_url: paymentData.comprovante_url || null,
        observacoes: paymentData.obs || null,
        criado_por: userId,
        atualizado_por: userId,
        grupo_categoria: grupoCategoria,
        reembolsavel: false,
        reembolso_recebido: false,
      };

      const { data, error } = await (supabase as any)
        .from('movimentacoes')
        .insert(entry)
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Erro ao criar lançamento "${descricao}":`, error);
        return null;
      }

      console.log(`✅ Lançamento criado: ${descricao} - R$ ${valor}`);
      return data;
    };

    // Processar cada tipo de pagamento
    // 1. Salário Base
    if (paymentData.base_salary_holerite && paymentData.base_salary_holerite > 0) {
      const result = await createEntry(
        paymentData.base_salary_holerite,
        categoriasIds['Salários Holerite'],
        'Salário Base'
      );
      if (result) entries.push(result);
    }

    // 2. Horas de Voo (pode ser string com valor)
    if (paymentData.horas_voo) {
      const horasValor = parseFloat(String(paymentData.horas_voo).replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(horasValor) && horasValor > 0) {
        const result = await createEntry(
          horasValor,
          categoriasIds['Pagamento de Horas de Voo'],
          'Horas de Voo'
        );
        if (result) entries.push(result);
      }
    }

    // 3. Benefício (pode ser string com valor)
    if (paymentData.benefit) {
      const benefitValor = parseFloat(String(paymentData.benefit).replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(benefitValor) && benefitValor > 0) {
        const result = await createEntry(
          benefitValor,
          categoriasIds['Cartão Benefício'],
          'Cartão Benefício'
        );
        if (result) entries.push(result);
      }
    }

    // 4. Extra/Bônus (pode ser string com valor)
    if (paymentData.extra) {
      const extraValor = parseFloat(String(paymentData.extra).replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(extraValor) && extraValor > 0) {
        const result = await createEntry(
          extraValor,
          categoriasIds['Bônus ou Extra'],
          'Extra/Bônus'
        );
        if (result) entries.push(result);
      }
    }

    // 5. Férias
    if (paymentData.ferias && paymentData.ferias > 0) {
      const result = await createEntry(
        paymentData.ferias,
        categoriasIds['Pagamento de Férias'],
        'Férias'
      );
      if (result) entries.push(result);
    }

    // 6. 13º Salário - Parcela 1
    if (paymentData.decimo_terceiro_parcela1 && paymentData.decimo_terceiro_parcela1 > 0) {
      const result = await createEntry(
        paymentData.decimo_terceiro_parcela1,
        categoriasIds['Décimo Terceiro Salário'],
        '13º Salário - 1ª Parcela'
      );
      if (result) entries.push(result);
    }

    // 7. 13º Salário - Parcela 2
    if (paymentData.decimo_terceiro_parcela2 && paymentData.decimo_terceiro_parcela2 > 0) {
      const result = await createEntry(
        paymentData.decimo_terceiro_parcela2,
        categoriasIds['Décimo Terceiro Salário'],
        '13º Salário - 2ª Parcela'
      );
      if (result) entries.push(result);
    }

    console.log(`✅ Total de ${entries.length} lançamentos criados para ${employeeName}`);

    return {
      success: true,
      entriesCreated: entries.length,
      details: { entries }
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
 * Sincroniza uma bank_reconciliation com controle_bancario
 * (Implementação simplificada - pode ser expandida conforme necessidade)
 */
export async function syncBankReconciliationToFinancial(
  reconciliationId: string,
  userId: string
): Promise<SyncResult> {
  try {
    console.log(`📊 [Financial Sync] Sincronizando reconciliação: ${reconciliationId}`);

    // Buscar dados da reconciliação
    const { data: reconciliation, error: fetchError } = await (supabase as any)
      .from('conciliacoes_bancarias')
      .select('*')
      .eq('id', reconciliationId)
      .single();

    if (fetchError || !reconciliation) {
      console.error('❌ Erro ao buscar reconciliação:', fetchError);
      return { success: false, error: 'Reconciliação não encontrada' };
    }

    // Criar entrada no controle_bancario se ainda não existir
    if (!reconciliation.controle_bancario_id) {
      const entry = {
        data: reconciliation.data,
        tipo_movimento: reconciliation.tipo === 'receita' ? 'entrada' : 'saida',
        categoria_id: reconciliation.categoria_movimentacao_id,
        descricao: reconciliation.descricao,
        valor: reconciliation.valor,
        conta_banco: 'Conta Principal',
        status: reconciliation.status === 'conciliado' ? 'pago' : 'pendente',
        client_id: reconciliation.cliente_id,
        aeronave_id: reconciliation.aeronave_id,
        comprovante_url: reconciliation.comprovante_url,
        nf_url: reconciliation.nf_url,
        boleto_url: reconciliation.boleto_url,
        criado_por: userId,
        atualizado_por: userId,
        grupo_categoria: reconciliation.categoria || 'OUTROS',
        reembolsavel: false,
      };

      const { data: newEntry, error: insertError } = await (supabase as any)
        .from('movimentacoes')
        .insert(entry)
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar lançamento:', insertError);
        return { success: false, error: insertError.message };
      }

      // Atualizar reconciliação com o ID do controle_bancario
      await (supabase as any)
        .from('conciliacoes_bancarias')
        .update({ controle_bancario_id: newEntry.id })
        .eq('id', reconciliationId);

      return {
        success: true,
        controleBancarioId: newEntry.id,
      };
    }

    return { success: true, controleBancarioId: reconciliation.controle_bancario_id };
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
 * Deleta todas as movimentações de um pagamento de salário
 */
export async function deleteSalaryPaymentFromFinancial(paymentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🗑️ [Financial Sync] Função de deleção ainda não implementada para: ${paymentId}`);
    // TODO: Implementar deleção baseada em reference_id ou similar
    return { success: true };
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
 */
export async function deleteReconciliationFromFinancial(reconciliationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🗑️ [Financial Sync] Deletando reconciliação: ${reconciliationId}`);
    
    // Buscar e deletar entrada do controle_bancario associada
    const { data: reconciliation } = await (supabase as any)
      .from('conciliacoes_bancarias')
      .select('controle_bancario_id')
      .eq('id', reconciliationId)
      .single();

    if (reconciliation?.controle_bancario_id) {
      await (supabase as any)
        .from('movimentacoes')
        .delete()
        .eq('id', reconciliation.controle_bancario_id);
    }

    return { success: true };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error deleting bank reconciliation:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
