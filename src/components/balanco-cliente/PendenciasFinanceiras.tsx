import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Clock, Send, CheckCircle, Mail, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface PendenciasFinanceirasProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
}

export function PendenciasFinanceiras({ clienteId, aeronaveId }: PendenciasFinanceirasProps) {
  const queryClient = useQueryClient();

  // Valores a enviar ao cliente (pendentes)
  const { data: pendentesEnvio = [], isLoading: loadingEnvio } = useQuery({
    queryKey: ['pendentes-envio', clienteId, aeronaveId],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome),
          aircraft:aircraft_id (registration)
        `)
        .eq('client_id', clienteId)
        .eq('status', 'pendente')
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

  // Valores aguardando reembolso
  const { data: aguardandoReembolso = [], isLoading: loadingReembolso } = useQuery({
    queryKey: ['aguardando-reembolso', clienteId, aeronaveId],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome),
          aircraft:aircraft_id (registration)
        `)
        .eq('client_id', clienteId)
        .eq('status', 'aguardando_reembolso')
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

  // Mutation para marcar como enviado
  const marcarEnviado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ status: 'enviado', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendentes-envio'] });
      queryClient.invalidateQueries({ queryKey: ['pendencias-count'] });
      toast.success('Despesa marcada como enviada');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Mutation para registrar reembolso
  const registrarReembolso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ 
          status: 'reembolsado', 
          data_reembolso: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aguardando-reembolso'] });
      queryClient.invalidateQueries({ queryKey: ['pendencias-count'] });
      toast.success('Reembolso registrado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao registrar reembolso');
    },
  });

  const totalEnvio = pendentesEnvio.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const totalReembolso = aguardandoReembolso.reduce((sum: number, d: any) => sum + ((d.saldo_pendente || d.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Seção 1: Valores a Enviar */}
      <Card className="border-destructive/30 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Valores a Enviar ao Cliente</CardTitle>
              <CardDescription>
                Despesas pendentes de envio de cobrança
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-destructive">
              R$ {totalEnvio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">{pendentesEnvio.length} despesas</p>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEnvio ? (
            <div className="text-center py-4">Carregando...</div>
          ) : pendentesEnvio.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhuma despesa pendente de envio</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Aeronave</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentesEnvio.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{item.categorias_movimentacao?.nome || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.description || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {(item.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{item.aircraft?.registration || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => marcarEnviado.mutate(item.id)}
                          disabled={marcarEnviado.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Marcar Enviado
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
                  const diasPendente = differenceInDays(new Date(), new Date(item.date));
                  const isAtrasado = diasPendente > 30;
                  
                  return (
                    <TableRow key={item.id} className={isAtrasado ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {format(new Date(item.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{item.categorias_movimentacao?.nome || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.description || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {((item.saldo_pendente || item.amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                            onClick={() => registrarReembolso.mutate(item.id)}
                            disabled={registrarReembolso.isPending}
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
    </div>
  );
}
