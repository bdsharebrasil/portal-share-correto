import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";

interface MonthlyData {
  name: string;
  receita: number;
  despesa: number;
}

export function useReceitasDespesas() {
  return useQuery({
    queryKey: ["receitas-despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("data, tipo_movimento, valor")
        .order("data", { ascending: true });

      if (error) throw error;

      // Agrupar por mês
      const monthlyMap = new Map<string, { receita: number; despesa: number }>();

      (data || []).forEach((item: any) => {
        if (!item.data || !item.tipo_movimento || item.valor === null) return;

        const monthKey = format(new Date(item.data), "MMM").substring(0, 3);
        const monthNum = format(new Date(item.data), "MM");
        const fullKey = `${monthNum}-${monthKey}`;

        if (!monthlyMap.has(fullKey)) {
          monthlyMap.set(fullKey, { receita: 0, despesa: 0 });
        }

        const current = monthlyMap.get(fullKey)!;
        if (item.tipo_movimento === "entrada") {
          current.receita += Number(item.valor);
        } else if (item.tipo_movimento === "saida") {
          current.despesa += Number(item.valor);
        }
      });

      // Converter para array ordenado
      const result: MonthlyData[] = Array.from(monthlyMap.entries())
        .map(([key, value]) => ({
          name: key.split("-")[1],
          ...value,
        }))
        .sort((a, b) => {
          const monthOrder = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          return monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name);
        });

      return result;
    },
  });
}
