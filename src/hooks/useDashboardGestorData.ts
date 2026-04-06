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
  // Totais gerais baseados em tipo_movimento
  totalReceitas: number;
  totalDespesas: number;
  saldoGeral: number;
  // Contadores de status
  receitasConferidas: number;
  despesasConferidas: number;
  receitasPendentes: number;
  despesasPendentes: number;
  // Alertas
  contasVencidas: number;
  recebimentosVencidos: number;
  // Do mês
  totalConferido: number;
  totalPendente: number;
  transacoesDoMes: number;
}

const CHART_COLORS = [
  "#10b981", // green
  "#3b82f6", // blue
  "#f97316", // orange
  "#8b5cf6", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#ec4899", // pink
];

export function useDashboardGestorData(currentDate: Date) {
  // Buscar transações do controle bancário
  const { data: transacoes = [], isLoading: isLoadingTransacoes } = useQuery({
    queryKey: ["dashboard-gestor-transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          *,
          categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria)
        `)
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calcular dados mensais para gráficos (últimos 6 meses)
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

      // Receitas = tipo_movimento "entrada"
      const receitas = monthTransacoes
        .filter((t: any) => t.tipo_movimento === "entrada")
        .reduce((acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)), 0);

      // Despesas = tipo_movimento "saida"
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

  // Calcular distribuição de despesas por categoria
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

  // Calcular estatísticas baseadas em tipo_movimento e status real do Supabase
  const stats: DashboardStats = (() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const today = new Date();

    const transacoesDoMesAtual = transacoes.filter((t: any) => {
      if (!t.data) return false;
      const tDate = typeof t.data === 'string' ? parseISO(t.data) : new Date(t.data);
      return tDate >= monthStart && tDate <= monthEnd;
    });

    // Separar por tipo_movimento: entrada = receita, saida = despesa
    const receitas = transacoes.filter((t: any) => t.tipo_movimento === "entrada");
    const despesas = transacoes.filter((t: any) => t.tipo_movimento === "saida");

    // Total de receitas (todas as entradas)
    const totalReceitas = receitas
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor || 0)), 0);

    // Total de despesas (todas as saídas)
    const totalDespesas = despesas
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor || 0)), 0);

    // Receitas conferidas (status = pago ou confirmado)
    const receitasConferidas = receitas
      .filter((r: any) => r.situacao === "pago" || r.situacao === "confirmado")
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor || 0)), 0);

    // Despesas conferidas (status = pago ou confirmado)
    const despesasConferidas = despesas
      .filter((d: any) => d.situacao === "pago" || d.situacao === "confirmado")
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor || 0)), 0);

    // Receitas pendentes (qualquer status que não seja pago/confirmado)
    const receitasPendentes = receitas
      .filter((r: any) => r.situacao !== "pago" && r.situacao !== "confirmado")
      .reduce((acc: number, r: any) => acc + Math.abs(Number(r.valor || 0)), 0);

    // Despesas pendentes
    const despesasPendentes = despesas
      .filter((d: any) => d.situacao !== "pago" && d.situacao !== "confirmado")
      .reduce((acc: number, d: any) => acc + Math.abs(Number(d.valor || 0)), 0);

    // Contas vencidas (despesas com data passada e não pagas)
    const contasVencidas = despesas.filter((d: any) => {
      const dataVenc = d.data_vencimento
        ? (typeof d.data_vencimento === 'string' ? parseISO(d.data_vencimento) : new Date(d.data_vencimento))
        : (d.data ? (typeof d.data === 'string' ? parseISO(d.data) : new Date(d.data)) : null);
      return (
        dataVenc &&
        dataVenc < today &&
        d.status !== "confirmado" &&
        d.status !== "pago" &&
        d.status !== "recebido" &&
        d.status !== "reembolsado"
      );
    }).length;

    // Recebimentos vencidos
    const recebimentosVencidos = receitas.filter((r: any) => {
      const dataVenc = r.data_vencimento
        ? (typeof r.data_vencimento === 'string' ? parseISO(r.data_vencimento) : new Date(r.data_vencimento))
        : (r.data ? (typeof r.data === 'string' ? parseISO(r.data) : new Date(r.data)) : null);
      return (
        dataVenc &&
        dataVenc < today &&
        r.situacao !== "confirmado" &&
        r.situacao !== "pago" &&
        r.situacao !== "recebido" &&
        r.situacao !== "reembolsado"
      );
    }).length;

    // Total conferido no mês (pago ou confirmado)
    const totalConferido = transacoesDoMesAtual
      .filter((t: any) => t.situacao === "pago" || t.situacao === "confirmado")
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.valor || 0)), 0);

    // Total pendente no mês
    const totalPendente = transacoesDoMesAtual
      .filter((t: any) => t.situacao !== "pago" && t.situacao !== "confirmado")
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.valor || 0)), 0);

    // Saldo geral = receitas conferidas - despesas conferidas
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
      totalConferido,
      totalPendente,
      transacoesDoMes: transacoesDoMesAtual.length,
    };
  })();

  // Separar receitas e despesas para tabelas (baseado em tipo_movimento)
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
