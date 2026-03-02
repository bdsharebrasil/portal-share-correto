"use client"

import { useMemo, useState } from "react"
import {
  format,
  subMonths,
  isSameMonth,
  parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"

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

type Transaction = {
  id: string
  date: string
  description: string
  category: string
  amount: number
  type: "entrada" | "saida"
}

type Props = {
  transactions: Transaction[]
}

export default function FinancialReportPage({ transactions = [] }: Props) {
  const [filterMonth, setFilterMonth] = useState<string>("")
  const [visibleCategories, setVisibleCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // -------------------------
  // FILTRO POR MÊS
  // -------------------------

  const filteredTransactions = useMemo(() => {
    if (!filterMonth) return transactions || []

    const selectedDate = new Date(filterMonth + "-01")

    return (transactions || []).filter((t) =>
      isSameMonth(parseISO(t.date), selectedDate)
    )
  }, [transactions, filterMonth])

  // -------------------------
  // COMPARAÇÃO COM MÊS ANTERIOR
  // -------------------------

  const previousMonthTransactions = useMemo(() => {
    if (!filterMonth) return []

    const currentDate = new Date(filterMonth + "-01")
    const previousMonthDate = subMonths(currentDate, 1)

    return (transactions || []).filter((t) =>
      isSameMonth(parseISO(t.date), previousMonthDate)
    )
  }, [transactions, filterMonth])

  // -------------------------
  // SUMMARY
  // -------------------------

  const calculateSummary = (list: Transaction[]) => {
    const totalEntradas = list
      .filter((t) => t.type === "entrada")
      .reduce((sum, t) => sum + t.amount, 0)

    const totalSaidas = list
      .filter((t) => t.type === "saida")
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
    }
  }

  const currentSummary = calculateSummary(filteredTransactions)
  const previousSummary = calculateSummary(previousMonthTransactions)

  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  // -------------------------
  // CATEGORIAS
  // -------------------------

  const allCategories = useMemo(() => {
    return [...new Set((transactions || []).map((t) => t.category))]
  }, [transactions])

  const finalTransactions =
    visibleCategories.length > 0
      ? filteredTransactions.filter((t) =>
          visibleCategories.includes(t.category)
        )
      : filteredTransactions

  // -------------------------
  // ORDENAÇÃO
  // -------------------------

  const sortedTransactions = [...finalTransactions].sort((a, b) => {
    if (sortBy === "date") {
      return sortOrder === "asc"
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime()
    }

    if (sortBy === "amount") {
      return sortOrder === "asc"
        ? a.amount - b.amount
        : b.amount - a.amount
    }

    return 0
  })

  // -------------------------
  // GRÁFICO POR CATEGORIA
  // -------------------------

  const categoryData = useMemo(() => {
    const summary: Record<string, number> = {}

    finalTransactions.forEach((t) => {
      if (!summary[t.category]) summary[t.category] = 0
      summary[t.category] += t.amount
    })

    return Object.entries(summary).map(([name, value]) => ({
      name,
      value,
    }))
  }, [finalTransactions])

  // -------------------------
  // UI
  // -------------------------

  return (
    <div className="p-8 space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Relatório Financeiro</h1>

        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          title="Entradas"
          value={currentSummary.totalEntradas}
          variation={calculateVariation(
            currentSummary.totalEntradas,
            previousSummary.totalEntradas
          )}
          positive
        />
        <Card
          title="Saídas"
          value={currentSummary.totalSaidas}
          variation={calculateVariation(
            currentSummary.totalSaidas,
            previousSummary.totalSaidas
          )}
        />
        <Card
          title="Saldo"
          value={currentSummary.saldo}
          variation={calculateVariation(
            currentSummary.saldo,
            previousSummary.saldo
          )}
          positive={currentSummary.saldo >= 0}
        />
      </div>

      {/* FILTRO DE CATEGORIAS */}
      <div>
        <h2 className="font-semibold mb-2">Categorias visíveis</h2>
        <div className="flex flex-wrap gap-4">
          {allCategories.map((cat) => (
            <label key={cat} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibleCategories.includes(cat)}
                onChange={() =>
                  setVisibleCategories((prev) =>
                    prev.includes(cat)
                      ? prev.filter((c) => c !== cat)
                      : [...prev, cat]
                  )
                }
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      {/* GRÁFICO */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-4">Movimentação por Categoria</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ORDENAÇÃO */}
      <div className="flex gap-4">
        <select
          onChange={(e) => setSortBy(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="date">Ordenar por Data</option>
          <option value="amount">Ordenar por Valor</option>
        </select>

        <select
          onChange={(e) => setSortOrder(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>
      </div>

      {/* TABELA */}
      <div className="bg-white p-6 rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left py-2">Data</th>
              <th className="text-left">Descrição</th>
              <th className="text-left">Categoria</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  {format(parseISO(t.date), "dd/MM/yyyy")}
                </td>
                <td>{t.description}</td>
                <td>{t.category}</td>
                <td
                  className={`text-right font-semibold ${
                    t.type === "entrada"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  R$ {t.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -------------------------
// CARD COMPONENT
// -------------------------

function Card({
  title,
  value,
  variation,
  positive,
}: {
  title: string
  value: number
  variation: number
  positive?: boolean
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p
        className={`text-2xl font-bold ${
          positive ? "text-green-600" : "text-red-600"
        }`}
      >
        R$ {value.toFixed(2)}
      </p>
      <p className="text-xs mt-1">
        {variation > 0 ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}% vs mês anterior
      </p>
    </div>
  )
}
