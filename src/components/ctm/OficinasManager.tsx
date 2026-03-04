import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Building, Phone, MapPin, FileText, User, Plane } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Oficina {
  id: string;
  razao_social: string;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  mecanico_responsavel: string | null;
  tipo_aeronave: string | null;
  ativo: boolean;
  created_at: string;
}

const emptyForm = {
  razao_social: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  mecanico_responsavel: '',
  tipo_aeronave: '',
};

export function OficinasManager() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadOficinas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('oficinas')
      .select('*')
      .order('razao_social') as any;
    if (error) {
      toast.error('Erro ao carregar oficinas');
    } else {
      setOficinas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOficinas();
  }, []);

  const handleOpen = (oficina?: Oficina) => {
    if (oficina) {
      setEditingId(oficina.id);
      setForm({
        razao_social: oficina.razao_social,
        cnpj: oficina.cnpj || '',
        endereco: oficina.endereco || '',
        telefone: oficina.telefone || '',
        mecanico_responsavel: oficina.mecanico_responsavel || '',
        tipo_aeronave: oficina.tipo_aeronave || '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      toast.error('Razão social é obrigatória');
      return;
    }

    const payload = {
      razao_social: form.razao_social,
      cnpj: form.cnpj || null,
      endereco: form.endereco || null,
      telefone: form.telefone || null,
      mecanico_responsavel: form.mecanico_responsavel || null,
      tipo_aeronave: form.tipo_aeronave || null,
    };

    let error;
    if (editingId) {
      ({ error } = await (supabase.from('oficinas') as any).update(payload).eq('id', editingId));
    } else {
      ({ error } = await (supabase.from('oficinas') as any).insert(payload));
    }

    if (error) {
      toast.error('Erro ao salvar oficina');
      console.error(error);
    } else {
      toast.success(editingId ? 'Oficina atualizada' : 'Oficina cadastrada');
      setDialogOpen(false);
      loadOficinas();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('oficinas') as any).delete().eq('id', id);
    if (error) {
      toast.error('Erro ao deletar oficina');
    } else {
      toast.success('Oficina removida');
      loadOficinas();
    }
  };

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          Cadastro de Oficinas
        </CardTitle>
        <Button onClick={() => handleOpen()} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Oficina
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : oficinas.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma oficina cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mecânico Resp.</TableHead>
                  <TableHead>Tipo Aeronave</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oficinas.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.razao_social}</TableCell>
                    <TableCell>{o.cnpj || '-'}</TableCell>
                    <TableCell>{o.telefone || '-'}</TableCell>
                    <TableCell>{o.mecanico_responsavel || '-'}</TableCell>
                    <TableCell>{o.tipo_aeronave || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpen(o)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja remover a oficina "{o.razao_social}"?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(o.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              {editingId ? 'Editar Oficina' : 'Nova Oficina'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Razão Social *
              </Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                placeholder="Nome da oficina"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Endereço
              </Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Mecânico Responsável
                </Label>
                <Input
                  value={form.mecanico_responsavel}
                  onChange={(e) => setForm({ ...form, mecanico_responsavel: e.target.value })}
                  placeholder="Nome do mecânico"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Plane className="h-3 w-3" />
                  Tipo de Aeronave
                </Label>
                <Input
                  value={form.tipo_aeronave}
                  onChange={(e) => setForm({ ...form, tipo_aeronave: e.target.value })}
                  placeholder="Ex: Monomotor, Bimotor"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
