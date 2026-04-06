import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ResumoMensalCliente, PendenciasCliente, AnaliseAnualCliente } from '@/types/consolidation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, AlertCircle, DollarSign } from 'lucide-react';

interface RelatorioCustosClienteProps {
  clienteId: string;
  showPendencias?: boolean;
  showAnaliseAnual?: boolean;
}

export function RelatorioCustosCliente({
  clienteId,
  showPendencias = true,
  showAnaliseAnual = true,
}: RelatorioCustosClienteProps) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  // Resumo mensal
  const { data: resumoMensal = [], isLoading: isLoadingResumo } = useQuery({
    queryKey: ['resumo-mensal', clienteId, ano, mes],
    queryFn: async () => {
      const response = await fetch(
        `/api/consolidacao/resumo-mensal-cliente/${clienteId}?ano=${ano}&mes=${mes}`
      );
      if (!response.ok) throw new Error('Falha ao carregar resumo');
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!clienteId,
  });

  // Pendências
  const { data: pendencias = null, isLoading: isLoadingPendencias } = useQuery({
    queryKey: ['pendencias', clienteId],
    queryFn: async () => {
      const response = await fetch(`/api/consolidacao/pendencias-cliente/${clienteId}`);
      if (!response.ok) throw new Error('Falha ao carregar pendências');
      const json = await response.json();
      return json.data;
    },
    enabled: !!clienteId && showPendencias,
  });

  // Análise anual
  const { data: analiseAnual = [], isLoading: isLoadingAnual } = useQuery({
    queryKey: ['analise-anual', clienteId, ano],
    queryFn: async () => {
      const response = await fetch(`/api/consolidacao/analise-anual/${clienteId}?ano=${ano}`);
      if (!response.ok) throw new Error('Falha ao carregar análise');
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!clienteId && showAnaliseAnual,
  });

  const resumoChart = resumoMensal.map((item: ResumoMensalCliente) => ({
    name: item.categoria_grupo,
    total: parseFloat(item.total_categoria.toString()),
    horas: parseFloat(item.total_horas_cliente.toString()),
  }));

  const analiseChart = analiseAnual.map((item: AnaliseAnualCliente) => ({
    name: `${item.ano}/${String(item.categoria_grupo).padStart(2, '0')}`,
    valor: parseFloat(item.total_ano.toString()),
  }));

  const resumoSummary = resumoMensal.reduce(
    (acc, item: ResumoMensalCliente) => ({
      totalGasto: acc.totalGasto + parseFloat(item.total_categoria.toString()),
      totalHoras: acc.totalHoras + parseFloat(item.total_horas_cliente.toString()),
    }),
    { totalGasto: 0, totalHoras: 0 }
  );

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Relatório de Custos do Cliente</CardTitle>
          <CardDescription>
            Análise detalhada de despesas e rateio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={ano.toString()} onValueChange={(val) => setAno(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={mes.toString()} onValueChange={(val) => setMes(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Mensal */}
      {!isLoadingResumo && resumoMensal.length > 0 && (
        <>
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Resumo Mensal - {meses.find((m) => m.value === mes)?.label}/{ano}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-blue-900">
                    R$ {resumoSummary.totalGasto.toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700 mb-1">Total de Horas</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {resumoSummary.totalHoras.toFixed(2)}h
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">Categorias</p>
                  <p className="text-2xl font-bold">{resumoMensal.length}</p>
                </div>
              </div>

              {resumoChart.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={resumoChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                      formatter={(value: any) => value.toFixed(2)}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Valor (R$)" />
                    <Bar yAxisId="right" dataKey="horas" fill="#10b981" radius={[8, 8, 0, 0]} name="Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Detalhes por Categoria */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Detalhes por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resumoMensal.map((item: ResumoMensalCliente, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.categoria_grupo}</p>
                      <p className="text-xs text-slate-600">
                        {item.num_lancamentos} lançamento{item.num_lancamentos !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">R$ {parseFloat(item.total_categoria.toString()).toFixed(2)}</p>
                      <p className="text-xs text-slate-600">
                        {parseFloat(item.total_horas_cliente.toString()).toFixed(2)}h
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Pendências */}
      {showPendencias && !isLoadingPendencias && pendencias && (
        <Card className={`border-2 ${pendencias.total_pendente > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${pendencias.total_pendente > 0 ? 'text-red-600' : 'text-green-600'}`} />
              Pendências de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendencias.total_pendente > 0 ? (
              <div className="space-y-3">
                <div className="p-4 bg-white rounded-lg border border-red-300">
                  <p className="text-sm text-slate-600">Saldo Pendente</p>
                  <p className="text-2xl font-bold text-red-600">
                    R$ {pendencias.total_pendente.toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600">Lançamentos Pendentes</p>
                    <p className="text-xl font-bold">{pendencias.total_lancamentos_pendentes}</p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600">Período</p>
                    <p className="text-xs font-mono">
                      {format(new Date(pendencias.periodo_inicio), 'dd/MM/yyyy', { locale: ptBR })} até<br />
                      {format(new Date(pendencias.periodo_fim), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600">Dias Pendente</p>
                    <p className="text-xl font-bold">{pendencias.dias_pendente}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700">
                <span>✓</span>
                <p className="text-sm">Nenhuma pendência de pagamento</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Análise Anual */}
      {showAnaliseAnual && !isLoadingAnual && analiseAnual.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Análise Anual - {ano}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {analiseChart.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analiseChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                    formatter={(value: any) => 'R$ ' + value.toFixed(2)}
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Resumo por categoria */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Resumo por Categoria</h3>
              <div className="space-y-2">
                {Array.from(
                  new Set(analiseAnual.map((item: AnaliseAnualCliente) => item.categoria_grupo))
                ).map((categoria) => {
                  const items = analiseAnual.filter(
                    (item: AnaliseAnualCliente) => item.categoria_grupo === categoria
                  );
                  const total = items.reduce(
                    (sum: number, item: AnaliseAnualCliente) => sum + parseFloat(item.total_ano.toString()),
                    0
                  );

                  return (
                    <div key={categoria as string} className="flex items-center justify-between p-2 border border-slate-200 rounded hover:bg-slate-50">
                      <span className="text-sm font-medium">{categoria as React.ReactNode}</span>
                      <span className="font-semibold">R$ {total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
