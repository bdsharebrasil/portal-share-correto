import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PartnerAccount, PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { useQueryClient } from "@tanstack/react-query";

const PARTNER_COLORS: Record<string, string> = {
  GUAVIRA: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  ARMANDO: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  DJALMA: "from-amber-500/20 to-amber-600/10 border-amber-500/30"
};

const PARTNER_TEXT: Record<string, string> = {
  GUAVIRA: "text-emerald-400",
  ARMANDO: "text-blue-400",
  DJALMA: "text-amber-400"
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface PartnerCardsProps {
  accounts: PartnerAccount[];
  transactions?: PartnerTransaction[];
  clienteId?: string;
}

// Calcula o saldo de um sócio baseado em suas transações
function calculatePartnerBalance(partnerCpf: string, transactions: PartnerTransaction[]): number {
  const partnerTransactions = transactions.filter((t) => t.partner_cpf === partnerCpf);

  const totalDeposits = partnerTransactions.
  filter((t) => t.transaction_type === "deposit").
  reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = partnerTransactions.
  filter((t) => t.transaction_type !== "deposit").
  reduce((sum, t) => sum + Number(t.amount), 0);

  return totalDeposits - totalExpenses;
}

export function PartnerCards({ accounts, transactions = [], clienteId }: PartnerCardsProps) {
  const queryClient = useQueryClient();

  // Calcula o saldo total automaticamente baseado em TODAS as transações
  const totalDepositsAll = transactions.
  filter((t) => t.transaction_type === "deposit").
  reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpensesAll = transactions.
  filter((t) => t.transaction_type !== "deposit").
  reduce((sum, t) => sum + Number(t.amount), 0);
  const totalBalance = totalDepositsAll - totalExpensesAll;

  // Calcula valores do mês atual
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const thisMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.created_at);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  const monthDeposits = thisMonthTransactions
    .filter((t) => t.transaction_type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthExpenses = thisMonthTransactions
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Calcula valores SEM sócio específico (null ou vazio)
  const transactionsWithoutPartner = transactions.filter((t) => !t.partner_cpf || t.partner_cpf.trim() === "");
  const depositsWithoutPartner = transactionsWithoutPartner
    .filter((t) => t.transaction_type === "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesWithoutPartner = transactionsWithoutPartner
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balanceWithoutPartner = depositsWithoutPartner - expensesWithoutPartner;

  const handleRefresh = () => {
    if (clienteId) {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clienteId] });
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de Totais Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Total */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-primary">Saldo Total</h3>
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(totalBalance)}
            </p>
          </CardContent>
        </Card>

        {/* Entrada Total do Mês */}
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-emerald-400">Entrada Mês</h3>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(monthDeposits)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {monthStart.toLocaleDateString("pt-BR")} - {monthEnd.toLocaleDateString("pt-BR")}
            </p>
          </CardContent>
        </Card>

        {/* Saída Total do Mês */}
        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-red-400">Saída Mês</h3>
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {fmt(monthExpenses)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {monthStart.toLocaleDateString("pt-BR")} - {monthEnd.toLocaleDateString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards dos Sócios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          // Calcula saldo automático, depósitos e despesas baseado em transações
          const accountTransactions = transactions.filter((t) => t.partner_cpf === acc.partner_cpf);
          const totalDeposits = accountTransactions.
          filter((t) => t.transaction_type === "deposit").
          reduce((sum, t) => sum + Number(t.amount), 0);
          const totalExpenses = accountTransactions.
          filter((t) => t.transaction_type !== "deposit").
          reduce((sum, t) => sum + Number(t.amount), 0);
          const calculatedBalance = totalDeposits - totalExpenses;

          return (
            <Card
              key={acc.id}
              className={`bg-gradient-to-br ${PARTNER_COLORS[acc.partner_name] || "from-muted/20 to-muted/10 border-muted/30"} border`}>

              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold text-lg ${PARTNER_TEXT[acc.partner_name] || "text-foreground"}`}>
                    {acc.partner_name}
                  </h3>
                  <span className="text-xs text-muted-foreground">{acc.partner_cpf}</span>
                </div>
                <p className="text-2xl font-bold text-foreground mb-3">
                  {fmt(calculatedBalance)}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    {fmt(totalDeposits)}
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <TrendingDown className="h-3 w-3" />
                    {fmt(totalExpenses)}
                  </span>
                </div>
              </CardContent>
            </Card>);

        })}
      </div>

      {/* Card de Valores sem Sócio */}
      <Card className="bg-gradient-to-br from-slate-500/20 to-slate-600/10 border-slate-500/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-400">Conta (Sem Sócio)</h3>
            <DollarSign className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-foreground mb-3">
            {fmt(balanceWithoutPartner)}
          </p>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1 text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {fmt(depositsWithoutPartner)}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <TrendingDown className="h-3 w-3" />
              {fmt(expensesWithoutPartner)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Atualizar */}
      {clienteId && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Atualizar todos os saldos"
            className="gap-2">
            Atualizar Saldos
          </Button>
        </div>
      )}
    </div>);

}
