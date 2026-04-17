import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Expense — campos em inglês alinhados ao schema (despesas salvas como JSON)
// ---------------------------------------------------------------------------
export interface Expense {
  id?: string;
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  expense_date?: string;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Shape used by enrichReportWithCorrectTotals / getCrewTotalsWithNames
// Fields match travel_expense_reports columns
// ---------------------------------------------------------------------------
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
  nome_tripulante?: string;       // was crew_member_name
  nome_tripulante_2?: string;     // was crew_member_name_2
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// calculateReportTotals
// ---------------------------------------------------------------------------
/**
 * Recalcula todos os totais a partir das despesas.
 * Deve ser chamada sempre que um relatório é carregado ou processado.
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

  if (!Array.isArray(expenses)) return totals;

  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;
    if (amount <= 0) continue;

    // By category
    switch (expense.category) {
      case 'Combustível':  totals.total_fuel      += amount; break;
      case 'Hospedagem':   totals.total_lodging   += amount; break;
      case 'Alimentação':  totals.total_food      += amount; break;
      case 'Transporte':   totals.total_transport += amount; break;
      default:             totals.total_other     += amount;
    }

    // By payer — keep backward-compat with old "Tripulante" value
    const paidBy = expense.paid_by || '';
    if (paidBy === 'Tripulante 1' || paidBy === 'Tripulante') {
      totals.total_crew1 += amount;
      totals.total_crew  += amount;
    } else if (paidBy === 'Tripulante 2') {
      totals.total_crew2 += amount;
      totals.total_crew  += amount;
    } else if (paidBy === 'Cliente') {
      totals.total_client += amount;
    } else if (paidBy === 'ShareBrasil') {
      totals.total_sharebrasil += amount;
    }
  }

  totals.total_amount =
    totals.total_crew + totals.total_client + totals.total_sharebrasil;

  return totals;
}

// ---------------------------------------------------------------------------
// enrichReportWithCorrectTotals
// ---------------------------------------------------------------------------
/**
 * Enriquece um relatório carregado do banco com totais recalculados,
 * corrigindo eventuais divergências salvas com lógica anterior.
 */
export function enrichReportWithCorrectTotals<T extends TravelReportWithTotals>(
  report: T,
  expenses: Expense[],
): T {
  return { ...report, ...calculateReportTotals(expenses) };
}

// ---------------------------------------------------------------------------
// extractPayerTotals
// ---------------------------------------------------------------------------
/**
 * Extrai os totais por pagador para criação de conciliações bancárias.
 *
 * - Cliente deve pagar: totalSharebrasil + totalCrew1 + totalCrew2
 * - Tripulante 1 recebe reembolso: totalCrew1
 * - Tripulante 2 recebe reembolso: totalCrew2
 */
export function extractPayerTotals(expenses: Expense[]) {
  const t = calculateReportTotals(expenses);
  return {
    totalCrew:        t.total_crew,
    totalCrew1:       t.total_crew1,
    totalCrew2:       t.total_crew2,
    totalClient:      t.total_client,
    totalSharebrasil: t.total_sharebrasil,
  };
}

// ---------------------------------------------------------------------------
// hasValidExpenses / getValidExpenses
// ---------------------------------------------------------------------------
/** Retorna true se há pelo menos uma despesa com categoria e valor > 0. */
export function hasValidExpenses(expenses: Expense[]): boolean {
  return expenses.some(e => e.category && Number(e.amount) > 0);
}

/** Filtra apenas as despesas com categoria e valor > 0. */
export function getValidExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter(e => e.category && Number(e.amount) > 0);
}

// ---------------------------------------------------------------------------
// getCrewTotalsWithNames
// ---------------------------------------------------------------------------
/**
 * Retorna os totais separados por tripulante com seus nomes.
 * Usa nome_tripulante / nome_tripulante_2 (colunas do banco).
 */
export function getCrewTotalsWithNames(
  report: TravelReportWithTotals,
  expenses: Expense[],
) {
  const totals = calculateReportTotals(expenses);
  return {
    tripulante1: {
      name:  report.nome_tripulante || 'Tripulante 1',
      total: totals.total_crew1,
    },
    tripulante2: {
      name:  report.nome_tripulante_2 || null,
      total: totals.total_crew2,
    },
    hasSecondCrew:
      !!report.nome_tripulante_2 && report.nome_tripulante_2.trim() !== '',
  };
}

// ---------------------------------------------------------------------------
// generateReportNumber
// ---------------------------------------------------------------------------
/**
 * Gera o próximo número de relatório para um determinado cliente E aeronave.
 * Cada cliente+aeronave tem sua própria sequência numerada.
 * Padrão: REL-XXX-001/YY
 *
 * @param clientName - Nome do cliente (para extrair iniciais)
 * @param aeronaveId - ID da aeronave (para filtrar sequência específica)
 */
export async function generateReportNumber(clientName: string, aeronaveId?: string): Promise<string> {
  if (!clientName?.trim()) {
    return `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`;
  }

  const yearShort = new Date().getFullYear().toString().slice(-2);

  const initials = clientName
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
    .replace(/[^A-Z]/g, '') // Remove caracteres não-alfabéticos
    .substring(0, 3)
    .padEnd(3, 'X');

  let query = supabase
    .from('travel_expense_reports')
    .select('numero_relatorio')
    .ilike('numero_relatorio', `REL-${initials}-%`);

  // Se aeronaveId foi fornecido, filtrar por essa aeronave específica
  if (aeronaveId?.trim()) {
    query = query.eq('aeronave_id', aeronaveId);
  }

  const { data: existing } = await query
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (existing && existing.length > 0) {
    const match = existing[0].numero_relatorio.match(/REL-[A-Z]{3}-(\d+)/);
    if (match?.[1]) nextNumber = parseInt(match[1]) + 1;
  }

  return `REL-${initials}-${String(nextNumber).padStart(3, '0')}/${yearShort}`;
}
