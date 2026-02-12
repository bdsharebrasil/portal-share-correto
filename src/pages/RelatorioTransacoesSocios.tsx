import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DollarSign, Download, Calendar, FileText, Trash2, Edit2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import {
  useSocioTransactions,
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/hooks/useFinanceiroSocios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import type { jsPDF as jsPDFType } from "jspdf";
import "jspdf-autotable";

// Estender tipagem do jsPDF para incluir autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface TransactionRow {
  id: string;
  /** Data exibida: vem de payment_date (campo preenchido pelo usuário) */
  date: string;
  /** Data bruta para ordenação */
  rawDate: string;
  partner_name: string;
  partner_cpf: string;
  amount: number;
  balance_after: number;
  description: string;
  bank_name: string;
  prazo: string;
  transaction_type: "deposit" | "withdrawal" | "expense" | "payment" | string;
  notes: string | null;
}

interface GroupedTransactions {
  [monthYear: string]: TransactionRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rótulo amigável para o tipo de transação */
function txLabel(type: string) {
  const map: Record<string, string> = {
    deposit: "Depósito",
    withdrawal: "Retirada",
    payment: "Pagamento",
    expense: "Despesa",
  };
  return map[type] ?? type;
}

/** Cor do Badge por tipo */
function txBadgeClass(type: string) {
  if (type === "deposit")
    return "bg-green-500/20 text-green-600 border-green-500/30";
  if (type === "expense" || type === "payment")
    return "bg-orange-500/20 text-orange-600 border-orange-500/30";
  return "bg-blue-500/20 text-blue-600 border-blue-500/30";
}

/** Sinal do valor */
function txSign(type: string) {
  return type === "deposit" ? "+" : "-";
}

/** Cor do valor */
function txAmountColor(type: string) {
  return type === "deposit" ? "text-green-600" : "text-red-600";
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // ── Modais ──────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionRow | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    paymentDate: "",
    notes: "",
    bank_name: "",
    prazo: "",
  });

  // ── Hooks de dados ──────────────────────────────────────────────────────────
  const { data: clientesComSocios = [], isLoading: loadingClientes } =
    useClientesComSocios();
  const { data: transactions = [], isLoading: loadingTx } =
    useSocioTransactions(clienteId || null);

  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  // ── Agrupamento por mês ─────────────────────────────────────────────────────
  const groupedTransactions = useMemo(() => {
    const grouped: GroupedTransactions = {};

    transactions.forEach((tx: any) => {
      // Prioridade: payment_date → due_date → created_at
      const rawDate =
        tx.payment_date ||
        tx.due_date ||
        tx.created_at;

      // Parser a data sem problemas de timezone
      const dateStr = rawDate.split('T')[0]; // Pega apenas a data (YYYY-MM-DD)
      const [year, month, day] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      const monthYear = date.toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric",
      });

      if (!grouped[monthYear]) grouped[monthYear] = [];

      grouped[monthYear].push({
        id: tx.id,
        date: date.toLocaleDateString("pt-BR"),
        rawDate,
        partner_name: tx.partner_name || "N/A",
        partner_cpf: tx.partner_cpf || "",
        amount: parseFloat(tx.amount) || 0,
        balance_after: parseFloat(tx.balance_after) || 0,
        description: tx.description || "N/A",
        bank_name: tx.bank_name || "N/A",
        prazo: tx.prazo || "N/A",
        transaction_type: tx.transaction_type,
        notes: tx.notes || null,
      });
    });

    // Ordena transações dentro de cada mês
    Object.keys(grouped).forEach((m) => {
      grouped[m].sort(
        (a, b) =>
          new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
      );
    });

    return grouped;
  }, [transactions]);

  const sortedMonths = useMemo(
    () => Object.keys(groupedTransactions).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    ),
    [groupedTransactions]
  );

  // Seleciona mês mais recente por padrão
  useEffect(() => {
    if (sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(sortedMonths[0]);
    }
  }, [sortedMonths, selectedMonth]);

  const selectedTransactions = useMemo(() => {
    const list = selectedMonth
      ? [...(groupedTransactions[selectedMonth] || [])]
      : [];
    return list.sort((a, b) => {
      const dA = new Date(a.rawDate).getTime();
      const dB = new Date(b.rawDate).getTime();
      return sortOrder === "asc" ? dA - dB : dB - dA;
    });
  }, [selectedMonth, sortOrder, groupedTransactions]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !clienteId) return;
    await deleteTransaction.mutateAsync({
      id: deleteTarget.id,
      clientId: clienteId,
      transactionType: deleteTarget.transaction_type,
      partnerCpf: deleteTarget.partner_cpf,
      amount: deleteTarget.amount,
    });
    setDeleteTarget(null);
  };

  // ── Edit open ───────────────────────────────────────────────────────────────
  const openEdit = (tx: TransactionRow) => {
    setEditTarget(tx);
    // Converte a data exibida (dd/MM/yyyy) para yyyy-MM-dd para o input type="date"
    const [day, month, year] = tx.date.split("/");
    setEditForm({
      description: tx.description === "N/A" ? "" : tx.description,
      amount: tx.amount.toFixed(2),
      paymentDate: `${year}-${month}-${day}`,
      notes: tx.notes || "",
      bank_name: tx.bank_name === "N/A" ? "" : tx.bank_name || "",
      prazo: tx.prazo === "N/A" ? "" : tx.prazo || "",
    });
  };

  // ── Edit save ───────────────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (!editTarget || !clienteId) return;
    await updateTransaction.mutateAsync({
      id: editTarget.id,
      clientId: clienteId,
      transactionType: editTarget.transaction_type,
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      paymentDate: editForm.paymentDate,
      notes: editForm.notes || null,
      bankName: editForm.bank_name || null,
      prazo: editForm.prazo || null,
    });
    setEditTarget(null);
  };

  // ── Exportações ─────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!selectedTransactions.length) return;

    const headers = [
      "Data",
      "Sócio",
      "Descrição",
      "Banco",
      "Prazo",
      "Tipo",
      "Valor",
    ];
    const rows = selectedTransactions.map((tx) => [
      tx.date,
      tx.partner_name,
      tx.description,
      tx.bank_name,
      tx.prazo,
      txLabel(tx.transaction_type),
      `R$ ${tx.amount.toFixed(2)}`,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const el = document.createElement("a");
    el.setAttribute(
      "href",
      `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    );
    el.setAttribute("download", `relatorio_${selectedMonth}.csv`);
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  const downloadPDF = () => {
    if (!selectedTransactions.length) return;

    const doc = new jsPDF() as any;
    const margin = 10;

    doc.setFontSize(16);
    doc.text("Relatório de Transações - Sócios", margin, margin);

    doc.setFontSize(10);
    doc.text(
      `Cliente: ${
        selectedClientData?.company_name || selectedClientData?.proprietario
      }`,
      margin,
      margin + 10
    );
    doc.text(`CNPJ: ${selectedClientData?.cnpj}`, margin, margin + 15);
    doc.text(`Período: ${selectedMonth}`, margin, margin + 20);

    const tableColumn = [
      "Data",
      "Sócio",
      "Descrição",
      "Banco",
      "Prazo",
      "Tipo",
      "Valor",
    ];
    const tableRows = selectedTransactions.map((tx) => [
      tx.date,
      tx.partner_name,
      tx.description,
      tx.bank_name,
      tx.prazo,
      txLabel(tx.transaction_type),
      `R$ ${tx.amount.toFixed(2)}`,
    ]);

    // Usar o método autoTable do jspdf-autotable
    if (doc.autoTable) {
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: margin + 28,
        margin,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });
    }

    const finalY = doc.lastAutoTable?.finalY || margin + 40;
    doc.setFontSize(10);
    doc.text(
      `Total de Depósitos: R$ ${selectedTransactions
        .filter((t) => t.transaction_type === "deposit")
        .reduce((s, t) => s + t.amount, 0)
        .toFixed(2)}`,
      margin,
      finalY
    );
    doc.text(
      `Total de Saídas: R$ ${selectedTransactions
        .filter((t) => t.transaction_type !== "deposit")
        .reduce((s, t) => s + t.amount, 0)
        .toFixed(2)}`,
      margin,
      finalY + 6
    );
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(
      `Saldo Final: R$ ${
        selectedTransactions[selectedTransactions.length - 1]?.balance_after.toFixed(2) ||
        "0.00"
      }`,
      margin,
      finalY + 14
    );

    doc.save(`relatorio_${selectedMonth}.pdf`);
  };

  // ── Loading / Not found ──────────────────────────────────────────────────────
  if (loadingClientes) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!selectedClientData) {
    return (
      <Layout>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-12 pb-12 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Cliente não encontrado
            </h3>
            <Button
              onClick={() => navigate("/financeiro/financeiro-socios")}
              className="mt-4"
            >
              ← Voltar 
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Relatório de Transações
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name ||
                  selectedClientData?.proprietario}{" "}
                • {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/financeiro/financeiro-socios")}
              size="sm"
            >
              ← Voltar 
            </Button>
            <Button
              onClick={downloadPDF}
              disabled={!selectedTransactions.length}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="w-full sm:w-64">
            <label className="text-sm font-medium text-foreground mb-2 block">
              <Calendar className="h-4 w-4 inline mr-2" />
              Selecione o Mês
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um mês" />
              </SelectTrigger>
              <SelectContent>
                {sortedMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transações - {selectedMonth}</CardTitle>
              <Badge variant="secondary">
                {selectedTransactions.length} transação
                {selectedTransactions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {selectedTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Nenhuma transação encontrada para este período
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                        }
                      >
                        Data {sortOrder === "asc" ? "↑" : "↓"}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Sócio
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Banco
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Prazo
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransactions.map((tx, index) => (
                      <tr
                        key={tx.id}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                          index % 2 === 0 ? "bg-muted/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">
                          {tx.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-medium">
                          {tx.partner_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.bank_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {tx.prazo}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge
                            variant="secondary"
                            className={txBadgeClass(tx.transaction_type)}
                          >
                            {txLabel(tx.transaction_type)}
                          </Badge>
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-semibold text-right ${txAmountColor(
                            tx.transaction_type
                          )}`}
                        >
                          {txSign(tx.transaction_type)} R${" "}
                          {tx.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-blue-500/20 transition-colors text-blue-600 hover:text-blue-700"
                              title="Editar transação"
                              onClick={() => openEdit(tx)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-red-500/20 transition-colors text-red-600 hover:text-red-700"
                              title="Deletar transação"
                              onClick={() => setDeleteTarget(tx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resumo */}
            {selectedTransactions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">
                    Total de Depósitos:
                  </span>
                  <span className="text-sm font-semibold text-green-600">
                    R${" "}
                    {selectedTransactions
                      .filter((t) => t.transaction_type === "deposit")
                      .reduce((s, t) => s + t.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">
                    Total de Saídas:
                  </span>
                  <span className="text-sm font-semibold text-red-600">
                    R${" "}
                    {selectedTransactions
                      .filter((t) => t.transaction_type !== "deposit")
                      .reduce((s, t) => s + t.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg">
                  <span className="text-sm font-bold text-foreground">
                    Saldo Final:
                  </span>
                  <span className="text-lg font-bold text-primary">
                    R${" "}
                    {selectedTransactions[
                      selectedTransactions.length - 1
                    ]?.balance_after.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modal Confirmar Exclusão ─────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação?
              <br />
              <span className="font-medium text-foreground">
                {deleteTarget?.description}
              </span>{" "}
              — R$ {deleteTarget?.amount.toFixed(2)}
              <br />
              <span className="text-destructive text-xs mt-1 block">
                Esta ação reverterá o saldo do sócio e não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTransaction.isPending}
            >
              {deleteTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal Editar Transação ───────────────────────────────────────────── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-blue-500" />
              Editar Transação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="edit-desc">Descrição</Label>
              <Input
                id="edit-desc"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-amount">Valor (R$)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-date">Data</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.paymentDate}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      paymentDate: e.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-bank">Banco</Label>
                <Select value={editForm.bank_name || "none"} onValueChange={(value) => setEditForm(p => ({ ...p, bank_name: value === "none" ? "" : value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="Bradesco">Bradesco</SelectItem>
                    <SelectItem value="Caixa">Caixa</SelectItem>
                    <SelectItem value="Sicoob">Sicoob</SelectItem>
                    <SelectItem value="Sicredi">Sicredi</SelectItem>
                    <SelectItem value="Itaú">Itaú</SelectItem>
                    <SelectItem value="Santander">Santander</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-prazo">Prazo</Label>
                <Select value={editForm.prazo || "none"} onValueChange={(value) => setEditForm(p => ({ ...p, prazo: value === "none" ? "" : value }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o prazo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                    <SelectItem value="Extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, notes: e.target.value }))
                }
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={updateTransaction.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={
                updateTransaction.isPending ||
                !editForm.description ||
                !editForm.amount ||
                !editForm.paymentDate
              }
            >
              {updateTransaction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}