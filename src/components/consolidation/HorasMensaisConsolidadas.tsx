import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, Check, Clock, Plane, Users } from 'lucide-react';

interface HorasMensaisConsolidadasProps {
  aeronaveId?: string;
  clienteId?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function HorasMensaisConsolidadas({
  aeronaveId,
  clienteId,
}: HorasMensaisConsolidadasProps) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  // Buscar dados diretamente do Supabase
  const { data: horasData = [], isLoading, error } = useQuery({
    queryKey: ['horas-mensais-consolidadas', aeronaveId, ano, mes],
    queryFn: async () => {
      if (!aeronaveId) return [];

      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const endDate = `${ano}-${String(mes).padStart(2, '0')}-31`;

      // Buscar entradas de logbook para a aeronave no período
      const { data: entries, error: entriesError } = await supabase
        .from('logbook_entries')
        .select(`
          *,
          client:client_id (id, company_name, proprietario)
        `)
        .eq('aircraft_id', aeronaveId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (entriesError) throw entriesError;

      // Agrupar por cliente
      const clienteMap = new Map<string, {
        cliente_id: string;
        cliente_nome: string;
        horas_voadas: number;
        voos: number;
      }>();

      let horasTotais = 0;

      (entries || []).forEach((entry: any) => {
        const clienteId = entry.client_id || 'sem-cliente';
        const clienteNome = entry.client?.company_name || entry.client?.proprietario || 'Sem Cliente';
        const horas = entry.total_time || 0;
        horasTotais += horas;

        if (clienteMap.has(clienteId)) {
          const existing = clienteMap.get(clienteId)!;
          existing.horas_voadas += horas;
          existing.voos += 1;
        } else {
          clienteMap.set(clienteId, {
            cliente_id: clienteId,
            cliente_nome: clienteNome,
            horas_voadas: horas,
            voos: 1,
          });
        }
      });

      // Converter para array com percentuais
      const result = Array.from(clienteMap.values())
        .map((item, index) => ({
          ...item,
          horas_totais_aeronave: horasTotais,
          percentual_uso: horasTotais > 0 ? (item.horas_voadas / horasTotais) * 100 : 0,
          ranking: index + 1,
          validado: true,
          fonte_diario_bordo: true,
          fonte_portal_cliente: false,
        }))
        .sort((a, b) => b.horas_voadas - a.horas_voadas)
        .map((item, index) => ({ ...item, ranking: index + 1 }));

      return result;
    },
    enabled: !!aeronaveId,
  });

  // Filtrar por cliente se especificado
  const comparativoFiltrado = clienteId
    ? horasData.filter((item) => item.cliente_id === clienteId)
    : horasData;

  const chartData = comparativoFiltrado.map((item) => ({
    name: item.cliente_nome,
    horas: item.horas_voadas,
    percentual: item.percentual_uso,
    ranking: item.ranking,
  }));

  const validados = comparativoFiltrado.filter((item) => item.validado).length;
  const pendentes = comparativoFiltrado.length - validados;
  const totalHoras = comparativoFiltrado.length > 0 ? comparativoFiltrado[0].horas_totais_aeronave : 0;

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
      <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Consolidação de Horas Mensais</CardTitle>
          <CardDescription>
            Visualize o uso da aeronave por cliente no período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ano</label>
              <Select value={ano.toString()} onValueChange={(val) => setAno(parseInt(val))}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
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
              <label className="text-sm font-medium text-muted-foreground">Mês</label>
              <Select value={mes.toString()} onValueChange={(val) => setMes(parseInt(val))}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
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
              <div className="text-sm text-muted-foreground">
                Período: {meses[mes - 1]?.label} de {ano}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-slate-700/50 bg-gradient-to-br from-blue-900/40 to-blue-950/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-300/70">Total de Horas</p>
                <p className="text-2xl font-bold text-blue-100">{totalHoras.toFixed(2)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/70">Clientes Ativos</p>
                <p className="text-2xl font-bold text-emerald-100">{comparativoFiltrado.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-gradient-to-br from-green-900/40 to-green-950/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-green-300/70">Validados</p>
                <p className="text-2xl font-bold text-green-100">{validados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-gradient-to-br from-amber-900/40 to-amber-950/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-amber-300/70">Pendentes</p>
                <p className="text-2xl font-bold text-amber-100">{pendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {isLoading ? (
        <Card className="border-slate-700/50 bg-slate-800/60">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-slate-700/50 bg-slate-800/60">
          <CardContent className="pt-6">
            <div className="flex justify-center py-8">
              <p className="text-red-400">Erro ao carregar dados</p>
            </div>
          </CardContent>
        </Card>
      ) : chartData.length === 0 ? (
        <Card className="border-slate-700/50 bg-slate-800/60">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Plane className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum voo registrado para o período selecionado</p>
              <p className="text-sm text-muted-foreground/70">Selecione outro mês/ano ou verifique os registros no Diário de Bordo</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gráfico de Barras */}
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Horas por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(value: any) => [value.toFixed(2) + 'h', 'Horas']}
                  />
                  <Bar dataKey="horas" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Percentual de Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentual }) => `${name} (${percentual.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentual"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => value.toFixed(2) + '%'}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tabela de Detalhes */}
      <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Detalhes por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-muted-foreground">Ranking</TableHead>
                    <TableHead className="text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-right text-muted-foreground">Horas Voadas</TableHead>
                    <TableHead className="text-right text-muted-foreground">Total Aeronave</TableHead>
                    <TableHead className="text-right text-muted-foreground">Percentual</TableHead>
                    <TableHead className="text-muted-foreground">Validação</TableHead>
                    <TableHead className="text-muted-foreground">Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativoFiltrado.map((item) => (
                    <TableRow key={item.cliente_id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600">#{item.ranking}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{item.cliente_nome}</TableCell>
                      <TableCell className="text-right text-foreground">
                        {item.horas_voadas.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.horas_totais_aeronave.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {item.percentual_uso.toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        {item.validado ? (
                          <Badge className="bg-green-900/50 text-green-400 border-green-700">
                            ✓ Validado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                            ⚠ Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs">
                          {item.fonte_diario_bordo && (
                            <Badge variant="secondary" className="bg-slate-700 text-slate-300">Diário</Badge>
                          )}
                          {item.fonte_portal_cliente && (
                            <Badge variant="secondary" className="bg-slate-700 text-slate-300">Portal</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
