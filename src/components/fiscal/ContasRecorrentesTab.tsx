import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface RecorrentAccount {
  id: string;
  name: string;
  amount: number;
  frequency: 'mensal' | 'trimestral' | 'anual';
  nextDate: string;
  status: 'ativo' | 'inativo';
}

interface ContasRecorrentesTabProps {
  accounts?: RecorrentAccount[];
  loading?: boolean;
  onAdd?: () => void;
  onEdit?: (account: RecorrentAccount) => void;
  onDelete?: (id: string) => void;
}

export function ContasRecorrentesTab({
  accounts = [],
  loading = false,
  onAdd,
  onEdit,
  onDelete
}: ContasRecorrentesTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contas Recorrentes</CardTitle>
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
        <CardTitle>Contas Recorrentes</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta Recorrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome da conta" />
              <Input type="number" placeholder="Valor" />
              <Input type="date" placeholder="Próxima data" />
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
            Nenhuma conta recorrente cadastrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Próxima Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => (
                <TableRow key={account.id}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>R$ {account.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="capitalize">{account.frequency}</TableCell>
                  <TableCell>{new Date(account.nextDate).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${account.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {account.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
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
  );
}