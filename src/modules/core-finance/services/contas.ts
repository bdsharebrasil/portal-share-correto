import { supabase } from '@/integrations/supabase/client';

export async function fetchContas() {
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select('*')
    .eq('ativo', true)
    .order('banco');

  if (error) throw error;

  return (data || []).map((conta: any) => ({
    id: conta.id,
    nome: conta.banco || conta.numero_conta || 'Conta sem nome',
    numero_conta: conta.numero_conta || undefined,
    banco: conta.banco || undefined,
    tipo_conta: (conta.tipo_conta || 'corrente') as 'corrente' | 'investimento' | 'poupanca',
    ativo: conta.ativo ?? true,
    saldo: (conta as any).saldo || 0,
    criado_por: conta.criado_por,
  }));
}

export async function addContaService(conta: any, userId: string) {
  const { error } = await supabase
    .from('contas_bancarias')
    .insert([{
      id: conta.id,
      numero_conta: conta.numero_conta || null,
      banco: conta.banco || null,
      tipo_conta: conta.tipo_conta || 'corrente',
      ativo: true,
      criado_por: userId,
      empresa_id: (conta.empresa_id) || 'default'
    }]);

  if (error) throw error;
  return true;
}

export async function updateContaService(id: string, updates: any) {
  const updateData: any = {};
  if (updates.numero_conta !== undefined) updateData.numero_conta = updates.numero_conta || null;
  if (updates.banco !== undefined) updateData.banco = updates.banco || null;
  if (updates.tipo_conta !== undefined) updateData.tipo_conta = updates.tipo_conta;
  if (updates.ativo !== undefined) updateData.ativo = updates.ativo;
  updateData.atualizado_em = new Date().toISOString();

  const { error } = await supabase
    .from('contas_bancarias')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function deleteContaService(id: string) {
  const { error } = await supabase
    .from('contas_bancarias')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return true;
}
