import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PartnerAccount, PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { useQueryClient } from "@tanstack/react-query";

const PARTNER_COLORS: Record<string, string> = {
  GUAVIRA: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  ARMANDO: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  DJALMA: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  DEJALMO: "from-amber-500/20 to-amber-600/10 border-amber-500/30"
};

const PARTNER_TEXT: Record<string, string> = {
  GUAVIRA: "text-emerald-400",
  ARMANDO: "text-blue-400",
  DJALMA: "text-amber-400",
  DEJALMO: "text-amber-400"
};

const normalizePartnerName = (name: string | null | undefined) => {
  if (!name) return "";
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
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
  const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
  const normalizedPartnerCpf = normalizeCpf(partnerCpf);

  const partnerTransactions = transactions.filter((t) => normalizeCpf(t.partner_cpf) === normalizedPartnerCpf);

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


  const handleRefresh = () => {
    if (clienteId) {
      queryClient.invalidateQueries({ queryKey: ["partner-accounts", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["partner-transactions", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", clienteId] });
    }
  };

  return (
    <div className="space-y-4">

      {/* Cards dos Sócios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          // Normalize CPF for comparison
          const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
          const normalizedAccCpf = normalizeCpf(acc.partner_cpf);

          // Calcula saldo automático, depósitos e despesas baseado em transações
          const accountTransactions = transactions.filter((t) => normalizeCpf(t.partner_cpf) === normalizedAccCpf);
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
              className={`bg-gradient-to-br ${PARTNER_COLORS[normalizePartnerName(acc.partner_name)] || "from-muted/20 to-muted/10 border-muted/30"} border`}>

              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold text-lg ${PARTNER_TEXT[normalizePartnerName(acc.partner_name)] || "text-foreground"}`}>
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
