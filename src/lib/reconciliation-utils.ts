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
  aeronave_id?: string | null;
  prazo_pagamento?: string | null;
  forma_pagamento?: string | null;
  afeta_caixa_empresa?: boolean;
  saldo_pendente?: number | null;
  partner_name?: string | null;
  client_partner?: string | null;
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
  if (!reconciliation.cliente_id) {
    console.warn('createContaAReceber: client_id ausente');
    return null;
  }

  try {
    // Verificar se já existe conta para esta conciliação
    const { data: existing } = await (supabase as any)
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
      .from('clientes')
      .select('razao_social, cnpj')
      .eq('id', reconciliation.cliente_id)
      .single();

    if (!clientData) {
      console.warn('Cliente não encontrado');
      return null;
    }

    // Buscar matrícula da aeronave se houver
    let aircraftRegistration = '';
    if (reconciliation.aeronave_id) {
      const { data: aircraftData } = await supabase
        .from('aeronave')
        .select('matricula')
        .eq('id', reconciliation.aeronave_id)
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

    // Data de vencimento: usar prazo_pagamento ou data + 30 dias
    const dataVencimento = reconciliation.prazo_pagamento || reconciliation.data;

    // Valor: usar saldo_pendente se disponível, senão amount
    const valor = Math.abs(reconciliation.saldo_pendente ?? reconciliation.valor ?? 0);

    // Usar partner_name quando disponível, senão usar nome do cliente
    const nomeExibicao = reconciliation.nome_socio || clientData.razao_social || 'Cliente';

    // Criar conta a receber
    const { data: newConta, error } = await supabase
      .from('contas_areceber')
      .insert({
        numero,
        referencia: reconciliation.descricao,
        cliente_nome: nomeExibicao,
        cliente_cnpj: clientData.cnpj || '',
        created_at: new Date().toISOString(),
        data_vencimento: dataVencimento,
        valor: valor,
        categoria: reconciliation.categoria || 'Reembolso de Despesa',
        descricao: reconciliation.descricao || 'Conta a receber - Reembolso',
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
  if (!reconciliation.recebedor_id) {
    console.warn('createContaAPagar: receiver_id ausente');
    return null;
  }

  try {
    // Verificar se já existe
    const { data: existing } = await (supabase
      .from('contas_apagar') as any)
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
      .eq('id', reconciliation.recebedor_id)
      .single();

    if (!userProfileData) {
      console.warn('Colaborador não encontrado');
      return null;
    }

    // Buscar matrícula da aeronave se houver
    let aircraftRegistration = '';
    if (reconciliation.aeronave_id) {
      const { data: aircraftData } = await supabase
        .from('aeronave')
        .select('matricula')
        .eq('id', reconciliation.aeronave_id)
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
      const lastNumero = (lastRecord[0] as any).numero;
      const match = lastNumero.match(/CP-(\d+)\//);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const numero = `CP-${String(nextNumber).padStart(4, '0')}/${yearShort}`;
    const dataVencimento = reconciliation.prazo_pagamento || reconciliation.data;

    // Criar conta a pagar
    const { data: newConta, error } = await supabase
      .from('contas_apagar')
      .insert({
        numero,
        fornecedor_nome: userProfileData.full_name || 'Colaborador',
        fornecedor_cnpj: userProfileData.cpf || '',
        data_recebimento: new Date().toISOString().split('T')[0],
        data_vencimento: dataVencimento,
        valor: Math.abs(reconciliation.valor || 0),
        categoria: reconciliation.categoria || 'Reembolso de Viagem',
        descricao: reconciliation.descricao || 'Conta a pagar - Reembolso',
        status: 'recebida',
        aeronave_id: reconciliation.aeronave_id || null,
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
    // Client partners não devem gerar controle_bancario (fluxo de caixa)
    // Eles geram partner_expenses em seu próprio fluxo
    if (reconciliation.socio_cliente_id) {
      console.log('Conciliação é client_partner - não criar controle_bancario');
      return true;
    }

    const statusLower = status?.toLowerCase() || '';
    const isClientReconciliation = reconciliation.tipo === 'cliente';
    const isColaboradorReconciliation = reconciliation.tipo === 'colaborador';

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
    const { data: existingEntry } = await (supabase
      .from('movimentacoes') as any)
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

    if (isClientReconciliation && reconciliation.cliente_id) {
      clientIdToInsert = reconciliation.cliente_id;
      const { data: clientData } = await supabase
        .from('clientes')
        .select('razao_social')
        .eq('id', reconciliation.cliente_id)
        .single();
      if (clientData?.razao_social) {
        clientNameToInsert = clientData.razao_social;
      }
    }

    if (reconciliation.aeronave_id) {
      const { data: aircraftData } = await supabase
        .from('aeronave')
        .select('matricula')
        .eq('id', reconciliation.aeronave_id)
        .single();
      if (aircraftData?.registration) {
        aeronaveRegistro = aircraftData.registration;
      }
    }

    // Criar entrada no fluxo de caixa
    const valor = Math.abs(reconciliation.saldo_pendente ?? reconciliation.valor ?? 0);

    const { error } = await supabase
      .from('movimentacoes')
      .insert({
        data: new Date().toISOString().split('T')[0],
        data_vencimento: reconciliation.prazo_pagamento || null,
        tipo_movimento: tipoMovimento,
        categoria: reconciliation.categoria || (tipoMovimento === 'entrada' ? 'Receita de Reembolso' : 'Despesa'),
        grupo_categoria: tipoMovimento === 'entrada' ? 'RECEITAS' : 'DESPESAS',
        descricao: reconciliation.descricao || (tipoMovimento === 'entrada' ? 'Recebimento de Reembolso' : 'Pagamento'),
        valor: valor,
        referencia,
        status: statusFluxo,
        criado_por: userId,
        conta_banco: nomeBanco,
        comprovante_url: comprovanteUrl,
        client_id: clientIdToInsert,
        client_name: clientNameToInsert,
        aeronave_registro: aeronaveRegistro
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
      .from('conciliacoes_bancarias')
      .select('valor, saldo_pendente, valor_reembolsado')
      .eq('id', reconciliationId)
      .single();

    if (!current) return false;

    const saldoAtual = current.saldo_pendente ?? Math.abs(current.valor);
    const novoSaldo = saldoAtual - valorPago;
    const valorReembolsadoTotal = (current.valor_reembolsado || 0) + valorPago;

    const { error } = await supabase
      .from('conciliacoes_bancarias')
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

/**
 * Marca uma despesa reembolsável como recebida e cria a entrada correspondente
 * 
 * Quando uma saída reembolsável é marcada como "recebido", precisamos:
 * 1. Atualizar o registro original: reembolso_recebido = true, data_reembolso = data atual
 * 2. Criar uma nova entrada (tipo_movimento = 'entrada') representando o recebimento do reembolso
 */
export async function marcarDespesaComoRecebida(
  despesaId: string,
  dataRecebimento: string,
  contaBanco: string | null,
  comprovanteUrl: string | null,
  userId: string
): Promise<{ success: boolean; entradaId?: string; error?: string }> {
  try {
    console.log('=== marcarDespesaComoRecebida ===');
    console.log('despesaId:', despesaId);
    console.log('dataRecebimento:', dataRecebimento);

    // 1. Buscar dados da despesa original
    const { data: despesa, error: fetchError } = await (supabase
      .from('movimentacoes') as any)
      .select('*')
      .eq('id', despesaId)
      .single();

    if (fetchError || !despesa) {
      console.error('Erro ao buscar despesa:', fetchError);
      return { success: false, error: 'Despesa não encontrada' };
    }

    console.log('Despesa encontrada:', {
      id: despesa.id,
      reembolsavel: despesa.reembolsavel,
      reembolso_recebido: despesa.reembolso_recebido,
      status: despesa.status
    });

    // Verificar se é reembolsável
    if (!despesa.reembolsavel) {
      console.log('Despesa não é reembolsável');
      return { success: false, error: 'Esta despesa não é reembolsável' };
    }

    // Verificar se já foi marcada como recebida (reembolso_recebido = true)
    if (despesa.reembolso_recebido === true) {
      console.log('Despesa já foi marcada como recebida');
      return { success: false, error: 'Esta despesa já foi marcada como recebida' };
    }

    // 2. Atualizar o registro original
    const { error: updateError } = await supabase
      .from('movimentacoes')
      .update({
        reembolso_recebido: true,
        data_reembolso: dataRecebimento,
        status: 'recebido',
        atualizado_por: userId,
        data_atualizacao: new Date().toISOString()
      })
      .eq('id', despesaId);

    if (updateError) {
      console.error('Erro ao atualizar despesa:', updateError);
      return { success: false, error: updateError.message };
    }

    // 3. Verificar se já existe entrada de reembolso vinculada
    const { data: existingEntry } = await (supabase
      .from('movimentacoes') as any)
      .select('id')
      .eq('despesa_original_id', despesaId)
      .eq('tipo_movimento', 'entrada')
      .maybeSingle();

    if (existingEntry) {
      console.log('Entrada de reembolso já existe:', existingEntry.id);
      return { success: true, entradaId: existingEntry.id };
    }

    // 4. Criar nova entrada representando o recebimento do reembolso
    const descricaoEntrada = `[REEMBOLSO] ${despesa.descricao || 'Reembolso recebido'}`;

    const { data: novaEntrada, error: insertError } = await supabase
      .from('movimentacoes')
      .insert({
        data: dataRecebimento,
        data_vencimento: null,
        tipo_movimento: 'entrada',
        categoria_id: despesa.categoria_id,
        descricao: descricaoEntrada,
        valor: Math.abs(despesa.valor),
        conta_banco: contaBanco || despesa.conta_banco,
        numero_documento: despesa.numero_documento ? `REIMB-${despesa.numero_documento}` : null,
        status: 'recebido',
        client_id: despesa.cliente_id,
        client_name: despesa.client_name,
        aeronave_id: despesa.aeronave_id,
        aeronave_registro: despesa.aeronave_registro,
        reembolsavel: false,
        reembolso_recebido: false,
        despesa_original_id: despesaId,
        comprovante_url: comprovanteUrl,
        nf_url: despesa.nf_url,
        observacoes: `Reembolso referente à despesa de ${despesa.data}`,
        criado_por: userId,
        grupo_categoria: 'RECEITAS DE REEMBOLSO',
        tem_rateio: despesa.tem_rateio || false,
        rateio_tipo: despesa.rateio_tipo,
      } as any)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao criar entrada de reembolso:', insertError);
      return { success: false, error: insertError.message };
    }

    // 5. Atualizar a despesa original com o ID do lançamento de reembolso
    await supabase
      .from('movimentacoes')
      .update({ lancamento_reembolso_id: novaEntrada?.id })
      .eq('id', despesaId);

    console.log('Despesa marcada como recebida e entrada criada:', novaEntrada?.id);
    return { success: true, entradaId: novaEntrada?.id };
  } catch (error: any) {
    console.error('Erro ao marcar despesa como recebida:', error);
    return { success: false, error: error.message };
  }
}
