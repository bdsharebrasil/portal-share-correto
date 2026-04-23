import React, { useState } from 'react';
import { useHistoricoRateioConsolidado, useEstatisticasHistorico } from '@/hooks/useHistoricoRateioConsolidado';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Download, Filter, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricoRateioConsolidadoProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: {
    inicio: string;
    fim: string;
  };
}

const CATEGORIA_GRUPOS = [
  'REEMBOLSOS',
  'Despesas Aeronave',
  'RECEITAS OPERACIONAIS',
  'DESPESAS REEMBOLSÁVEIS',
  'Combustível',
  'Manutenção',
];

export function HistoricoRateioConsolidado({
  clienteId,
  socioId,
  aeronaveId,
  periodo,
}: HistoricoRateioConsolidadoProps) {
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroReembolsos, setFiltroReembolsos] = useState<string>('todos');

  // Buscar dados do histórico
  const { 
    data: historicoData = [], 
    isLoading, 
    error,
    refetch
  } = useHistoricoRateioConsolidado({
    clienteId,
    socioId,
    aeronaveId,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    enabled: !!clienteId,
  });

  // Buscar estatísticas
  const { data: estatisticas } = useEstatisticasHistorico({
    clienteId,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    enabled: !!clienteId,
  });

  // Aplicar filtros ao histórico
  let dadosFiltrados = historicoData;

  if (filtroCategoria) {
    dadosFiltrados = dadosFiltrados.filter(
      (item) => item.categoria_grupo === filtroCategoria
    );
  }

  if (filtroReembolsos === 'reembolsos') {
    dadosFiltrados = dadosFiltrados.filter((item) => item.foi_reembolso);
  } else if (filtroReembolsos === 'nao-reembolsos') {
    dadosFiltrados = dadosFiltrados.filter((item) => !item.foi_reembolso);
  }

  // Calcular totais do filtrado
  const totaisFiltrados = {
    valor: dadosFiltrados.reduce((sum, item) => sum + (item.valor_rateado || 0), 0),
    horas: dadosFiltrados.reduce((sum, item) => sum + (item.horas_voadas || 0), 0),
    reembolsos: dadosFiltrados.filter((item) => item.foi_reembolso).length,
  };

  const handleExportarCSV = () => {
    const csv = [
      ['Data Competência', 'Aeronave', 'Categoria', 'Descrição', 'Horas Voadas', 'Percentual', 'Valor Rateado', 'Reembolso'],
      ...dadosFiltrados.map((item) => [
        format(parseISO(item.data_competencia), 'dd/MM/yyyy'),
        item.aeronave_registro,
        item.categoria_nome,
        item.descricao,
        item.horas_voadas.toFixed(2),
        `${item.percentual_participacao?.toFixed(2) || '0'}%`,
        `R$ ${item.valor_rateado.toFixed(2)}`,
        item.foi_reembolso ? 'Sim' : 'Não',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-rateio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar histórico</p>
              <p className="text-sm text-destructive/80 mt-1">
                {(error as Error)?.message || 'Ocorreu um erro ao buscar os dados'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3"
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!historicoData || historicoData.length === 0) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum histórico encontrado</p>
            <p className="text-sm mt-1">
              Não há registros consolidados para o período selecionado
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dadosFiltrados.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {estatisticas.total_registros}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Total Rateado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totaisFiltrados.valor.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                de R$ {estatisticas.total_valor_rateado.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Voadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totaisFiltrados.horas.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {estatisticas.total_horas_voadas.toFixed(1)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reembolsos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totaisFiltrados.reembolsos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {estatisticas.total_reembolsos}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card com Tabela */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Histórico de Rateio Consolidado</CardTitle>
              <CardDescription>
                {dadosFiltrados.length} registros encontrados
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end mt-4">
            <Filter className="h-4 w-4 text-muted-foreground md:mt-6" />
            
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Categoria
              </label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIA_GRUPOS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <Select value={filtroReembolsos} onValueChange={setFiltroReembolsos}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="reembolsos">Apenas Reembolsos</SelectItem>
                  <SelectItem value="nao-reembolsos">Sem Reembolsos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tabela Responsiva */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-foreground">
                    Data Competência
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">
                    Aeronave
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">
                    Categoria
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">
                    Horas
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-right">
                    Percentual
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-right">
                    Valor Rateado
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosFiltrados.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-xs font-medium">
                      {format(parseISO(item.data_competencia), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="font-mono">
                        {item.aeronave_registro}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{item.categoria_nome}</TableCell>
                    <TableCell className="text-xs text-right">
                      {item.horas_voadas.toFixed(2)}h
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {item.percentual_participacao?.toFixed(2) || '0'}%
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      R$ {item.valor_rateado.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={item.foi_reembolso ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {item.foi_reembolso ? '♻️ Reembolso' : 'Despesa'}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totalizadores */}
          <div className="mt-6 pt-4 border-t border-border/50 flex justify-between md:justify-end md:gap-8">
            <div className="text-sm">
              <span className="text-muted-foreground">Total Horas:</span>
              <span className="ml-2 font-bold">{totaisFiltrados.horas.toFixed(2)}h</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Total Valor:</span>
              <span className="ml-2 font-bold">R$ {totaisFiltrados.valor.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
