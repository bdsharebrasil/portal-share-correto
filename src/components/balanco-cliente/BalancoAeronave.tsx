import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plane, Clock, Wrench, Fuel, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BalancoAeronaveProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

export function BalancoAeronave({ clienteId, aeronaveId, periodo }: BalancoAeronaveProps) {
  // Buscar horas voadas consolidadas
  const { data: horasData = [], isLoading: loadingHoras } = useQuery({
    queryKey: ['horas-aeronave', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = (supabase as any)
        .from('horas_mensais_consolidadas')
        .select('*')
        .eq('clientes_id', clienteId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      let { data, error } = await query;

      // Se não houver dados consolidados, buscar de logbook_entries
      if (!error && (!data || data.length === 0)) {
        let fallbackQuery = (supabase as any)
          .from('logbook_entries')
          .select(`
            id,
            client_id,
            aeronave_id,
            entry_date,
            total_time,
            aircraft:aeronave_id(registration)
          `)
          .eq('clientes_id', clienteId)
          .gte('entry_date', periodo.inicio)
          .lte('entry_date', periodo.fim)
          .order('entry_date', { ascending: false });

        if (aeronaveId) {
          fallbackQuery = fallbackQuery.eq('aeronave_id', aeronaveId);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          console.error('Erro ao buscar logbook_entries:', fallbackError);
          return [];
        }

        // Transformar dados de logbook_entries para formato compatível
        if (fallbackData && fallbackData.length > 0) {
          const horasAgrupadas: Record<string, any> = {};

          fallbackData.forEach((entry: any) => {
            const data = new Date(entry.entry_date);
            const ano = data.getFullYear();
            const mes = data.getMonth() + 1;
            const key = `${entry.aircraft_id}-${ano}-${mes}`;

            if (!horasAgrupadas[key]) {
              horasAgrupadas[key] = {
                id: `${entry.aircraft_id}-${ano}-${mes}`,
                cliente_id: entry.client_id,
                aeronave_id: entry.aircraft_id,
                aeronave_registro: entry.aircraft?.matricula || 'N/A',
                ano,
                mes,
                data_referencia: new Date(ano, mes - 1, 1).toISOString().split('T')[0],
                horas_voadas: 0,
                horas_totais_aeronave: 0,
                percentual_uso: 0,
                fonte_diario_bordo: true,
                fonte_portal_cliente: false,
                validado: false,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString()
              };
            }

            horasAgrupadas[key].horas_voadas += entry.total_time || 0;
          });

          // Calcular totais de aeronave por mês
          Object.values(horasAgrupadas).forEach((hora: any) => {
            const totalAeronave = fallbackData
              .filter((e: any) => {
                const d = new Date(e.entry_date);
                return d.getFullYear() === hora.ano &&
                  (d.getMonth() + 1) === hora.mes &&
                  e.aircraft_id === hora.aeronave_id;
              })
              .reduce((sum: number, e: any) => sum + (e.total_time || 0), 0);

            hora.horas_totais_aeronave = totalAeronave;
            hora.percentual_uso = totalAeronave > 0 ? (hora.horas_voadas / totalAeronave) * 100 : 0;
          });

          return Object.values(horasAgrupadas);
        }
      }

      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar custos reais do extrato do cliente (fallback robusto quando histórico consolidado está vazio)
  const { data: custosData = [], isLoading: loadingCustos } = useQuery({
    queryKey: ['custos-aeronave', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let aeronaveRegistro: string | null = null;

      if (aeronaveId) {
        const { data: aeronaveSelecionada } = await supabase
          .from('aeronave')
          .select('matricula')
          .eq('id', aeronaveId)
          .single();

        aeronaveRegistro = aeronaveSelecionada?.matricula ?? null;
      }

      let query = supabase
        .from('vw_extrato_cliente')
        .select('data, valor, valor_total, categoria, status, aeronave_registro')
        .eq('cliente_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);

      if (aeronaveRegistro) {
        query = query.eq('aeronave_registro', aeronaveRegistro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Calcular totais
  const totalHoras = horasData.reduce((sum: number, h: any) => sum + (h.horas_voadas || 0), 0);
  const totalCustos = custosData.reduce(
    (sum: number, c: any) => sum + Number(c.valor_total ?? c.valor ?? 0),
    0
  );
  const percentualMedio = horasData.length > 0
    ? horasData.reduce((sum: number, h: any) => sum + (h.percentual_uso || 0), 0) / horasData.length
    : 0;

  // Preparar dados para gráfico de horas por mês
  const horasPorMes = horasData.reduce((acc: any[], item: any) => {
    const key = `${item.ano}-${String(item.mes).padStart(2, '0')}`;
    const existing = acc.find(a => a.mes === key);
    if (existing) {
      existing.horas += item.horas_voadas || 0;
    } else {
      acc.push({
        mes: key,
        label: format(new Date(item.ano, item.mes - 1), 'MMM/yy', { locale: ptBR }),
        horas: item.horas_voadas || 0
      });
    }
    return acc;
  }, []).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);

  // Preparar dados para gráfico de custos por categoria
  const custosPorCategoria = custosData.reduce((acc: Record<string, number>, item: any) => {
    const categoria = item.categoria || 'Sem categoria';
    const valor = Number(item.valor_total ?? item.valor ?? 0);
    acc[categoria] = (acc[categoria] || 0) + valor;
    return acc;
  }, {});

  const custosCategoriaData = Object.entries(custosPorCategoria).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  })).sort((a, b) => b.value - a.value);

  // Custos mensais
  const custosMensais = custosData.reduce((acc: any[], item: any) => {
    const mes = format(new Date(item.data), 'MMM/yy', { locale: ptBR });
    const existing = acc.find(a => a.mes === mes);
    const valor = Number(item.valor_total ?? item.valor ?? 0);

    if (existing) {
      existing.valor += valor;
    } else {
      acc.push({
        mes,
        valor,
      });
    }

    return acc;
  }, []);

  const isLoading = loadingHoras || loadingCustos;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo Operacional */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas Voadas</p>
                <p className="text-2xl font-bold">{totalHoras.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">% Uso Médio</p>
                <p className="text-2xl font-bold">{percentualMedio.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Wrench className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Custos</p>
                <p className="text-2xl font-bold">
                  R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Fuel className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Custo/Hora</p>
                <p className="text-2xl font-bold">
                  R$ {totalHoras > 0 ? (totalCustos / totalHoras).toFixed(0) : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Horas por Mês */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Horas Voadas por Mês</CardTitle>
            <CardDescription>Evolução das horas de voo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">Carregando...</div>
            ) : horasPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={horasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}h`, 'Horas']}
                  />
                  <Area
                    type="monotone"
                    dataKey="horas"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados de horas no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custos por Categoria */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="text-lg">Custos por Categoria</CardTitle>
            <CardDescription>Distribuição de custos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">Carregando...</div>
            ) : custosCategoriaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={custosCategoriaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados de custos no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução de Custos Mensais */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Evolução de Custos Mensais</CardTitle>
          <CardDescription>Total de custos rateados por mês</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center">Carregando...</div>
          ) : custosMensais.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={custosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados de custos no período
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}