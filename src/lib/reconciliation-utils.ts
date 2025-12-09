import { supabase } from "@/integrations/supabase/client";

interface ReconciliationData {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  category: string | null;
  client_id?: string | null;
  receiver_id?: string | null;
  aircraft_id?: string | null;
  payment_term?: string | null;
}

interface ContaBancariaData {
  id: string;
  nome: string;
  banco: string | null;
}

/**
 * Cria conta a receber para conciliação de cliente
 * Retorna o ID da conta criada ou null se já existir
 */
export async function createContaAReceber(
  reconciliation: ReconciliationData,
  userId: string
): Promise<string | null> {
  if (!reconciliation.client_id) return null;

  try {
    // Buscar dados do cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('company_name, cnpj')
      .eq('id', reconciliation.client_id)
      .single();

    if (!clientData || !clientData.cnpj) {
      console.warn('Cliente não encontrado ou sem CNPJ');
      return null;
    }

    // Buscar matrícula da aeronave se houver
    let aircraftRegistration = '';
    if (reconciliation.aircraft_id) {
      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('registration')
        .eq('id', reconciliation.aircraft_id)
        .single();
      if (aircraftData) {
        aircraftRegistration = aircraftData.registration;
      }
    }

    // Gerar número sequencial
    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const { data: lastRecord } = await supabase
      .from('contas_areceber')
      .select('numero')
      .order('criado_em', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (lastRecord && lastRecord.length > 0) {
      const lastNumero = lastRecord[0].numero;
      const match = lastNumero.match(/CR-(\d+)\//);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const numero = `CR-${String(nextNumber).padStart(4, '0')}/${yearShort}`;
    const dataVencimento = reconciliation.payment_term || reconciliation.date;

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('contas_areceber')
      .select('id')
      .eq('banco_conciliacao_id', reconciliation.id)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Criar conta
    const { data: newConta, error } = await supabase
      .from('contas_areceber')
      .insert({
        numero,
        cliente_nome: clientData.company_name,
        cliente_cnpj: clientData.cnpj,
        data_criacao: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        valor: reconciliation.amount || 0,
        categoria: reconciliation.category || 'Faturamento',
        descricao: reconciliation.description || 'Conta a receber',
        status: 'pendente',
        aeronave: aircraftRegistration || '',
        criado_por: userId,
        banco_conciliacao_id: reconciliation.id
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar conta a receber:', error);
      return null;
    }

    return newConta?.id || null;
  } catch (error) {
    console.error('Erro ao criar conta a receber:', error);
    return null;
  }
}

/**
 * Cria conta a pagar para conciliação de colaborador
 * Retorna o ID da conta criada ou null se já existir
 */
export async function createContaAPagar(
  reconciliation: ReconciliationData,
  userId: string
): Promise<string | null> {
  if (!reconciliation.receiver_id) return null;

  try {
    // Buscar dados do colaborador
    const { data: userProfileData } = await supabase
      .from('user_profiles')
      .select('full_name, cpf')
      .eq('id', reconciliation.receiver_id)
      .single();

    if (!userProfileData || !userProfileData.cpf) {
      console.warn('Colaborador não encontrado ou sem CPF');
      return null;
    }

    // Buscar matrícula da aeronave se houver
    let aircraftRegistration = '';
    if (reconciliation.aircraft_id) {
      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('registration')
        .eq('id', reconciliation.aircraft_id)
        .single();
      if (aircraftData) {
        aircraftRegistration = aircraftData.registration;
      }
    }

    // Gerar número sequencial
    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const { data: lastRecord } = await supabase
      .from('contas_apagar')
      .select('numero')
      .order('criado_em', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (lastRecord && lastRecord.length > 0) {
      const lastNumero = lastRecord[0].numero;
      const match = lastNumero.match(/CP-(\d+)\//);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const numero = `CP-${String(nextNumber).padStart(4, '0')}/${yearShort}`;
    const dataVencimento = reconciliation.payment_term || reconciliation.date;

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('contas_apagar')
      .select('id')
      .eq('banco_conciliacao_id', reconciliation.id)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Criar conta
    const { data: newConta, error } = await supabase
      .from('contas_apagar')
      .insert({
        numero,
        fornecedor_nome: userProfileData.full_name,
        fornecedor_cnpj: userProfileData.cpf,
        data_recebimento: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        valor: reconciliation.amount || 0,
        categoria: reconciliation.category || 'Despesas',
        descricao: reconciliation.description || 'Conta a pagar',
        status: 'recebida',
        aeronave: aircraftRegistration || '',
        criado_por: userId,
        banco_conciliacao_id: reconciliation.id
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar conta a pagar:', error);
      return null;
    }

    return newConta?.id || null;
  } catch (error) {
    console.error('Erro ao criar conta a pagar:', error);
    return null;
  }
}

/**
 * Cria entrada/saída no fluxo de caixa baseado no tipo de conciliação
 * Retorna true se foi criado ou já existe
 */
export async function createFluxoCaixaEntry(
  reconciliation: ReconciliationData,
  status: string,
  contaBancaria: ContaBancariaData | null,
  comprovanteUrl: string | null,
  userId: string
): Promise<boolean> {
  try {
    const isClientReconciliation = reconciliation.type === 'cliente';
    const isColaboradorReconciliation = reconciliation.type === 'colaborador';

    // Determinar se deve criar entrada/saída baseado no status final
    const isStatusFinal = (isClientReconciliation && status?.toLowerCase() === 'recebido') ||
                          (isColaboradorReconciliation && status?.toLowerCase() === 'pago');

    if (!isStatusFinal) {
      return true; // Status não é final, não cria entrada ainda
    }

    // Montar referência e tipo de movimento
    let referencia = '';
    let tipoMovimento = '';
    let nomeBanco = '';

    if (contaBancaria) {
      nomeBanco = `${contaBancaria.nome}${contaBancaria.banco ? ` - ${contaBancaria.banco}` : ''}`;
    }

    if (isClientReconciliation && status?.toLowerCase() === 'recebido') {
      referencia = `REC-${reconciliation.id}`;
      tipoMovimento = 'entrada';
    } else if (isColaboradorReconciliation && status?.toLowerCase() === 'pago') {
      referencia = `PAG-${reconciliation.id}`;
      tipoMovimento = 'saída';
    }

    // Verificar se já existe
    const { data: existingEntry } = await supabase
      .from('controle_bancario')
      .select('id')
      .eq('referencia', referencia)
      .maybeSingle();

    if (existingEntry) {
      return true; // Já existe
    }

    // Criar entrada no fluxo de caixa
    const { error } = await supabase
      .from('controle_bancario')
      .insert({
        data: reconciliation.date || new Date().toISOString().split('T')[0],
        tipo_movimento: tipoMovimento,
        categoria: reconciliation.category || (tipoMovimento === 'entrada' ? 'Receita' : 'Despesa'),
        descricao: reconciliation.description || (tipoMovimento === 'entrada' ? 'Recebimento' : 'Pagamento'),
        valor: reconciliation.amount || 0,
        referencia,
        status: 'confirmado',
        criado_por: userId,
        conta_banco: nomeBanco,
        comprovante_url: comprovanteUrl
      } as any);

    if (error) {
      console.error('Erro ao criar entrada no fluxo de caixa:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao criar fluxo de caixa:', error);
    return false;
  }
}

/**
 * Determina o próximo status baseado no tipo de conciliação
 */
export function getNextStatus(
  currentStatus: string,
  reconciliationType: string
): string[] {
  const statusLower = currentStatus?.toLowerCase() || 'pendente';

  if (reconciliationType === 'cliente') {
    switch (statusLower) {
      case 'pendente':
        return ['recebido'];
      case 'recebido':
        return [];
      default:
        return ['pendente', 'recebido'];
    }
  }

  if (reconciliationType === 'colaborador') {
    switch (statusLower) {
      case 'pendente':
        return ['enviado', 'pago'];
      case 'enviado':
        return ['pago'];
      case 'pago':
        return [];
      default:
        return ['pendente', 'enviado', 'pago'];
    }
  }

  // Padrão para outros tipos
  return ['pendente', 'enviado'];
}

/**
 * Verifica se o status é final (finalizado)
 */
export function isStatusFinal(status: string, reconciliationType: string): boolean {
  const statusLower = status?.toLowerCase() || '';

  if (reconciliationType === 'cliente') {
    return statusLower === 'recebido';
  }
  if (reconciliationType === 'colaborador') {
    return statusLower === 'pago';
  }

  return false;
}

/**
 * Verifica se o status é "enviado"
 */
export function isStatusEnviado(status: string): boolean {
  return status?.toLowerCase() === 'enviado';
}
