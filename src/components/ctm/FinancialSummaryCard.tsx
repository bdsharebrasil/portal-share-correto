import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, Wrench, Zap, Package } from 'lucide-react';
import type { FinancialSummary } from '@/types/maintenance';

interface FinancialSummaryCardProps {
  data: FinancialSummary;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

export function FinancialSummaryCard({ data }: FinancialSummaryCardProps) {
  const categoryEntries = Object.entries(data.costByCategory || {}).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  const summaryItems = [
    {
      label: 'Total Manutenção',
      value: data.totalMaintenanceCost,
      icon: Wrench,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: 'Custos de Motor',
      value: data.totalMotorCost,
      icon: Zap,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
    },
    {
      label: 'Peças e Componentes',
      value: data.totalPartsCost,
      icon: Package,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      label: 'Mão de Obra',
      value: data.totalLaborCost,
      icon: Wrench,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-950/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className={`w-fit p-2 rounded-lg ${item.bg}`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold">
                    R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total and Yearly */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Total Anual</span>
              <span className="text-2xl font-bold">
                R$ {data.yearlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Distribution Chart */}
      {categoryEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryEntries}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: R$ ${value.toLocaleString('pt-BR')}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryEntries.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    `R$ ${(value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Expenses Chart */}
      {data.monthlyExpenses && data.monthlyExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) =>
                    `R$ ${(value as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  dot={false}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
