import React from "react";
import { StatsCard } from "./StatsCard";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";

interface KPISectionProps {
  totalReceitas: number;
  receitasConferidas: number;
  totalDespesas: number;
  despesasConferidas: number;
  saldoGeral: number;
  formatCurrency: (value: number) => string;
}

export function KPISection({
  totalReceitas,
  receitasConferidas,
  totalDespesas,
  despesasConferidas,
  saldoGeral,
  formatCurrency,
}: KPISectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Receitas */}
      <StatsCard
        label="Receitas"
        value={formatCurrency(totalReceitas)}
        subValue={`${formatCurrency(receitasConferidas)} conf.`}
        icon={<TrendingUp className="w-5 h-5 text-success" />}
        borderColor="border-success/30"
        bgColor="bg-card/80"
        iconBgColor="bg-success/20"
      />

      {/* Total Despesas */}
      <StatsCard
        label="Despesas"
        value={formatCurrency(totalDespesas)}
        subValue={`${formatCurrency(despesasConferidas)} conf.`}
        icon={<TrendingDown className="w-5 h-5 text-destructive" />}
        borderColor="border-destructive/30"
        bgColor="bg-card/80"
        iconBgColor="bg-destructive/20"
      />

      {/* Saldo */}
      <StatsCard
        label="Saldo"
        value={formatCurrency(saldoGeral)}
        subValue="Conferido"
        icon={<DollarSign className={`w-5 h-5 ${saldoGeral >= 0 ? "text-primary" : "text-warning"}`} />}
        borderColor={saldoGeral >= 0 ? "border-primary/30" : "border-warning/30"}
        bgColor="bg-card/80"
        iconBgColor={saldoGeral >= 0 ? "bg-primary/20" : "bg-warning/20"}
      />
    </div>
  );
}
