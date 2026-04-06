import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Edit2,
  Filter,
  X,
  DollarSign,
  Eye,
  ArrowLeft,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Paperclip,
  Search,
  CalendarDays,
  RotateCcw,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import { useClientPartners, type ClientPartner } from "@/hooks/useClientPartners";
import {
  useSocioTransactions,
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/hooks/useFinanceiroSocios";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { exportTableToPDF, createFilenameWithTimestamp } from "@/components/utils/exportToPDF";
import { ExportReportModal } from "@/components/reports/ExportReportModal";
import { MonthlyPartnerReportPDF } from "@/components/reports/MonthlyPartnerReportPDF";
import { useMonthlyPartnerReport } from "@/hooks/useMonthlyPartnerReport";

// Helper functions
function formatCPF(cpf: string) {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "N/A";
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Hook para contas bancárias
function useContasBancarias() {
  return useQuery({
    queryKey: ["contas_bancarias_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, banco, numero_conta, tipo_conta")
        .eq("ativo", true)
        .order("banco");
      if (error) throw error;
      return data || [];
    },
  });
}

// Hook para expense_categories do Supabase
function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, label, icon, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });
}

// Main Component
export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  // State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [editTarget, setEditTarget] = useState<ClientPartner | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    cpf: "",
    percentual_participacao: "",
  });

  // Monthly report state
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showInlineReport, setShowInlineReport] = useState(false);
  const [dateSortOrder, setDateSortOrder] = useState<"asc" | "desc">("desc");

  // Filters state
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterBank, setFilterBank] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTxForm, setEditTxForm] = useState({
    description: "",
    amount: "",
    paymentDate: "",
    notes: "",
    bankName: "",
    prazo: "",
  });

  // State for individual partner view
  const [selectedPartnerCpf, setSelectedPartnerCpf] = useState<string | null>(null);

  // Data hooks
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();
  const {
    data: partners = [],
    isLoading: loadingPartners,
    refetch: refetchPartners,
  } = useClientPartners(clienteId || null);
  const { data: allTransactions = [], isLoading: loadingTransactions } = useSocioTransactions(clienteId || null);
  const { data: contasBancarias = [] } = useContasBancarias();
  const { data: expenseCategories = [] } = useExpenseCategories();

  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  // Monthly partner report data
  const { data: monthlyReportData } = useMonthlyPartnerReport(clienteId || null, filterMonth);

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  // Filter partners by search term
  const filteredPartners = useMemo(() => {
    if (!searchTerm) return partners;
    const term = searchTerm.toLowerCase();
    return partners.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    );
  }, [partners, searchTerm]);

  // Calculate summary stats
  const partnerStats = useMemo(() => {
    const totalPartners = partners.length;
    const totalSharePercentage = partners.reduce(
      (sum, p) => sum + (p.percentual_participacao || 0),
      0
    );
    const averageSharePercentage =
      totalPartners > 0 ? totalSharePercentage / totalPartners : 0;
    return { totalPartners, totalSharePercentage, averageSharePercentage };
  }, [partners]);

  // Get unique values for filters
  const uniqueCategories = useMemo(() => {
    return [
      ...new Set(
        allTransactions
          .map((t: any) => t.expense_type)
          .filter(Boolean)
      ),
    ];
  }, [allTransactions]);

  const uniquePaymentMethods = useMemo(() => {
    return [
      ...new Set(
        allTransactions
          .map((t: any) => t.payment_method)
          .filter(Boolean)
      ),
    ];
  }, [allTransactions]);

  const uniqueBanks = useMemo(() => {
    return [
      ...new Set(
        allTransactions
          .map((t: any) => t.bank_name)
          .filter(Boolean)
      ),
    ];
  }, [allTransactions]);

  // Filter & sort transactions for monthly report
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    // Filter by month
    if (filterMonth) {
      result = result.filter((tx: any) => {
        const date = tx.payment_date || tx.data_vencimento || tx.criado_em;
        try {
          return date?.slice(0, 7) === filterMonth;
        } catch {
          return false;
        }
      });
    }

    // Filter by partner
    if (filterPartner !== "all") {
      result = result.filter((t: any) => t.nome_socio === filterPartner);
    }

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((t: any) => t.transaction_type === filterType);
    }

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((t: any) => {
        const status = t.status || (t.transaction_type === "deposit" ? "pago" : "pendente");
        return status === filterStatus;
      });
    }

    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter((t: any) => t.expense_type === filterCategory);
    }

    // Filter by payment method
    if (filterPaymentMethod !== "all") {
      result = result.filter((t: any) => t.payment_method === filterPaymentMethod);
    }

    // Filter by bank
    if (filterBank !== "all") {
      result = result.filter((t: any) => t.bank_name === filterBank);
    }

    // Filter by search term
    if (filterSearch) {
      const term = filterSearch.toLowerCase();
      result = result.filter(
        (t: any) =>
          t.descricao?.toLowerCase().includes(term) ||
          t.nome_socio?.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term)
      );
    }

    // Sort by date
    result.sort((a: any, b: any) => {
      const dateA = new Date(a.payment_date || a.criado_em).getTime();
      const dateB = new Date(b.payment_date || b.criado_em).getTime();
      return dateSortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [
    allTransactions,
    filterMonth,
    filterPartner,
    filterType,
    filterStatus,
    filterCategory,
    filterPaymentMethod,
    filterBank,
    filterSearch,
    dateSortOrder,
  ]);

  // Summary
  const reportSummary = useMemo(() => {
    const totalEntradas = filteredTransactions
      .filter((t: any) => t.transaction_type === "deposit")
      .reduce((s: number, t: any) => s + Number(t.valor), 0);
    const totalSaidas = filteredTransactions
      .filter((t: any) => t.transaction_type !== "deposit")
      .reduce((s: number, t: any) => s + Number(t.valor), 0);
    return { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas };
  }, [filteredTransactions]);

  // Individual partner transactions
  const partnerTransactions = useMemo(() => {
    if (!selectedPartnerCpf) return [];
    const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
    const normalizedSelectedCpf = normalizeCpf(selectedPartnerCpf);
    return allTransactions.filter(
      (t: any) => normalizeCpf(t.partner_cpf) === normalizedSelectedCpf
    );
  }, [allTransactions, selectedPartnerCpf]);

  const selectedPartnerData = useMemo(() => {
    if (!selectedPartnerCpf) return null;
    const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
    const normalizedSelectedCpf = normalizeCpf(selectedPartnerCpf);
    return partners.find((p) => normalizeCpf(p.cpf) === normalizedSelectedCpf);
  }, [partners, selectedPartnerCpf]);

  // Handlers
  const openEdit = (partner: ClientPartner) => {
    setEditTarget(partner);
    setEditForm({
      nome: partner.nome,
      cpf: partner.cpf,
      percentual_participacao: partner.percentual_participacao?.toString() || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget || !clienteId) return;
    if (!editForm.nome.trim() || !editForm.cpf.trim()) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }
    try {
      const { error } = await supabase
        .from("socios_cliente")
        .update({
          nome: editForm.nome.trim(),
          cpf: editForm.cpf.replace(/\D/g, ""),
          percentual_participacao: editForm.percentual_participacao
            ? parseFloat(editForm.percentual_participacao)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTarget.id)
        .eq("cliente_id", clienteId);

      if (error) throw error;
      toast.success("Sócio atualizado com sucesso!");
      setEditTarget(null);
      refetchPartners();
    } catch (err) {
      console.error("[handleEditSave] Erro:", err);
      toast.error("Erro ao atualizar sócio");
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!clienteId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta transação?")) return;

    await deleteTransaction.mutateAsync({
      id: tx.id,
      clientId: clienteId,
      transactionType: tx.transaction_type,
      partnerCpf: tx.partner_cpf,
      amount: Number(tx.valor),
    });
  };

  const openEditTransaction = (tx: any) => {
    setEditingTransaction(tx);
    setEditTxForm({
      description: tx.descricao || "",
      amount: String(tx.valor || tx.total_amount || ""),
      paymentDate: tx.payment_date || tx.data_vencimento || tx.criado_em?.slice(0, 10) || "",
      notes: tx.notes || "",
      bankName: tx.bank_name || "",
      prazo: tx.prazo || "",
    });
  };

  const handleEditTransactionSave = async () => {
    if (!editingTransaction || !clienteId) return;

    await updateTransaction.mutateAsync({
      id: editingTransaction.id,
      clientId: clienteId,
      transactionType: editingTransaction.transaction_type,
      description: editTxForm.descricao,
      amount: parseFloat(editTxForm.valor),
      paymentDate: editTxForm.paymentDate,
      notes: editTxForm.notes || null,
      bankName: editTxForm.bankName || null,
      prazo: editTxForm.prazo || null,
    });

    setEditingTransaction(null);
  };

  const resetFilters = () => {
    setFilterPartner("all");
    setFilterType("all");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterPaymentMethod("all");
    setFilterBank("all");
    setFilterSearch("");
    setFilterMonth(new Date().toISOString().slice(0, 7));
  };

  const activeFilterCount = [
    filterPartner !== "all",
    filterType !== "all",
    filterStatus !== "all",
    filterCategory !== "all",
    filterPaymentMethod !== "all",
    filterBank !== "all",
  ].filter(Boolean).length;

  // Get type label
  const getTypeLabel = (tx: any) => {
    switch (tx.transaction_type) {
      case "deposit":
        return "Entrada";
      case "expense":
        return "Despesa";
      case "payment":
        return "Pagamento";
      default:
        return tx.transaction_type || "—";
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "deposit":
        return "default";
      case "expense":
        return "destructive";
      case "payment":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getCategoryLabel = (tx: any) => {
    const catId = tx.expense_type || tx.categoria || tx.transaction_subtype;
    if (!catId) return "—";
    const found = expenseCategories.find((c: any) => c.id === catId);
    return found ? `${found.icon || ""} ${found.label}`.trim() : catId;
  };

  // PDF export handler
  const handleExportPDF = async () => {
    try {
      const data = filteredTransactions.map((tx: any) => {
        const txDate = tx.payment_date || tx.data_vencimento || tx.criado_em;
        const status = tx.status || (tx.transaction_type === "deposit" ? "pago" : "pendente");
        return {
          data: formatDate(txDate),
          tipo: getTypeLabel(tx),
          doc: tx.invoice_number || tx.documento || "—",
          descricao: tx.descricao || "—",
          prazo: tx.prazo || "—",
          valor: formatCurrency(Number(tx.valor || tx.total_amount)),
          categoria: getCategoryLabel(tx),
          pagamento: tx.payment_method || "—",
          status: status,
        };
      });

      const columns = [
        { header: "Data", dataKey: "data" },
        { header: "Tipo", dataKey: "tipo" },
        { header: "DOC", dataKey: "documento" },
        { header: "Descrição", dataKey: "descricao" },
        { header: "Prazo", dataKey: "prazo" },
        { header: "Valor", dataKey: "valor" },
        { header: "Categoria", dataKey: "categoria" },
        { header: "Pagamento", dataKey: "pagamento" },
        { header: "Status", dataKey: "status" },
      ];

      const monthLabel = filterMonth
        ? format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR })
        : "Todos";

      await exportTableToPDF(data, columns, {
        filename: createFilenameWithTimestamp("relatorio_socios"),
        title: `Relatório Mensal - ${selectedClientData?.razao_social || selectedClientData?.proprietario} - ${monthLabel}`,
        orientation: "landscape",
      });

      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      toast.error("Erro ao exportar PDF");
    }
  };

  // Month navigation helpers
  const goToPrevMonth = () => {
    const current = new Date(filterMonth + "-01");
    setFilterMonth(format(subMonths(current, 1), "yyyy-MM"));
  };
  const goToNextMonth = () => {
    const current = new Date(filterMonth + "-01");
    setFilterMonth(format(addMonths(current, 1), "yyyy-MM"));
  };

  const getBankLabel = (bankName: string | null) => {
    if (!bankName) return "—";
    const conta = contasBancarias.find(
      (c: any) => c.id === bankName || c.banco?.toLowerCase() === bankName?.toLowerCase()
    );
    return conta ? `${conta.banco} - ${conta.numero_conta || ""}` : bankName;
  };

  // Loading state
  if (loadingClientes) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin">
            <Users className="h-8 w-8 text-primary" />
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

  // --- INDIVIDUAL PARTNER VIEW ---
  if (selectedPartnerCpf && selectedPartnerData) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Transações de {selectedPartnerData.nome}
                </h1>
                <p className="text-sm text-muted-foreground">
                  CPF: {formatCPF(selectedPartnerData.cpf)} •{" "}
                  {selectedPartnerData.percentual_participacao?.toFixed(2)}% de participação
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPartnerCpf(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </div>

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Transações ({partnerTransactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partnerTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transação encontrada para este sócio.
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">Data</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">Tipo</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">Descrição</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-foreground">Status</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerTransactions.map((tx: any, idx: number) => (
                        <tr
                          key={tx.id}
                          className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 0 ? "bg-muted/5" : ""}`}
                        >
                          <td className="px-3 py-3 text-sm text-muted-foreground">
                            {formatDate(tx.payment_date || tx.criado_em)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={getTypeBadgeVariant(tx.transaction_type) as any} className="text-xs">
                              {getTypeLabel(tx)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-sm text-foreground">{tx.descricao}</td>
                          <td className="px-3 py-3 text-center">
                            <Badge variant="secondary" className="text-xs">
                              {tx.transaction_type === "deposit" ? "Recebido" : tx.status === "paid" || tx.status === "pago" ? "Pago" : tx.status ? tx.status.charAt(0).toUpperCase() + tx.status.slice(1).replace(/_/g, ' ') : "—"}
                            </Badge>
                          </td>
                          <td className={`px-3 py-3 text-sm text-right font-mono font-medium ${tx.transaction_type === "deposit" ? "text-emerald-500" : "text-destructive"}`}>
                            {tx.transaction_type === "deposit" ? "+" : "-"}
                            {formatCurrency(Number(tx.valor || tx.total_amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // --- MONTHLY REPORT VIEW ---
  if (showMonthlyReport) {
    return (
      <Layout>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Relatório Mensal Completo
                </h1>
                <p className="text-sm text-muted-foreground">
                  {selectedClientData?.razao_social || selectedClientData?.proprietario}{" "}
                  • {filterMonth
                    ? format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR })
                    : "Todos os meses"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  console.log("Botão clicado! showExportModal será true");
                  setShowExportModal(true);
                }}
                className="gap-1"
              >
                <FileDown className="h-4 w-4" />
                Relatório Completo por Sócio (PDF)
              </Button>
              <Button
                variant={showInlineReport ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowInlineReport(!showInlineReport)}
                className="gap-1"
              >
                <Eye className="h-4 w-4" />
                {showInlineReport ? "Ocultar Relatório" : "Visualizar Relatório"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMonthlyReport(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-emerald-600">
                  Entradas
                </span>
                <span className="text-lg font-bold text-emerald-600">
                  +{formatCurrency(reportSummary.totalEntradas)}
                </span>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-destructive">
                  Saídas
                </span>
                <span className="text-lg font-bold text-destructive">
                  -{formatCurrency(reportSummary.totalSaidas)}
                </span>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-primary">
                  Saldo
                </span>
                <span
                  className={`text-lg font-bold ${reportSummary.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {formatCurrency(reportSummary.saldo)}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar Dribbble-style */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-2">
            
            {/* Esquerda: Controle de Mês Super Limpo */}
            <div className="flex items-center bg-card border border-border/50 rounded-lg p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-muted" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-36 text-center text-sm font-semibold capitalize text-foreground">
                {filterMonth ? format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR }) : "Todos"}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-muted" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Direita: Busca e Botão de Filtros Avançados */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Buscar transação..."
                  className="h-10 pl-9 bg-card border-border/50 shadow-sm transition-all focus-visible:ring-primary/50"
                />
              </div>
              
              <Button
                variant={activeFilterCount > 0 ? "default" : "outline"}
                onClick={() => setIsFiltersModalOpen(true)}
                className="h-10 gap-2 shadow-sm whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className={`ml-1 px-1.5 py-0.5 text-[10px] ${activeFilterCount > 0 ? 'bg-background text-foreground' : ''}`}>
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {(activeFilterCount > 0 || filterSearch) && (
                <Button variant="ghost" size="icon" onClick={resetFilters} title="Limpar filtros" className="h-10 w-10">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  Movimentações
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    ({filteredTransactions.length} registros)
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    Nenhuma movimentação encontrada
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/40">
                        <th
                          className="px-3 py-3 text-left text-xs font-semibold text-foreground cursor-pointer select-none hover:bg-muted/60 transition-colors"
                          onClick={() =>
                            setDateSortOrder((prev) =>
                              prev === "asc" ? "desc" : "asc"
                            )
                          }
                        >
                          <span className="flex items-center gap-1">
                            Data
                            {dateSortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-primary" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-primary" />
                            )}
                          </span>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                          Tipo
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                          DOC
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground min-w-[200px]">
                          Descrição
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                          Prazo
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-foreground">
                          Valor
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                          Categoria
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                          Pagamento
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-foreground">
                          Status
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-foreground">
                          Anexos
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-foreground">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx: any, idx: number) => {
                        const txDate =
                          tx.payment_date || tx.data_vencimento || tx.criado_em;
                        const status =
                          tx.transaction_type === "deposit"
                            ? "recebido"
                            : tx.status || "pendente";
                        const hasAttachment =
                          tx.receipt_url || tx.invoice_url;

                        return (
                          <tr
                            key={tx.id}
                            className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "bg-muted/5" : ""}`}
                          >
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {formatDate(txDate)}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant={getTypeBadgeVariant(tx.transaction_type) as any}
                                className="text-[10px] whitespace-nowrap"
                              >
                                {getTypeLabel(tx)}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                              {tx.invoice_number || tx.documento || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-foreground max-w-[250px] truncate">
                              <span title={tx.descricao}>
                                {tx.descricao || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {tx.prazo ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${tx.prazo === "mensal" ? "border-blue-500/50 text-blue-600" : "border-orange-500/50 text-orange-600"}`}
                                >
                                  {tx.prazo}
                                </Badge>
                              ) : tx.data_vencimento ? (
                                formatDate(tx.data_vencimento)
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-mono font-medium whitespace-nowrap ${tx.transaction_type === "deposit" ? "text-emerald-500" : "text-destructive"}`}
                            >
                              {tx.transaction_type === "deposit"
                                ? "+"
                                : "-"}
                              {formatCurrency(
                                Number(tx.valor || tx.total_amount)
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                              {getCategoryLabel(tx)}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs">
                              {tx.payment_method || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                                  status === "paid" || status === "pago" || status === "recebido"
                                    ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                    : status === "pendente" || status === "pending"
                                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                    : status === "cancelado"
                                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                                    : "bg-muted text-muted-foreground border border-border/50"
                                }`}
                              >
                                {status === "paid" ? "pago"
                                  : status === "pending" ? "pendente"
                                  : status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {hasAttachment ? (
                                <a
                                  href={tx.receipt_url || tx.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80"
                                  title="Ver anexo"
                                >
                                  <Paperclip className="h-4 w-4 inline" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openEditTransaction(tx)}
                                  className="p-1 rounded hover:bg-primary/20 transition-colors text-primary"
                                  title="Editar"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(tx)}
                                  className="p-1 rounded hover:bg-destructive/20 transition-colors text-destructive"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td
                          colSpan={5}
                          className="px-3 py-3 text-sm font-semibold text-foreground"
                        >
                          Total ({filteredTransactions.length} registros)
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-mono font-bold text-primary">
                          {formatCurrency(reportSummary.saldo)}
                        </td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Filtros Avançados */}
          <Dialog open={isFiltersModalOpen} onOpenChange={setIsFiltersModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Filter className="w-5 h-5 text-primary" />
                  Filtros Avançados
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Sócio Envolvido</Label>
                  <SearchableCombobox
                    items={[{ id: "all", label: "Todos" }, ...partners.map((p) => ({ id: p.nome, label: p.nome }))]}
                    value={filterPartner}
                    onChange={(val) => setFilterPartner(val)}
                    placeholder="Selecione o sócio"
                    searchPlaceholder="Buscar sócio..."
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Tipo de Movimentação</Label>
                  <SearchableCombobox
                    items={[
                      { id: "all", label: "Todos" },
                      { id: "deposit", label: "Entrada" },
                      { id: "expense", label: "Despesa" },
                      { id: "payment", label: "Pagamento" },
                    ]}
                    value={filterType}
                    onChange={(val) => setFilterType(val)}
                    placeholder="Selecione o tipo"
                    searchPlaceholder="Buscar tipo..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Status da Transação</Label>
                  <SearchableCombobox
                    items={[
                      { id: "all", label: "Todos" },
                      { id: "pendente", label: "Pendente" },
                      { id: "pago", label: "Pago" },
                      { id: "recebido", label: "Recebido" },
                      { id: "cancelado", label: "Cancelado" },
                    ]}
                    value={filterStatus}
                    onChange={(val) => setFilterStatus(val)}
                    placeholder="Selecione o status"
                    searchPlaceholder="Buscar status..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Categoria</Label>
                  <SearchableCombobox
                    items={[
                      { id: "all", label: "Todas" },
                      ...expenseCategories.map((c: any) => ({
                        id: c.id,
                        label: `${c.icon || ""} ${c.label}`.trim(),
                      })),
                    ]}
                    value={filterCategory}
                    onChange={(val) => setFilterCategory(val)}
                    placeholder="Selecione a categoria"
                    searchPlaceholder="Buscar categoria..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Forma de Pagamento</Label>
                  <SearchableCombobox
                    items={[{ id: "all", label: "Todos" }, ...uniquePaymentMethods.map((pm: any) => ({ id: pm, label: pm }))]}
                    value={filterPaymentMethod}
                    onChange={(val) => setFilterPaymentMethod(val)}
                    placeholder="Selecione o método"
                    searchPlaceholder="Buscar método..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-muted-foreground">Instituição Bancária</Label>
                  <SearchableCombobox
                    items={[
                      { id: "all", label: "Todos" },
                      ...contasBancarias.map((conta: any) => ({
                        id: conta.banco,
                        label: `${conta.banco} - ${conta.numero_conta || conta.tipo_conta}`,
                      })),
                    ]}
                    value={filterBank}
                    onChange={(val) => setFilterBank(val)}
                    placeholder="Selecione o banco"
                    searchPlaceholder="Buscar banco..."
                  />
                </div>
              </div>

              <DialogFooter className="mt-8 flex justify-between sm:justify-between items-center w-full">
                <Button variant="ghost" onClick={resetFilters} className="text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
                <Button onClick={() => setIsFiltersModalOpen(false)}>
                  Ver Resultados ({filteredTransactions.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>

        {/* Edit Transaction Dialog */}
        <Dialog
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                Editar Transação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editTxForm.descricao}
                  onChange={(e) =>
                    setEditTxForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
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
                    value={editTxForm.valor}
                    onChange={(e) =>
                      setEditTxForm((p) => ({
                        ...p,
                        amount: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input
                    type="data"
                    value={editTxForm.paymentDate}
                    onChange={(e) =>
                      setEditTxForm((p) => ({
                        ...p,
                        paymentDate: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Banco / Instituição</Label>
                <Select
                  value={editTxForm.bankName}
                  onValueChange={(v) =>
                    setEditTxForm((p) => ({ ...p, bankName: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((conta: any) => (
                      <SelectItem key={conta.id} value={conta.banco}>
                        {conta.banco} - {conta.numero_conta || conta.tipo_conta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Select
                  value={editTxForm.prazo}
                  onValueChange={(v) =>
                    setEditTxForm((p) => ({ ...p, prazo: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={editTxForm.notes}
                  onChange={(e) =>
                    setEditTxForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="mt-1"
                  placeholder="Notas adicionais..."
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                variant="outline"
                onClick={() => setEditingTransaction(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditTransactionSave}
                disabled={updateTransaction.isPending}
              >
                {updateTransaction.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inline Report Preview */}
        {showInlineReport && monthlyReportData && (
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Relatório Detalhado por Sócio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto max-h-[800px]">
              <div id="partner-report-pdf-content">
                <MonthlyPartnerReportPDF
                  data={monthlyReportData}
                  month={filterMonth}
                  includeCharts={true}
                  includeFlights={true}
                  includeFuels={true}
                  includeExpenses={true}
                  selectedPartnerIds={[]}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Modal */}
        {clienteId && (
          <ExportReportModal
            open={showExportModal}
            onOpenChange={setShowExportModal}
            clientId={clienteId}
            clientName={selectedClientData?.razao_social || selectedClientData?.proprietario || ""}
            defaultMonth={filterMonth}
          />
        )}
      </Layout>
    );
  }

  // --- MAIN VIEW: Partners Table ---
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Sócios e Parceiros
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.razao_social ||
                  selectedClientData?.proprietario}{" "}
                • {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <FileDown className="h-4 w-4" />
              Exportar Relatório PDF
            </Button>
            <Button
              onClick={() => setShowMonthlyReport(true)}
              size="sm"
              className="gap-2"
              variant="outline"
            >
              <FileText className="h-4 w-4" />
              Relatório Mensal Detalhado
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/financeiro/financeiro-socios")}
              size="sm"
            >
              ← Voltar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Total de Sócios
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalPartners}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Percentual Total
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Média por Sócio
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.averageSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">
                Buscar Sócios
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="search" className="text-sm font-medium">
                  Nome ou CPF
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="search"
                    type="text"
                    placeholder="Digite o nome ou CPF do sócio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setSearchTerm("")}
                      title="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {searchTerm && (
                <div className="text-xs text-muted-foreground">
                  Mostrando {filteredPartners.length} de {partners.length} sócios
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Partners Table */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Sócios e Parceiros
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                ({filteredPartners.length} de {partners.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPartners ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm
                    ? "Nenhum sócio encontrado"
                    : "Nenhum sócio cadastrado"}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        CPF
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Percentual
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        Última Atualização
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.map((partner, index) => (
                      <tr
                        key={partner.id}
                        className={`border-b border-border/30 hover:bg-primary/5 transition-colors cursor-pointer ${
                          index % 2 === 0 ? "bg-muted/5" : ""
                        }`}
                        onClick={() => setSelectedPartnerCpf(partner.cpf)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {partner.nome}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {formatCPF(partner.cpf)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {partner.percentual_participacao !== null ? (
                            <Badge
                              variant="secondary"
                              className="bg-primary/20 text-primary border-primary/30"
                            >
                              {partner.percentual_participacao.toFixed(2)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(partner.atualizado_em)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors text-primary"
                              title="Ver Transações"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartnerCpf(partner.cpf);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Partner Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Editar Sócio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.nome}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                className="mt-1"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
                value={editForm.cpf}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, cpf: e.target.value }))
                }
                className="mt-1"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label htmlFor="edit-share">
                Percentual de Participação (%)
              </Label>
              <Input
                id="edit-share"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editForm.percentual_participacao}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    percentual_sociedade: e.target.value,
                  }))
                }
                className="mt-1"
                placeholder="Ex: 50.00"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      {clienteId && (
        <ExportReportModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          clientId={clienteId}
          clientName={selectedClientData?.razao_social || selectedClientData?.proprietario || ""}
          defaultMonth={filterMonth}
        />
      )}
    </Layout>
  );
}
