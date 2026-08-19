import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";

interface MonthlyData {
  month: string;
  monthLabel: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface DashboardStats {
  totalReceitas: number;
  totalDespesas: number;
  saldoGeral: number;
  receitasConferidas: number;
  despesasConferidas: number;
  receitasPendentes: number;
  despesasPendentes: number;
  contasVencidas: number;
  recebimentosVencidos: number;
  reembolsosPendentes: number;
  totalReembolsosPendentes: number;
  totalConferido: number;
  totalPendente: number;
  transacoesDoMes: number;
}

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f97316", "#8b5cf6",
  "#ef4444", "#06b6d4", "#eab308", "#ec4899",
];

/**
 * "aguardando_reembolso" numa DESPESA = a SHARE pagou o fornecedor direto
 * (dívida com fornecedor quitada). O que falta é o cliente/sócio reembolsar
 * a SHARE — isso é rastreado por `reembolsavel` / `reembolso_quitado`.
 * Por isso conta como conferida do lado despesa. Do lado receita não se aplica.
 */
function isConferido(status: string, tipoMovimento: "entrada" | "saida"): boolean {
  if (status === "pago" || status === "recebido") return true;
  if (status === "aguardando_reembolso" && tipoMovimento === "saida") return true;
  return false;
}

/** Status que não devem contar como "vencido" mesmo com data passada */
function isNaoVencido(status: string, tipoMovimento: "entrada" | "saida"): boolean {
  if (["pago", "recebido", "reembolsado", "cancelado"].includes(status)) return true;
  if (status === "aguardando_reembolso" && tipoMovimento === "saida") return true;
  return false;
}

export function useDashboardGestorData(currentDate: Date) {
  const { data: transacoes = [], isLoading: isLoadingTransacoes } = useQuery({
    queryKey: ["dashboard-gestor-transacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("movimentacoes")
        .select(`
          *,
          categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria)
        `)
        .order("data_emissao", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => {
        const valorRateado = Number(row.valor_rateado ?? row.valor_total ?? 0);
        const valorPagoReal =
          row.valor_pago_real !== null && row.valor_pago_real !== undefined
            ? Number(row.valor_pago_real)
            : null;

        return {
          ...row,
          data: row.data_pagamento || row.data_vencimento || row.data_emissao,
          tipo_movimento:
            row.fluxo === "receita" || row.fluxo === "entrada" ? "entrada" : "saida",
          valor: valorRateado,
          valor_pago_real: valorPagoReal,
          valor_conferido: valorPagoReal ?? valorRateado,
          grupo_categoria: row.categorias_movimentacao?.grupo_categoria ?? row.categoria_nome ?? null,
        };
      });
    },
  });

  const monthlyData: MonthlyData[] = (() => {
    const result: MonthlyData[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, "yyyy-MM");
      const monthLabel = format(monthDate, "MMM");

      const monthTransacoes = transacoes.filter((t: any) => {
        if (!t.data) return false;
        const tDate = typeof t.data === 'string' ? parseISO(t.data) : new Date(t.data);
        return tDate >= monthStart && tDate <= monthEnd;
      });

      const receitas = monthTransacoes
        .filter((t: any) => t.tipo_movimento === "entrada")
        .reduce((acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)), 0);

      const despesas = monthTransacoes
        .filter((t: any) => t.tipo_movimento === "saida")
        .reduce((acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)), 0);

      result.push({
        month: monthKey,
        monthLabel,
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }

    return result;
  })();

  const categoryData: CategoryData[] = (() => {
    const categoryTotals: Record<string, number> = {};

    transacoes
      .filter((t: any) => t.tipo_movimento === "saida")
      .forEach((t: any) => {
        const categoryName = t.categorias_movimentacao?.nome || t.grupo_categoria || "Outros";
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Math.abs(Number(t.valor || 0));
      });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    const total = sortedCategories.reduce((acc, [, value]) => acc + value, 0);

    return sortedCategories.map(([name, value], index) => ({
      name: name.length > 20 ? name.substring(0, 20) + "..." : name,
      value: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  })();

  const stats: DashboardStats = (() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const today = new Date();

    const transacoesDoMesAtual = transacoes.filter((t: any) => {
      if (!t.data) return false;
      const tDate = typeof t.data === 'string' ? parseISO(t.data) : new Date(t.data);
      return tDate >= monthStart && tDate <= monthEnd;
    });

    const receitas = transacoes.filter((t: any) => t.tipo_movimento === "entrada");
    const despesas = transacoes.filter((t: any) => t.tipo_movimento === "saida");

    const totalReceitas = receitas
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor || 0)), 0);

    const totalDespesas = despesas
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor || 0)), 0);

    const receitasConferidas = receitas
      .filter((r: any) => isConferido(r.status, "entrada"))
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor_conferido || 0)), 0);

    const despesasConferidas = despesas
      .filter((d: any) => isConferido(d.status, "saida"))
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor_conferido || 0)), 0);

    const receitasPendentes = receitas
      .filter((r: any) => !isConferido(r.status, "entrada"))
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor || 0)), 0);

    const despesasPendentes = despesas
      .filter((d: any) => !isConferido(d.status, "saida"))
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor || 0)), 0);

    const contasVencidas = despesas.filter((d: any) => {
      const dataVenc = d.data_vencimento
        ? (typeof d.data_vencimento === 'string' ? parseISO(d.data_vencimento) : new Date(d.data_vencimento))
        : (d.data ? (typeof d.data === 'string' ? parseISO(d.data) : new Date(d.data)) : null);
      return dataVenc && dataVenc < today && !isNaoVencido(d.status, "saida");
    }).length;

    const recebimentosVencidos = receitas.filter((r: any) => {
      const dataVenc = r.data_vencimento
        ? (typeof r.data_vencimento === 'string' ? parseISO(r.data_vencimento) : new Date(r.data_vencimento))
        : (r.data ? (typeof r.data === 'string' ? parseISO(r.data) : new Date(r.data)) : null);
      return dataVenc && dataVenc < today && !isNaoVencido(r.status, "entrada");
    }).length;

    const despesasAguardandoReembolso = despesas.filter(
      (d: any) => d.reembolsavel === true && d.reembolso_quitado === false
    );
    const reembolsosPendentes = despesasAguardandoReembolso.length;
    const totalReembolsosPendentes = despesasAguardandoReembolso.reduce(
      (acc: number, d: any) => acc + Math.abs(Number(d.valor_conferido || d.valor || 0)),
      0
    );

    const totalConferido = transacoesDoMesAtual
      .filter((t: any) => isConferido(t.status, t.tipo_movimento))
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.valor_conferido || 0)), 0);

    const totalPendente = transacoesDoMesAtual
      .filter((t: any) => !isConferido(t.status, t.tipo_movimento))
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.valor || 0)), 0);

    const saldoGeral = receitasConferidas - despesasConferidas;

    return {
      totalReceitas,
      totalDespesas,
      saldoGeral,
      receitasConferidas,
      despesasConferidas,
      receitasPendentes,
      despesasPendentes,
      contasVencidas,
      recebimentosVencidos,
      reembolsosPendentes,
      totalReembolsosPendentes,
      totalConferido,
      totalPendente,
      transacoesDoMes: transacoesDoMesAtual.length,
    };
  })();

  const contasReceber = transacoes.filter((t: any) => t.tipo_movimento === "entrada");
  const contasPagar = transacoes.filter((t: any) => t.tipo_movimento === "saida");

  return {
    transacoes,
    monthlyData,
    categoryData,
    stats,
    contasReceber,
    contasPagar,
    isLoading: isLoadingTransacoes,
  };
}
