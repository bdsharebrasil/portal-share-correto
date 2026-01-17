import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Download, FileText, ExternalLink, Eye } from 'lucide-react';

interface DespesasDetalhadasProps {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente Envio', variant: 'destructive' },
  enviado: { label: 'Enviado', variant: 'secondary' },
  pago: { label: 'Pago', variant: 'default' },
  conciliado: { label: 'Conciliado', variant: 'default' },
  aguardando_reembolso: { label: 'Aguardando Reembolso', variant: 'outline' },
  reembolsado: { label: 'Reembolsado', variant: 'default' },
};

export function DespesasDetalhadas({ clienteId, aeronaveId, periodo }: DespesasDetalhadasProps) {
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');

  // Buscar despesas
  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ['despesas-detalhadas', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (id, nome, grupo_categoria),
          aircraft:aircraft_id (registration)
        `)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim)
        .order('date', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar categorias para filtro
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  // Filtrar despesas
  const despesasFiltradas = despesas.filter((d: any) => {
    const matchBusca = !busca || 
      d.description?.toLowerCase().includes(busca.toLowerCase()) ||
      d.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    const matchCategoria = categoriaFilter === 'todas' || 
      d.categorias_movimentacao?.id === categoriaFilter;
    return matchBusca && matchStatus && matchCategoria;
  });

  const totalFiltrado = despesasFiltradas.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

  const handleExportCSV = () => {
    const csv = [
      ['Data', 'Categoria', 'Descrição', 'Valor', 'Status', 'Aeronave'].join(','),
      ...despesasFiltradas.map((d: any) => [
        format(new Date(d.date), 'dd/MM/yyyy'),
        d.categorias_movimentacao?.nome || '',
        `"${d.description || ''}"`,
        d.amount?.toFixed(2) || '0',
        STATUS_LABELS[d.status]?.label || d.status,
        d.aircraft?.registration || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `despesas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente Envio</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="aguardando_reembolso">Aguardando Reembolso</SelectItem>
                <SelectItem value="reembolsado">Reembolsado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Despesas Detalhadas</CardTitle>
            <CardDescription>
              {despesasFiltradas.length} despesas | Total: R$ {totalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : despesasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aeronave</TableHead>
                    <TableHead className="text-center">Docs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.map((despesa: any) => (
                    <TableRow key={despesa.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(despesa.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {despesa.categorias_movimentacao?.nome || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {despesa.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(despesa.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABELS[despesa.status]?.variant || 'secondary'}>
                          {STATUS_LABELS[despesa.status]?.label || despesa.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {despesa.aircraft?.registration || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {despesa.comprovante_url && (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <a href={despesa.comprovante_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {despesa.boleto_url && (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <a href={despesa.boleto_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {despesa.nf_url && (
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <a href={despesa.nf_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
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
