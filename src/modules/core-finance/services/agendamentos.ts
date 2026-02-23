import { supabase } from '@/integrations/supabase/client';
import { syncAgendamentoPagamentoToControle, removeAgendamentoPagamentoFromControle } from '@/services/syncSalariesToBankingControl';

export async function fetchAgendamentos() {
  const { data, error } = await supabase
    .from('agendamento_pagamentos')
    .select('*')
    .order('data_agendamento', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function deleteAgendamento(id: string) {
  // remove from controle bancário se existir
  try {
    await removeAgendamentoPagamentoFromControle(id);
  } catch (err) {
    // não falhar a exclusão se remoção do controle falhar
    console.warn('Falha ao remover do controle bancário:', err);
  }

  const { error } = await supabase.from('agendamento_pagamentos').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function markAgendamentoAsPaid(agendamento: any, userId?: string) {
  // sincroniza com controle bancário
  await syncAgendamentoPagamentoToControle(agendamento, userId);

  const { error } = await supabase
    .from('agendamento_pagamentos')
    .update({ status: 'pago' })
    .eq('id', agendamento.id);

  if (error) throw error;
  return true;
}

export async function createAgendamento(data: any, userId: string) {
  const { data: insertedData, error } = await supabase
    .from('agendamento_pagamentos')
    .insert({ ...data, criado_por: userId } as any)
    .select();

  if (error) throw error;

  // se inserido e já marcado como pago, sincroniza
  if (data.status === 'pago' && insertedData && insertedData.length > 0) {
    await syncAgendamentoPagamentoToControle({ ...insertedData[0], valor: parseFloat(String(insertedData[0].valor)) }, userId);
  }

  return insertedData?.[0];
}

export async function updateAgendamento(id: string, updates: any, existing?: any, userId?: string) {
  // sincronizações condicionais: se passou para pago e antes não era, ou cancelamento
  if (updates.status === 'pago' && existing && existing.status !== 'pago') {
    await syncAgendamentoPagamentoToControle({ ...existing, ...updates }, userId);
  } else if (updates.status === 'cancelado' && existing && existing.status === 'pago') {
    await removeAgendamentoPagamentoFromControle(id);
  }

  const { error } = await supabase.from('agendamento_pagamentos').update(updates as any).eq('id', id);
  if (error) throw error;
  return true;
}
