import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Send, CheckCircle, Receipt, Fuel } from 'lucide-react';
import { MarcarPagoDialog } from './MarcarPagoDialog';

interface PendenciasFinanceirasProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
}

export function PendenciasFinanceiras({ clienteId, aeronaveId }: PendenciasFinanceirasProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState<'despesa_direta' | 'reembolso' | 'combustivel'>('despesa_direta');
  const [selectedItemId, setSelectedItemId] = useState('');

  const handleOpenPagoDialog = (tipo: 'despesa_direta' | 'reembolso' | 'combustivel', id: string) => {
    setDialogTipo(tipo);
    setSelectedItemId(id);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['pagamento-direto-pendente'] });
    queryClient.invalidateQueries({ queryKey: ['aguardando-reembolso'] });
    queryClient.invalidateQueries({ queryKey: ['combustivel-pendente'] });
    queryClient.invalidateQueries({ queryKey: ['balanco-resumo'] });
  };

  // Valores enviados ao cliente - Pagamento Direto (status: enviado, visualizado_cliente, aguardando_pagamento, atrasado)
  const { data: pagamentoDiretoPendente = [], isLoading: loadingDireto } = useQuery({
    queryKey: ['pagamento-direto-pendente', clienteId, aeronaveId],
    queryFn: async () => {
      let query = supabase
        .from('despesas_cliente_direto')
        .select(`
          *,
          aircraft:aeronave_id (id, matricula)
        `)
        .eq('clientes_id', clienteId)
        .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado'])
        .order('data_vencimento', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Valores aguardando reembolso (bank_reconciliations com status aguardando_reembolso)
  const { data: aguardandoReembolso = [], isLoading: loadingReembolso } = useQuery({
    queryKey: ['aguardando-reembolso', clienteId, aeronaveId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('conciliacoes_bancarias')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome),
          aircraft:aeronave_id (matricula)
        `)
        .eq('clientes_id', clienteId)
        .eq('status', 'aguardando_reembolso')
        .order('data', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Combustível enviado (pendente de pagamento)
  const { data: combustivelPendente = [], isLoading: loadingCombustivel } = useQuery({
    queryKey: ['combustivel-pendente', clienteId, aeronaveId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('abastecimentos')
        .select(`
          *,
          aircraft:aeronave_id (matricula)
        `)
        .eq('clientes_id', clienteId)
        .neq('status_pagamento', 'pago')
        .order('data', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const totalDireto = pagamentoDiretoPendente.reduce((sum: number, d: any) => sum + (d.valor || 0), 0);
  const totalReembolso = aguardandoReembolso.reduce((sum: number, d: any) => sum + ((d.saldo_pendente || d.valor) || 0), 0);
  const totalCombustivel = combustivelPendente.reduce((sum: number, d: any) => sum + (d.valor_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Seção 1: Valores Enviados ao Cliente - Pagamento Direto */}
      <Card className="border-purple-500/30 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Send className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Valores Enviados ao Cliente - Pagamento Direto</CardTitle>
              <CardDescription>
                Despesas enviadas ao cliente aguardando pagamento
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-500">
              R$ {totalDireto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{pagamentoDiretoPendente.length} despesas</p>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDireto ? (
            <div className="text-center py-4">Carregando...</div>
          ) : pagamentoDiretoPendente.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhuma despesa pendente de pagamento</p>
            </div>
          ) : (
            <Table>
                <TableHeader>
                <TableRow>
                  <TableHead>Data Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Aeronave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentoDiretoPendente.map((item: any) => {
                  const diasAtraso = differenceInDays(new Date(), new Date(item.data_vencimento + 'T00:00:00'));
                  const isAtrasado = diasAtraso > 0;

                  return (
                    <TableRow key={item.id} className={isAtrasado ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {format(new Date(item.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.descricao || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{item.aeronave?.matricula || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={isAtrasado ? 'destructive' : 'secondary'}>
                          {isAtrasado ? `${diasAtraso} dias atrasado` : item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPagoDialog('despesa_direta', item.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Marcar Pago
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Aguardando Reembolso */}
      <Card className="border-yellow-500/30 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Valores Aguardando Reembolso</CardTitle>
              <CardDescription>
                Despesas pagas pela empresa aguardando reembolso do cliente
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-500">
              R$ {totalReembolso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{aguardandoReembolso.length} despesas</p>
          </div>
        </CardHeader>
        <CardContent>
          {loadingReembolso ? (
            <div className="text-center py-4">Carregando...</div>
          ) : aguardandoReembolso.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum reembolso pendente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Dias Pendente</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aguardandoReembolso.map((item: any) => {
                  const diasPendente = differenceInDays(new Date(), new Date(item.data + 'T00:00:00'));
                  const isAtrasado = diasPendente > 30;
                  
                  return (
                    <TableRow key={item.id} className={isAtrasado ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {format(new Date(item.data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{item.categorias_movimentacao?.nome || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.descricao || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {((item.saldo_pendente || item.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isAtrasado ? 'destructive' : 'secondary'}>
                          {diasPendente} dias
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPagoDialog('reembolso', item.id)}
                          >
                            <Receipt className="h-3 w-3 mr-1" />
                            Registrar Reembolso
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Seção 3: Combustível Enviado */}
      <Card className="border-orange-500/30 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Fuel className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Combustível Enviado</CardTitle>
              <CardDescription>
                Abastecimentos enviados ao cliente pendentes de pagamento
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-500">
              R$ {totalCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{combustivelPendente.length} abastecimentos</p>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCombustivel ? (
            <div className="text-center py-4">Carregando...</div>
          ) : combustivelPendente.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum combustível pendente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Trecho</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Aeronave</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combustivelPendente.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{item.local || '-'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{item.trecho || '-'}</TableCell>
                    <TableCell className="text-right">
                      {(item.litros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{item.aeronave?.matricula || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPagoDialog('combustivel', item.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Marcar Pago
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para registrar pagamento */}
      <MarcarPagoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo={dialogTipo}
        itemId={selectedItemId}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
