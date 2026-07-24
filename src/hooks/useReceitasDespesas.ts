import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  name: string;
  receita: number;
  despesa: number;
}

export function useReceitasDespesas() {
  return useQuery({
    queryKey: ["receitas-despesas"],
    queryFn: async (): Promise<MonthlyData[]> => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("data_competencia, tipo, valor, status, data_pagamento, tipo_caixa")
        .eq("tipo_caixa", "share")
        .neq("status", "cancelado")
        .order("data_competencia", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Agrupar dados por mês (últimos 6 meses)
      const monthlyData: Record<string, { receita: number; despesa: number }> = {};
      const now = new Date();

      // Inicializar últimos 6 meses
      for (let i = 0; i < 6; i++) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        monthlyData[monthKey] = { receita: 0, despesa: 0 };
      }

      // Processar dados
      if (data) {
        data.forEach((item: any) => {
          const date = new Date(item.data_competencia);
          const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

          if (monthlyData[monthKey]) {
            const realizado = item.status === "pago" || item.data_pagamento;
            if (!realizado) return;
            if (["entrada", "receita"].includes(item.tipo)) {
              monthlyData[monthKey].receita += Number(item.valor);
            } else {
              monthlyData[monthKey].despesa += Number(item.valor);
            }
          }
        });
      }

      return Object.entries(monthlyData)
        .map(([name, data]) => ({
          name,
          receita: data.receita,
          despesa: data.despesa,
        }))
        .reverse();
    },
  });
}
