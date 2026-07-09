import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KeyRound, Plus, Pencil, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props {
  clienteId: string;
  socioId?: string;
}

interface AcessoPortal {
  id: string;
  clientes_id: string;
  socios_cliente_id: string | null;
  login: string;
  hash_senha: string;
  ativo: boolean;
  ultimo_login: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  partner_name?: string;
}

export function GerenciarAcessoPortal({ clienteId, socioId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [changePasswordId, setChangePasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Fetch acessos
  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ['acessos-portal', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('autenticacao_portal_cliente')
        .select('*')
        .eq('clientes_id', clienteId)
        .order('criado_em', { ascending: false });
      if (error) throw error;

      // Fetch partner names
      const partnerIds = (data || []).filter(a => a.socios_cliente_id).map(a => a.socios_cliente_id!);
      let partnersMap: Record<string, string> = {};
      if (partnerIds.length > 0) {
        const { data: partners } = await supabase
          .from('socios')
          .select('id, nome')
          .in('id', partnerIds);
        if (partners) {
          partnersMap = Object.fromEntries(partners.map(p => [p.id, p.nome]));
        }
      }

      return (data || []).map(a => ({
        ...a,
        ativo: a.ativo ?? true,
        partner_name: a.socios_cliente_id ? partnersMap[a.socios_cliente_id] || 'Sócio' : undefined,
      })) as AcessoPortal[];
    },
    enabled: !!clienteId,
  });

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ['client-partners', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('socios')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Create/Update
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!login.trim() || !senha.trim()) throw new Error('Login e senha são obrigatórios');

      if (editingId) {
        const { error } = await supabase
          .from('autenticacao_portal_cliente')
          .update({
            login: login.trim(),
            hash_senha: senha.trim(),
            socios_cliente_id: partnerId,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('autenticacao_portal_cliente')
          .insert({
            clientes_id: clienteId,
            login: login.trim(),
            hash_senha: senha.trim(),
            socios_cliente_id: partnerId,
            ativo: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acessos-portal', clienteId] });
      toast.success(editingId ? 'Acesso atualizado!' : 'Acesso criado!');
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  // Toggle ativo
  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('autenticacao_portal_cliente')
        .update({ ativo, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acessos-portal', clienteId] });
      toast.success('Status atualizado');
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('autenticacao_portal_cliente')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acessos-portal', clienteId] });
      toast.success('Acesso removido');
    },
  });

  // Change password
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword.trim() || !changePasswordId) throw new Error('Nova senha obrigatória');
      const { error } = await supabase
        .from('autenticacao_portal_cliente')
        .update({ hash_senha: newPassword.trim(), atualizado_em: new Date().toISOString() })
        .eq('id', changePasswordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acessos-portal', clienteId] });
      toast.success('Senha alterada!');
      setChangePasswordId(null);
      setNewPassword('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao alterar senha'),
  });

  const openCreate = () => {
    setEditingId(null);
    setLogin('');
    setSenha('');
    setPartnerId(null);
    setDialogOpen(true);
  };

  const openEdit = (acesso: AcessoPortal) => {
    setEditingId(acesso.id);
    setLogin(acesso.login);
    setSenha(acesso.hash_senha);
    setPartnerId(acesso.socios_cliente_id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setLogin('');
    setSenha('');
    setPartnerId(null);
  };

  const togglePassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Card className="border-border/50 bg-amber-50/30 border-amber-200/50 dark:bg-amber-950/20 dark:border-amber-900/50">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-400">
            <p className="font-semibold mb-1">Informações de Acesso</p>
            <p className="text-xs opacity-90">
              O login pode ser um código ou texto (ex: cliente001). A senha pode ser o CNPJ do cliente ou uma senha personalizada.
              O usuário poderá alterá-la após o primeiro acesso.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Acesso ao Portal do Cliente
            </CardTitle>
            <CardDescription>
              Gerencie os logins e senhas de acesso ao portal para este cliente
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Acesso
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : acessos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum acesso configurado para este cliente</p>
              <p className="text-sm mt-1">Clique em "Novo Acesso" para criar um login</p>
            </div>
          ) : (
            <div className="space-y-3">
              {acessos.map((acesso) => (
                <div
                  key={acesso.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{acesso.login}</span>
                      {((acesso as any).nome_socio || acesso.partner_name) ? (
                        <Badge variant="outline" className="text-xs">
                          {(acesso as any).nome_socio || acesso.partner_name}
                        </Badge>
                      ) : null}
                      <Badge variant={acesso.ativo ? 'default' : 'secondary'} className="text-xs">
                        {acesso.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Senha: </span>
                      <span className="font-mono">
                        {showPasswords[acesso.id] ? acesso.hash_senha : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePassword(acesso.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPasswords[acesso.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    {acesso.ultimo_login && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Último login: {new Date(acesso.ultimo_login).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={acesso.ativo}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: acesso.id, ativo: checked })
                      }
                      title={acesso.ativo ? 'Desativar' : 'Ativar'}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setChangePasswordId(acesso.id);
                        setNewPassword('');
                      }}
                      title="Alterar Senha"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(acesso)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja remover este acesso?')) {
                          deleteMutation.mutate(acesso.id);
                        }
                      }}
                      title="Remover"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Acesso' : 'Novo Acesso ao Portal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {partners.length > 0 && (
              <div className="space-y-2">
                <Label>Sócio (opcional)</Label>
                <select
                  value={partnerId || ''}
                  onChange={(e) => setPartnerId(e.target.value || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Cliente consolidado</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Login (texto ou código) *</Label>
              <Input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ex: cliente001 ou código personalizado"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Senha (CNPJ ou texto livre) *</Label>
              <Input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Ex: CNPJ do cliente ou senha personalizada"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!changePasswordId} onOpenChange={(open) => !open && setChangePasswordId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha *</Label>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordId(null)}>Cancelar</Button>
            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
