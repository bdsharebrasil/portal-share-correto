import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, History, Receipt } from "lucide-react";
import type { PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function TransactionsTable({
  transactions,
  title = "Últimas Transações",
  limit,
}: {
  transactions: PartnerTransaction[];
  title?: string;
  limit?: number;
}) {
  const items = limit ? transactions.slice(0, limit) : transactions;

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nenhuma transação encontrada</p>
        ) : (
          <div className="space-y-2">
            {items.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3">
                  {tx.transaction_type === "deposit" ? (
                    <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
                  ) : tx.transaction_type === "expense" ? (
                    <Receipt className="h-5 w-5 text-orange-500" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.description || tx.transaction_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.partner_name} • {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      {tx.transaction_type === "expense" && tx.status && ` • ${tx.status}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    tx.transaction_type === "deposit" ? "text-emerald-400" : tx.transaction_type === "expense" ? "text-orange-400" : "text-red-400"
                  }`}>
                    {tx.transaction_type === "deposit" ? "+" : "-"}{fmt(Number(tx.amount))}
                  </p>
                  {tx.transaction_type !== "expense" && (
                    <p className="text-xs text-muted-foreground">Saldo: {fmt(Number(tx.balance_after))}</p>
                  )}
                  {tx.transaction_type === "expense" && (
                    <p className="text-xs text-muted-foreground">{tx.expense_type || "Despesa"}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
