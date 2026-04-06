import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowLeft,
  Filter,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { format, isSameMonth, parseISO, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import type { PartnerAccount, PartnerTransaction } from "@/hooks/useFinanceiroSocios"
import { DepositForm } from "./DepositForm"
import { ExpenseForm } from "./ExpenseForm"
import { MaintenanceReportDialog } from "./MaintenanceReportDialog"
import { useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(0, 84%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(339, 82%, 51%)",
  "hsl(160, 60%, 45%)",
]

interface SocioDashboardProps {
  clienteId: string
  clienteName: string
  clienteCnpj?: string
  accounts: PartnerAccount[]
  transactions: PartnerTransaction[]
  onBack: () => void
}

export function SocioDashboard({
  clienteId,
  clienteName,
  clienteCnpj,
  accounts,
  transactions,
  onBack,
}: SocioDashboardProps) {
  const navigate = useNavigate()
  const [filterMonth, setFilterMonth] = useState("")
  const [filterDay, setFilterDay] = useState("")
  const [visiblePartners, setVisiblePartners] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"data" | "valor">("data")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [clientAircraftId, setClientAircraftId] = useState<string | null>(null)

  useEffect(() => {
    const fetchAircraft = async () => {
      const { data } = await supabase
        .from("cotistas_aeronave")
        .select("id_aeronave")
        .eq("id_clientes", clienteId)
        .limit(1)
        .single();
      setClientAircraftId(data?.aeronave_id || null);
    };
    if (clienteId) fetchAircraft();
  }, [clienteId]);

  // ========================
  // COMPUTAÇÕES
  // ========================

  // Meses disponíveis
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach((t) => {
      const date = (t as any).payment_date || t.criado_em
      try {
        months.add(format(new Date(date.includes("T") ? date : date + "T12:00:00"), "yyyy-MM"))
      } catch {}
    })
    return [...months].sort().reverse()
  }, [transactions])

  // Partners únicos
  const allPartners = useMemo(
    () => [...new Set(transactions.map((t) => t.nome_socio))].filter(Boolean),
    [transactions]
  )

  // Filtro por mês
  const filteredTransactions = useMemo(() => {
    let result = transactions
    if (filterMonth) {
      const selectedDate = new Date(filterMonth + "-01")
      result = result.filter((t) => {
        const date = (t as any).payment_date || t.criado_em
        try {
          return isSameMonth(
            new Date(date.includes("T") ? date : date + "T12:00:00"),
            selectedDate
          )
        } catch {
          return false
        }
      })
    }
    if (filterDay) {
      const dayNumber = parseInt(filterDay)
      result = result.filter((t) => {
        const date = (t as any).payment_date || t.criado_em
        try {
          return new Date(date.includes("T") ? date : date + "T12:00:00").getDate() === dayNumber
        } catch {
          return false
        }
      })
    }
    if (visiblePartners.length > 0) {
      result = result.filter((t) => visiblePartners.includes(t.nome_socio))
    }
    return result
  }, [transactions, filterMonth, filterDay, visiblePartners])

  // Mês anterior para comparação
  const previousMonthTransactions = useMemo(() => {
    if (!filterMonth) return []
    const currentDate = new Date(filterMonth + "-01")
    const prevDate = subMonths(currentDate, 1)
    return transactions.filter((t) => {
      const date = (t as any).payment_date || t.criado_em
      try {
        return isSameMonth(
          new Date(date.includes("T") ? date : date + "T12:00:00"),
          prevDate
        )
      } catch {
        return false
      }
    })
  }, [transactions, filterMonth])

  // Summary calculator
  const calculateSummary = (list: PartnerTransaction[]) => {
    const totalEntradas = list
      .filter((t) => t.transaction_type === "deposit")
      .reduce((sum, t) => sum + Number(t.valor), 0)
    const totalSaidas = list
      .filter((t) => t.transaction_type !== "deposit")
      .reduce((sum, t) => sum + Number(t.valor), 0)
    return { totalEntradas, totalSaidas, saldo: totalEntradas - totalSaidas }
  }

  const currentSummary = calculateSummary(filteredTransactions)
  const previousSummary = calculateSummary(previousMonthTransactions)

  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  // Dados por sócio (para gráfico)
  const partnerChartData = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {}
    filteredTransactions.forEach((t) => {
      const name = t.nome_socio || "Conta Bancária"
      if (!map[name]) map[name] = { entradas: 0, saidas: 0 }
      if (t.transaction_type === "deposit") map[name].entradas += Number(t.valor)
      else map[name].saidas += Number(t.valor)
    })
    return Object.entries(map).map(([name, v]) => ({ name, ...v }))
  }, [filteredTransactions])

  // Dados por tipo de transação (para pie chart)
  const typeChartData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransactions.forEach((t) => {
      const type =
        t.transaction_type === "deposit"
          ? "Depósito"
          : t.transaction_type === "expense"
          ? "Despesa"
          : "Pagamento"
      map[type] = (map[type] || 0) + Number(t.valor)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filteredTransactions])

  // Ordenação
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (sortBy === "data") {
        const dateA = new Date((a as any).payment_date || a.criado_em).getTime()
        const dateB = new Date((b as any).payment_date || b.criado_em).getTime()
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA
      }
      return sortOrder === "asc"
        ? Number(a.valor) - Number(b.valor)
        : Number(b.valor) - Number(a.valor)
    })
  }, [filteredTransactions, sortBy, sortOrder])

  const getTransactionDate = (tx: any) => {
    const date = tx.payment_date || tx.criado_em
    try {
      return format(new Date(date.includes("T") ? date : date + "T12:00:00"), "dd/MM/yyyy", {
        locale: ptBR,
      })
    } catch {
      return "-"
    }
  }

  // ========================
  // RENDER
  // ========================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel Financeiro</h1>
            <p className="text-sm text-muted-foreground">
              {clienteName}
              {clienteCnpj ? ` • ${clienteCnpj}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todos os dias</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                Dia {String(day).padStart(2, "0")}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <DepositForm accounts={accounts} clienteId={clienteId} />
        <ExpenseForm clienteId={clienteId} />
        <Button
          onClick={() => navigate(`/financeiro/relatorio-mensal/${clienteId}`)}
          className="gap-2"
          size="sm"
        >
          <BarChart3 className="h-4 w-4" />
          Relatório Mensal
        </Button>
        <MaintenanceReportDialog aircraftId={clientAircraftId} clienteId={clienteId} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Entradas"
          value={currentSummary.totalEntradas}
          variation={calculateVariation(
            currentSummary.totalEntradas,
            previousSummary.totalEntradas
          )}
          positive
          showVariation={!!filterMonth}
        />
        <SummaryCard
          title="Saídas"
          value={currentSummary.totalSaidas}
          variation={calculateVariation(currentSummary.totalSaidas, previousSummary.totalSaidas)}
          showVariation={!!filterMonth}
        />
        <SummaryCard
          title="Saldo"
          value={currentSummary.saldo}
          variation={calculateVariation(currentSummary.saldo, previousSummary.saldo)}
          positive={currentSummary.saldo >= 0}
          showVariation={!!filterMonth}
        />
      </div>

      {/* Partner balance cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            // Normalize CPF for comparison
            const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
            const normalizedAccCpf = normalizeCpf(acc.partner_cpf);

            const partnerTxs = filteredTransactions.filter(
              (t) => normalizeCpf(t.partner_cpf) === normalizedAccCpf
            )
            const deposits = partnerTxs
              .filter((t) => t.transaction_type === "deposit")
              .reduce((s, t) => s + Number(t.valor), 0)
            const expenses = partnerTxs
              .filter((t) => t.transaction_type !== "deposit")
              .reduce((s, t) => s + Number(t.valor), 0)
            const balance = deposits - expenses
            return (
              <Card key={acc.id} className="border border-border bg-background">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-foreground">{acc.nome_socio}</h3>
                    <Badge variant="outline" className="text-xs">
                      {acc.partner_cpf}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2">{fmt(balance)}</p>
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-emerald-500">
                      <TrendingUp className="h-3 w-3" />
                      {fmt(deposits)}
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                      <TrendingDown className="h-3 w-3" />
                      {fmt(expenses)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Filtro de sócios */}
      {allPartners.length > 1 && (
        <Card className="border border-border bg-background">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Filtrar por Sócio</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {allPartners.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visiblePartners.includes(p)}
                    onChange={() =>
                      setVisiblePartners((prev) =>
                        prev.includes(p) ? prev.filter((c) => c !== p) : [...prev, p]
                      )
                    }
                    className="rounded border-input"
                  />
                  <span className="text-sm text-foreground">{p}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      {partnerChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart */}
          <Card className="border border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Movimentação por Sócio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={partnerChartData}>
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar
                    dataKey="entradas"
                    name="Entradas"
                    fill="hsl(142, 71%, 45%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="saidas"
                    name="Saídas"
                    fill="hsl(0, 84%, 60%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie chart */}
          <Card className="border border-border bg-background">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {typeChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transações */}
      <Card className="border border-border bg-background">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-sm">Transações ({sortedTransactions.length})</CardTitle>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">Por Data</SelectItem>
                  <SelectItem value="valor">Por Valor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Decrescente</SelectItem>
                  <SelectItem value="asc">Crescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhuma transação encontrada
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                      Data
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground">
                      Descrição
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground">
                      Sócio
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((tx: any) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 text-foreground">{getTransactionDate(tx)}</td>
                      <td className="text-foreground truncate max-w-[200px]">
                        {tx.descricao || "-"}
                      </td>
                      <td className="text-muted-foreground">{tx.nome_socio}</td>
                      <td>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            tx.transaction_type === "deposit"
                              ? "border-emerald-500/30 text-emerald-500"
                              : tx.transaction_type === "expense"
                              ? "border-orange-500/30 text-orange-500"
                              : "border-red-500/30 text-red-500"
                          }`}
                        >
                          {tx.transaction_type === "deposit"
                            ? "Entrada"
                            : tx.transaction_type === "expense"
                            ? (tx.expense_type || "Despesa").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                            : "Saída"}
                        </Badge>
                      </td>
                      <td className="text-center">
                        {tx.transaction_type === "deposit" ? (
                          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
                            Recebido
                          </Badge>
                        ) : tx.status ? (
                          <Badge variant="outline" className={`text-xs ${
                            tx.status === "paid" || tx.status === "pago"
                              ? "border-emerald-500/30 text-emerald-500"
                              : "border-amber-500/30 text-amber-500"
                          }`}>
                            {tx.status === "paid" || tx.status === "pago" ? "Pago" : tx.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td
                        className={`text-right font-semibold ${
                          tx.transaction_type === "deposit" ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {tx.transaction_type === "deposit" ? "+" : "-"}
                        {fmt(Number(tx.valor))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totais */}
              <div className="mt-4 p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Entradas:</span>
                  <span className="font-semibold text-emerald-500">
                    +{fmt(currentSummary.totalEntradas)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Saídas:</span>
                  <span className="font-semibold text-red-500">
                    -{fmt(currentSummary.totalSaidas)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1">
                  <span className="text-foreground">Resultado:</span>
                  <span className={currentSummary.saldo >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {fmt(currentSummary.saldo)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Summary card component
function SummaryCard({
  title,
  value,
  variation,
  positive,
  showVariation,
}: {
  title: string
  value: number
  variation: number
  positive?: boolean
  showVariation: boolean
}) {
  return (
    <Card className="border border-border bg-background">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            positive ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {fmt(value)}
        </p>
        {showVariation && (
          <p className="text-xs text-muted-foreground mt-1">
            {variation > 0 ? "▲" : variation < 0 ? "▼" : "—"}{" "}
            {Math.abs(variation).toFixed(1)}% vs mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  )
}
