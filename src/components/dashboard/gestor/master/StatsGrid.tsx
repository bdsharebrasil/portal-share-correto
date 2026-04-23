import { DollarSign, TrendingUp, TrendingDown, Users, UserCheck, Wallet } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function StatsGrid() {
  const { data: clientsData } = useQuery({
    queryKey: ["clients-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("tipo", "colaborador")
        .eq("employment_status", "ativo");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: receitasData } = useQuery({
    queryKey: ["receitas-mes"],
    queryFn: async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("controle_bancario")
        .select("valor")
        .eq("tipo_movimento", "entrada")
        .gte("data", firstDay)
        .lte("data", lastDay);
      
      if (error) throw error;
      return data?.reduce((sum, item) => sum + Number(item.valor), 0) || 0;
    },
  });

  const { data: despesasData } = useQuery({
    queryKey: ["despesas-mes"],
    queryFn: async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("controle_bancario")
        .select("valor")
        .eq("tipo_movimento", "saida")
        .gte("data", firstDay)
        .lte("data", lastDay);
      
      if (error) throw error;
      return data?.reduce((sum, item) => sum + Number(item.valor), 0) || 0;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const saldo = (receitasData || 0) - (despesasData || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <MetricCard
        title="Receita Total"
        value={formatCurrency(receitasData || 0)}
        subtitle="Este mês"
        icon={TrendingUp}
        variant="success"
        trend={{ value: "+12.5%", isPositive: true }}
      />
      <MetricCard
        title="Despesas"
        value={formatCurrency(despesasData || 0)}
        subtitle="Este mês"
        icon={TrendingDown}
        variant="destructive"
        trend={{ value: "-3.2%", isPositive: true }}
      />
      <MetricCard
        title="Saldo"
        value={formatCurrency(saldo)}
        subtitle="Balanço mensal"
        icon={Wallet}
        variant={saldo >= 0 ? "primary" : "destructive"}
      />
      <MetricCard
        title="Clientes"
        value={String(clientsData || 0)}
        subtitle="Total cadastrados"
        icon={Users}
        variant="primary"
      />
      <MetricCard
        title="Colaboradores"
        value={String(employeesData || 0)}
        subtitle="Ativos"
        icon={UserCheck}
        variant="default"
      />
    </div>
  );
}
