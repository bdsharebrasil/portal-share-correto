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
  Search,
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
  const [searchQuery, setSearchQuery] = useState("")
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

  const reportMonth = format(currentMonth, "yyyy-MM")
  const { data: monthlyReportData } = useMonthlyPartnerReport(clienteId || null, reportMonth)

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
    () => [...new Set(transactions.map((t) => t.nome_socio))].filter(Boolean).sort(),
    [transactions]
  )

  const getCategoryFromTx = (t: any): string => {
    const raw = t.transaction_subtype || t.categoria || t.expense_type
    const dbCat = dbCategories.find((c: any) => c.id === raw)
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
    }
    return map[status?.toLowerCase()] || status || "-"
  }

  const getExpenseTypeLabel = (type: string) => {
    return (type || "").toUpperCase()
  }

  const getPaymentMethodLabel = (method: string | null | undefined) => {
    if (!method) return "-"
    const map: Record<string, string> = {
      pix: "PIX",
      ted: "TED",
      boleto: "Boleto",
      cartao: "Cartão",
      dinheiro: "Dinheiro",
      nao_informado: "-",
      outros: "Outros",
    }
    return map[method?.toLowerCase()] || method
  }

  const filteredTransactions = useMemo(() => {
    let result = transactions.filter((t) => {
      const date = (t as any).payment_date || t.criado_em
      try {
        return isSameMonth(new Date(date.includes("T") ? date : date + "T12:00:00"), currentMonth)
      } catch {
        return false
      }
    })

    if (selectedPartners.length > 0) {
      result = result.filter((t) => selectedPartners.includes(t.nome_socio))
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
        const date = (t as any).payment_date || t.criado_em
        try {
          return new Date(date.includes("T") ? date : date + "T12:00:00").getDate() === dayNumber
        } catch {
          return false
        }
      })
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t: any) =>
        (t.descricao || "").toLowerCase().includes(q) ||
        (t.nome_socio || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        (t.documento || "").toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let compareValue = 0
      if (sortBy === 'date') {
        const dateA = new Date((a as any).payment_date || a.criado_em)
        const dateB = new Date((b as any).payment_date || b.criado_em)
        compareValue = dateA.getTime() - dateB.getTime()
      } else if (sortBy === 'partner') {
        compareValue = (a.nome_socio || '').localeCompare(b.nome_socio || '')
      }
      return sortOrder === 'asc' ? compareValue : -compareValue
    })

    return result
  }, [transactions, currentMonth, selectedPartners, selectedCategories, selectedDay, searchQuery, sortBy, sortOrder])

  // ========================
  // COMPUTAÇÕES
  // ========================

  const monthlySummary = useMemo(() => {
    const deposits = filteredTransactions
      .filter((t) => t.transaction_type === "deposit")
      .reduce((sum, t) => sum + Number(t.valor), 0)
    const expenses = filteredTransactions
      .filter((t) => t.transaction_type !== "deposit")
      .reduce((sum, t) => sum + Number(t.valor), 0)
    return { totalDeposits: deposits, totalExpenses: expenses, balance: deposits - expenses }
  }, [filteredTransactions])

  const dailyData = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    return days.map((day) => {
      const dayTransactions = filteredTransactions.filter((t) => {
        const date = (t as any).payment_date || t.criado_em
        try {
          const txDate = new Date(date.includes("T") ? date : date + "T12:00:00")
          return (
            txDate.getDate() === day.getDate() &&
            txDate.getMonth() === day.getMonth() &&
            txDate.getFullYear() === day.getFullYear()
          )
        } catch { return false }
      })
      const deposits = dayTransactions.filter((t) => t.transaction_type === "deposit").reduce((sum, t) => sum + Number(t.valor), 0)
      const expenses = dayTransactions.filter((t) => t.transaction_type !== "deposit").reduce((sum, t) => sum + Number(t.valor), 0)
      return { date: format(day, "dd MMM", { locale: ptBR }), day: day.getDate(), deposits, expenses, balance: deposits - expenses }
    })
  }, [filteredTransactions, currentMonth])

  const isBankAccountTransaction = (t: any) => {
    const name = (t.nome_socio || "").trim().toLowerCase()
    const cpf = (t.partner_cpf || "").trim()
    return (
      name === "conta bancária" || !name || !cpf ||
      cpf === "N/A" || cpf === "00000000000" || cpf.replace(/\D/g, "") === ""
    )
  }

  const partnerData = useMemo(() => {
    const map: Record<string, { deposits: number; expenses: number }> = {}
    filteredTransactions.forEach((t) => {
      if (isBankAccountTransaction(t)) return
      const name = t.nome_socio
      if (!map[name]) map[name] = { deposits: 0, expenses: 0 }
      if (t.transaction_type === "deposit") map[name].deposits += Number(t.valor)
      else map[name].expenses += Number(t.valor)
    })
    return Object.entries(map).map(([name, data]) => ({
      name, deposits: data.deposits, expenses: data.expenses, balance: data.deposits - data.expenses,
    }))
  }, [filteredTransactions])

  const bankAccountData = useMemo(() => {
    let deposits = 0, expenses = 0
    filteredTransactions.forEach((t) => {
      if (isBankAccountTransaction(t)) {
        if (t.transaction_type === "deposit") deposits += Number(t.valor)
        else expenses += Number(t.valor)
      }
    })
    return { deposits, expenses, balance: deposits - expenses }
  }, [filteredTransactions])

  const partnerCardTransactions = useMemo(() => {
    if (!selectedPartnerCard) return []
    if (selectedPartnerCard === "Conta Bancária") return filteredTransactions.filter((t) => isBankAccountTransaction(t))
    return filteredTransactions.filter((t) => t.nome_socio === selectedPartnerCard)
  }, [filteredTransactions, selectedPartnerCard])

  // ========================
  // HELPERS
  // ========================

  const previousMonth = () => {
    setCurrentMonth((m) => {
      const newDate = new Date(m)
      newDate.setMonth(newDate.getMonth() - 1)
      newDate.setDate(15)
      return newDate
    })
  }

  const nextMonth = () => {
    setCurrentMonth((m) => {
      const newDate = new Date(m)
      newDate.setMonth(newDate.getMonth() + 1)
      newDate.setDate(15)
      return newDate
    })
  }

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR })
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  const toggleFuelExpanded = (fuelId: string) => {
    const newSet = new Set(expandedFuels)
    if (newSet.has(fuelId)) newSet.delete(fuelId)
    else newSet.add(fuelId)
    setExpandedFuels(newSet)
  }

  const toggleTravelReportExpanded = (reportId: string) => {
    const newSet = new Set(expandedTravelReports)
    if (newSet.has(reportId)) newSet.delete(reportId)
    else newSet.add(reportId)
    setExpandedTravelReports(newSet)
  }

  // ========================
  // NAVEGAÇÃO
  // ========================

  const handleExpenseTypeClick = async (tx: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tx.tipo_referencia === "abastecimento") {
      try {
        const { data: abastecimento, error } = await supabase
          .from("abastecimentos").select("id, data, local, litros").eq("id", tx.referencia_id).single()
        if (error || !abastecimento) { toast.error("Esse abastecimento não está vinculado a nenhum registro"); return }
        navigate("/abastecimento", { state: { selectedAbastecimentoId: tx.referencia_id, fromRelatorioMensal: true, clienteId, abastecimentoFound: true } })
      } catch (err) { toast.error("Esse abastecimento não está vinculado a nenhum registro") }
    } else if (
      tx.tipo_referencia === "travel_expense_report" ||
      (tx.tipo_referencia === "partner_expense" && tx.expense_type &&
        (tx.expense_type.toLowerCase() === "viagem" || tx.expense_type.toLowerCase() === "despesas de viagem"))
    ) {
      try {
        let travelReportId: string | null = null
        let travelReport: any = null
        if (tx.tipo_referencia === "travel_expense_report" && tx.referencia_id) {
          const { data: report, error: reportError } = await supabase
            .from("travel_expense_reports").select("id, numero_relatorio, data_inicio, client").eq("id", tx.referencia_id).single()
          if (!reportError && report) { travelReportId = tx.referencia_id; travelReport = report }
        }
        if (!travelReport && tx.tipo_referencia === "partner_expense") {
          const { data: expense, error: expError } = await supabase
            .from("partner_expenses").select("id, reference_id, reference_type, description, notes").eq("id", tx.referencia_id).single()
          if (expError || !expense) { toast.error("Essa despesa não foi vinculada a um relatório de viagem"); return }
          if (expense.referencia_id && (expense.tipo_referencia === "travel_expense_report" || expense.tipo_referencia === "travel_report" || expense.tipo_referencia === "viagem")) {
            const { data: report, error: reportError } = await supabase
              .from("travel_expense_reports").select("id, numero_relatorio, data_inicio, client").eq("id", expense.referencia_id).single()
            if (!reportError && report) { travelReportId = expense.referencia_id; travelReport = report }
          }
          if (!travelReport && expense.notes) {
            const reportPattern = /REL-[A-Z]{3}-\d{3}\/\d{2}/g
            const matches = expense.notes.match(reportPattern)
            if (matches && matches.length > 0) {
              const reportNumber = matches[0]
              const { data: reportByNumber, error: searchError } = await supabase
                .from("travel_expense_reports").select("id, numero_relatorio, data_inicio, clientes_id").eq("numero_relatorio", reportNumber).eq("clientes_id", clienteId).single()
              if (!searchError && reportByNumber) {
                travelReportId = reportByNumber.id; travelReport = reportByNumber
                try {
                  await supabase.from("partner_expenses").update({ reference_id: travelReportId, reference_type: "travel_report" }).eq("id", expense.id)
                } catch (updateErr) { console.warn("Não foi possível atualizar despesa:", updateErr) }
              }
            }
          }
        }
        if (!travelReport) { toast.error("Essa despesa não foi vinculada a um relatório de viagem"); return }
        navigate("/financeiro/viagem", { state: { selectedReportId: travelReportId, fromRelatorioMensal: true, clienteId, reportFound: true, reportNumber: travelReport.numero_relatorio } })
      } catch (err) { toast.error("Essa despesa não foi vinculada a um relatório de viagem") }
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
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="border-b border-border pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Button
                  variant="outline" size="sm"
                  onClick={() => navigate(`/financeiro/financeiro-socios`, { state: { selectedClientId: clienteId } })}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold text-foreground">Relatório Mensal</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedClient.razao_social || selectedClient.proprietario}
                {selectedClient.cnpj ? ` • ${selectedClient.cnpj}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="icon" onClick={previousMonth} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[180px] text-center">
                <p className="text-sm font-semibold text-foreground capitalize">{monthLabelCapitalized}</p>
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="gap-2 bg-primary hover:bg-primary/90" size="sm" onClick={() => setShowExportModal(true)}>
                <FileDown className="h-4 w-4" /> Exportar PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/financeiro/centro-custos/${clienteId}`)} className="gap-2">
                <DollarSign className="h-4 w-4" /> Centro de Custos
              </Button>
              <Button variant={showInlineReport ? "secondary" : "outline"} size="sm" onClick={() => setShowInlineReport(!showInlineReport)} className="gap-2">
                <Eye className="h-4 w-4" /> {showInlineReport ? "Ocultar Relatório" : "Relatório Completo"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {allPartners.length > 0 && (
            <Popover open={partnerFilterOpen} onOpenChange={setPartnerFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 rounded-xl border-border/70 gap-2 min-w-[160px] justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedPartners.length === 0 ? "Todos os Sócios" : `${selectedPartners.length} sócio${selectedPartners.length > 1 ? "s" : ""}`}
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
                  <CommandInput placeholder="Buscar sócio..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum sócio encontrado.</CommandEmpty>
                    <CommandGroup>
                      {allPartners.map((partner) => (
                        <CommandItem key={partner} onSelect={() => setSelectedPartners((prev) => prev.includes(partner) ? prev.filter((p) => p !== partner) : [...prev, partner])} className="cursor-pointer">
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedPartners.includes(partner) ? "bg-primary text-primary-foreground" : "opacity-50")}>
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
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8" onClick={() => setSelectedPartners([])}>
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
                <Button variant="outline" className="h-9 rounded-xl border-border/70 gap-2 min-w-[180px] justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedCategories.length === 0 ? "Todas as Categorias" : `${selectedCategories.length} categoria${selectedCategories.length > 1 ? "s" : ""}`}
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
                  <CommandInput placeholder="Buscar categoria..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {allCategories.map((category) => (
                        <CommandItem key={category} onSelect={() => setSelectedCategories((prev) => prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category])} className="cursor-pointer">
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedCategories.includes(category) ? "bg-primary text-primary-foreground" : "opacity-50")}>
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
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8" onClick={() => setSelectedCategories([])}>
                      <X className="h-3 w-3 mr-1" /> Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="h-9 px-3 rounded-xl border border-border/70 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos os dias</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={String(day)}>Dia {String(day).padStart(2, "0")}</option>
              ))}
            </select>
            {selectedDay && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedDay("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Active filter chips */}
          {(selectedPartners.length > 0 || selectedCategories.length > 0 || selectedDay) && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedPartners.map((p) => (
                <Badge key={`p-${p}`} variant="secondary" className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20" onClick={() => setSelectedPartners((prev) => prev.filter((x) => x !== p))}>
                  {p} <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedCategories.map((c) => (
                <Badge key={`c-${c}`} variant="outline" className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20" onClick={() => setSelectedCategories((prev) => prev.filter((x) => x !== c))}>
                  {c} <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedDay && (
                <Badge variant="outline" className="rounded-full gap-1 pr-1 cursor-pointer hover:bg-destructive/20" onClick={() => setSelectedDay("")}>
                  Dia {String(selectedDay).padStart(2, "0")} <X className="h-3 w-3" />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                onClick={() => { setSelectedPartners([]); setSelectedCategories([]); setSelectedDay("") }}>
                Limpar tudo
              </Button>
            </div>
          )}
        </div>

        {/* ── KPI bar com search integrado ── */}
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card">
          {/* Ícone + contagem */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                Transações
              </p>
              <p className="text-2xl font-bold text-foreground leading-none">
                {filteredTransactions.length}
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div className="h-10 w-px bg-border mx-2 shrink-0" />

          {/* Mini resumo rápido */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Entradas </span>
              <span className="font-semibold text-emerald-500">{fmt(monthlySummary.totalDeposits)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Saídas </span>
              <span className="font-semibold text-red-500">{fmt(monthlySummary.totalExpenses)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Saldo </span>
              <span className={cn("font-semibold", monthlySummary.balance >= 0 ? "text-emerald-500" : "text-red-500")}>
                {fmt(monthlySummary.balance)}
              </span>
            </div>
          </div>

          {/* Search — empurrado para a direita */}
          <div className="ml-auto flex items-center gap-2 bg-muted/40 border border-border/60 rounded-xl px-3 py-2 min-w-[240px] max-w-[320px] w-full transition-all focus-within:border-primary/50 focus-within:bg-muted/60">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar transações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="shrink-0">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* ── Resumo por Sócio ── */}
        {partnerData.length > 0 && (
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Resumo por Sócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Conta Bancária */}
                {(bankAccountData.deposits > 0 || bankAccountData.expenses > 0) && (
                  <div
                    className="p-4 rounded-lg border border-amber-200/40 dark:border-amber-800/40 bg-amber-50/10 dark:bg-amber-950/15 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-100/15 cursor-pointer transition-all duration-200 space-y-2"
                    onClick={() => setSelectedPartnerCard("Conta Bancária")}
                  >
                    <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                      <Landmark className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      Conta Bancária
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entradas</span>
                        <span className="font-semibold text-emerald-500">{fmt(bankAccountData.deposits)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saídas</span>
                        <span className="font-semibold text-red-500">{fmt(bankAccountData.expenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/50 pt-1.5">
                        <span className="font-semibold text-foreground">Saldo</span>
                        <span className={cn("font-bold", bankAccountData.balance >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {fmt(bankAccountData.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sócios */}
                {partnerData.map((partner) => (
                  <div
                    key={partner.nome}
                    className="p-4 rounded-lg border border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-muted/25 cursor-pointer transition-all duration-200 space-y-2"
                    onClick={() => setSelectedPartnerCard(partner.nome)}
                  >
                    <h4 className="font-semibold text-foreground text-sm truncate">{partner.nome}</h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entradas</span>
                        <span className="font-semibold text-emerald-500">{fmt(partner.deposits)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saídas</span>
                        <span className="font-semibold text-red-500">{fmt(partner.expenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/50 pt-1.5">
                        <span className="font-semibold text-foreground">Saldo</span>
                        <span className={cn("font-bold", partner.balance >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {fmt(partner.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tabela de Transações ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Cabeçalho do card */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-foreground">Detalhamento de Transações</h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {filteredTransactions.length} registros
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">Nenhuma transação neste período</p>
            </div>
          ) : (
            /*
             * Scroll horizontal com a barra no TOPO:
             * Usamos "transform: rotateX(180deg)" no container e no conteúdo interno
             * para que o scrollbar nativo apareça no topo sem nenhuma biblioteca extra.
             */
            <div
              className="overflow-x-auto"
              style={{ transform: "rotateX(180deg)", WebkitTransform: "rotateX(180deg)" }}
            >
              <div style={{ transform: "rotateX(180deg)", WebkitTransform: "rotateX(180deg)" }}>
                <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-[72px] whitespace-nowrap">
                        Ação
                      </th>
                      <th
                        className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap select-none"
                        onClick={() => {
                          if (sortBy === 'date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                          else { setSortBy('date'); setSortOrder('desc') }
                        }}
                      >
                        Data {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Descrição
                      </th>
                      <th
                        className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap select-none"
                        onClick={() => {
                          if (sortBy === 'partner') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                          else { setSortBy('partner'); setSortOrder('asc') }
                        }}
                      >
                        Sócio {sortBy === 'partner' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Método Pg.</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prazo</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Banco</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Doc</th>
                      <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Obs</th>
                      <th className="text-right py-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx: any, idx) => {
                      const txDate = tx.payment_date || tx.criado_em
                      const formattedDate = format(
                        new Date(txDate.includes("T") ? txDate : txDate + "T12:00:00"),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )
                      const isEven = idx % 2 === 0

                      return (
                        <React.Fragment key={tx.id || idx}>
                          <tr
                            className={cn(
                              "border-b border-border/20 transition-colors cursor-pointer group",
                              isEven ? "bg-muted/5 hover:bg-muted/20" : "hover:bg-muted/15"
                            )}
                            onClick={() => {
                              setEditingTransaction(tx)
                              setIsEditModalOpen(true)
                            }}
                          >
                            {/* Ação */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-0.5">
                                <Button
                                  size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-md opacity-60 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); setEditingTransaction(tx); setIsEditModalOpen(true) }}
                                  title="Editar"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-400" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-md opacity-60 group-hover:opacity-100 transition-opacity"
                                  disabled={deleteTransaction.isPending}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (window.confirm("Tem certeza que deseja excluir este lançamento?")) {
                                      deleteTransaction.mutate({
                                        id: tx.id, clientId: clienteId!,
                                        transactionType: tx.transaction_type,
                                        partnerCpf: tx.partner_cpf || "",
                                        amount: Number(tx.valor),
                                        referenceType: tx.tipo_referencia || undefined,
                                      })
                                    }
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </td>

                            {/* Data */}
                            <td className="py-2.5 px-3 text-foreground text-xs font-medium whitespace-nowrap">
                              {formattedDate}
                            </td>

                            {/* Descrição */}
                            <td className="py-2.5 px-3 text-foreground text-xs max-w-[200px]">
                              <span className="truncate block" title={tx.descricao || ""}>{tx.descricao || "-"}</span>
                            </td>

                            {/* Sócio */}
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {tx.nome_socio || "-"}
                            </td>

                            {/* Tipo */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                {(tx.tipo_referencia === "abastecimento" || tx.tipo_referencia === "travel_expense_report") && (
                                  <Button
                                    size="sm" variant="ghost" className="h-5 w-5 p-0 rounded"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (tx.tipo_referencia === "abastecimento") toggleFuelExpanded(tx.referencia_id)
                                      else if (tx.tipo_referencia === "travel_expense_report") toggleTravelReportExpanded(tx.referencia_id)
                                    }}
                                  >
                                    {(tx.tipo_referencia === "abastecimento" && expandedFuels.has(tx.referencia_id)) ||
                                      (tx.tipo_referencia === "travel_expense_report" && expandedTravelReports.has(tx.referencia_id)) ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </Button>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap",
                                    tx.transaction_type === "deposit"
                                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                      : tx.transaction_type === "expense"
                                        ? "border-orange-500/30 text-orange-500 bg-orange-500/5"
                                        : "border-red-500/30 text-red-500 bg-red-500/5"
                                  )}
                                  onClick={(e) => void handleExpenseTypeClick(tx, e)}
                                >
                                  {tx.expense_type
                                    ? getExpenseTypeLabel(tx.expense_type)
                                    : tx.transaction_type === "deposit" ? "ENTRADA"
                                      : tx.transaction_type === "expense" ? "DESPESA" : "SAÍDA"}
                                </Badge>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 whitespace-nowrap",
                                  (tx.status === "pago" || tx.status === "paid") ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                    : (tx.status === "recebido" || tx.status === "received") ? "border-blue-500/30 text-blue-500 bg-blue-500/5"
                                      : tx.status === "cancelado" ? "border-red-500/30 text-red-500 bg-red-500/5"
                                        : "border-amber-500/30 text-amber-500 bg-amber-500/5"
                                )}
                              >
                                {getStatusLabel(tx.status)}
                              </Badge>
                            </td>

                            {/* Método */}
                            <td className="py-2.5 px-3 text-foreground text-xs whitespace-nowrap">
                              {getPaymentMethodLabel(tx.payment_method)}
                            </td>

                            {/* Prazo */}
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {tx.prazo || "-"}
                            </td>

                            {/* Banco */}
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {tx.bank_name || "-"}
                            </td>

                            {/* Doc */}
                            <td className="py-2.5 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {tx.documento || "-"}
                            </td>

                            {/* Obs */}
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px]">
                              <span className="truncate block" title={tx.notes || ""}>{tx.notes || "-"}</span>
                            </td>

                            {/* Valor */}
                            <td className={cn(
                              "text-right py-2.5 px-3 font-bold text-sm whitespace-nowrap",
                              tx.transaction_type === "deposit" ? "text-emerald-500" : "text-red-500"
                            )}>
                              {tx.transaction_type === "deposit" ? "+" : "-"}{fmt(Number(tx.valor))}
                            </td>
                          </tr>

                          {/* Expansão: Abastecimento */}
                          {tx.tipo_referencia === "abastecimento" && expandedFuels.has(tx.referencia_id) && (
                            <tr className={isEven ? "bg-blue-950/20" : "bg-blue-900/20"}>
                              <td colSpan={12} className="py-4 px-5">
                                <div className="bg-blue-950/30 rounded-lg p-4 border border-blue-500/20">
                                  <h5 className="text-xs font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                    <ChevronDown className="h-3.5 w-3.5" /> Detalhes do Abastecimento
                                  </h5>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {[
                                      { label: "Comanda", value: tx.comanda },
                                      { label: "NF", value: tx.nf },
                                      { label: "Trecho", value: tx.trecho },
                                      { label: "Litros", value: typeof tx.litros === 'number' ? tx.litros.toFixed(2) : null },
                                      { label: "Local", value: tx.local },
                                      { label: "Abastecedor", value: tx.abastecedor },
                                      { label: "Galões", value: typeof tx.abastecimento_galoes === 'number' ? tx.abastecimento_galoes.toFixed(2) : null },
                                      { label: "Observação", value: tx.observacao },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="space-y-0.5">
                                        <p className="text-muted-foreground font-medium">{label}</p>
                                        <p className="text-foreground">{value || "-"}</p>
                                      </div>
                                    ))}
                                  </div>
                                  {(tx.comanda_url || tx.nota_url || tx.boleto_url || tx.comprovante_pagamento) && (
                                    <div className="mt-3 pt-3 border-t border-blue-500/20 flex flex-wrap gap-2">
                                      {[
                                        { url: tx.comanda_url, label: "Comanda" },
                                        { url: tx.nota_url, label: "NF" },
                                        { url: tx.boleto_url, label: "Boleto" },
                                        { url: tx.comprovante_pagamento, label: "Comprovante" },
                                      ].filter(a => a.url).map(({ url, label }) => (
                                        <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-md transition-colors text-xs font-medium">
                                          <FileDown className="h-3 w-3" /> {label}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Expansão: Viagem */}
                          {tx.tipo_referencia === "travel_expense_report" && expandedTravelReports.has(tx.referencia_id) && (
                            <tr className={isEven ? "bg-purple-950/20" : "bg-purple-900/20"}>
                              <td colSpan={12} className="py-4 px-5">
                                <div className="bg-purple-950/30 rounded-lg p-4 border border-purple-500/20">
                                  <h5 className="text-xs font-semibold text-purple-400 mb-4 flex items-center gap-2">
                                    <ChevronDown className="h-3.5 w-3.5" /> Detalhes do Relatório de Viagem
                                  </h5>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                                    {[
                                      { label: "Relatório", value: tx.numero_relatorio },
                                      { label: "Rota", value: tx.rota },
                                      { label: "Período", value: tx.data_inicio && tx.data_fim ? `${format(new Date(tx.data_inicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(tx.data_fim), "dd/MM/yyyy", { locale: ptBR })}` : null },
                                      { label: "Dias", value: tx.dias_count },
                                      { label: "Tripulação 1", value: tx.crew_member_name },
                                      { label: "Tripulação 2", value: tx.crew_member_name2 },
                                      { label: "Status", value: getStatusLabel(tx.status) },
                                      { label: "Observação", value: tx.observacoes },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="space-y-0.5">
                                        <p className="text-muted-foreground font-medium">{label}</p>
                                        <p className="text-foreground truncate" title={String(value || "")}>{value || "-"}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-purple-500/10 rounded-lg">
                                    {[
                                      { title: "Crew", total: tx.total_crew, spent: tx.spent_crew, remaining: tx.remaining_crew },
                                      { title: "Share Brasil", total: tx.total_sharebrasil, spent: tx.spent_sharebrasil, remaining: tx.remaining_sharebrasil },
                                    ].map(({ title, total, spent, remaining }) => (
                                      <div key={title} className="space-y-1.5 text-xs">
                                        <p className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{title}</p>
                                        <div className="space-y-1">
                                          <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold text-purple-400">{fmt(total || 0)}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Despendido</span><span className="font-semibold text-red-400">{fmt(spent || 0)}</span></div>
                                          <div className="flex justify-between border-t border-purple-500/20 pt-1"><span className="text-muted-foreground">Pendente</span><span className={cn("font-semibold", (remaining || 0) > 0 ? "text-amber-400" : "text-emerald-400")}>{fmt(remaining || 0)}</span></div>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="space-y-1.5 text-xs">
                                      <p className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Cliente</p>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold text-blue-400">{fmt(tx.total_client || 0)}</span></div>
                                      <p className="text-muted-foreground text-[10px] pt-1">Não contabilizado</p>
                                    </div>
                                  </div>
                                  {tx.url_pdf && (
                                    <div className="pt-3 border-t border-purple-500/20">
                                      <a href={tx.url_pdf} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-md transition-colors text-xs font-medium">
                                        <FileDown className="h-3.5 w-3.5" /> Baixar PDF do Relatório
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Gráficos ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Movimentação Diária</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="deposits" stroke="hsl(142, 71%, 45%)" fillOpacity={1} fill="url(#colorDeposits)" name="Entradas" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(0, 84%, 60%)" fillOpacity={1} fill="url(#colorExpenses)" name="Saídas" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Saldo por Sócio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={
                  (bankAccountData.deposits > 0 || bankAccountData.expenses > 0)
                    ? [{ name: "Conta Bancária", deposits: bankAccountData.deposits, expenses: bankAccountData.expenses }, ...partnerData]
                    : partnerData
                }>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="deposits" name="Entradas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Saídas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Relatório Completo Inline ── */}
      {showInlineReport && monthlyReportData && (
        <Card className="border border-border bg-card mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Relatório Completo por Sócio — {monthLabelCapitalized}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto max-h-[800px] bg-white">
            <div id="partner-report-pdf-content-inline" className="text-gray-900">
              <MonthlyPartnerReportPDF
                data={monthlyReportData}
                month={reportMonth}
                includeCharts={true}
                includeFlights={true}
                includeFuels={true}
                includeExpenses={true}
                selectedPartnerIds={[]}
                isInlinePreview={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Export Modal ── */}
      {clienteId && (
        <ExportReportModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          clientId={clienteId}
          clientName={selectedClient?.razao_social || selectedClient?.proprietario || ""}
          defaultMonth={reportMonth}
        />
      )}

      {/* ── Modal de Edição ── */}
      <TransactionEditModal
        transaction={editingTransaction}
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null) }}
        clientId={clienteId || ""}
      />

      {/* ── Dialog: transações do sócio selecionado ── */}
      <Dialog open={!!selectedPartnerCard} onOpenChange={(open) => !open && setSelectedPartnerCard(null)}>
        <DialogContent className="max-w-[95vw] min-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              Transações — {selectedPartnerCard}
            </DialogTitle>
          </DialogHeader>

          {partnerCardTransactions.length > 0 && (
            <div className="px-6 py-3 border-b border-border bg-background grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
              {[
                { label: "Total Entradas", value: fmt(partnerCardTransactions.filter((t: any) => t.transaction_type === "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)), color: "text-emerald-500" },
                { label: "Total Saídas", value: fmt(partnerCardTransactions.filter((t: any) => t.transaction_type !== "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)), color: "text-red-500" },
                {
                  label: "Saldo", color: (() => {
                    const d = partnerCardTransactions.filter((t: any) => t.transaction_type === "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)
                    const e = partnerCardTransactions.filter((t: any) => t.transaction_type !== "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)
                    return d - e >= 0 ? "text-emerald-500" : "text-red-500"
                  })(),
                  value: fmt((() => {
                    const d = partnerCardTransactions.filter((t: any) => t.transaction_type === "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)
                    const e = partnerCardTransactions.filter((t: any) => t.transaction_type !== "deposit").reduce((s: number, t: any) => s + Number(t.valor), 0)
                    return d - e
                  })())
                },
                { label: "Transações", value: String(partnerCardTransactions.length), color: "text-primary" },
              ].map(({ label, value, color }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className={cn("text-lg font-bold leading-none", color)}>{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {partnerCardTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-16 text-sm">Nenhuma transação encontrada.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10 border-b border-border">
                  <tr>
                    {["Data", "Descrição", "Tipo", "Status", "Método", "Obs", "Valor"].map((h) => (
                      <th key={h} className={cn("py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", h === "Valor" ? "text-right" : "text-left")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnerCardTransactions.map((tx: any, idx) => {
                    const txDate = tx.payment_date || tx.criado_em
                    const formattedDate = format(new Date(txDate.includes("T") ? txDate : txDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                    return (
                      <tr
                        key={tx.id || idx}
                        className={cn(
                          "border-b border-border/20 transition-colors cursor-pointer",
                          idx % 2 === 0 ? "bg-muted/5 hover:bg-muted/20" : "hover:bg-muted/15"
                        )}
                        onClick={() => { setSelectedPartnerCard(null); setEditingTransaction(tx); setIsEditModalOpen(true) }}
                      >
                        <td className="py-2.5 px-4 text-xs font-medium text-foreground whitespace-nowrap">{formattedDate}</td>
                        <td className="py-2.5 px-4 text-xs text-foreground max-w-[220px]">
                          <span className="truncate block" title={tx.descricao}>{tx.descricao || "-"}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap",
                            tx.transaction_type === "deposit" ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : "border-red-500/30 text-red-500 bg-red-500/5")}>
                            {tx.transaction_type === "deposit" ? "ENTRADA" : "SAÍDA"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap",
                            (tx.status === "pago" || tx.status === "paid") ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                              : (tx.status === "recebido" || tx.status === "received") ? "border-blue-500/30 text-blue-500 bg-blue-500/5"
                                : tx.status === "cancelado" ? "border-red-500/30 text-red-500 bg-red-500/5"
                                  : "border-amber-500/30 text-amber-500 bg-amber-500/5")}>
                            {getStatusLabel(tx.status)}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-foreground whitespace-nowrap">{getPaymentMethodLabel(tx.payment_method)}</td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground max-w-[180px]">
                          <span className="truncate block" title={tx.notes}>{tx.notes || "-"}</span>
                        </td>
                        <td className={cn("text-right py-2.5 px-4 font-bold text-sm whitespace-nowrap",
                          tx.transaction_type === "deposit" ? "text-emerald-500" : "text-red-500")}>
                          {tx.transaction_type === "deposit" ? "+" : "-"}{fmt(Number(tx.valor))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}