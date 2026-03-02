"use client"

import React, { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Layout } from "@/components/layout/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
} from "lucide-react"
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
  subMonths,
  addMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { useSocioTransactions } from "@/hooks/useFinanceiroSocios"
import { useClientesComSocios } from "@/hooks/useSocioBalanco"

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function RelatorioMensal() {
  const navigate = useNavigate()
  const { clienteId } = useParams<{ clienteId: string }>()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedPartners, setSelectedPartners] = useState<string[]>([])

  // ========================
  // DADOS
  // ========================

  const { data: clientesComSocios = [] } = useClientesComSocios()
  const { data: transactions = [] } = useSocioTransactions(clienteId)

  const selectedClient = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  )

  // ========================
  // FILTROS
  // ========================

  const allPartners = useMemo(
    () => [...new Set(transactions.map((t) => t.partner_name))].filter(Boolean),
    [transactions]
  )

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

    return result
  }, [transactions, currentMonth, selectedPartners])

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

  const dailyData = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })

    return days.map((day) => {
      const dayTransactions = filteredTransactions.filter((t) => {
        const date = (t as any).payment_date || t.created_at
        try {
          const txDate = new Date(date.includes("T") ? date : date + "T12:00:00")
          return (
            txDate.getDate() === day.getDate() &&
            txDate.getMonth() === day.getMonth() &&
            txDate.getFullYear() === day.getFullYear()
          )
        } catch {
          return false
        }
      })

      const deposits = dayTransactions
        .filter((t) => t.transaction_type === "deposit")
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const expenses = dayTransactions
        .filter((t) => t.transaction_type !== "deposit")
        .reduce((sum, t) => sum + Number(t.amount), 0)

      return {
        date: format(day, "dd MMM", { locale: ptBR }),
        day: day.getDate(),
        deposits,
        expenses,
        balance: deposits - expenses,
      }
    })
  }, [filteredTransactions, currentMonth])

  const partnerData = useMemo(() => {
    const map: Record<string, { deposits: number; expenses: number }> = {}

    filteredTransactions.forEach((t) => {
      const name = t.partner_name || "Outros"
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

  // ========================
  // HELPERS
  // ========================

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR })
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

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
                  onClick={() => navigate(`/financeiro/socios`)}
                  className="h-8 w-8 p-0"
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

            {/* Navegação de Meses */}
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

              <Button className="gap-2" size="sm">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Filtro de Sócios */}
        {allPartners.length > 0 && (
          <Card className="border border-border bg-background">
            <CardContent className="p-4">
              <label className="text-sm font-semibold text-foreground block mb-3">
                Filtrar por Sócio
              </label>
              <div className="flex flex-wrap gap-3">
                {allPartners.map((partner) => (
                  <label key={partner} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPartners.includes(partner)}
                      onChange={() =>
                        setSelectedPartners((prev) =>
                          prev.includes(partner)
                            ? prev.filter((p) => p !== partner)
                            : [...prev, partner]
                        )
                      }
                      className="rounded border-input cursor-pointer"
                    />
                    <span className="text-sm text-foreground">{partner}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title="Total de Entradas"
            value={monthlySummary.totalDeposits}
            icon={<TrendingUp className="h-5 w-5" />}
            color="emerald"
          />
          <KPICard
            title="Total de Saídas"
            value={monthlySummary.totalExpenses}
            icon={<TrendingDown className="h-5 w-5" />}
            color="red"
          />
          <KPICard
            title="Saldo do Mês"
            value={monthlySummary.balance}
            icon={<DollarSign className="h-5 w-5" />}
            color={monthlySummary.balance >= 0 ? "emerald" : "red"}
          />
          <KPICard
            title="Transações"
            value={filteredTransactions.length}
            icon={<Calendar className="h-5 w-5" />}
            color="blue"
            isCount
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Chart */}
          <Card className="border border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base">Movimentação Diária</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="deposits"
                    stroke="hsl(142, 71%, 45%)"
                    fillOpacity={1}
                    fill="url(#colorDeposits)"
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(0, 84%, 60%)"
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="Saídas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Partner Comparison */}
          <Card className="border border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base">Saldo por Sócio</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={partnerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
                  <Legend />
                  <Bar dataKey="deposits" name="Entradas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Saídas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Transações */}
        <Card className="border border-border bg-background">
          <CardHeader>
            <CardTitle className="text-base">Detalhamento de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Nenhuma transação neste período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">
                        Data
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">
                        Descrição
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">
                        Sócio
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground">
                        Tipo
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx: any, idx) => {
                      const txDate = tx.payment_date || tx.created_at
                      const formattedDate = format(
                        new Date(txDate.includes("T") ? txDate : txDate + "T12:00:00"),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )

                      return (
                        <tr
                          key={tx.id || idx}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 px-3 text-foreground">{formattedDate}</td>
                          <td className="py-3 px-3 text-foreground">{tx.description || "-"}</td>
                          <td className="py-3 px-3 text-muted-foreground">{tx.partner_name}</td>
                          <td className="py-3 px-3">
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
                                ? "Despesa"
                                : "Saída"}
                            </Badge>
                          </td>
                          <td
                            className={`text-right py-3 px-3 font-semibold ${
                              tx.transaction_type === "deposit" ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            {tx.transaction_type === "deposit" ? "+" : "-"}
                            {fmt(Number(tx.amount))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo de Sócios */}
        {partnerData.length > 0 && (
          <Card className="border border-border bg-background">
            <CardHeader>
              <CardTitle className="text-base">Resumo por Sócio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {partnerData.map((partner) => (
                  <div
                    key={partner.name}
                    className="p-4 rounded-lg border border-border bg-muted/20 space-y-2"
                  >
                    <h4 className="font-semibold text-foreground">{partner.name}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entradas:</span>
                        <span className="font-medium text-emerald-500">{fmt(partner.deposits)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saídas:</span>
                        <span className="font-medium text-red-500">{fmt(partner.expenses)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1">
                        <span className="font-semibold text-foreground">Saldo:</span>
                        <span
                          className={`font-semibold ${
                            partner.balance >= 0 ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
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
      </div>
    </Layout>
  )
}

// ========================
// COMPONENTES AUXILIARES
// ========================

function KPICard({
  title,
  value,
  icon,
  color = "blue",
  isCount = false,
}: {
  title: string
  value: number
  icon: React.ReactNode
  color?: "emerald" | "red" | "blue"
  isCount?: boolean
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    red: "bg-red-500/10 text-red-500",
    blue: "bg-blue-500/10 text-blue-500",
  }

  return (
    <Card className="border border-border bg-background">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{title}</p>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {isCount ? value : fmt(value)}
        </p>
      </CardContent>
    </Card>
  )
}
