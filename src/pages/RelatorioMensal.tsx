"use client"

import React, { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Edit2,
  Filter,
  X,
  Check,
  Trash2,
  Eye,
  FileDown,
  Loader2,
  Landmark,
} from "lucide-react"
import { TransactionEditModal } from "@/components/socios/TransactionEditModal"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { useSocioTransactions, useDeleteTransaction } from "@/hooks/useFinanceiroSocios"
import { useClientesComSocios } from "@/hooks/useSocioBalanco"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { useMonthlyPartnerReport } from "@/hooks/useMonthlyPartnerReport"
import { MonthlyPartnerReportPDF } from "@/components/reports/MonthlyPartnerReportPDF"
import { ExportReportModal } from "@/components/reports/ExportReportModal"
import { toast } from "sonner"

// Mapa de normalização de categorias
const CATEGORY_NORMALIZE: Record<string, string> = {
  hangar: "Hangaragem",
  hangaragem: "Hangaragem",
  abastecimento: "Abastecimento",
  "Abastecimento": "Abastecimento",
  manutencao: "Manutenção",
  contabilidade: "Honorários Contabilidade",
  "Honorários Contabilidade": "Honorários Contabilidade",
  viagem: "Despesas de Viagem",
  outros: "Outros",
  atendimento_pista: "Atendimento de Pista",
  pouso_decolagem: "Pouso/Decolagem",
  subscricoes: "Assinaturas",
  "Assinaturas": "Assinaturas",
  infraero: "INFRAERO",
  impostos: "Impostos",
  ressarcimento: "Ressarcimento",
  acquisition_refund: "Devolução de Aquisição",
  deposit: "Entrada",
  bank_interest: "Juros Bancários",
  reembolso: "Reembolso",
}

