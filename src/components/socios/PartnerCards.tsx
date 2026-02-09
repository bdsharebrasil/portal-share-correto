import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import type { PartnerAccount } from "@/hooks/useFinanceiroSocios";

const PARTNER_COLORS: Record<string, string> = {
  GUAVIRA: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  ARMANDO: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  DJALMA: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
};

const PARTNER_TEXT: Record<string, string> = {
  GUAVIRA: "text-emerald-400",
  ARMANDO: "text-blue-400",
  DJALMA: "text-amber-400",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DGAPartnerCards({ accounts }: { accounts: PartnerAccount[] }) {
  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <Card
            key={acc.id}
            className={`bg-gradient-to-br ${PARTNER_COLORS[acc.partner_name] || "from-muted/20 to-muted/10 border-muted/30"} border`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold text-lg ${PARTNER_TEXT[acc.partner_name] || "text-foreground"}`}>
                  {acc.partner_name}
                </h3>
                <span className="text-xs text-muted-foreground">{acc.partner_cpf}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mb-3">
                {fmt(Number(acc.current_balance))}
              </p>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {fmt(Number(acc.total_deposited))}
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <TrendingDown className="h-3 w-3" />
                  {fmt(Number(acc.total_spent))}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Saldo Total da Conta</span>
          </div>
          <span className="text-xl font-bold text-primary">{fmt(totalBalance)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
