import React, { useState, useMemo, useEffect, useRef } from "react";
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
import {
  DollarSign,
  Calendar,
  FileText,
  Trash2,
  Edit2,
  Filter,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  X,
  Users,
  BarChart3,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import {
  useSocioTransactions,
  useDeleteTransaction,
  useUpdateTransaction,
  EXPENSE_TYPES,
} from "@/hooks/useFinanceiroSocios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface TransactionRow {
  id: string;
  date: string;
  rawDate: string;
  partner_name: string;
  partner_cpf: string;
  amount: number;
  balance_after: number;
  description: string;
  bank_name: string;
  prazo: string;
  expense_type: string;
  transaction_type: "deposit" | "withdrawal" | "expense" | "payment" | string;
  notes: string | null;
  status?: string;
  paid_date?: string;
  due_date?: string;
  invoice_url?: string;
  category?: string;
  doc?: string;
}

interface GroupedTransactions {
  [monthYear: string]: TransactionRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function txLabel(type: string) {
  const map: Record<string, string> = {
    deposit: "Depósito",
    withdrawal: "Retirada",
    payment: "Pagamento",
    expense: "Despesa",
  };
  return map[type] ?? type;
}

function txBadgeClass(type: string) {
  if (type === "deposit") return "bg-emerald-500/20 text-emerald-600 border-emerald-500/30";
  if (type === "expense" || type === "payment") return "bg-red-500/20 text-red-600 border-red-500/30";
  return "bg-blue-500/20 text-blue-600 border-blue-500/30";
}

function txSign(type: string) {
  return type === "deposit" ? "+" : "-";
}

function txAmountColor(type: string) {
  return type === "deposit" ? "text-emerald-600" : "text-red-600";
}

const CHART_COLORS = ["#10b981", "#f43f5e", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#3b82f6", "#84cc16"];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(true);

  // ── Modais ──────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionRow | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    paymentDate: "",
    dueDate: "",
    notes: "",
    bank_name: "",
    prazo: "",
    status: "pago",
    invoiceUrl: "",
    doc: "",
  });

  // ── Hooks de dados ──────────────────────────────────────────────────────────
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();
  const { data: transactions = [], isLoading: loadingTx } = useSocioTransactions(clienteId || null);
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  // ── Transformar transações em TransactionRow ─────────────────────────────────
  const allRows = useMemo(() => {
    return transactions.map((tx: any) => {
      const rawDate = tx.paid_date || tx.payment_date || tx.due_date || tx.created_at;
      const dateStr = rawDate.split("T")[0];
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      return {
        id: tx.id,
        date: date.toLocaleDateString("pt-BR"),
        rawDate,
        monthKey: `${year}-${month}`,
        partner_name: tx.partner_name || "N/A",
        partner_cpf: tx.partner_cpf || "",
        amount: parseFloat(tx.amount) || 0,
        balance_after: parseFloat(tx.balance_after) || 0,
        description: tx.description || "N/A",
        bank_name: tx.bank_name || "",
        prazo: tx.prazo || "",
        expense_type: tx.expense_type || "",
        transaction_type: tx.transaction_type,
        notes: tx.notes || null,
        status: tx.status || null,
        paid_date: tx.paid_date || null,
        due_date: tx.due_date || null,
        invoice_url: tx.invoice_url || null,
        category: tx.category || null,
        doc: tx.doc || null,
      };
    });
  }, [transactions]);

  // ── Listas únicas para filtros ────────────────────────────────────────────────
  const uniqueMonths = useMemo(() => {
    const months = [...new Set(allRows.map((r) => r.monthKey))].sort().reverse();
    return months.map((m) => {
      const [y, mo] = m.split("-");
      const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
      return { value: m, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
    });
  }, [allRows]);

  const uniquePartners = useMemo(
    () => [...new Set(allRows.map((r) => r.partner_name))].filter((p) => p !== "N/A").sort(),
    [allRows]
  );

  const uniqueCategories = useMemo(
    () => [...new Set(allRows.filter((r) => r.expense_type).map((r) => r.expense_type))].sort(),
    [allRows]
  );

  // Auto-select first month
  useEffect(() => {
    if (uniqueMonths.length > 0 && filterMonth === "all") {
      // Keep "all" as default for broader view
    }
  }, [uniqueMonths]);

  // ── Transações filtradas ─────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    let result = [...allRows];

    if (filterMonth !== "all") {
      result = result.filter((r) => r.monthKey === filterMonth);
    }
    if (filterPartner !== "all") {
      result = result.filter((r) => r.partner_name === filterPartner);
    }
    if (filterType !== "all") {
      result = result.filter((r) => r.transaction_type === filterType);
    }
    if (filterCategory !== "all") {
      result = result.filter((r) => r.expense_type === filterCategory);
    }

    return result.sort((a, b) => {
      const dA = new Date(a.rawDate).getTime();
      const dB = new Date(b.rawDate).getTime();
      return sortOrder === "asc" ? dA - dB : dB - dA;
    });
  }, [allRows, filterMonth, filterPartner, filterType, filterCategory, sortOrder]);

  // ── Métricas de resumo ──────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalDeposits = filteredTransactions
      .filter((t) => t.transaction_type === "deposit")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = filteredTransactions
      .filter((t) => t.transaction_type !== "deposit")
      .reduce((s, t) => s + t.amount, 0);
    return { totalDeposits, totalExpenses, saldo: totalDeposits - totalExpenses };
  }, [filteredTransactions]);

  // ── Dados para gráficos ─────────────────────────────────────────────────────
  const monthlyChartData = useMemo(() => {
    const acc: Record<string, { name: string; entradas: number; saidas: number }> = {};
    filteredTransactions.forEach((tx) => {
      const [y, m] = tx.monthKey.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!acc[tx.monthKey]) acc[tx.monthKey] = { name: label, entradas: 0, saidas: 0 };
      if (tx.transaction_type === "deposit") acc[tx.monthKey].entradas += tx.amount;
      else acc[tx.monthKey].saidas += tx.amount;
    });
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filteredTransactions]);

  const partnerPieData = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredTransactions.forEach((tx) => {
      const name = tx.partner_name || "Geral";
      acc[name] = (acc[name] || 0) + tx.amount;
    });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const categoryBarData = useMemo(() => {
    const acc: Record<string, number> = {};
    filteredTransactions
      .filter((t) => t.transaction_type !== "deposit")
      .forEach((tx) => {
        const cat = tx.expense_type
          ? (EXPENSE_TYPES.find((e) => e.value === tx.expense_type)?.label || tx.expense_type)
          : txLabel(tx.transaction_type);
        acc[cat] = (acc[cat] || 0) + tx.amount;
      });
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions]);

  // ── Filtros ativos label ────────────────────────────────────────────────────
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (filterMonth !== "all") parts.push(`Mês: ${uniqueMonths.find((m) => m.value === filterMonth)?.label}`);
    if (filterPartner !== "all") parts.push(`Sócio: ${filterPartner}`);
    if (filterType !== "all") parts.push(`Tipo: ${txLabel(filterType)}`);
    if (filterCategory !== "all") {
      const catLabel = EXPENSE_TYPES.find((e) => e.value === filterCategory)?.label || filterCategory;
      parts.push(`Categoria: ${catLabel}`);
    }
    return parts.length > 0 ? parts.join(" • ") : "Todos os dados";
  }, [filterMonth, filterPartner, filterType, filterCategory, uniqueMonths]);

  const hasActiveFilters = filterMonth !== "all" || filterPartner !== "all" || filterType !== "all" || filterCategory !== "all";

  const clearFilters = () => {
    setFilterMonth("all");
    setFilterPartner("all");
    setFilterType("all");
    setFilterCategory("all");
  };

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

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = (tx: TransactionRow) => {
    setEditTarget(tx);
    const [day, month, year] = tx.date.split("/");
    const paidDateStr = tx.paid_date ? tx.paid_date.split("T")[0] : `${year}-${month}-${day}`;
    const dueDateStr = tx.due_date ? tx.due_date.split("T")[0] : "";

    setEditForm({
      description: tx.description === "N/A" ? "" : tx.description,
      amount: tx.amount.toFixed(2),
      paymentDate: paidDateStr,
      dueDate: dueDateStr,
      notes: tx.notes || "",
      bank_name: tx.bank_name || "",
      prazo: tx.prazo || "",
      status: tx.status || "pago",
      invoiceUrl: tx.invoice_url || "",
      doc: tx.doc || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget || !clienteId) return;
    // prazo DB constraint: must be 'mensal' or 'extra' (lowercase) or null
    const prazoValue = editForm.prazo ? editForm.prazo.toLowerCase() : null;
    await updateTransaction.mutateAsync({
      id: editTarget.id,
      clientId: clienteId,
      transactionType: editTarget.transaction_type,
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      paymentDate: editForm.paymentDate,
      dueDate: editForm.dueDate || null,
      notes: editForm.notes || null,
      bankName: editForm.bank_name || null,
      prazo: prazoValue,
      status: editForm.status || "pago",
      invoiceUrl: editForm.invoiceUrl || null,
      doc: editForm.doc || null,
    });
    setEditTarget(null);
  };

  // ── PDF Export com Dashboard ────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!pdfRef.current) return;

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();

    let position = 0;
    while (position < pdfHeight) {
      if (position > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, pdfHeight);
      position += pageHeight;
    }

    const clientName = selectedClientData?.company_name || selectedClientData?.proprietario || "cliente";
    pdf.save(`relatorio-financeiro-${clientName}-${new Date().toISOString().slice(0, 10)}.pdf`);
    setShowPDFPreview(false);
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Cliente não encontrado</h3>
            <Button onClick={() => navigate("/financeiro/financeiro-socios")} className="mt-4">
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
              <h1 className="text-2xl font-bold text-foreground">Relatório de Transações</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name || selectedClientData?.proprietario} •{" "}
                {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/financeiro/financeiro-socios")} size="sm">
              ← Voltar
            </Button>
            <Button
              onClick={() => setShowPDFPreview(true)}
              disabled={!filteredTransactions.length}
              size="sm"
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Pré-visualizar PDF
            </Button>
          </div>
        </div>

        {/* ── Filtros Robustos ───────────────────────────────────────────────── */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Filtros</h3>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                  <X className="h-3 w-3" />
                  Limpar filtros
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  Mês
                </Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {uniqueMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="w-3.5 h-3.5" />
                  Sócio
                </Label>
                <Select value={filterPartner} onValueChange={setFilterPartner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os sócios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os sócios</SelectItem>
                    {uniquePartners.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Tipo
                </Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="deposit">Depósito</SelectItem>
                    <SelectItem value="payment">Pagamento</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="w-3.5 h-3.5" />
                  Categoria
                </Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {EXPENSE_TYPES.find((e) => e.value === c)?.label || c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active filters display */}
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filterMonth !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {uniqueMonths.find((m) => m.value === filterMonth)?.label}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterMonth("all")} />
                  </Badge>
                )}
                {filterPartner !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {filterPartner}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterPartner("all")} />
                  </Badge>
                )}
                {filterType !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {txLabel(filterType)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterType("all")} />
                  </Badge>
                )}
                {filterCategory !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {EXPENSE_TYPES.find((e) => e.value === filterCategory)?.label || filterCategory}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterCategory("all")} />
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Summary Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Entradas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{fmt(summary.totalDeposits)}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Total Saídas</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{fmt(summary.totalExpenses)}</p>
                </div>
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`${summary.saldo >= 0 ? "border-primary/30 bg-primary/5" : "border-red-500/30 bg-red-500/5"}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Saldo Final</p>
                  <p className={`text-2xl font-bold mt-1 ${summary.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmt(summary.saldo)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabela ─────────────────────────────────────────────────────────── */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Transações
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  ({filteredTransactions.length} registro{filteredTransactions.length !== 1 ? "s" : ""})
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma transação encontrada com os filtros selecionados</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      >
                        Data {sortOrder === "asc" ? "↑" : "↓"}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Sócio</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Documento</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Banco</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Prazo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tipo</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Valor</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx, index) => (
                      <tr
                        key={tx.id}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${index % 2 === 0 ? "bg-muted/5" : ""}`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">{tx.date}</td>
                        <td className="px-4 py-3 text-sm text-foreground font-medium">{tx.partner_name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.description}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {tx.doc ? (
                            <span className="bg-muted/50 px-2 py-1 rounded text-xs">{tx.doc}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tx.status ? (
                            <Badge
                              variant="secondary"
                              className={
                                tx.status === "pago" ? "bg-green-500/20 text-green-600 border-green-500/30" :
                                tx.status === "pendente" ? "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" :
                                "bg-red-500/20 text-red-600 border-red-500/30"
                              }
                            >
                              {tx.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.bank_name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.prazo || "—"}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="secondary" className={txBadgeClass(tx.transaction_type)}>
                            {txLabel(tx.transaction_type)}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold text-right ${txAmountColor(tx.transaction_type)}`}>
                          {txSign(tx.transaction_type)} {fmt(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors text-primary"
                              title="Editar"
                              onClick={() => openEdit(tx)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-destructive"
                              title="Excluir"
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

            {/* Resumo calculado automaticamente */}
            {filteredTransactions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total de Depósitos:</span>
                  <span className="text-sm font-semibold text-emerald-600">+{fmt(summary.totalDeposits)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total de Saídas:</span>
                  <span className="text-sm font-semibold text-red-600">-{fmt(summary.totalExpenses)}</span>
                </div>
                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg">
                  <span className="text-sm font-bold text-foreground">Saldo Final:</span>
                  <span className={`text-lg font-bold ${summary.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmt(summary.saldo)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Modal Confirmar Exclusão ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação?
              <br />
              <span className="font-medium text-foreground">{deleteTarget?.description}</span> — {fmt(deleteTarget?.amount || 0)}
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
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Editar Transação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-desc">Descrição</Label>
                <Input
                  id="edit-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-doc">Documento (Nº)</Label>
                <Input
                  id="edit-doc"
                  value={editForm.doc}
                  onChange={(e) => setEditForm((p) => ({ ...p, doc: e.target.value }))}
                  placeholder="Ex: 2025180"
                  className="mt-1"
                />
              </div>
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
                  onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editForm.status || "pago"}
                  onValueChange={(value) => setEditForm((p) => ({ ...p, status: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-paid-date">Data de Pagamento</Label>
                <Input
                  id="edit-paid-date"
                  type="date"
                  value={editForm.paymentDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-due-date">Data de Vencimento</Label>
                <Input
                  id="edit-due-date"
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-bank">Banco</Label>
                <Select
                  value={editForm.bank_name || "none"}
                  onValueChange={(value) => setEditForm((p) => ({ ...p, bank_name: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="bradesco">Bradesco</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="sicoob">Sicoob</SelectItem>
                    <SelectItem value="sicredi">Sicredi</SelectItem>
                    <SelectItem value="itau">Itaú</SelectItem>
                    <SelectItem value="santander">Santander</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-prazo">Tipo de Despesa (Prazo)</Label>
                <Select
                  value={editForm.prazo || "none"}
                  onValueChange={(value) => setEditForm((p) => ({ ...p, prazo: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-invoice-url">URL Nota Fiscal</Label>
              <Input
                id="edit-invoice-url"
                type="url"
                value={editForm.invoiceUrl}
                onChange={(e) => setEditForm((p) => ({ ...p, invoiceUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={updateTransaction.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateTransaction.isPending || !editForm.description || !editForm.amount || !editForm.paymentDate}
            >
              {updateTransaction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Pré-visualização PDF com Dashboard ─────────────────────────── */}
      <Dialog open={showPDFPreview} onOpenChange={setShowPDFPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Pré-visualização do Relatório
            </DialogTitle>
          </DialogHeader>

          {/* PDF Content */}
          <div ref={pdfRef} className="p-8 space-y-6 bg-white text-gray-900 rounded-lg" style={{ fontFamily: "sans-serif" }}>
            {/* Header */}
            <div className="text-center border-b-2 border-gray-200 pb-4">
              <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro - Sócios</h1>
              <p className="text-gray-600 mt-1">
                {selectedClientData?.company_name || selectedClientData?.proprietario}
                {selectedClientData?.cnpj ? ` • CNPJ: ${selectedClientData.cnpj}` : ""}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {activeFiltersLabel} • Gerado em {new Date().toLocaleDateString("pt-BR")} às{" "}
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase">Total Entradas</p>
                <p className="text-xl font-bold text-emerald-800 mt-1">{fmt(summary.totalDeposits)}</p>
              </div>
              <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold text-red-700 uppercase">Total Saídas</p>
                <p className="text-xl font-bold text-red-800 mt-1">{fmt(summary.totalExpenses)}</p>
              </div>
              <div className={`rounded-lg border-2 p-4 ${summary.saldo >= 0 ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"}`}>
                <p className="text-xs font-semibold text-blue-700 uppercase">Saldo Final</p>
                <p className={`text-xl font-bold mt-1 ${summary.saldo >= 0 ? "text-blue-800" : "text-red-800"}`}>
                  {fmt(summary.saldo)}
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Monthly Comparison */}
              {monthlyChartData.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Entradas vs Saídas por Mês</h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                          tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          cursor={{ fill: "#f3f4f6" }}
                          formatter={(value: number) => fmt(value)}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        />
                        <Legend />
                        <Bar name="Entradas" dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                        <Bar name="Saídas" dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Partner Distribution */}
              {partnerPieData.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Distribuição por Sócio</h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={partnerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {partnerPieData.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => fmt(value)}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                        />
                        <Legend verticalAlign="bottom" height={30} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            {categoryBarData.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Saídas por Categoria</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBarData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e5e7eb" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f3f4f6" }}
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Detalhamento ({filteredTransactions.length} transações)
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-600">Data</th>
                    <th className="text-left py-2 font-semibold text-gray-600">Sócio</th>
                    <th className="text-left py-2 font-semibold text-gray-600">Descrição</th>
                    <th className="text-left py-2 font-semibold text-gray-600">Banco</th>
                    <th className="text-left py-2 font-semibold text-gray-600">Prazo</th>
                    <th className="text-left py-2 font-semibold text-gray-600">Tipo</th>
                    <th className="text-right py-2 font-semibold text-gray-600">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.slice(0, 100).map((tx, i) => (
                    <tr key={tx.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50" : ""}`}>
                      <td className="py-1.5 text-gray-700">{tx.date}</td>
                      <td className="py-1.5 text-gray-700">{tx.partner_name}</td>
                      <td className="py-1.5 text-gray-700 max-w-[180px] truncate">{tx.description}</td>
                      <td className="py-1.5 text-gray-500">{tx.bank_name || "—"}</td>
                      <td className="py-1.5 text-gray-500">{tx.prazo || "—"}</td>
                      <td className="py-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            tx.transaction_type === "deposit"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {txLabel(tx.transaction_type)}
                        </span>
                      </td>
                      <td className={`py-1.5 text-right font-semibold ${tx.transaction_type === "deposit" ? "text-emerald-700" : "text-red-700"}`}>
                        {txSign(tx.transaction_type)} {fmt(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={6} className="py-2 font-bold text-gray-800">Saldo Final</td>
                    <td className={`py-2 text-right font-bold text-lg ${summary.saldo >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {fmt(summary.saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPDFPreview(false)}>
              Fechar
            </Button>
            <Button onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
