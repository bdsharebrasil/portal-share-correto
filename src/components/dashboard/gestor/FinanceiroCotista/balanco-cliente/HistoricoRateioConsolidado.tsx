import React, { useState, useEffect } from 'react';
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
import { Download, FileText, DollarSign, Clock } from 'lucide-react';

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
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('__all__');

  // Definir data padrão (últimos 12 meses)
  useEffect(() => {
    const hoje = new Date();
    const umAnoAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());

    setDataFim(format(hoje, 'yyyy-MM-dd'));
    setDataInicio(format(umAnoAtras, 'yyyy-MM-dd'));
  }, []);

  // Atualizar clienteId quando prop mudar
  useEffect(() => {
    setSelectedClienteId(clienteId);
  }, [clienteId]);

  // Buscar movimentações diretamente do Supabase
  const { data: movimentacoes = [], isLoading, error } = useQuery({
    queryKey: ['historico-rateio', selectedClienteId, dataInicio, dataFim],
    queryFn: async () => {
      if (!selectedClienteId) return [];

      let query = supabase
        .from('conciliacoes_bancarias')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (id, nome, grupo_categoria),
          aircraft:aeronave_id (id, registration, model)
        `)
        .eq('clientes_id', selectedClienteId)
        .order('date', { ascending: false });

      if (dataInicio) {
        query = query.gte('date', dataInicio);
      }
      if (dataFim) {
        query = query.lte('date', dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        data_competencia: item.data,
        aeronave_registro: item.aeronave?.matricula || 'N/A',
        categoria_nome: item.categorias_movimentacao?.nome || item.categoria || 'Sem categoria',
        categoria_grupo: item.categorias_movimentacao?.grupo_categoria || 'Outros',
        descricao: item.descricao,
        tipo_rateio: item.percentual ? 'percentual' : 'valor',
        horas_voadas: 0, // Seria calculado com base em logbook
        percentual_uso: parseFloat(item.percentual || '0'),
        valor_total_lancamento: item.valor || 0,
        valor_rateado: item.valor || 0,
        valor_pago: item.valor_reembolsado || 0,
        saldo_devedor: (item.valor || 0) - (item.valor_reembolsado || 0),
        status_pagamento: item.status === 'reembolsado' ? 'Pago' :
          item.status === 'pendente' ? 'Pendente' :
            item.status === 'inadimplente' ? 'Inadimplente' : item.status,
        tipo: item.tipo,
      }));
    },
    enabled: !!selectedClienteId,
  });

  const extratoFiltrado = movimentacoes.filter((item: any) => {
    if (categoriaFiltro && categoriaFiltro !== '__all__' && item.categoria_grupo !== categoriaFiltro) {
      return false;
    }
    return true;
  });

  const totalizacao = {
    lancamentos: extratoFiltrado.length,
    valorTotal: extratoFiltrado.reduce((sum: number, item: any) => sum + item.valor_rateado, 0),
    valorPago: extratoFiltrado.reduce((sum: number, item: any) => sum + item.valor_pago, 0),
    saldoDevedor: extratoFiltrado.reduce((sum: number, item: any) => sum + item.saldo_devedor, 0),
    horasTotal: extratoFiltrado.reduce((sum: number, item: any) => sum + item.horas_voadas, 0),
  };

  const categorias = Array.from(
    new Set(movimentacoes.map((item: any) => item.categoria_grupo))
  ).filter(Boolean);

  const handleExportCSV = () => {
    const headers = [
      'Data Competência',
      'Aeronave',
      'Categoria',
      'Descrição',
      'Tipo',
      'Valor Total',
      'Valor Pago',
      'Saldo',
      'Status Pagamento',
    ];

    const rows = extratoFiltrado.map((item: any) => [
      format(new Date(item.data_competencia), 'dd/MM/yyyy', { locale: ptBR }),
      item.aeronave_registro,
      item.categoria_nome,
      item.descricao || '-',
      item.tipo === 'entrada' ? 'Receita' : 'Despesa',
      'R$ ' + item.valor_rateado.toFixed(2),
      'R$ ' + item.valor_pago.toFixed(2),
      'R$ ' + item.saldo_devedor.toFixed(2),
      item.status_pagamento,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico-rateio-${selectedClienteId}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Histórico Consolidado de Rateio</CardTitle>
          <CardDescription>
            Registro de despesas e movimentações do cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {showClienteFilter && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                <Input
                  placeholder="ID do Cliente"
                  value={selectedClienteId || ''}
                  onChange={(e) => setSelectedClienteId(e.target.value)}
                  className="bg-slate-700/50 border-slate-600"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Data Inicial</label>
              <Input
                type="data"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-slate-700/50 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Data Final</label>
              <Input
                type="data"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-slate-700/50 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Categoria</label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
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
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mt-6">
              <Card className="border-slate-700/50 bg-gradient-to-br from-slate-700/40 to-slate-800/60">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lançamentos</p>
                      <p className="text-lg font-semibold text-foreground">{totalizacao.lancamentos}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-gradient-to-br from-slate-700/40 to-slate-800/60">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <DollarSign className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="text-lg font-semibold text-foreground">R$ {totalizacao.valorTotal.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700/50 bg-gradient-to-br from-green-900/40 to-green-950/60">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <DollarSign className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-green-300/70">Valor Pago</p>
                      <p className="text-lg font-semibold text-green-400">R$ {totalizacao.valorPago.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-slate-700/50 ${totalizacao.saldoDevedor > 0 ? 'bg-gradient-to-br from-red-900/40 to-red-950/60' : 'bg-gradient-to-br from-green-900/40 to-green-950/60'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${totalizacao.saldoDevedor > 0 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                      <DollarSign className={`h-4 w-4 ${totalizacao.saldoDevedor > 0 ? 'text-red-400' : 'text-green-400'}`} />
                    </div>
                    <div>
                      <p className={`text-xs ${totalizacao.saldoDevedor > 0 ? 'text-red-300/70' : 'text-green-300/70'}`}>Saldo Devedor</p>
                      <p className={`text-lg font-semibold ${totalizacao.saldoDevedor > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        R$ {totalizacao.saldoDevedor.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Botão Exportar */}
          {extratoFiltrado.length > 0 && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 border-slate-600 hover:bg-slate-700"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : error ? (
            <div className="flex justify-center py-8">
              <p className="text-red-400">Erro ao carregar histórico</p>
            </div>
          ) : extratoFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum registro encontrado</p>
              <p className="text-sm text-muted-foreground/70">Ajuste os filtros ou verifique os lançamentos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-muted-foreground">Data</TableHead>
                    <TableHead className="text-muted-foreground">Aeronave</TableHead>
                    <TableHead className="text-muted-foreground">Categoria</TableHead>
                    <TableHead className="text-muted-foreground">Descrição</TableHead>
                    <TableHead className="text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-right text-muted-foreground">Valor</TableHead>
                    <TableHead className="text-right text-muted-foreground">Pago</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratoFiltrado.map((item: any) => (
                    <TableRow key={item.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-foreground">
                        {format(new Date(item.data_competencia), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{item.aeronave_registro}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600">{item.categoria_grupo}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate text-muted-foreground">
                        {item.descricao || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.tipo === 'entrada' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}>
                          {item.tipo === 'entrada' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        R$ {item.valor_rateado.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-400">
                        R$ {item.valor_pago.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            item.status_pagamento === 'Pago'
                              ? 'bg-green-900/50 text-green-400 border-green-700'
                              : item.status_pagamento === 'Pendente'
                                ? 'bg-amber-900/50 text-amber-400 border-amber-700'
                                : item.status_pagamento === 'Inadimplente'
                                  ? 'bg-red-900/50 text-red-400 border-red-700'
                                  : 'bg-slate-700 text-slate-300'
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