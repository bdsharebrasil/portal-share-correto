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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  CORRETIVO: 'Corretivo',
  '50HORAS': '50 Horas',
  '100HORAS': '100 Horas',
  CVA: 'C.V.A',
  HELICE_GOVERNADOR: 'Hélice-Governador',
  OLEO: 'Óleo',
  PNEU_DIREITO: 'Pneu Direito',
  PNEU_ESQUERDO: 'Pneu Esquerdo',
  PNEU_TREM_NARIZ: 'Pneu Trem de Nariz',
};

const tipoManutencaoColors: Record<string, string> = {
  CORRETIVO: 'bg-red-100 text-red-800',
  '50HORAS': 'bg-blue-100 text-blue-800',
  '100HORAS': 'bg-green-100 text-green-800',
  CVA: 'bg-purple-100 text-purple-800',
  HELICE_GOVERNADOR: 'bg-orange-100 text-orange-800',
  OLEO: 'bg-yellow-100 text-yellow-800',
  PNEU_DIREITO: 'bg-cyan-100 text-cyan-800',
  PNEU_ESQUERDO: 'bg-teal-100 text-teal-800',
  PNEU_TREM_NARIZ: 'bg-indigo-100 text-indigo-800',
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
                {orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{order.numero}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tipoManutencaoColors[order.tipo_manutencao] || 'bg-gray-100 text-gray-800'}`}>
                        {tipoManutencaoLabels[order.tipo_manutencao] || order.tipo_manutencao}
                      </span>
                    </TableCell>
                    <TableCell>{order.oficina_nome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[order.status || ''] as any}>
                        {statusLabels[order.status || ''] || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.data_entrada
                        ? format(new Date(order.data_entrada), 'dd/MM/yyyy', { locale: ptBR })
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
                ))}
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
