import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface ServiceProvider {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  specialization: string;
  status: 'ativo' | 'inativo';
}

interface PrestadoresServicoTabProps {
  providers?: ServiceProvider[];
  loading?: boolean;
  onAdd?: () => void;
  onEdit?: (provider: ServiceProvider) => void;
  onDelete?: (id: string) => void;
}

export function PrestadoresServicoTab({
  providers = [],
  loading = false,
  onAdd,
  onEdit,
  onDelete
}: PrestadoresServicoTabProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prestadores de Serviço</CardTitle>
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
        <CardTitle>Prestadores de Serviço</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Prestador de Serviço</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome da empresa" />
              <Input placeholder="CNPJ" />
              <Input type="email" placeholder="Email" />
              <Input placeholder="Telefone" />
              <Input placeholder="Especialização" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={() => { onAdd?.(); setIsOpen(false); }}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum prestador de serviço cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Especialização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map(provider => (
                <TableRow key={provider.id}>
                  <TableCell>{provider.name}</TableCell>
                  <TableCell>{provider.cnpj}</TableCell>
                  <TableCell>{provider.email}</TableCell>
                  <TableCell>{provider.phone}</TableCell>
                  <TableCell>{provider.specialization}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${provider.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {provider.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit?.(provider)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete?.(provider.id)}>
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