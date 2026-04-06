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
import { Search, FileText, Eye, Image, Receipt } from 'lucide-react';
import { DocumentoViewer } from './DocumentoViewer';

interface DespesasDetalhadasProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente Envio', variant: 'destructive' },
  enviado: { label: 'Enviado', variant: 'secondary' },
  pago: { label: 'Pago', variant: 'default' },
  conciliado: { label: 'Conciliado', variant: 'default' },
  aguardando_reembolso: { label: 'Aguardando Reembolso', variant: 'outline' },
  aguardando_pagamento: { label: 'Aguardando Pagamento', variant: 'outline' },
  visualizado_cliente: { label: 'Visualizado', variant: 'secondary' },
  comprovante_recebido: { label: 'Comprovante Recebido', variant: 'default' },
  reembolsado: { label: 'Reembolsado', variant: 'default' },
  atrasado: { label: 'Atrasado', variant: 'destructive' },
};

export function DespesasDetalhadas({ clienteId, aeronaveId, periodo }: DespesasDetalhadasProps) {
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [fonteFilter, setFonteFilter] = useState('todas');
  const [documentoViewerOpen, setDocumentoViewerOpen] = useState(false);
  const [documentoUrl, setDocumentoUrl] = useState('');
  const [documentoTitle, setDocumentoTitle] = useState('');

  const openDocumento = (url: string, title: string) => {
    setDocumentoUrl(url);
    setDocumentoTitle(title);
    setDocumentoViewerOpen(true);
  };

  // Buscar despesas de bank_reconciliations
  const { data: despesasBankRec = [], isLoading: loadingBankRec } = useQuery({
    queryKey: ['despesas-bank-rec', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('conciliacoes_bancarias')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (id, nome, grupo_categoria),
          aircraft:aeronave_id (id, matricula)
        `)
        .eq('clientes_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim)
        .order('data', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        fonte: 'bank_reconciliations',
        valor: d.valor,
        data: d.data,
        descricao: d.descricao,
        situacao: d.status || 'pendente',
        categoria_nome: d.categorias_movimentacao?.nome || 'Sem categoria',
        aeronave_registro: d.aircraft?.matricula || '-',
      }));
    },
    enabled: !!clienteId,
  });

  // Buscar despesas de despesas_cliente_direto
  const { data: despesasDiretas = [], isLoading: loadingDiretas } = useQuery({
    queryKey: ['despesas-cliente-direto', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('despesas_cliente_direto')
        .select(`
          *,
          aircraft:aeronave_id (id, matricula)
        `)
        .eq('clientes_id', clienteId)
        .gte('data_vencimento', periodo.inicio)
        .lte('data_vencimento', periodo.fim)
        .order('data_vencimento', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        fonte: 'despesas_cliente_direto',
        valor: d.valor,
        data: d.data_vencimento,
        descricao: d.descricao,
        situacao: d.status || 'pendente',
        categoria_nome: d.categoria || 'Pagamento Direto',
        aeronave_registro: d.aircraft?.matricula || '-',
        comprovante_url: d.comprovante_url,
        boleto_url: d.boleto_url,
        nf_url: null,
      }));
    },
    enabled: !!clienteId,
  });

  // Buscar abastecimentos
  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useQuery({
    queryKey: ['despesas-abastecimentos', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('abastecimentos')
        .select(`
          *,
          aircraft:aeronave_id (id, matricula)
        `)
        .eq('id_clientes', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim)
        .order('data', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        fonte: 'abastecimentos',
        valor: d.valor_total,
        data: d.data,
        descricao: `Abastecimento - ${d.local} (${d.trecho})`,
        situacao: d.status_pagamento || 'pendente',
        categoria_nome: 'Combustível',
        aeronave_registro: d.aircraft?.matricula || '-',
        comprovante_url: d.comanda_url,
        boleto_url: d.boleto_url,
        nf_url: d.nota_url,
      }));
    },
    enabled: !!clienteId,
  });

  // Combinar despesas de todas as fontes
  const despesas = [...despesasBankRec, ...despesasDiretas, ...abastecimentos].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
  const isLoading = loadingBankRec || loadingDiretas || loadingAbastecimentos;

  // Buscar categorias para filtro (apenas categorias do cliente)
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-filtro'],
    queryFn: async () => {
      // Keywords para identificar as categorias permitidas
      const keywordPermitidos = ['aeronave', 'reembolsável', 'reembolso', 'operacional', 'receita'];

      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // Filtrar categorias que contêm alguma keyword permitida
      return (data || []).filter((cat: any) =>
        keywordPermitidos.some(keyword =>
          cat.nome.toLowerCase().includes(keyword)
        )
      );
    },
  });

  // Filtrar despesas
  const despesasFiltradas = despesas.filter((d: any) => {
    const matchBusca = !busca ||
      d.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      d.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = statusFilter === 'todos' || d.situacao === statusFilter;
    const matchCategoria = categoriaFilter === 'todas' ||
      d.categorias_movimentacao?.id === categoriaFilter ||
      d.categoria_nome?.toLowerCase().includes(categoriaFilter.toLowerCase());
    const matchFonte = fonteFilter === 'todas' || d.fonte === fonteFilter;
    return matchBusca && matchStatus && matchCategoria && matchFonte;
  });

  const totalFiltrado = despesasFiltradas.reduce((sum: number, d: any) => sum + (d.valor || 0), 0);


  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-border/50 bg-card/60">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
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
                <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                <SelectItem value="visualizado_cliente">Visualizado</SelectItem>
                <SelectItem value="comprovante_recebido">Comprovante Recebido</SelectItem>
                <SelectItem value="reembolsado">Reembolsado</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
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

            <Select value={fonteFilter} onValueChange={setFonteFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as fontes</SelectItem>
                <SelectItem value="conciliacoes_bancarias">Reembolsos</SelectItem>
                <SelectItem value="despesas_cliente_direto">Pagamento Direto</SelectItem>
                <SelectItem value="abastecimentos">Combustível</SelectItem>
              </SelectContent>
            </Select>

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
                    <TableHead>Data Vencimento</TableHead>
                    <TableHead>Fonte</TableHead>
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
                    <TableRow key={`${despesa.fonte}-${despesa.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(despesa.data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            despesa.fonte === 'despesas_cliente_direto'
                              ? 'outline'
                              : despesa.fonte === 'abastecimentos'
                                ? 'default'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {despesa.fonte === 'despesas_cliente_direto'
                            ? 'Pag. Direto'
                            : despesa.fonte === 'abastecimentos'
                              ? 'Combustível'
                              : 'Reembolso'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {despesa.categoria_nome || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {despesa.descricao || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(despesa.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABELS[despesa.situacao]?.variant || 'secondary'}>
                          {STATUS_LABELS[despesa.situacao]?.label || despesa.situacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {despesa.aeronave_registro || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {despesa.comprovante_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDocumento(despesa.comprovante_url, 'Comprovante')}
                              title="Ver Comprovante"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {despesa.boleto_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDocumento(despesa.boleto_url, 'Boleto')}
                              title="Ver Boleto"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {despesa.nf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDocumento(despesa.nf_url, 'Nota Fiscal')}
                              title="Ver Nota Fiscal"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}
                          {!despesa.comprovante_url && !despesa.boleto_url && !despesa.nf_url && (
                            <span className="text-xs text-muted-foreground">-</span>
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

      {/* Document Viewer Modal */}
      <DocumentoViewer
        open={documentoViewerOpen}
        onOpenChange={setDocumentoViewerOpen}
        url={documentoUrl}
        title={documentoTitle}
      />
    </div>
  );
}