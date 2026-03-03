import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, RefreshCw, TrendingUp, Plane, Fuel, DollarSign, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSocioBalanco } from '@/hooks/useSocioBalanco';
import { SociosBalancoCards } from './SociosBalancoCards';
import { useBalancoClienteCompleto, calcularResumoHorasCombustivel, formatarHoras } from '@/hooks/useBalancoClienteCompleto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BalancoVisaoGeralProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
  onNavigateTab?: (tab: string) => void;
}

type DrillDownType = 'horas' | 'combustivel' | 'custoHora' | 'pendenteEnvio' | 'aguardandoReembolso' | 'pago' | 'reembolsado' | null;

export function BalancoVisaoGeral({ clienteId, socioId, aeronaveId, periodo, onNavigateTab }: BalancoVisaoGeralProps) {
  const [drillDown, setDrillDown] = useState<DrillDownType>(null);

  const { sociosBalanco, socioSelecionado, temMultiplosSocios } = useSocioBalanco(clienteId, socioId, aeronaveId, periodo);
  const { data: dadosCompletos = [] } = useBalancoClienteCompleto(clienteId, periodo, aeronaveId);
  const fatorProporcao = socioId && socioSelecionado ? socioSelecionado.percentual / 100 : 1;
  const resumoHorasCombustivel = calcularResumoHorasCombustivel(dadosCompletos, fatorProporcao);

  // Buscar logbook entries para drill-down de horas
  const { data: horasDetalhe = [] } = useQuery({
    queryKey: ['horas-detalhe', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let q = supabase
        .from('logbook_entries')
        .select('id, entry_date, total_time, departure_aerodrome, arrival_aerodrome, trecho, partner_name')
        .eq('client_id', clienteId)
        .gte('entry_date', periodo.inicio)
        .lte('entry_date', periodo.fim)
        .order('entry_date', { ascending: false });
      if (aeronaveId) q = q.eq('aircraft_id', aeronaveId);
      const { data } = await q;
      return data || [];
    },
    enabled: drillDown === 'horas',
  });

  // Buscar abastecimentos para drill-down de combustível
  const { data: abastDetalhe = [] } = useQuery({
    queryKey: ['abast-detalhe', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let q = supabase
        .from('abastecimentos')
        .select('id, data, litros, valor_total, valor_unitario, local, trecho')
        .eq('client_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim)
        .order('data', { ascending: false });
      if (aeronaveId) q = q.eq('aeronave_id', aeronaveId);
      const { data } = await q;
      return data || [];
    },
    enabled: drillDown === 'combustivel',
  });

  // Buscar despesas por status para drill-down financeiro
  const { data: despesasDetalhe = [] } = useQuery({
    queryKey: ['despesas-detalhe', clienteId, aeronaveId, periodo, drillDown],
    queryFn: async () => {
      const statusMap: Record<string, string[]> = {
        pendenteEnvio: ['pendente'],
        aguardandoReembolso: ['aguardando_reembolso'],
        pago: ['pago', 'conciliado'],
        reembolsado: ['reembolsado'],
      };
      const statuses = statusMap[drillDown || ''];
      if (!statuses) return [];

      let q = supabase
        .from('bank_reconciliations')
        .select('id, date, description, amount, status, saldo_pendente, category, categorias_movimentacao:categoria_movimentacao_id (nome)')
        .eq('client_id', clienteId)
        .in('status', statuses)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim)
        .order('date', { ascending: false });
      if (aeronaveId) q = q.eq('aircraft_id', aeronaveId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!drillDown && ['pendenteEnvio', 'aguardandoReembolso', 'pago', 'reembolsado'].includes(drillDown || ''),
  });

  // Resumo financeiro
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['balanco-resumo', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      let queryDespesas = supabase
        .from('bank_reconciliations')
        .select('id, amount, status, type, saldo_pendente, valor_reembolsado, date')
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);
      if (aeronaveId) queryDespesas = queryDespesas.eq('aircraft_id', aeronaveId);
      const { data: despesasData, error: errorDespesas } = await queryDespesas;
      if (errorDespesas) throw errorDespesas;

      let queryDiretas = supabase
        .from('despesas_cliente_direto')
        .select('id, valor, status, data_vencimento')
        .eq('client_id', clienteId)
        .gte('data_vencimento', periodo.inicio)
        .lte('data_vencimento', periodo.fim);
      if (aeronaveId) queryDiretas = queryDiretas.eq('aeronave_id', aeronaveId);
      const { data: despesasDiretasData } = await queryDiretas;

      let abastecimentosQuery = supabase
        .from('abastecimentos')
        .select('id, litros, valor_total, status_pagamento')
        .eq('client_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);
      if (aeronaveId) abastecimentosQuery = abastecimentosQuery.eq('aeronave_id', aeronaveId);
      const { data: abastecimentosData } = await abastecimentosQuery;

      const data = despesasData || [];
      const diretas = despesasDiretasData || [];
      const abastecimentos = abastecimentosData || [];

      const pendentes = data.filter(r => r.status === 'pendente');
      const aguardandoReembolso = data.filter(r => r.status === 'aguardando_reembolso');
      const pagos = data.filter(r => r.status === 'pago' || r.status === 'conciliado');
      const reembolsados = data.filter(r => r.status === 'reembolsado');

      const diretasPendentes = diretas.filter((d: any) =>
        ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado'].includes(d.status)
      );
      const diretasPagas = diretas.filter((d: any) =>
        ['pago', 'comprovante_recebido'].includes(d.status)
      );

      const abastecimentosPendentes = abastecimentos.filter((a: any) => a.status_pagamento !== 'pago');
      const abastecimentosPagos = abastecimentos.filter((a: any) => a.status_pagamento === 'pago');

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

  // Categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ['balanco-categorias', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`amount, categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria)`)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim);
      if (aeronaveId) query = query.eq('aircraft_id', aeronaveId);
      const { data, error } = await query;
      if (error) throw error;

      const grouped: Record<string, number> = {};
      data?.forEach((item: any) => {
        const categoria = item.categorias_movimentacao?.nome || 'Sem categoria';
        grouped[categoria] = (grouped[categoria] || 0) + (item.amount || 0);
      });

      const keywordPermitidos = ['aeronave', 'reembolsável', 'reembolso', 'operacional', 'receita'];
      return Object.entries(grouped)
        .filter(([name]) => keywordPermitidos.some(keyword => name.toLowerCase().includes(keyword)))
        .map(([name, value]) => ({ name, value }));
    },
    enabled: !!clienteId,
  });

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-card/60 rounded-2xl">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const getDrillDownTitle = () => {
    const titles: Record<string, string> = {
      horas: 'Histórico de Horas Voadas',
      combustivel: 'Detalhamento de Abastecimentos',
      custoHora: 'Composição do Custo por Hora',
      pendenteEnvio: 'Despesas Pendentes de Envio',
      aguardandoReembolso: 'Despesas Aguardando Reembolso',
      pago: 'Despesas Pagas',
      reembolsado: 'Despesas Reembolsadas',
    };
    return titles[drillDown || ''] || '';
  };

  const custoHoraTotal = resumo?.total || 0;
  const custoHoraValor = resumoHorasCombustivel.horasVoadas > 0 ? custoHoraTotal / resumoHorasCombustivel.horasVoadas : 0;

  return (
    <div className="space-y-6">
      {/* Cards de sócios */}
      {!socioId && temMultiplosSocios && (
        <SociosBalancoCards sociosBalanco={sociosBalanco} />
      )}

      {socioSelecionado && (
        <Card className="border-primary/30 bg-primary/5 rounded-2xl">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Visualizando: <span className="text-primary font-semibold">{socioSelecionado.nome}</span>
                  <span className="text-xs text-muted-foreground ml-2">({socioSelecionado.percentual.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Operacionais - Menores e clicáveis */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          onClick={() => setDrillDown('horas')}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 transition-all hover:border-primary/50 hover:shadow-lg text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20">
              <Plane className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">Clique para detalhes</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Horas Voadas</p>
          <p className="text-2xl font-bold text-foreground">
            {formatarHoras(resumoHorasCombustivel.horasVoadas)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas decimais
          </p>
        </button>

        <button
          onClick={() => setDrillDown('combustivel')}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 transition-all hover:border-emerald-500/50 hover:shadow-lg text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
              <Fuel className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Clique para detalhes</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Combustível</p>
          <p className="text-2xl font-bold text-foreground">
            {resumoHorasCombustivel.litrosConsumidos.toFixed(0)} <span className="text-sm">L</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            R$ {resumoHorasCombustivel.valorCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </button>

        <button
          onClick={() => setDrillDown('custoHora')}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 transition-all hover:border-amber-500/50 hover:shadow-lg text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Clique para detalhes</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Custo por Hora</p>
          <p className="text-2xl font-bold text-foreground">
            {resumoHorasCombustivel.horasVoadas > 0 ? `R$ ${custoHoraValor.toFixed(0)}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Em {resumoHorasCombustivel.horasVoadas.toFixed(1)} horas
          </p>
        </button>
      </div>

      {/* Cards Financeiros - Menores e clicáveis */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { key: 'pendenteEnvio' as DrillDownType, label: 'Pendente Envio', data: resumo?.pendenteEnvio, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { key: 'aguardandoReembolso' as DrillDownType, label: 'Aguard. Reembolso', data: resumo?.aguardandoReembolso, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { key: 'pago' as DrillDownType, label: 'Pago', data: resumo?.pago, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { key: 'reembolsado' as DrillDownType, label: 'Reembolsado', data: resumo?.reembolsado, icon: RefreshCw, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map(({ key, label, data, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => key === 'pendenteEnvio' && onNavigateTab ? onNavigateTab('pendencias') : setDrillDown(key)}
            className="rounded-2xl border border-border/50 bg-card/80 p-3 transition-all hover:border-primary/50 hover:shadow-md text-left cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {data?.quantidade || 0}
              </Badge>
            </div>
            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{label}</p>
            <p className="text-lg font-bold text-foreground">
              R$ {(data?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border border-border/50 bg-card/80 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categorias.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categorias.sort((a, b) => b.value - a.value).slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem despesas no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const chartData = [
                { name: 'Pendente Envio', value: resumo?.pendenteEnvio.valor || 0, color: '#ef4444' },
                { name: 'Aguardando Reembolso', value: resumo?.aguardandoReembolso.valor || 0, color: '#f59e0b' },
                { name: 'Pago', value: resumo?.pago.valor || 0, color: '#22c55e' },
                { name: 'Reembolsado', value: resumo?.reembolsado.valor || 0, color: '#3b82f6' },
              ].filter(item => item.value > 0);

              return chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry) => `${entry.name}: R$ ${entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados no período
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Cards adicionais (pagamento direto / combustível) */}
      {((resumo?.pagamentoDiretoPendente?.valor || 0) > 0 ||
        (resumo?.abastecimentoPendente?.valor || 0) > 0 ||
        (resumo?.pagamentoDiretoPago?.valor || 0) > 0 ||
        (resumo?.abastecimentoPago?.valor || 0) > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Pagamentos Diretos e Combustível</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { show: (resumo?.pagamentoDiretoPendente?.valor || 0) > 0, label: 'Pgto Direto Pendente', valor: resumo?.pagamentoDiretoPendente?.valor, qtd: resumo?.pagamentoDiretoPendente?.quantidade, color: 'text-purple-400' },
              { show: (resumo?.abastecimentoPendente?.valor || 0) > 0, label: 'Combust. Pendente', valor: resumo?.abastecimentoPendente?.valor, qtd: resumo?.abastecimentoPendente?.quantidade, color: 'text-orange-400' },
              { show: (resumo?.pagamentoDiretoPago?.valor || 0) > 0, label: 'Pgto Direto Pago', valor: resumo?.pagamentoDiretoPago?.valor, qtd: resumo?.pagamentoDiretoPago?.quantidade, color: 'text-blue-400' },
              { show: (resumo?.abastecimentoPago?.valor || 0) > 0, label: 'Combust. Pago', valor: resumo?.abastecimentoPago?.valor, qtd: resumo?.abastecimentoPago?.quantidade, color: 'text-emerald-400' },
            ].filter(c => c.show).map((c, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card/80 p-3">
                <p className={`text-[10px] font-medium ${c.color} mb-1`}>{c.label}</p>
                <p className="text-lg font-bold text-foreground">
                  R$ {(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{c.qtd || 0} registros</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down Dialog */}
      <Dialog open={!!drillDown} onOpenChange={() => setDrillDown(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDrillDownTitle()}</DialogTitle>
          </DialogHeader>

          {drillDown === 'horas' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Trecho</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                    <TableHead>Sócio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasDetalhe.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                  ) : horasDetalhe.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell>{format(new Date(h.entry_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{h.trecho || '-'}</TableCell>
                      <TableCell>{h.departure_aerodrome || '-'}</TableCell>
                      <TableCell>{h.arrival_aerodrome || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatarHoras(h.total_time || 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.partner_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 text-right text-sm font-bold text-foreground">
                Total: {formatarHoras(horasDetalhe.reduce((s: number, h: any) => s + (h.total_time || 0), 0))}
              </div>
            </div>
          )}

          {drillDown === 'combustivel' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Trecho</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">R$/L</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abastDetalhe.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum abastecimento encontrado</TableCell></TableRow>
                  ) : abastDetalhe.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{format(new Date(a.data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{a.local || '-'}</TableCell>
                      <TableCell>{a.trecho || '-'}</TableCell>
                      <TableCell className="text-right">{(a.litros || 0).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{(a.valor_unitario || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {(a.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex justify-between text-sm font-bold text-foreground">
                <span>Total: {abastDetalhe.reduce((s: number, a: any) => s + (a.litros || 0), 0).toFixed(0)} L</span>
                <span>R$ {abastDetalhe.reduce((s: number, a: any) => s + (a.valor_total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {drillDown === 'custoHora' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Total Despesas</p>
                  <p className="text-xl font-bold text-foreground">R$ {custoHoraTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Total Horas</p>
                  <p className="text-xl font-bold text-foreground">{formatarHoras(resumoHorasCombustivel.horasVoadas)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Custo por Hora</p>
                <p className="text-3xl font-bold text-primary">
                  R$ {custoHoraValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">= Total Despesas ÷ Total Horas</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Combustível: R$ {resumoHorasCombustivel.valorCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({resumoHorasCombustivel.horasVoadas > 0 ? `R$ ${(resumoHorasCombustivel.valorCombustivel / resumoHorasCombustivel.horasVoadas).toFixed(0)}/h` : '-'})</p>
                <p>• Outras despesas: R$ {(custoHoraTotal - resumoHorasCombustivel.valorCombustivel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({resumoHorasCombustivel.horasVoadas > 0 ? `R$ ${((custoHoraTotal - resumoHorasCombustivel.valorCombustivel) / resumoHorasCombustivel.horasVoadas).toFixed(0)}/h` : '-'})</p>
              </div>
            </div>
          )}

          {['pendenteEnvio', 'aguardandoReembolso', 'pago', 'reembolsado'].includes(drillDown || '') && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasDetalhe.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada</TableCell></TableRow>
                  ) : despesasDetalhe.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{format(new Date(d.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs">{d.categorias_movimentacao?.nome || d.category || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{d.description || '-'}</TableCell>
                      <TableCell className="text-right font-medium">R$ {(d.saldo_pendente || d.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 text-right text-sm font-bold text-foreground">
                Total: R$ {despesasDetalhe.reduce((s: number, d: any) => s + (d.saldo_pendente || d.amount || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
