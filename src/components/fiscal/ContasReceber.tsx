import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReceivableAccount {
  id: string;
  clientName: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pendente' | 'pago' | 'atraso' | 'cancelado';
  invoiceNumber?: string;
}

interface ContasReceberTabProps {
  accounts?: ReceivableAccount[];
  loading?: boolean;
  onAdd?: () => void;
  onEdit?: (account: ReceivableAccount) => void;
  onDelete?: (id: string) => void;
  onReceipt?: (id: string) => void;
}

export function ContasReceber({
  accounts = [],
  loading = false,
  onAdd,
  onEdit,
  onDelete,
  onReceipt
}: ContasReceberTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pago':
        return <Badge className="bg-green-100 text-green-800">Recebido</Badge>;
      case 'pendente':
        return <Badge className="bg-blue-100 text-blue-800">Pendente</Badge>;
      case 'atraso':
        return <Badge className="bg-red-100 text-red-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Atraso</Badge>;
      case 'cancelado':
        return <Badge className="bg-gray-100 text-gray-800">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTotalAmount = () => accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const getReceivedAmount = () => accounts
    .filter(acc => acc.status === 'pago')
    .reduce((sum, acc) => sum + acc.amount, 0);
  const getPendingAmount = () => accounts
    .filter(acc => acc.status === 'pendente' || acc.status === 'atraso')
    .reduce((sum, acc) => sum + acc.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contas a Receber</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total a Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {getTotalAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {getReceivedAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {getPendingAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Quantidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Listagem de Contas</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conta a Receber</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Cliente" />
                <Input placeholder="Descrição" />
                <Input type="number" placeholder="Valor" />
                <Input type="date" placeholder="Data de vencimento" />
                <Input placeholder="Número da nota/recibo" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button onClick={() => { onAdd?.(); setIsOpen(false); }}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma conta a receber cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.clientName}</TableCell>
                    <TableCell>{account.description}</TableCell>
                    <TableCell>
                      R$ {account.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{new Date(account.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {(account.status === 'pendente' || account.status === 'atraso') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReceipt?.(account.id)}
                          title="Registrar recebimento"
                        >
                          Receber
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => onEdit?.(account)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete?.(account.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}