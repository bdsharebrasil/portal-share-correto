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
        .from("controle_bancario")
        .select("data, tipo_movimento, valor")
        .order("data", { ascending: false })
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
          const date = new Date(item.data);
          const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

          if (monthlyData[monthKey]) {
            if (item.tipo_movimento === "entrada") {
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
