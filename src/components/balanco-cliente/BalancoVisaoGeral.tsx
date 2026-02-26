import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp, Plane, Fuel, DollarSign, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSocioBalanco } from '@/hooks/useSocioBalanco';
import { SociosBalancoCards } from './SociosBalancoCards';
import { useBalancoClienteCompleto, calcularResumoHorasCombustivel, formatarHoras } from '@/hooks/useBalancoClienteCompleto';

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

  // Hook para dados completos (horas voadas e combustível)
  const { data: dadosCompletos = [] } = useBalancoClienteCompleto(clienteId, periodo, aeronaveId);

  // Fator de proporção (100% se consolidado ou se socioId não foi informado, ou percentual do sócio se selecionado)
  // Nota: socioSelecionado pode estar definido mas socioId pode ser undefined (consolidado)
  const fatorProporcao = socioId && socioSelecionado ? socioSelecionado.percentual / 100 : 1;

  // Calcular resumo de horas e combustível
  const resumoHorasCombustivel = calcularResumoHorasCombustivel(dadosCompletos, fatorProporcao);

  // Buscar resumo financeiro
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['balanco-resumo', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      // Buscar despesas de bank_reconciliations
      let queryDespesas = supabase
        .from('bank_reconciliations')
        .select('id, amount, status, type, saldo_pendente, valor_reembolsado, date')
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);

      if (aeronaveId) {
        queryDespesas = queryDespesas.eq('aircraft_id', aeronaveId);
      }

      const { data: despesasData, error: errorDespesas } = await queryDespesas;
      if (errorDespesas) throw errorDespesas;

      // Buscar despesas de despesas_cliente_direto
      let queryDiretas = supabase
        .from('despesas_cliente_direto')
        .select('id, valor, status, data_vencimento')
        .eq('client_id', clienteId)
        .gte('data_vencimento', periodo.inicio)
        .lte('data_vencimento', periodo.fim);

      if (aeronaveId) {
        queryDiretas = queryDiretas.eq('aeronave_id', aeronaveId);
      }

      const { data: despesasDiretasData, error: errorDiretas } = await queryDiretas;
      if (errorDiretas) throw errorDiretas;

      // Buscar abastecimentos diretamente do Supabase
      let abastecimentosQuery = supabase
        .from('abastecimentos')
        .select('id, litros, valor_total, status_pagamento')
        .eq('client_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);

      if (aeronaveId) {
        abastecimentosQuery = abastecimentosQuery.eq('aeronave_id', aeronaveId);
      }

      const { data: abastecimentosData, error: abastecimentosError } = await abastecimentosQuery;
      if (abastecimentosError) throw abastecimentosError;

      const abastecimentos = abastecimentosData || [];

      const data = despesasData || [];
      const diretas = despesasDiretasData || [];

      // Calcular totais despesas reembolso (bank_reconciliations)
      const pendentes = data.filter(r => r.status === 'pendente') || [];
      const aguardandoReembolso = data.filter(r => r.status === 'aguardando_reembolso') || [];
      const pagos = data.filter(r => r.status === 'pago' || r.status === 'conciliado') || [];
      const reembolsados = data.filter(r => r.status === 'reembolsado') || [];

      // Calcular totais despesas diretas (despesas_cliente_direto)
      const diretasPendentes = diretas.filter((d: any) =>
        ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado'].includes(d.status)
      );
      const diretasPagas = diretas.filter((d: any) =>
        ['pago', 'comprovante_recebido'].includes(d.status)
      );

      // Calcular totais abastecimentos
      const abastecimentosPendentes = abastecimentos.filter((a: any) => a.status_pagamento !== 'pago') || [];
      const abastecimentosPagos = abastecimentos.filter((a: any) => a.status_pagamento === 'pago') || [];

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
        pagamentoDiretoPendente: {
          valor: diretasPendentes.reduce((sum: number, d: any) => sum + (d.valor || 0), 0) * fatorProporcao,
          quantidade: diretasPendentes.length
        },
        pagamentoDiretoPago: {
          valor: diretasPagas.reduce((sum: number, d: any) => sum + (d.valor || 0), 0) * fatorProporcao,
          quantidade: diretasPagas.length
        },
        abastecimentoPendente: {
          valor: abastecimentosPendentes.reduce((sum: number, a: any) => sum + (a.valor_total || 0), 0) * fatorProporcao,
          quantidade: abastecimentosPendentes.length
        },
        abastecimentoPago: {
          valor: abastecimentosPagos.reduce((sum: number, a: any) => sum + (a.valor_total || 0), 0) * fatorProporcao,
          quantidade: abastecimentosPagos.length
        },
        total: (data.reduce((sum, r) => sum + (r.amount || 0), 0) || 0) * fatorProporcao +
               (diretas.reduce((sum: number, d: any) => sum + (d.valor || 0), 0) || 0) * fatorProporcao +
               (abastecimentos.reduce((sum: number, a: any) => sum + (a.valor_total || 0), 0) || 0) * fatorProporcao
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
    <div className="space-y-8">
      {/* Cards de Distribuição por Sócio (apenas quando consolidado e tem múltiplos sócios) */}
      {!socioId && temMultiplosSocios && (
        <SociosBalancoCards sociosBalanco={sociosBalanco} />
      )}

      {/* Indicador de sócio selecionado */}
      {socioSelecionado && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/30">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Visualizando balanço de: <span className="text-primary font-semibold">{socioSelecionado.nome}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Participação: {socioSelecionado.percentual.toFixed(1)}% • Valores proporcionais aplicados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Principais - Operacionais */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Horas Voadas */}
        <div className="group relative overflow-hidden rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-500/5 p-6 transition-all hover:border-blue-300/80">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-100/50 px-2 py-1 rounded">Operacional</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Horas Voadas</p>
              <p className="text-4xl font-bold text-blue-600">
                {formatarHoras(resumoHorasCombustivel.horasVoadas)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas decimais
              </p>
            </div>
          </div>
        </div>

        {/* Combustível */}
        <div className="group relative overflow-hidden rounded-xl border border-green-200/50 bg-gradient-to-br from-green-50 to-green-500/5 p-6 transition-all hover:border-green-300/80">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                <Fuel className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-100/50 px-2 py-1 rounded">Operacional</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Combustível Consumido</p>
              <p className="text-4xl font-bold text-green-600">
                {resumoHorasCombustivel.litrosConsumidos.toFixed(0)} <span className="text-lg">L</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                R$ {resumoHorasCombustivel.valorCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Custo/Hora */}
        <div className="group relative overflow-hidden rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50 to-purple-500/5 p-6 transition-all hover:border-purple-300/80">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-purple-600 bg-purple-100/50 px-2 py-1 rounded">Métrica</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Custo por Hora</p>
              <p className="text-4xl font-bold text-purple-600">
                {resumoHorasCombustivel.horasVoadas > 0
                  ? `R$ ${((resumo?.total || 0) / resumoHorasCombustivel.horasVoadas).toFixed(0)}`
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Em {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Financeiro Principal - Destaque */}
      <div className="relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-8">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-300 mix-blend-overlay" />
        </div>
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                TOTAL A PROCESSAR
              </p>
              <p className="text-5xl font-bold text-amber-900">
                R$ {(resumo?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-xs text-amber-700/70">Período:</p>
                <p className="text-sm font-medium text-amber-900">Selecionado</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo - Financeiro */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pendente Envio */}
        <div className="group rounded-lg border border-red-200/50 bg-gradient-to-br from-red-50 to-red-500/5 p-5 transition-all hover:border-red-300/80 hover:shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-100/50 px-2 py-1 rounded">
              {resumo?.pendenteEnvio.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pendente Envio</p>
          <p className="text-2xl font-bold text-red-600">
            R$ {(resumo?.pendenteEnvio.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Aguardando Reembolso */}
        <div className="group rounded-lg border border-yellow-200/50 bg-gradient-to-br from-yellow-50 to-yellow-500/5 p-5 transition-all hover:border-yellow-300/80 hover:shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 group-hover:bg-yellow-200 transition-colors">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-xs font-bold text-yellow-600 bg-yellow-100/50 px-2 py-1 rounded">
              {resumo?.aguardandoReembolso.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Aguardando Reembolso</p>
          <p className="text-2xl font-bold text-yellow-600">
            R$ {(resumo?.aguardandoReembolso.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Pago */}
        <div className="group rounded-lg border border-green-200/50 bg-gradient-to-br from-green-50 to-green-500/5 p-5 transition-all hover:border-green-300/80 hover:shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-100/50 px-2 py-1 rounded">
              {resumo?.pago.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pago</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {(resumo?.pago.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Reembolsado */}
        <div className="group rounded-lg border border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-500/5 p-5 transition-all hover:border-blue-300/80 hover:shadow-md">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
              <RefreshCw className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-100/50 px-2 py-1 rounded">
              {resumo?.reembolsado.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Reembolsado</p>
          <p className="text-2xl font-bold text-blue-600">
            R$ {(resumo?.reembolsado.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de Pizza - Status */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
            <CardDescription>Proporção entre pendente, pago e reembolsado</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    animationDuration={500}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[420px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Categorias */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
            <CardDescription>Distribuição das principais categorias de gastos</CardDescription>
          </CardHeader>
          <CardContent>
            {categorias.length > 0 ? (
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={categorias.sort((a, b) => b.value - a.value).slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[420px] flex items-center justify-center text-muted-foreground">
                Sem despesas no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards Adicionais de Pagamentos - Resumo */}
      {((resumo?.pagamentoDiretoPendente?.valor || 0) > 0 ||
        (resumo?.abastecimentoPendente?.valor || 0) > 0 ||
        (resumo?.pagamentoDiretoPago?.valor || 0) > 0 ||
        (resumo?.abastecimentoPago?.valor || 0) > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Pagamentos Diretos e Combustível</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(resumo?.pagamentoDiretoPendente?.valor || 0) > 0 && (
              <div className="rounded-lg border border-purple-200/50 bg-gradient-to-br from-purple-50 to-purple-500/5 p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Pagamento Direto Pendente</p>
                <p className="text-xl font-bold text-purple-600">
                  R$ {(resumo?.pagamentoDiretoPendente.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{resumo?.pagamentoDiretoPendente.quantidade || 0} despesas</p>
              </div>
            )}
            {(resumo?.abastecimentoPendente?.valor || 0) > 0 && (
              <div className="rounded-lg border border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-500/5 p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Combustível Pendente</p>
                <p className="text-xl font-bold text-orange-600">
                  R$ {(resumo?.abastecimentoPendente.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{resumo?.abastecimentoPendente.quantidade || 0} registros</p>
              </div>
            )}
            {(resumo?.pagamentoDiretoPago?.valor || 0) > 0 && (
              <div className="rounded-lg border border-teal-200/50 bg-gradient-to-br from-teal-50 to-teal-500/5 p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Pagamento Direto Pago</p>
                <p className="text-xl font-bold text-teal-600">
                  R$ {(resumo?.pagamentoDiretoPago?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{resumo?.pagamentoDiretoPago?.quantidade || 0} despesas</p>
              </div>
            )}
            {(resumo?.abastecimentoPago?.valor || 0) > 0 && (
              <div className="rounded-lg border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-emerald-500/5 p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">Combustível Pago</p>
                <p className="text-xl font-bold text-emerald-600">
                  R$ {(resumo?.abastecimentoPago?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{resumo?.abastecimentoPago?.quantidade || 0} registros</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
