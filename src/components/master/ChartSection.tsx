import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend } from
"recharts";
import { useReceitasDespesas } from "@/hooks/useReceitasDespesas";
import { BarChart3 } from "lucide-react";

export function ChartSection() {
  const { data: monthlyData = [], isLoading } = useReceitasDespesas();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Receitas vs Despesas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparativo dos últimos 6 meses
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ?
        <div className="h-[300px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Carregando dados...</span>
            </div>
          </div> :

        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} barGap={8} className="bg-inherit">
              <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false} />

              <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false} />

              <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />

              <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => [
              `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]
              } />

              <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) =>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {value === 'receita' ? 'Receitas' : 'Despesas'}
                  </span>
              } />

              <Bar
              dataKey="receita"
              fill="hsl(var(--success))"
              radius={[6, 6, 0, 0]}
              name="receita" />

              <Bar
              dataKey="despesa"
              fill="hsl(var(--destructive))"
              radius={[6, 6, 0, 0]}
              name="despesa" />

            </BarChart>
          </ResponsiveContainer>
        }
      </CardContent>
    </Card>);

}