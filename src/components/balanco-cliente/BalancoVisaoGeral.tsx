import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useSocioBalanco } from '@/hooks/useSocioBalanco';
import { SociosBalancoCards } from './SociosBalancoCards';

interface BalancoVisaoGeralProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

export function BalancoVisaoGeral({ clienteId, socioId, aeronaveId, periodo }: BalancoVisaoGeralProps) {
  // Hook para dados de sócios
  const { sociosBalanco, socioSelecionado, temMultiplosSocios } = useSocioBalanco(
    clienteId,
    socioId,
    aeronaveId,
    periodo
  );

  // Fator de proporção (100% se consolidado, ou percentual do sócio)
  const fatorProporcao = socioSelecionado ? socioSelecionado.percentual / 100 : 1;

  // Buscar resumo financeiro
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['balanco-resumo', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      let queryDespesas = supabase
        .from('bank_reconciliations')
        .select('id, amount, status, type, saldo_pendente, valor_reembolsado, date')
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);

      if (aeronaveId) {
        queryDespesas = queryDespesas.eq('aircraft_id', aeronaveId);
      }

      // Fetch despesas
      const { data: despesasData, error: errorDespesas } = await queryDespesas;
      if (errorDespesas) throw errorDespesas;

      // Buscar abastecimentos via backend proxy para evitar erro 400 do Supabase
      let fuelUrl = `/api/fuel?client_id=${clienteId}&date_start=${periodo.inicio}&date_end=${periodo.fim}`;
      if (aeronaveId) {
        fuelUrl += `&aircraft_id=${aeronaveId}`;
      }

      const fuelResponse = await fetch(fuelUrl);
      if (!fuelResponse.ok) {
        throw new Error(`Failed to fetch fuel data: ${fuelResponse.statusText}`);
      }
      const fuelResult = await fuelResponse.json();
      const abastecimentos = fuelResult.data || [];

      const data = despesasData || [];

      // Calcular totais despesas
      const pendentes = data.filter(r => r.status === 'pendente') || [];
      const aguardandoReembolso = data.filter(r => r.status === 'aguardando_reembolso') || [];
      const pagos = data.filter(r => r.status === 'pago' || r.status === 'conciliado') || [];
      const reembolsados = data.filter(r => r.status === 'reembolsado') || [];

      // Calcular totais abastecimentos
      const abastecimentosPendentes = abastecimentos.filter(a => a.status === 'pendente') || [];
      const abastecimentosPagos = abastecimentos.filter(a => a.status === 'pago') || [];

      return {
        pendenteEnvio: {
          valor: pendentes.reduce((sum, r) => sum + (r.amount || 0), 0) * fatorProporcao,
          quantidade: pendentes.length
        },
        aguardandoReembolso: {
          valor: aguardandoReembolso.reduce((sum, r) => sum + ((r.saldo_pendente || r.amount) || 0), 0) * fatorProporcao,
          quantidade: aguardandoReembolso.length
        },
        pago: {
          valor: pagos.reduce((sum, r) => sum + (r.amount || 0), 0) * fatorProporcao,
          quantidade: pagos.length
        },
        reembolsado: {
          valor: reembolsados.reduce((sum, r) => sum + (r.valor_reembolsado || r.amount || 0), 0) * fatorProporcao,
          quantidade: reembolsados.length
        },
        abastecimentoPendente: {
          valor: abastecimentosPendentes.reduce((sum, a) => sum + (a.valor_total || 0), 0) * fatorProporcao,
          quantidade: abastecimentosPendentes.length
        },
        abastecimentoPago: {
          valor: abastecimentosPagos.reduce((sum, a) => sum + (a.valor_total || 0), 0) * fatorProporcao,
          quantidade: abastecimentosPagos.length
        },
        total: (data.reduce((sum, r) => sum + (r.amount || 0), 0) || 0) * fatorProporcao +
               (abastecimentos.reduce((sum, a) => sum + (a.valor_total || 0), 0) || 0) * fatorProporcao
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

      // Filtrar apenas categorias permitidas para o cliente (por keywords)
      const keywordPermitidos = ['aeronave', 'reembolsável', 'reembolso', 'operacional', 'receita'];

      return Object.entries(grouped)
        .filter(([name]) =>
          keywordPermitidos.some(keyword =>
            name.toLowerCase().includes(keyword)
          )
        )
        .map(([name, value]) => ({ name, value }));
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
      {/* Cards de Distribuição por Sócio (apenas quando consolidado e tem múltiplos sócios) */}
      {!socioId && temMultiplosSocios && (
        <SociosBalancoCards sociosBalanco={sociosBalanco} />
      )}

      {/* Indicador de sócio selecionado */}
      {socioSelecionado && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Visualizando balanço de: <span className="text-primary">{socioSelecionado.nome}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Participação: {socioSelecionado.percentual.toFixed(1)}% • Valores proporcionais aplicados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pendente de Envio */}
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendente de Envio</p>
                <p className="text-2xl font-bold text-destructive">
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
                <p className="text-2xl font-bold text-yellow-500">
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
                <p className="text-2xl font-bold text-green-500">
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
                <p className="text-2xl font-bold text-blue-500">
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

      {/* Cards de Abastecimento */}
      {(resumo?.abastecimentoPendente.valor || 0) > 0 || (resumo?.abastecimentoPago.valor || 0) > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Abastecimento Pendente */}
          {(resumo?.abastecimentoPendente.valor || 0) > 0 && (
            <Card className="border-orange-500/50 bg-orange-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Abastecimentos Pendentes</p>
                    <p className="text-3xl font-bold text-orange-500">
                      R$ {(resumo?.abastecimentoPendente.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resumo?.abastecimentoPendente.quantidade || 0} registros
                    </p>
                  </div>
                  <AlertCircle className="h-12 w-12 text-orange-500/50" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Abastecimento Pago */}
          {(resumo?.abastecimentoPago.valor || 0) > 0 && (
            <Card className="border-emerald-500/50 bg-emerald-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Abastecimentos Pagos</p>
                    <p className="text-3xl font-bold text-emerald-500">
                      R$ {(resumo?.abastecimentoPago.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resumo?.abastecimentoPago.quantidade || 0} registros
                    </p>
                  </div>
                  <CheckCircle className="h-12 w-12 text-emerald-500/50" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

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
