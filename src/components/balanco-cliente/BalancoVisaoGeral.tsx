import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BalancoVisaoGeralProps {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

export function BalancoVisaoGeral({ clienteId, aeronaveId, periodo }: BalancoVisaoGeralProps) {
  // Buscar resumo financeiro
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['balanco-resumo', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select('id, amount, status, type, saldo_pendente, valor_reembolsado, date')
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);

      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calcular totais
      const pendentes = data?.filter(r => r.status === 'pendente') || [];
      const aguardandoReembolso = data?.filter(r => r.status === 'aguardando_reembolso') || [];
      const pagos = data?.filter(r => r.status === 'pago' || r.status === 'conciliado') || [];
      const reembolsados = data?.filter(r => r.status === 'reembolsado') || [];

      return {
        pendenteEnvio: {
          valor: pendentes.reduce((sum, r) => sum + (r.amount || 0), 0),
          quantidade: pendentes.length
        },
        aguardandoReembolso: {
          valor: aguardandoReembolso.reduce((sum, r) => sum + ((r.saldo_pendente || r.amount) || 0), 0),
          quantidade: aguardandoReembolso.length
        },
        pago: {
          valor: pagos.reduce((sum, r) => sum + (r.amount || 0), 0),
          quantidade: pagos.length
        },
        reembolsado: {
          valor: reembolsados.reduce((sum, r) => sum + (r.valor_reembolsado || r.amount || 0), 0),
          quantidade: reembolsados.length
        },
        total: data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0
      };
    },
    enabled: !!clienteId,
  });

  // Buscar despesas por categoria
  const { data: categorias = [] } = useQuery({
    queryKey: ['balanco-categorias', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          amount,
          categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria)
        `)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);

      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por categoria
      const grouped: Record<string, number> = {};
      data?.forEach((item: any) => {
        const categoria = item.categorias_movimentacao?.nome || 'Sem categoria';
        grouped[categoria] = (grouped[categoria] || 0) + (item.amount || 0);
      });

      return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    },
    enabled: !!clienteId,
  });

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  const chartData = [
    { name: 'Pendente Envio', value: resumo?.pendenteEnvio.valor || 0, color: '#ef4444' },
    { name: 'Aguardando Reembolso', value: resumo?.aguardandoReembolso.valor || 0, color: '#f59e0b' },
    { name: 'Pago', value: resumo?.pago.valor || 0, color: '#22c55e' },
    { name: 'Reembolsado', value: resumo?.reembolsado.valor || 0, color: '#3b82f6' },
  ].filter(item => item.value > 0);

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Pendente de Envio */}
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendente de Envio</p>
                <p className="text-3xl font-bold text-destructive">
                  R$ {(resumo?.pendenteEnvio.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumo?.pendenteEnvio.quantidade || 0} despesas
                </p>
              </div>
              <AlertCircle className="h-12 w-12 text-destructive/50" />
            </div>
          </CardContent>
        </Card>

        {/* Aguardando Reembolso */}
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aguardando Reembolso</p>
                <p className="text-3xl font-bold text-yellow-500">
                  R$ {(resumo?.aguardandoReembolso.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumo?.aguardandoReembolso.quantidade || 0} despesas
                </p>
              </div>
              <Clock className="h-12 w-12 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>

        {/* Pago pelo Cliente */}
        <Card className="border-green-500/50 bg-green-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pago pelo Cliente</p>
                <p className="text-3xl font-bold text-green-500">
                  R$ {(resumo?.pago.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumo?.pago.quantidade || 0} despesas
                </p>
              </div>
              <CheckCircle className="h-12 w-12 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        {/* Reembolsado */}
        <Card className="border-blue-500/50 bg-blue-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reembolsado à Empresa</p>
                <p className="text-3xl font-bold text-blue-500">
                  R$ {(resumo?.reembolsado.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumo?.reembolsado.quantidade || 0} despesas
                </p>
              </div>
              <RefreshCw className="h-12 w-12 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de Pizza - Status */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
            <CardDescription>Proporção entre pendente, pago e reembolsado</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela por Categoria */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Resumo por Categoria</CardTitle>
            <CardDescription>Total de despesas agrupadas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categorias.length > 0 ? (
                categorias.sort((a, b) => b.value - a.value).slice(0, 8).map((cat, index) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <span className="font-medium">
                      R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Sem despesas no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
