import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  Receipt,
  Pencil,
  Trash2,
  Filter,
  FileDown,
} from "lucide-react";
import {
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/hooks/useFinanceiroSocios";
import type { PartnerTransaction } from "@/hooks/useFinanceiroSocios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatMoney } from "@/lib/formatters";
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
  const [editTx, setEditTx] = useState<PartnerTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<PartnerTransaction | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    paymentDate: "",
    notes: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);

  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  // Get unique partners and months for filters
  const partners = [...new Set(transactions.map((t) => t.partner_name))].filter(Boolean);
  const months = [
    ...new Set(
      transactions.map((t) => {
        const date = (t as any).payment_date || t.created_at;
        return format(new Date(date), "yyyy-MM");
      })
    ),
  ].sort().reverse();

  // Apply filters
  let filtered = transactions;
  if (filterPartner !== "all") {
    filtered = filtered.filter((t) => t.partner_name === filterPartner);
  }
  if (filterType !== "all") {
    filtered = filtered.filter((t) => t.transaction_type === filterType);
  }
  if (filterMonth !== "all") {
    filtered = filtered.filter((t) => {
      const date = (t as any).payment_date || t.created_at;
      return format(new Date(date), "yyyy-MM") === filterMonth;
    });
  }

  const items = limit ? filtered.slice(0, limit) : filtered;

  // Summary
  const totalDeposits = items
    .filter((t) => t.transaction_type === "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = items
    .filter((t) => t.transaction_type !== "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const netResult = totalDeposits - totalExpenses;

  const handleEditOpen = (tx: PartnerTransaction) => {
    setEditTx(tx);
    setEditForm({
      description: tx.description || "",
      amount: String(tx.amount),
      paymentDate: (tx as any).payment_date
        ? String((tx as any).payment_date)
        : format(new Date(tx.created_at), "yyyy-MM-dd"),
      notes: tx.notes || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTx || !clienteId) return;
    await updateTransaction.mutateAsync({
      id: editTx.id,
      clientId: clienteId,
      transactionType: editTx.transaction_type,
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      paymentDate: editForm.paymentDate,
      notes: editForm.notes || null,
    });
    setEditTx(null);
  };

  const handleDelete = async () => {
    if (!deleteTx || !clienteId) return;
    await deleteTransaction.mutateAsync({
      id: deleteTx.id,
      clientId: clienteId,
      transactionType: deleteTx.transaction_type,
      partnerCpf: deleteTx.partner_cpf,
      amount: Number(deleteTx.amount),
    });
    setDeleteTx(null);
  };

  const getTransactionDate = (tx: any) => {
    const date = tx.payment_date || tx.created_at;
    try {
      return format(new Date(date.includes("T") ? date : date + "T12:00:00"), "dd/MM/yyyy", {
        locale: ptBR,
      });
    } catch {
      return format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ptBR });
    }
  };

  return (
    <>
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <div className="flex gap-2">
              {!limit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-3 w-3" />
                    Filtros
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowPDFExport(true)}
                  >
                    <FileDown className="h-3 w-3" />
                    Exportar PDF
                  </Button>
                </>
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
              {items.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 group"
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {tx.description || tx.transaction_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.partner_name} • {getTransactionDate(tx)}
                        {tx.transaction_type === "expense" && tx.status && ` • ${tx.status}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      {fmt(Number(tx.amount))}
                    </p>

                    {/* Edit/Delete buttons */}
                    {clienteId && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditOpen(tx)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTx(tx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Summary at the bottom */}
              <div className="mt-4 p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Entradas:</span>
                  <span className="font-semibold text-emerald-400">+{fmt(totalDeposits)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Saídas:</span>
                  <span className="font-semibold text-red-400">-{fmt(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1">
                  <span>Resultado:</span>
                  <span className={netResult >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {fmt(netResult)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTx} onOpenChange={(v) => !v && setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editForm.paymentDate}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, paymentDate: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={updateTransaction.isPending}>
              {updateTransaction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTx} onOpenChange={(v) => !v && setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTx?.description}"? Esta ação
              não pode ser desfeita e o saldo será ajustado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
