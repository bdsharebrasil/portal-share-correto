import { supabase } from '@/integrations/supabase/client';

export interface Expense {
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  id?: string;
}

export interface TravelTotals {
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1: number;
  total_crew2: number;
  total_client: number;
  total_sharebrasil: number;
  total_amount: number;
}

export interface TravelReportWithTotals {
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1?: number;
  total_crew2?: number;
  total_client: number;
  total_sharebrasil: number;
  total_amount: number;
  crew_member_name?: string;
  crew_member_name_2?: string;
  [key: string]: any;
}

/**
 * Recalcula todos os totais de um relatório a partir das despesas.
 * Esta função deve ser chamada SEMPRE que um relatório é carregado ou processado
 * para garantir que os totais estão corretos, mesmo se foram salvos com lógica antiga.
 * 
 * Suporta separação de pagamentos entre Tripulante 1 e Tripulante 2.
 * 
 * @param expenses - Array de despesas do relatório
 * @returns Objeto com todos os totais recalculados
 */
export function calculateReportTotals(expenses: Expense[]): TravelTotals {
  const totals: TravelTotals = {
    total_fuel: 0,
    total_lodging: 0,
    total_food: 0,
    total_transport: 0,
    total_other: 0,
    total_crew: 0,
    total_crew1: 0,
    total_crew2: 0,
    total_client: 0,
    total_sharebrasil: 0,
    total_amount: 0,
  };

  if (!expenses || !Array.isArray(expenses)) {
    return totals;
  }

  expenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;

    // Se não há valor válido, pula este item
    if (amount <= 0) {
      return;
    }

    // Acumula por categoria
    switch (expense.category) {
      case 'Combustível':
        totals.total_fuel += amount;
        break;
      case 'Hospedagem':
        totals.total_lodging += amount;
        break;
      case 'Alimentação':
        totals.total_food += amount;
        break;
      case 'Transporte':
        totals.total_transport += amount;
        break;
      default:
        totals.total_other += amount;
    }

    // Acumula por quem pagou - suporta Tripulante 1 e Tripulante 2
    const paidBy = expense.paid_by || '';
    if (paidBy === 'Tripulante 1' || paidBy === 'Tripulante') {
      // Compatibilidade com dados antigos que usavam "Tripulante"
      totals.total_crew1 += amount;
      totals.total_crew += amount;
    } else if (paidBy === 'Tripulante 2') {
      totals.total_crew2 += amount;
      totals.total_crew += amount;
    } else if (paidBy === 'Cliente') {
      totals.total_client += amount;
    } else if (paidBy === 'ShareBrasil') {
      totals.total_sharebrasil += amount;
    }
  });

  // O total geral é a soma dos valores pagos por cada tipo de pagador
  totals.total_amount = totals.total_crew + totals.total_client + totals.total_sharebrasil;

  return totals;
}

/**
 * Enriquece um relatório carregado do banco com totais recalculados.
 * Isto garante que mesmo se os totais no banco estiverem errados (por terem sido
 * calculados com lógica anterior), eles serão corrigidos.
 * 
 * @param report - Relatório carregado do banco
 * @param expenses - Despesas do relatório (já parsed)
 * @returns Relatório com totais recalculados
 */
export function enrichReportWithCorrectTotals<T extends TravelReportWithTotals>(
  report: T,
  expenses: Expense[]
): T {
  const correctedTotals = calculateReportTotals(expenses);
  return {
    ...report,
    ...correctedTotals,
  };
}

/**
 * Extrai os totais de pagadores de um relatório para criar conciliações.
 * Isto é essencial para garantir que as conciliações bancárias sejam criadas
 * com os valores CORRETOS, recalculados a partir das despesas.
 *
 * IMPORTANTE para uso correto em RelatorioViagem.tsx:
 * - Para CLIENTE: amount = totalSharebrasil + totalCrew1 + totalCrew2
 *   (O que o cliente deve pagar = tudo que não foi pago por ele)
 * - Para TRIPULANTE 1: amount = totalCrew1 (reembolso)
 * - Para TRIPULANTE 2: amount = totalCrew2 (reembolso)
 * - Para SHAREBRASIL: amount = totalSharebrasil (custos de operação)
 *
 * @param expenses - Despesas do relatório
 * @returns Objeto com totais por tipo de pagador, incluindo separação por tripulante
 */
export function extractPayerTotals(expenses: Expense[]) {
  const totals = calculateReportTotals(expenses);
  return {
    totalCrew: totals.total_crew,
    totalCrew1: totals.total_crew1,
    totalCrew2: totals.total_crew2,
    totalClient: totals.total_client,
    totalSharebrasil: totals.total_sharebrasil,
  };
}

