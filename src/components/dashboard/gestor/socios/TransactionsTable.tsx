import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Receipt,
  Filter,
  FileDown,
  Clock,
} from "lucide-react";
import type { PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TransactionsPDFExport } from "./TransactionsPDFExport";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface TransactionsTableProps {
  transactions: PartnerTransaction[];
  title?: string;
  limit?: number;
  clienteId?: string;
  clienteName?: string;
}

export function TransactionsTable({
  transactions,
  title = "Últimas Transações",
  limit,
  clienteId,
  clienteName,
}: TransactionsTableProps) {
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);

  // Memoizar a função de obter data da transação
  const getTransactionDate = useMemo(
    () => (tx: any) => {
      const date = tx.payment_date || tx.criado_em;
      try {
        return format(new Date(date.includes("T") ? date : date + "T12:00:00"), "dd/MM/yyyy", {
          locale: ptBR,
        });
      } catch {
        return format(new Date(tx.criado_em), "dd/MM/yyyy", { locale: ptBR });
      }
    },
    []
  );

  // Memoizar partners únicos
  const partners = useMemo(
    () => [...new Set(transactions.map((t) => t.nome_socio))].filter(Boolean),
    [transactions]
  );

  // Memoizar meses únicos
  const months = useMemo(
    () =>
      [
        ...new Set(
          transactions.map((t) => {
            const date = (t as any).payment_date || t.criado_em;
            try {
              return format(new Date(date), "yyyy-MM");
            } catch {
              return format(new Date(), "yyyy-MM");
            }
          })
        ),
      ].sort().reverse(),
    [transactions]
  );

  // Memoizar transações filtradas
  const filtered = useMemo(() => {
    let result = [...transactions];

    if (filterPartner !== "all") {
      result = result.filter((t) => t.nome_socio === filterPartner);
    }
    if (filterType !== "all") {
      result = result.filter((t) => t.transaction_type === filterType);
    }
    if (filterMonth !== "all") {
      result = result.filter((t) => {
        const date = (t as any).payment_date || t.criado_em;
        try {
          return format(new Date(date), "yyyy-MM") === filterMonth;
        } catch {
          return false;
        }
      });
    }

    return result;
  }, [transactions, filterPartner, filterType, filterMonth]);

  // Memoizar items com limite
  const items = useMemo(
    () => (limit ? filtered.slice(0, limit) : filtered),
    [filtered, limit]
  );

  // Memoizar resumo financeiro - usa filtered (todas as transações filtradas, sem limite)
  const summary = useMemo(() => {
    const totalDeposits = filtered
      .filter((t) => t.transaction_type === "deposit")
      .reduce((s, t) => s + Number(t.valor), 0);
    const totalExpenses = filtered
      .filter((t) => t.transaction_type !== "deposit")
      .reduce((s, t) => s + Number(t.valor), 0);
    const netResult = totalDeposits - totalExpenses;

    return { totalDeposits, totalExpenses, netResult };
  }, [filtered]);

  return (
    <>
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <div className="flex gap-2">
              {!limit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-3 w-3" />
                  Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && !limit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <Label className="text-xs font-medium">Sócio</Label>
                <Select value={filterPartner} onValueChange={setFilterPartner}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="deposit">Depósito</SelectItem>
                    <SelectItem value="payment">Retirada</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Mês</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>
                        {format(new Date(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Nenhuma transação encontrada
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((tx: any) => {
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between p-3 rounded-lg border group transition-colors bg-muted/30 border-border/50`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {tx.transaction_type === "deposit" ? (
                        <ArrowUpCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      ) : tx.transaction_type === "expense" ? (
                        <Receipt className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">
                            {tx.descricao || tx.transaction_type}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tx.nome_socio} • {getTransactionDate(tx)}
                          {tx.transaction_type === "expense" && tx.status && ` • ${tx.status}`}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold whitespace-nowrap ${
                          tx.transaction_type === "deposit"
                            ? "text-emerald-400"
                            : tx.transaction_type === "expense"
                            ? "text-orange-400"
                            : "text-red-400"
                        }`}
                      >
                        {tx.transaction_type === "deposit" ? "+" : "-"}
                        {fmt(Number(tx.valor))}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Summary at the bottom */}
              <div className="mt-4 p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Entradas:</span>
                  <span className="font-semibold text-emerald-400">+{fmt(summary.totalDeposits)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Saídas:</span>
                  <span className="font-semibold text-red-400">-{fmt(summary.totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1">
                  <span>Resultado:</span>
                  <span className={summary.netResult >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {fmt(summary.netResult)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Export Dialog */}
      {showPDFExport && clienteId && (
        <TransactionsPDFExport
          transactions={filtered}
          clienteName={clienteName || "Cliente"}
          open={showPDFExport}
          onOpenChange={setShowPDFExport}
          filterPartner={filterPartner}
          filterType={filterType}
          filterMonth={filterMonth}
        />
      )}
    </>
  );
}
