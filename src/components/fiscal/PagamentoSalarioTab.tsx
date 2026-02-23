import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';

interface SalaryPayment {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  month: string;
  status: 'pendente' | 'pago' | 'atraso';
  paymentDate?: string;
  dueDate: string;
}

interface PagamentoSalarioTabProps {
  payments?: SalaryPayment[];
  loading?: boolean;
  onAdd?: () => void;
  onPayment?: (id: string) => void;
  onEdit?: (payment: SalaryPayment) => void;
  onDelete?: (id: string) => void;
}

export function PagamentoSalarioTab({
  payments = [],
  loading = false,
  onAdd,
  onPayment,
  onEdit,
  onDelete
}: PagamentoSalarioTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'atraso':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pago':
        return 'Pago';
      case 'pendente':
        return 'Pendente';
      case 'atraso':
        return 'Atraso';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagamento de Salários</CardTitle>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pagamento de Salários</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Pagamento de Salário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Funcionário" />
              <Input type="number" placeholder="Valor" />
              <Input type="month" placeholder="Mês" />
              <Input type="date" placeholder="Data de vencimento" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={() => { onAdd?.(); setIsOpen(false); }}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum pagamento de salário cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data de Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(payment => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.employeeName}</TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell>R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(payment.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(payment.status)}`}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {payment.status === 'pendente' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onPayment?.(payment.id)}
                        title="Marcar como pago"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onEdit?.(payment)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete?.(payment.id)}>
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
  );
}