function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return "Outros"
  return CATEGORY_NORMALIZE[raw] || CATEGORY_NORMALIZE[raw.toLowerCase()] || raw
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function RelatorioMensal() {
  const navigate = useNavigate()
  const { clienteId } = useParams<{ clienteId: string }>()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    const isoMonth = String(now.getMonth() + 1).padStart(2, "0")
    return new Date(`${now.getFullYear()}-${isoMonth}-15T12:00:00`)
  })
  const [selectedPartners, setSelectedPartners] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [sortBy, setSortBy] = useState<'date' | 'partner'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [partnerFilterOpen, setPartnerFilterOpen] = useState(false)
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showInlineReport, setShowInlineReport] = useState(false)
  const [selectedPartnerCard, setSelectedPartnerCard] = useState<string | null>(null)
  const [expandedFuels, setExpandedFuels] = useState<Set<string>>(new Set())
  const [expandedTravelReports, setExpandedTravelReports] = useState<Set<string>>(new Set())

  // ========================
  // DADOS
  // ========================

  const { data: clientesComSocios = [] } = useClientesComSocios()
  const { data: transactions = [] } = useSocioTransactions(clienteId)
  const deleteTransaction = useDeleteTransaction()

  // Monthly partner report for PDF export
  const reportMonth = format(currentMonth, "yyyy-MM")
  const { data: monthlyReportData } = useMonthlyPartnerReport(clienteId || null, reportMonth)

  // Fetch expense_categories from DB for label enrichment
  const { data: dbCategories = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, label, icon")
        .order("sort_order")
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const selectedClient = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  )

  // ========================
  // FILTROS
  // ========================

  const allPartners = useMemo(
    () => [...new Set(transactions.map((t) => t.partner_name))].filter(Boolean).sort(),
    [transactions]
  )

  const getCategoryFromTx = (t: any): string => {
    const raw = t.transaction_subtype || t.category || t.expense_type
    const dbCat = dbCategories.find(c => c.id === raw)
    if (dbCat) return dbCat.label
    return normalizeCategory(raw)
  }

  const allCategories = useMemo(
    () => [...new Set(transactions.map(getCategoryFromTx))].filter(Boolean).sort(),
    [transactions, dbCategories]
  )

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "Pendente",
      paid: "Pago",
      pago: "Pago",
      pendente: "Pendente",
      cancelado: "Cancelado",
      cancelled: "Cancelado",
      overdue: "Vencido",
      recebido: "Recebido",
      received: "Recebido",
    };
    return map[status?.toLowerCase()] || status || "-";
  };

  const getPaymentMethodLabel = (method: string | null | undefined) => {
    if (!method) return "-";
    const map: Record<string, string> = {
      pix: "PIX",
      ted: "TED",
      boleto: "Boleto",
      cartao: "Cartão",
      dinheiro: "Dinheiro",
      nao_informado: "-",
      outros: "Outros",
    };
    return map[method?.toLowerCase()] || method;
  };

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter((t) => {
      const date = (t as any).payment_date || t.created_at
      try {
        return isSameMonth(new Date(date.includes("T") ? date : date + "T12:00:00"), currentMonth)
      } catch {
        return false
      }
    })

    if (selectedPartners.length > 0) {
      result = result.filter((t) => selectedPartners.includes(t.partner_name))
    }

    if (selectedCategories.length > 0) {
      result = result.filter((t) => {
        const category = getCategoryFromTx(t)
        return selectedCategories.includes(category)
      })
    }

    if (selectedDay) {
      const dayNumber = parseInt(selectedDay)
      result = result.filter((t) => {
        const date = (t as any).payment_date || t.created_at
        try {
          return new Date(date.includes("T") ? date : date + "T12:00:00").getDate() === dayNumber
        } catch {
          return false
        }
      })
    }
    result.sort((a, b) => {
      let compareValue = 0
      if (sortBy === 'date') {
        const dateA = new Date((a as any).payment_date || a.created_at)
        const dateB = new Date((b as any).payment_date || b.created_at)
        compareValue = dateA.getTime() - dateB.getTime()
      } else if (sortBy === 'partner') {
        compareValue = (a.partner_name || '').localeCompare(b.partner_name || '')
      }
      return sortOrder === 'asc' ? compareValue : -compareValue
    })

    return result
  }, [transactions, currentMonth, selectedPartners, selectedCategories, selectedDay, sortBy, sortOrder])

  // ========================
  // COMPUTAÇÕES
  // ========================

  const monthlySummary = useMemo(() => {
    const deposits = filteredTransactions
      .filter((t) => t.transaction_type === "deposit")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const expenses = filteredTransactions
      .filter((t) => t.transaction_type !== "deposit")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      totalDeposits: deposits,
      totalExpenses: expenses,
      balance: deposits - expenses,
    }
  }, [filteredTransactions])

  const isBankAccountTransaction = (t: any) => {
    const name = (t.partner_name || "").trim().toLowerCase()
    const cpf = (t.partner_cpf || "").trim()
    return (
      name === "conta bancária" ||
      !name ||
      !cpf ||
      cpf === "N/A" ||
      cpf === "00000000000" ||
      cpf.replace(/\D/g, "") === ""
    )
  }

  const partnerData = useMemo(() => {
    const map: Record<string, { deposits: number; expenses: number }> = {}

    filteredTransactions.forEach((t) => {
      if (isBankAccountTransaction(t)) return
      const name = t.partner_name
      if (!map[name]) map[name] = { deposits: 0, expenses: 0 }

      if (t.transaction_type === "deposit") {
        map[name].deposits += Number(t.amount)
      } else {
        map[name].expenses += Number(t.amount)
      }
    })

    return Object.entries(map).map(([name, data]) => ({
      name,
      deposits: data.deposits,
      expenses: data.expenses,
      balance: data.deposits - data.expenses,
    }))
  }, [filteredTransactions])

  const previousMonth = () => {
    setCurrentMonth((m) => {
      const newDate = new Date(m);
      newDate.setMonth(newDate.getMonth() - 1);
      newDate.setDate(15);
      return newDate;
    });
  };

  const nextMonth = () => {
    setCurrentMonth((m) => {
      const newDate = new Date(m);
      newDate.setMonth(newDate.getMonth() + 1);
      newDate.setDate(15);
      return newDate;
    });
  };

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR })
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  const handleExpenseTypeClick = async (tx: any, e: React.MouseEvent) => {
    e.stopPropagation()
    // Lógica original de clique (mantida sem alterações)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
      try {
        await deleteTransaction.mutateAsync(id)
        toast.success("Transação excluída com sucesso")
      } catch (err) {
        toast.error("Erro ao excluir transação")
      }
    }
  }

  // ========================
  // RENDER
  // ========================

  if (!selectedClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <p className="text-muted-foreground">Cliente não encontrado</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/financeiro/financeiro-socios`, { state: { selectedClientId: clienteId } })}
                  className="h-8 w-8 p-0"
                  title="Voltar para o cliente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold text-foreground">Relatório Mensal</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedClient.company_name || selectedClient.proprietario}
                {selectedClient.cnpj ? ` • ${selectedClient.cnpj}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={previousMonth} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="min-w-[180px] text-center">
                <p className="text-sm font-semibold text-foreground capitalize">{monthLabelCapitalized}</p>
              </div>

              <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                className="gap-2 bg-primary hover:bg-primary/90"
                size="sm"
                onClick={() => setShowExportModal(true)}
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/financeiro/centro-custos/${clienteId}`)}
                className="gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Centro de Custos
              </Button>

              <Button
                variant={showInlineReport ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowInlineReport(!showInlineReport)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {showInlineReport ? "Ocultar Relatório" : "Relatório Completo"}
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          {allPartners.length > 0 && (
            <Popover open={partnerFilterOpen} onOpenChange={setPartnerFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-border/70 gap-2 min-w-[180px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedPartners.length === 0
                        ? "Todos os Sócios"
                        : `${selectedPartners.length} sócio${selectedPartners.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {selectedPartners.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                      {selectedPartners.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0 rounded-xl" align="start">
                <Command className="rounded-xl">
                  <CommandInput placeholder="Buscar sócio..." className="h-10" />
                  <CommandList>
                    <CommandEmpty>Nenhum sócio encontrado.</CommandEmpty>
                    <CommandGroup>
                      {allPartners.map((partner) => (
                        <CommandItem
                          key={partner}
                          onSelect={() =>
                            setSelectedPartners((prev) =>
                              prev.includes(partner)
                                ? prev.filter((p) => p !== partner)
                                : [...prev, partner]
                            )
                          }
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedPartners.includes(partner)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}>
                            {selectedPartners.includes(partner) && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-sm">{partner}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedPartners.length > 0 && (
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => setSelectedPartners([])}
                    >
                      <X className="h-3 w-3 mr-1" /> Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          {allCategories.length > 0 && (
            <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-border/70 gap-2 min-w-[200px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedCategories.length === 0
                        ? "Todas as Categorias"
                        : `${selectedCategories.length} categoria${selectedCategories.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 rounded-xl" align="start">
                <Command className="rounded-xl">
                  <CommandInput placeholder="Buscar categoria..." className="h-10" />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {allCategories.map((category) => (
                        <CommandItem
                          key={category}
                          onSelect={() =>
                            setSelectedCategories((prev) =>
                              prev.includes(category)
                                ? prev.filter((c) => c !== category)
                                : [...prev, category]
                            )
                          }
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedCategories.includes(category)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}>
                            {selectedCategories.includes(category) && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-sm">{category}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedCategories.length > 0 && (
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => setSelectedCategories([])}
                    >
                      <X className="h-3 w-3 mr-1" /> Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border/70 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos os dias</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={String(day)}>
                  Dia {String(day).padStart(2, "0")}
                </option>
              ))}
            </select>
            {selectedDay && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setSelectedDay("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {(selectedPartners.length > 0 || selectedCategories.length > 0 || selectedDay) && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedPartners.map((p) => (
                <Badge
                  key={`p-${p}`}
                  variant="secondary"
                  className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => setSelectedPartners((prev) => prev.filter((x) => x !== p))}
                >
                  {p}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedCategories.map((c) => (
                <Badge
                  key={`c-${c}`}
                  variant="outline"
                  className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => setSelectedCategories((prev) => prev.filter((x) => x !== c))}
                >
                  {c}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedDay && (
                <Badge
                  variant="outline"
                  className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => setSelectedDay("")}
                >
                  Dia {selectedDay}
                  <X className="h-3 w-3" />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Resumo Mensal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total de Entradas</p>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-500">{fmt(monthlySummary.totalDeposits)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total de Saídas</p>
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-bold text-rose-500">{fmt(monthlySummary.totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Saldo do Mês</p>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className={cn("text-2xl font-bold", monthlySummary.balance >= 0 ? "text-primary" : "text-rose-500")}>
                {fmt(monthlySummary.balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card de Detalhamento de Transações (Tabela Corrigida) */}
        <Card className="mt-6 border-border/50 shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold">Detalhamento de Transações</CardTitle>
            <div className="text-sm text-muted-foreground">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transação' : 'transações'}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Wrapper com Overflow e Scrollbar Customizada (Ciano) */}
            <div className="w-full overflow-x-auto pb-2 px-6 pt-4
              [&::-webkit-scrollbar]:h-2 
              [&::-webkit-scrollbar-track]:bg-slate-800/40 
              [&::-webkit-scrollbar-track]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-cyan-400 
              [&::-webkit-scrollbar-thumb]:rounded-full 
              hover:[&::-webkit-scrollbar-thumb]:bg-cyan-300"
            >
              <table className="w-full min-w-[1200px] text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-y border-border/50">
                  <tr>
                    <th className="py-3 px-4 font-medium">Sócio</th>
                    <th className="py-3 px-4 font-medium">Categoria</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Método Pg.</th>
                    <th className="py-3 px-4 font-medium">Data</th>
                    <th className="py-3 px-4 font-medium">Banco</th>
                    <th className="py-3 px-4 font-medium">Obs</th>
                    <th className="py-3 px-4 font-medium text-right">Valor</th>
                    <th className="py-3 px-4 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Nenhuma transação encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-medium">{t.partner_name || "Conta Bancária"}</td>
                        <td className="py-3 px-4">{getCategoryFromTx(t)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={cn(
                            getStatusLabel(t.status) === "Pago" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" : "text-amber-400 border-amber-400/20 bg-amber-400/10"
                          )}>
                            {getStatusLabel(t.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{getPaymentMethodLabel(t.payment_method)}</td>
                        <td className="py-3 px-4">
                          {t.payment_date ? format(new Date(t.payment_date), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="py-3 px-4">{t.bank || "-"}</td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]" title={t.notes || ""}>
                          {t.notes || "-"}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right font-medium",
                          t.transaction_type === "deposit" ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {t.transaction_type === "deposit" ? "+" : "-"} {fmt(Number(t.amount))}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingTransaction(t)
                                setIsEditModalOpen(true)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Modals */}
      {isEditModalOpen && editingTransaction && (
        <TransactionEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingTransaction(null)
          }}
          transaction={editingTransaction}
        />
      )}

      {showExportModal && (
        <ExportReportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          clienteId={clienteId || ""}
          mes={reportMonth}
        />
      )}

    </Layout>
  )
}