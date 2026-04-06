import React from 'react';
import { CTMServiceOrder } from '@/hooks/useCTMServiceOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Eye, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateToBR } from '@/lib/date-utils';

interface CTMServiceOrderListProps {
  orders: CTMServiceOrder[];
  onSelect: (order: CTMServiceOrder) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const statusColors: Record<string, string> = {
  em_andamento: 'default',
  concluída: 'secondary',
  pausada: 'outline',
  cancelada: 'destructive',
};

const statusLabels: Record<string, string> = {
  em_andamento: 'Em Andamento',
  concluída: 'Concluída',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
};

const tipoManutencaoLabels: Record<string, string> = {
  CORRETIVA: 'Corretiva',
  PREVENTIVA: 'Preventiva',
  REVISÃO: 'Revisão',
};

const tipoManutencaoColors: Record<string, string> = {
  CORRETIVA: 'bg-red-100 text-red-800',
  PREVENTIVA: 'bg-blue-100 text-blue-800',
  REVISÃO: 'bg-green-100 text-green-800',
};

export function CTMServiceOrderList({
  orders,
  onSelect,
  onDelete,
  onNew,
}: CTMServiceOrderListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDeleteConfirm = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma ordem de serviço encontrada</p>
            <Button onClick={onNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Ordem de Serviço
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Ordens de Serviço</CardTitle>
            <CardDescription>
              {orders.length} ordem{orders.length !== 1 ? 's' : ''} encontrada{orders.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button onClick={onNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Ordem
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const currentStatus = order.situacao || order.status || '';

                  return (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{order.numero}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tipoManutencaoColors[order.tipo_manutencao] || 'bg-gray-100 text-gray-800'}`}>
                        {tipoManutencaoLabels[order.tipo_manutencao] || order.tipo_manutencao}
                      </span>
                    </TableCell>
                    <TableCell>{order.oficina_nome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[currentStatus] as any}>
                        {statusLabels[currentStatus] || currentStatus || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.data_entrada
                        ? formatDateToBR(order.data_entrada)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.total_geral
                        ? `R$ ${(order.total_geral).toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelect(order)}
                          title="Visualizar detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(order.id)}
                          className="text-destructive hover:text-destructive"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A ordem de serviço será permanentemente deletada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
