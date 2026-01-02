import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { ExtratoCliente } from '@/types/consolidation';
import { Download, Filter, X } from 'lucide-react';

interface HistoricoRateioConsolidadoProps {
  clienteId?: string;
  showClienteFilter?: boolean;
}

export function HistoricoRateioConsolidado({
  clienteId,
  showClienteFilter = false,
}: HistoricoRateioConsolidadoProps) {
  const [selectedClienteId, setSelectedClienteId] = useState(clienteId);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');

  // Definir data padrão (últimos 12 meses)
  useEffect(() => {
    const hoje = new Date();
    const umAnoAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
    
    setDataFim(format(hoje, 'yyyy-MM-dd'));
    setDataInicio(format(umAnoAtras, 'yyyy-MM-dd'));
  }, []);

  const { data: extrato = [], isLoading, error } = useQuery({
    queryKey: ['extrato-cliente', selectedClienteId, dataInicio, dataFim],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      
      const params = new URLSearchParams();
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const response = await fetch(
        `/api/consolidacao/extrato-cliente/${selectedClienteId}?${params.toString()}`
      );
      
      if (!response.ok) throw new Error('Falha ao carregar extrato');
      const json = await response.json();
      return json.data || [];
    },
    enabled: !!selectedClienteId,
  });

  const extratoFiltrado = extrato.filter((item: ExtratoCliente) => {
    if (categoriaFiltro && categoriaFiltro !== '__all__' && item.categoria_grupo !== categoriaFiltro) {
      return false;
    }
    return true;
  });

  const totalizacao = {
    lancamentos: extratoFiltrado.length,
    valorTotal: extratoFiltrado.reduce((sum, item) => sum + item.valor_rateado, 0),
    valorPago: extratoFiltrado.reduce((sum, item) => sum + item.valor_pago, 0),
    saldoDevedor: extratoFiltrado.reduce((sum, item) => sum + item.saldo_devedor, 0),
    horasTotal: extratoFiltrado.reduce((sum, item) => sum + item.horas_voadas, 0),
  };

  const categorias = Array.from(
    new Set(extrato.map((item: ExtratoCliente) => item.categoria_grupo))
  );

  const handleExportCSV = () => {
    const headers = [
      'Data Competência',
      'Aeronave',
      'Categoria',
      'Descrição',
      'Tipo Rateio',
      'Horas Voadas',
      'Percentual Uso',
      'Valor Total',
      'Valor Rateado',
      'Valor Pago',
      'Saldo',
      'Status Pagamento',
    ];

    const rows = extratoFiltrado.map((item: ExtratoCliente) => [
      format(new Date(item.data_competencia), 'dd/MM/yyyy', { locale: ptBR }),
      item.aeronave_registro,
      item.categoria_nome,
      item.descricao || '-',
      item.tipo_rateio === 'percentual' ? 'Percentual' : 'Horas de Uso',
      item.horas_voadas.toFixed(2),
      item.percentual_uso.toFixed(2) + '%',
      'R$ ' + item.valor_total_lancamento.toFixed(2),
      'R$ ' + item.valor_rateado.toFixed(2),
      'R$ ' + item.valor_pago.toFixed(2),
      'R$ ' + item.saldo_devedor.toFixed(2),
      item.status_pagamento,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato-${selectedClienteId}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Histórico Consolidado de Rateio</CardTitle>
          <CardDescription>
            Registro permanente de despesas pagas e conciliadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {showClienteFilter && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  placeholder="ID do Cliente"
                  value={selectedClienteId || ''}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat as string} value={cat as string}>
                      {cat as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Totalizações */}
          {extratoFiltrado.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs text-slate-600">Lançamentos</p>
                <p className="text-lg font-semibold">{totalizacao.lancamentos}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Valor Total</p>
                <p className="text-lg font-semibold">R$ {totalizacao.valorTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Valor Pago</p>
                <p className="text-lg font-semibold text-green-600">R$ {totalizacao.valorPago.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Saldo Devedor</p>
                <p className={`text-lg font-semibold ${totalizacao.saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  R$ {totalizacao.saldoDevedor.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600">Horas Total</p>
                <p className="text-lg font-semibold">{totalizacao.horasTotal.toFixed(2)}h</p>
              </div>
            </div>
          )}

          {/* Botão Exportar */}
          {extratoFiltrado.length > 0 && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p className="text-slate-500">Carregando histórico...</p>
            </div>
          ) : error ? (
            <div className="flex justify-center py-8">
              <p className="text-red-500">Erro ao carregar histórico</p>
            </div>
          ) : extratoFiltrado.length === 0 ? (
            <div className="flex justify-center py-8">
              <p className="text-slate-500">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Aeronave</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Uso %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Rateado</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratoFiltrado.map((item: ExtratoCliente) => (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell>
                        {format(new Date(item.data_competencia), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{item.aeronave_registro}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.categoria_grupo}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {item.descricao || '-'}
                      </TableCell>
                      <TableCell className="text-right">{item.horas_voadas.toFixed(2)}h</TableCell>
                      <TableCell className="text-right">{item.percentual_uso.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">
                        R$ {item.valor_total_lancamento.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {item.valor_rateado.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {item.valor_pago.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status_pagamento === 'Pago'
                              ? 'default'
                              : item.status_pagamento === 'Pendente'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {item.status_pagamento}
                        </Badge>
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
