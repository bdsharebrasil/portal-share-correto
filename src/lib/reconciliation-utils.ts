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
  forma_pagamento?: string | null;
  afeta_caixa_empresa?: boolean;
  saldo_pendente?: number | null;
}

interface ContaBancariaData {
  id: string;
  nome: string;
  banco: string | null;
}

/**
 * Status do fluxo financeiro
 * 
 * CLIENTE (Empresa Paga - Aguarda Reembolso):
 *   pendente → enviado → aguardando_reembolso → reembolsado
 * 
 * CLIENTE (Cliente Paga Direto):
 *   pendente → aguardando_comprovante → comprovante_enviado → comprovante_validado → lancado_aeronave
 * 
 * COLABORADOR:
 *   pendente → aprovado → pago
 */

/**
 * Cria conta a receber para conciliação de cliente
 * Chamado quando status muda para "enviado"
 */
export async function createContaAReceber(
  reconciliation: ReconciliationData,
  userId: string
): Promise<string | null> {
  if (!reconciliation.client_id) {
    console.warn('createContaAReceber: client_id ausente');
    return null;
  }

  try {
    // Verificar se já existe conta para esta conciliação
    const { data: existing } = await supabase
      .from('contas_areceber')
      .select('id')
      .eq('banco_conciliacao_id', reconciliation.id)
      .maybeSingle();

    if (existing) {
      console.log('Conta a receber já existe para esta conciliação:', existing.id);
      return existing.id;
    }

    // Buscar dados do cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('company_name, cnpj')
      .eq('id', reconciliation.client_id)
      .single();

    if (!clientData) {
      console.warn('Cliente não encontrado');
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

    // Gerar número sequencial CR-XXXX/YY
    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const { data: lastRecord } = await supabase
      .from('contas_areceber')
      .select('numero')
      .like('numero', 'CR-%')
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
    
    // Data de vencimento: usar payment_term ou data + 30 dias
    const dataVencimento = reconciliation.payment_term || reconciliation.date;
    
    // Valor: usar saldo_pendente se disponível, senão amount
    const valor = Math.abs(reconciliation.saldo_pendente ?? reconciliation.amount ?? 0);

    // Criar conta a receber
    const { data: newConta, error } = await supabase
      .from('contas_areceber')
      .insert({
        numero,
        referencia: reconciliation.description,
        cliente_nome: clientData.company_name || 'Cliente',
        cliente_cnpj: clientData.cnpj || '',
        data_criacao: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        valor: valor,
        categoria: reconciliation.category || 'Reembolso de Despesa',
        descricao: reconciliation.description || 'Conta a receber - Reembolso',
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

    console.log('Conta a receber criada:', newConta?.id);
    return newConta?.id || null;
  } catch (error) {
    console.error('Erro ao criar conta a receber:', error);
    return null;
  }
}

/**
 * Cria conta a pagar para conciliação de colaborador
 * Chamado quando status muda para "aprovado" ou "enviado"
 */
export async function createContaAPagar(
  reconciliation: ReconciliationData,
  userId: string
): Promise<string | null> {
  if (!reconciliation.receiver_id) {
    console.warn('createContaAPagar: receiver_id ausente');
    return null;
  }

  try {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('contas_apagar')
      .select('id')
      .eq('banco_conciliacao_id', reconciliation.id)
      .maybeSingle();

    if (existing) {
      console.log('Conta a pagar já existe para esta conciliação:', existing.id);
      return existing.id;
    }

    // Buscar dados do colaborador
    const { data: userProfileData } = await supabase
      .from('user_profiles')
      .select('full_name, cpf')
      .eq('id', reconciliation.receiver_id)
      .single();

    if (!userProfileData) {
      console.warn('Colaborador não encontrado');
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

    // Gerar número sequencial CP-XXXX/YY
    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const { data: lastRecord } = await supabase
      .from('contas_apagar')
      .select('numero')
      .like('numero', 'CP-%')
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

    // Criar conta a pagar
    const { data: newConta, error } = await supabase
      .from('contas_apagar')
      .insert({
        numero,
        fornecedor_nome: userProfileData.full_name || 'Colaborador',
        fornecedor_cnpj: userProfileData.cpf || '',
        data_recebimento: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        valor: Math.abs(reconciliation.amount || 0),
        categoria: reconciliation.category || 'Reembolso de Viagem',
        descricao: reconciliation.description || 'Conta a pagar - Reembolso',
        status: 'recebida',
        aeronave_id: reconciliation.aircraft_id || null,
        criado_por: userId,
        banco_conciliacao_id: reconciliation.id
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar conta a pagar:', error);
      return null;
    }

    console.log('Conta a pagar criada:', newConta?.id);
    return newConta?.id || null;
  } catch (error) {
    console.error('Erro ao criar conta a pagar:', error);
    return null;
  }
}

/**
 * Cria entrada no fluxo de caixa (controle_bancario)
 * Chamado quando:
 * - Cliente: status = 'reembolsado' (entrada de dinheiro)
 * - Colaborador: status = 'pago' (saída de dinheiro)
 * - Financeiro Master paga fornecedor: status = 'aguardando_reembolso' (saída de dinheiro)
 */
export async function createFluxoCaixaEntry(
  reconciliation: ReconciliationData,
  status: string,
  contaBancaria: ContaBancariaData | null,
  comprovanteUrl: string | null,
  userId: string
): Promise<boolean> {
  try {
    const statusLower = status?.toLowerCase() || '';
    const isClientReconciliation = reconciliation.type === 'cliente';
    const isColaboradorReconciliation = reconciliation.type === 'colaborador';

    // Determinar tipo de movimento e referência
    let tipoMovimento = '';
    let referencia = '';
    let statusFluxo = 'confirmado';

    // CLIENTE - Reembolsado: entrada de dinheiro (cliente pagou)
    if (isClientReconciliation && statusLower === 'reembolsado') {
      tipoMovimento = 'entrada';
      referencia = `REIMB-${reconciliation.id.slice(0, 8)}`;
    }
    // CLIENTE - Aguardando Reembolso: saída de dinheiro (empresa pagou fornecedor)
    else if (isClientReconciliation && statusLower === 'aguardando_reembolso') {
      tipoMovimento = 'saída';
      referencia = `PAG-FORN-${reconciliation.id.slice(0, 8)}`;
      statusFluxo = 'aguardando_reembolso';
    }
    // COLABORADOR - Pago: saída de dinheiro (empresa pagou colaborador)
    else if (isColaboradorReconciliation && statusLower === 'pago') {
      tipoMovimento = 'saída';
      referencia = `PAG-COL-${reconciliation.id.slice(0, 8)}`;
    }
    // Se não é um status que gera movimento, retornar sucesso
    else {
      return true;
    }

    // Verificar se já existe entrada com esta referência
    const { data: existingEntry } = await supabase
      .from('controle_bancario')
      .select('id')
      .eq('referencia', referencia)
      .maybeSingle();

    if (existingEntry) {
      console.log('Entrada no fluxo de caixa já existe:', referencia);
      return true;
    }

    // Montar nome do banco
    let nomeBanco = '';
    if (contaBancaria) {
      nomeBanco = contaBancaria.banco || contaBancaria.nome || '';
    }

    // Buscar dados adicionais para cliente
    let clientIdToInsert: string | null = null;
    let clientNameToInsert: string | null = null;
    let aeronaveRegistro: string | null = null;

    if (isClientReconciliation && reconciliation.client_id) {
      clientIdToInsert = reconciliation.client_id;
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name')
        .eq('id', reconciliation.client_id)
        .single();
      if (clientData?.company_name) {
        clientNameToInsert = clientData.company_name;
      }
    }

    if (reconciliation.aircraft_id) {
      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('registration')
        .eq('id', reconciliation.aircraft_id)
        .single();
      if (aircraftData?.registration) {
        aeronaveRegistro = aircraftData.registration;
      }
    }

    // Criar entrada no fluxo de caixa
    const valor = Math.abs(reconciliation.saldo_pendente ?? reconciliation.amount ?? 0);
    
    const { error } = await supabase
      .from('controle_bancario')
      .insert({
        data: new Date().toISOString().split('T')[0],
        data_vencimento: reconciliation.payment_term || null,
        tipo_movimento: tipoMovimento,
        categoria: reconciliation.category || (tipoMovimento === 'entrada' ? 'Receita de Reembolso' : 'Despesa'),
        grupo_categoria: tipoMovimento === 'entrada' ? 'RECEITAS' : 'DESPESAS',
        descricao: reconciliation.description || (tipoMovimento === 'entrada' ? 'Recebimento de Reembolso' : 'Pagamento'),
        valor: valor,
        referencia,
        status: statusFluxo,
        criado_por: userId,
        conta_banco: nomeBanco,
        comprovante_url: comprovanteUrl,
        client_id: clientIdToInsert,
        client_name: clientNameToInsert,
        aeronave_registro: aeronaveRegistro,
        bank_reconciliation_id: reconciliation.id
      } as any);

    if (error) {
      console.error('Erro ao criar entrada no fluxo de caixa:', error);
      return false;
    }

    console.log('Entrada no fluxo de caixa criada:', referencia, tipoMovimento);
    return true;
  } catch (error) {
    console.error('Erro ao criar fluxo de caixa:', error);
    return false;
  }
}

/**
 * Atualiza saldo pendente na conciliação quando há pagamento parcial
 */
export async function updateSaldoPendente(
  reconciliationId: string,
  valorPago: number
): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('bank_reconciliations')
      .select('amount, saldo_pendente, valor_reembolsado')
      .eq('id', reconciliationId)
      .single();

    if (!current) return false;

    const saldoAtual = current.saldo_pendente ?? Math.abs(current.amount);
    const novoSaldo = saldoAtual - valorPago;
    const valorReembolsadoTotal = (current.valor_reembolsado || 0) + valorPago;

    const { error } = await supabase
      .from('bank_reconciliations')
      .update({
        saldo_pendente: Math.max(0, novoSaldo),
        valor_reembolsado: valorReembolsadoTotal,
        data_reembolso: new Date().toISOString().split('T')[0],
        status: novoSaldo <= 0 ? 'reembolsado' : 'parcialmente_reembolsado'
      })
      .eq('id', reconciliationId);

    if (error) {
      console.error('Erro ao atualizar saldo pendente:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao atualizar saldo pendente:', error);
    return false;
  }
}

/**
 * Determina os próximos status possíveis baseado no tipo e forma de pagamento
 */
export function getNextStatus(
  currentStatus: string,
  reconciliationType: string,
  formaPagamento?: string
): string[] {
  const statusLower = currentStatus?.toLowerCase() || 'pendente';
  const isEmpresaPaga = formaPagamento === 'empresa_paga' || !formaPagamento;
  const isClientePagaDireto = formaPagamento === 'cliente_paga_direto';

  // Tipo CLIENTE
  if (reconciliationType === 'cliente') {
    // Fluxo: Empresa Paga (Aguarda Reembolso)
    if (isEmpresaPaga) {
      switch (statusLower) {
        case 'pendente':
          return ['enviado'];
        case 'enviado':
          return ['aguardando_reembolso'];
        case 'aguardando_reembolso':
          return ['reembolsado'];
        case 'parcialmente_reembolsado':
          return ['reembolsado'];
        case 'reembolsado':
          return []; // Final
        default:
          return ['pendente', 'enviado', 'aguardando_reembolso', 'reembolsado'];
      }
    }
    // Fluxo: Cliente Paga Direto
    if (isClientePagaDireto) {
      switch (statusLower) {
        case 'pendente':
          return ['aguardando_comprovante'];
        case 'aguardando_comprovante':
          return ['comprovante_enviado'];
        case 'comprovante_enviado':
          return ['comprovante_validado'];
        case 'comprovante_validado':
          return ['lancado_aeronave'];
        case 'lancado_aeronave':
          return []; // Final
        default:
          return ['pendente', 'aguardando_comprovante', 'comprovante_enviado', 'comprovante_validado', 'lancado_aeronave'];
      }
    }
  }

  // Tipo COLABORADOR
  if (reconciliationType === 'colaborador') {
    switch (statusLower) {
      case 'pendente':
        return ['aprovado'];
      case 'aprovado':
        return ['pago'];
      case 'pago':
        return []; // Final
      default:
        return ['pendente', 'aprovado', 'pago'];
    }
  }

  // Padrão para outros tipos
  return ['pendente', 'enviado'];
}

/**
 * Verifica se o status é final (não há mais transições)
 */
export function isStatusFinal(status: string, reconciliationType: string, formaPagamento?: string): boolean {
  const statusLower = status?.toLowerCase() || '';
  const isClientePagaDireto = formaPagamento === 'cliente_paga_direto';

  if (reconciliationType === 'cliente') {
    if (isClientePagaDireto) {
      return statusLower === 'lancado_aeronave';
    }
    return statusLower === 'reembolsado';
  }
  
  if (reconciliationType === 'colaborador') {
    return statusLower === 'pago';
  }

  return false;
}

/**
 * Verifica se o status é "enviado" (momento de criar conta a receber/pagar)
 */
export function isStatusEnviado(status: string): boolean {
  return status?.toLowerCase() === 'enviado' || status?.toLowerCase() === 'aprovado';
}

/**
 * Verifica se status requer seleção de banco
 */
export function requiresBankSelection(status: string, reconciliationType: string): boolean {
  const statusLower = status?.toLowerCase() || '';
  
  if (reconciliationType === 'cliente') {
    return statusLower === 'aguardando_reembolso' || statusLower === 'reembolsado';
  }
  
  if (reconciliationType === 'colaborador') {
    return statusLower === 'pago';
  }

  return false;
}

/**
 * Retorna label legível para status
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'pendente': 'Pendente',
    'enviado': 'Enviado ao Cliente',
    'aprovado': 'Aprovado para Pagamento',
    'aguardando_reembolso': 'Aguardando Reembolso',
    'parcialmente_reembolsado': 'Parcialmente Reembolsado',
    'reembolsado': 'Reembolsado',
    'pago': 'Pago',
    'aguardando_comprovante': 'Aguardando Comprovante',
    'comprovante_enviado': 'Comprovante Enviado',
    'comprovante_validado': 'Comprovante Validado',
    'lancado_aeronave': 'Lançado na Aeronave',
    'cancelado': 'Cancelado',
    'inadimplente': 'Inadimplente'
  };
  return labels[status?.toLowerCase()] || status;
}

/**
 * Retorna cor do badge para status
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'pendente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'enviado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'aprovado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'aguardando_reembolso': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'parcialmente_reembolsado': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'reembolsado': 'bg-green-500/20 text-green-400 border-green-500/30',
    'pago': 'bg-green-500/20 text-green-400 border-green-500/30',
    'aguardando_comprovante': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'comprovante_enviado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'comprovante_validado': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'lancado_aeronave': 'bg-green-500/20 text-green-400 border-green-500/30',
    'cancelado': 'bg-red-500/20 text-red-400 border-red-500/30',
    'inadimplente': 'bg-red-500/20 text-red-400 border-red-500/30'
  };
  return colors[status?.toLowerCase()] || 'bg-muted text-muted-foreground';
}