/**
 * Valida se um conjunto de despesas tem pelo menos um item válido.
 * Despesas válidas são aquelas com categoria e valor > 0.
 * 
 * @param expenses - Array de despesas
 * @returns true se há pelo menos uma despesa válida
 */
export function hasValidExpenses(expenses: Expense[]): boolean {
  return expenses.some((e) => e.category && Number(e.amount) > 0);
}

/**
 * Filtra apenas as despesas válidas de um array.
 * 
 * @param expenses - Array de despesas
 * @returns Array contendo apenas despesas válidas
 */
export function getValidExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => e.category && Number(e.amount) > 0);
}

/**
 * Retorna os totais separados por tripulante com seus nomes
 * @param report - Relatório com informações dos tripulantes
 * @param expenses - Despesas do relatório
 * @returns Objeto com totais e nomes dos tripulantes
 */
export function getCrewTotalsWithNames(report: TravelReportWithTotals, expenses: Expense[]) {
  const totals = calculateReportTotals(expenses);

  return {
    tripulante1: {
      name: report.crew_member_name || 'Tripulante 1',
      total: totals.total_crew1,
    },
    tripulante2: {
      name: report.crew_member_name_2 || null,
      total: totals.total_crew2,
    },
    hasSecondCrew: !!report.crew_member_name_2 && report.crew_member_name_2.trim() !== '',
  };
}

/**
 * Gera o próximo número de relatório de viagem para um cliente + aeronave.
 *
 * Formato: `REL-XXX-001/26 PT-OPC`
 *  - XXX  = iniciais do cliente (até 3 letras, preenchidas com X)
 *  - 001  = sequência POR aeronave dentro do mesmo cliente (cada matrícula
 *           tem sua própria contagem começando em 1)
 *  - 26   = ano com 2 dígitos
 *  - PT-OPC = matrícula da aeronave (sufixo)
 *
 * Exemplo:
 *  GASP + PT-OPC → REL-GAS-001/26 PT-OPC
 *  GASP + PR-MDL → REL-GAS-001/26 PR-MDL  (contagem reinicia)
 *  GASP + PR-MDL → REL-GAS-002/26 PR-MDL
 *
 * IMPORTANTE: Recebe clientes_id para garantir consistência na numeração.
 * O nome do cliente é sempre obtido do campo razao_social da tabela clientes,
 * nunca do nome do sócio, garantindo que o mesmo cliente sempre gera o mesmo prefixo.
 *
 * @param clientesId ID do cliente (para buscar o nome consistentemente).
 * @param aircraftRegistration Matrícula da aeronave (sufixo + filtro).
 */
export async function generateReportNumber(
  clientesId: string,
  aircraftRegistration?: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearShort = year.toString().slice(-2);
  const reg = (aircraftRegistration ?? '').trim().toUpperCase();
  const suffix = reg ? ` ${reg}` : '';

  if (!clientesId || clientesId.trim() === '') {
    return `REL-XXX-001/${yearShort}${suffix}`;
  }

  // Busca o nome do cliente (razao_social) usando o ID
  const { data: clientData, error: clientError } = await supabase
    .from('clientes')
    .select('razao_social')
    .eq('id', clientesId)
    .single();

  if (clientError || !clientData?.razao_social) {
    return `REL-XXX-001/${yearShort}${suffix}`;
  }

  const getClientInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    return words
      .map(w => w.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3)
      .padEnd(3, 'X');
  };

  const clientInitials = getClientInitials(clientData.razao_social);

  // Filtra pelo prefixo do cliente
  let query = supabase
    .from('travel_expense_reports')
    .select('numero_relatorio')
    .eq('clientes_id', clientesId)
    .ilike('numero_relatorio', `REL-${clientInitials}-%`);

  // Se houver matrícula, filtra adicionalmente pelo sufixo para garantir
  // numeração independente por aeronave
  if (reg) {
    query = query.ilike('numero_relatorio', `%${reg}`);
  }

  const { data: existingReports, error } = await query;

  let nextNumber = 1;
  if (!error && existingReports && existingReports.length > 0) {
    const maxFound = existingReports.reduce((max, row: any) => {
      const m = row.numero_relatorio?.match(/REL-[A-Z]{3}-(\d+)/);
      const n = m && m[1] ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    nextNumber = maxFound + 1;
  }

  return `REL-${clientInitials}-${String(nextNumber).padStart(3, '0')}/${yearShort}${suffix}`;
}
