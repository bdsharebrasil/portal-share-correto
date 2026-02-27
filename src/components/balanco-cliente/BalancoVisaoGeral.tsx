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
      <Card className="border-blue-800/30 bg-blue-900/40 shadow-xl shadow-black/20">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-blue-300">Carregando...</p>
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
        <div className="group relative overflow-hidden rounded-2xl border border-blue-800/30 bg-blue-900/30 p-6 transition-all hover:border-blue-700/50 shadow-xl shadow-black/20">
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
                <Plane className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full">Operacional</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300 mb-1">Horas Voadas</p>
              <p className="text-4xl font-bold text-white">
                {formatarHoras(resumoHorasCombustivel.horasVoadas)}
              </p>
              <p className="text-xs text-blue-400/70 mt-2">
                {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas decimais
              </p>
            </div>
          </div>
        </div>

        {/* Combustível */}
        <div className="group relative overflow-hidden rounded-2xl border border-blue-800/30 bg-blue-900/30 p-6 transition-all hover:border-blue-700/50 shadow-xl shadow-black/20">
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/20">
                <Fuel className="h-6 w-6 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full">Operacional</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300 mb-1">Combustível Consumido</p>
              <p className="text-4xl font-bold text-white">
                {resumoHorasCombustivel.litrosConsumidos.toFixed(0)} <span className="text-lg">L</span>
              </p>
              <p className="text-xs text-blue-400/70 mt-2">
                R$ {resumoHorasCombustivel.valorCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Custo/Hora */}
        <div className="group relative overflow-hidden rounded-2xl border border-blue-800/30 bg-blue-900/30 p-6 transition-all hover:border-blue-700/50 shadow-xl shadow-black/20">
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
                <Zap className="h-6 w-6 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full">Métrica</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300 mb-1">Custo por Hora</p>
              <p className="text-4xl font-bold text-white">
                {resumoHorasCombustivel.horasVoadas > 0
                  ? `R$ ${((resumo?.total || 0) / resumoHorasCombustivel.horasVoadas).toFixed(0)}`
                  : '—'}
              </p>
              <p className="text-xs text-blue-400/70 mt-2">
                Em {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Cards de Resumo - Financeiro */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Pendente Envio */}
        <div className="group rounded-2xl border border-blue-800/30 bg-blue-900/30 p-5 transition-all hover:border-blue-700/50 hover:shadow-lg shadow-xl shadow-black/20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <span className="text-xs font-bold text-red-300 bg-red-500/10 px-2 py-1 rounded-full">
              {resumo?.pendenteEnvio.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-blue-300 mb-1">Pendente Envio</p>
          <p className="text-2xl font-bold text-white">
            R$ {(resumo?.pendenteEnvio.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Aguardando Reembolso */}
        <div className="group rounded-2xl border border-blue-800/30 bg-blue-900/30 p-5 transition-all hover:border-blue-700/50 hover:shadow-lg shadow-xl shadow-black/20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-1 rounded-full">
              {resumo?.aguardandoReembolso.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-blue-300 mb-1">Aguardando Reembolso</p>
          <p className="text-2xl font-bold text-white">
            R$ {(resumo?.aguardandoReembolso.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Pago */}
        <div className="group rounded-2xl border border-blue-800/30 bg-blue-900/30 p-5 transition-all hover:border-blue-700/50 hover:shadow-lg shadow-xl shadow-black/20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
              {resumo?.pago.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-blue-300 mb-1">Pago</p>
          <p className="text-2xl font-bold text-white">
            R$ {(resumo?.pago.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Reembolsado */}
        <div className="group rounded-2xl border border-blue-800/30 bg-blue-900/30 p-5 transition-all hover:border-blue-700/50 hover:shadow-lg shadow-xl shadow-black/20">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
              <RefreshCw className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-full">
              {resumo?.reembolsado.quantidade || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-blue-300 mb-1">Reembolsado</p>
          <p className="text-2xl font-bold text-white">
            R$ {(resumo?.reembolsado.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico de Barras - Categorias */}
        <Card className="border-blue-800/30 bg-blue-900/40 shadow-xl shadow-black/20">
          <CardHeader>
            <CardTitle className="text-lg text-blue-200">Despesas por Categoria</CardTitle>
            <CardDescription className="text-blue-400/70">Distribuição das principais categorias de gastos</CardDescription>
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
          <h3 className="text-lg font-semibold mb-4 text-foreground">Pagamentos Diretos e Combustível</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(resumo?.pagamentoDiretoPendente?.valor || 0) > 0 && (
              <div className="rounded-xl border-0 shadow-md bg-gradient-to-br from-purple-500 via-purple-400 to-purple-500 p-6 text-white hover:shadow-lg transition-shadow">
                <p className="text-sm font-medium mb-2 text-purple-100">Pagamento Direto Pendente</p>
                <p className="text-3xl font-bold mb-3">
                  R$ {(resumo?.pagamentoDiretoPendente.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-purple-100">{resumo?.pagamentoDiretoPendente.quantidade || 0} despesas</p>
              </div>
            )}
            {(resumo?.abastecimentoPendente?.valor || 0) > 0 && (
              <div className="rounded-xl border-0 shadow-md bg-gradient-to-br from-orange-500 via-orange-400 to-orange-500 p-6 text-white hover:shadow-lg transition-shadow">
                <p className="text-sm font-medium mb-2 text-orange-100">Combustível Pendente</p>
                <p className="text-3xl font-bold mb-3">
                  R$ {(resumo?.abastecimentoPendente.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-orange-100">{resumo?.abastecimentoPendente.quantidade || 0} registros</p>
              </div>
            )}
            {(resumo?.pagamentoDiretoPago?.valor || 0) > 0 && (
              <div className="rounded-xl border-0 shadow-md bg-gradient-to-br from-blue-500 via-blue-400 to-blue-500 p-6 text-white hover:shadow-lg transition-shadow">
                <p className="text-sm font-medium mb-2 text-blue-100">Pagamento Direto Pago</p>
                <p className="text-3xl font-bold mb-3">
                  R$ {(resumo?.pagamentoDiretoPago?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-blue-100">{resumo?.pagamentoDiretoPago?.quantidade || 0} despesas</p>
              </div>
            )}
            {(resumo?.abastecimentoPago?.valor || 0) > 0 && (
              <div className="rounded-xl border-0 shadow-md bg-gradient-to-br from-green-500 via-emerald-400 to-green-500 p-6 text-white hover:shadow-lg transition-shadow">
                <p className="text-sm font-medium mb-2 text-green-100">Combustível Pago</p>
                <p className="text-3xl font-bold mb-3">
                  R$ {(resumo?.abastecimentoPago?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-green-100">{resumo?.abastecimentoPago?.quantidade || 0} registros</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
