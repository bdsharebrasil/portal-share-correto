import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ComparativoUsoClientes } from '@/types/consolidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, Check } from 'lucide-react';

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

  const { data: comparativo = [], isLoading, error } = useQuery({
    queryKey: ['comparativo-uso', aeronaveId, ano, mes],
    queryFn: async () => {
      if (!aeronaveId) return [];

      const response = await fetch(
        `/api/consolidacao/comparativo-uso/${aeronaveId}?ano=${ano}&mes=${mes}`
      );

      if (!response.ok) throw new Error('Falha ao carregar comparativo');
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!aeronaveId,
  });

  const comparativoFiltrado = clienteId
    ? comparativo.filter((item: ComparativoUsoClientes) => item.cliente_id === clienteId)
    : comparativo;

  const chartData = comparativoFiltrado.map((item: ComparativoUsoClientes) => ({
    name: item.cliente_nome,
    horas: parseFloat(item.horas_voadas.toString()),
    percentual: parseFloat(item.percentual_uso.toString()),
    ranking: item.ranking,
  }));

  const validados = comparativoFiltrado.filter((item: ComparativoUsoClientes) => item.validado).length;
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
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Consolidação de Horas Mensais</CardTitle>
          <CardDescription>
            Visualize o uso da aeronave por cliente no período
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

      {/* Resumo */}
      {comparativoFiltrado.length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Total de Horas</p>
                <p className="text-2xl font-bold">{totalHoras.toFixed(2)}h</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1">Clientes Ativos</p>
                <p className="text-2xl font-bold">{comparativoFiltrado.length}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-600" /> Validados
                </p>
                <p className="text-2xl font-bold text-green-600">{validados}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-yellow-600" /> Pendentes
                </p>
                <p className="text-2xl font-bold text-yellow-600">{pendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      {isLoading ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex justify-center py-8">
              <p className="text-slate-500">Carregando dados...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex justify-center py-8">
              <p className="text-red-500">Erro ao carregar dados</p>
            </div>
          </CardContent>
        </Card>
      ) : chartData.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex justify-center py-8">
              <p className="text-slate-500">Nenhum dado para o período selecionado</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Gráfico de Barras */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Horas por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                    formatter={(value: any) => value.toFixed(2)}
                  />
                  <Bar dataKey="horas" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Percentual de Uso</CardTitle>
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
                    contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tabela de Detalhes */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Detalhes por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Nenhum dado disponível</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ranking</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Horas Voadas</TableHead>
                    <TableHead className="text-right">Total Aeronave</TableHead>
                    <TableHead className="text-right">Percentual</TableHead>
                    <TableHead>Validação</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativoFiltrado.map((item: ComparativoUsoClientes) => (
                    <TableRow key={item.cliente_id} className="hover:bg-slate-50">
                      <TableCell>
                        <Badge variant="outline">#{item.ranking}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.cliente_nome}</TableCell>
                      <TableCell className="text-right">
                        {item.horas_voadas.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {item.horas_totais_aeronave.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {item.percentual_uso.toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        {item.validado ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            ✓ Validado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-300">
                            ⚠ Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs">
                          {item.fonte_diario_bordo && (
                            <Badge variant="secondary">Diário</Badge>
                          )}
                          {item.fonte_portal_cliente && (
                            <Badge variant="secondary">Portal</Badge>
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
