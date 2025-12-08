import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingCart, Plus, FileText, Clock, CheckCircle, XCircle, Edit, Trash2, AlertCircle, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PurchaseRequest {
  id: string;
  numero_solicitacao: string;
  tipo: string;
  descricao: string;
  observacoes: string | null;
  user_id: string;
  departamento: string | null;
  centro_custo: string | null;
  data_solicitacao: string;
  data_necessaria: string | null;
  valor_total: number;
  moeda: string;
  status: string;
  aprovador_1_id: string | null;
  data_aprovacao_1: string | null;
  motivo_rejeicao_1: string | null;
  aprovador_2_id: string | null;
  data_aprovacao_2: string | null;
  motivo_rejeicao_2: string | null;
  created_at: string;
  updated_at: string;
}

interface RequestItem {
  id: string;
  purchase_request_id: string;
  numero_item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  especificacoes: string | null;
  codigo_fornecedor: string | null;
}

type Role = 'admin' | 'financeiro_master' | 'gestor_master';

export default function SolicitacaoCompras() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);

  // Form states
  const [tipo, setTipo] = useState("compra");
  const [descricao, setDescricao] = useState("");
  const [dataNecessaria, setDataNecessaria] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [tipoDeServico, setTipoDeServico] = useState("");

  // Items states
  const [itemDescricao, setItemDescricao] = useState("");
  const [itemQuantidade, setItemQuantidade] = useState("");
  const [itemUnidade, setItemUnidade] = useState("unidade");
  const [itemValor, setItemValor] = useState("");
  const [tempItems, setTempItems] = useState<Omit<RequestItem, 'id' | 'purchase_request_id'>[]>([]);

  // Edit dialog states
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editAprovador, setEditAprovador] = useState("");
  const [editMotivo, setEditMotivo] = useState("");

  useEffect(() => {
    loadCurrentUser();
    loadRequests();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (profile) {
      setCurrentUserName(profile.full_name || user.email || '');
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roles) {
      setUserRoles(roles.map(r => r.role));
    }
  };

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .order('data_solicitacao', { ascending: false });

    if (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar solicitações",
        variant: "destructive"
      });
      return;
    }

    setRequests((data || []) as any);
  };

  const canEditRequests = userRoles.some(role =>
    ['admin', 'financeiro_master', 'gestor_master'].includes(role)
  );

  const addItem = () => {
    if (!itemDescricao.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Preencha a descrição do item",
        variant: "destructive"
      });
      return;
    }

    const quantidade = itemQuantidade ? parseFloat(itemQuantidade) : 1;
    const valor = itemValor ? parseFloat(itemValor) : 0;

    const newItem = {
      numero_item: tempItems.length + 1,
      descricao: itemDescricao,
      quantidade: quantidade,
      unidade: itemUnidade,
      valor_unitario: valor,
      valor_total: quantidade * valor,
      especificacoes: null,
      codigo_fornecedor: null
    };

    setTempItems([...tempItems, newItem]);
    setItemDescricao("");
    setItemQuantidade("");
    setItemValor("");

    toast({
      title: "Sucesso",
      description: "Item adicionado com sucesso!"
    });
  };

  const removeItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const gerarNumeroSolicitacao = async () => {
    const timestamp = Date.now();
    return `SOL-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId || !currentUserName) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    if (!tipo) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione o tipo de solicitação",
        variant: "destructive"
      });
      return;
    }

    if (tipo === 'servico' && !tipoDeServico) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione o tipo de serviço",
        variant: "destructive"
      });
      return;
    }

    if (!descricao.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Descreva a solicitação",
        variant: "destructive"
      });
      return;
    }

    // Validar itens apenas para compras
    if (tipo === 'compra' && tempItems.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item à solicitação de compra",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const numeroSolicitacao = await gerarNumeroSolicitacao();
      const valorTotal = tempItems.reduce((sum, item) => sum + item.valor_total, 0);

      const { data: newRequest, error: insertError } = await supabase
        .from('purchase_requests')
        .insert({
          numero_solicitacao: numeroSolicitacao,
          tipo,
          tipo_de_servico: tipoDeServico || null,
          descricao,
          observacoes: null,
          user_id: currentUserId,
          priority: prioridade,
          data_necessaria: dataNecessaria || null,
          status: 'rascunho'
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert items apenas para compras
      if (tipo === 'compra' && tempItems.length > 0) {
        const itemsToInsert = tempItems.map(item => ({
          purchase_request_id: newRequest.id,
          ...item
        }));

        const { error: itemsError } = await supabase
          .from('purchase_request_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Sucesso",
        description: `Solicitação ${numeroSolicitacao} criada com sucesso!`
      });

      // Reset form
      setTipo("compra");
      setDescricao("");
      setDataNecessaria("");
      setDepartamento("");
      setPrioridade("normal");
      setTipoDeServico("");
      setTempItems([]);

      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar solicitação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingRequest) return;

    try {
      const updateData: any = {
        status: editStatus
      };

      if (editStatus === 'aprovado' && editAprovador === 'nivel1') {
        updateData.aprovador_1_id = currentUserId;
        updateData.data_aprovacao_1 = new Date().toISOString();
      } else if (editStatus === 'aprovado' && editAprovador === 'nivel2') {
        updateData.aprovador_2_id = currentUserId;
        updateData.data_aprovacao_2 = new Date().toISOString();
      } else if (editStatus === 'reprovado' && editAprovador === 'nivel1') {
        updateData.motivo_rejeicao_1 = editMotivo;
      } else if (editStatus === 'reprovado' && editAprovador === 'nivel2') {
        updateData.motivo_rejeicao_2 = editMotivo;
      }

      const { error } = await supabase
        .from('purchase_requests')
        .update(updateData)
        .eq('id', editingRequest.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação atualizada com sucesso!"
      });

      setEditingRequest(null);
      loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar solicitação",
        variant: "destructive"
      });
    }
  };

  const enviarSolicitacao = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: 'enviado' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação enviada para análise!"
      });

      loadRequests();
    } catch (error) {
      console.error('Error sending request:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      rascunho: { label: 'Rascunho', className: 'bg-gray-500/20 text-gray-700 dark:text-gray-400' },
      enviado: { label: 'Enviado', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
      em_analise: { label: 'Em Análise', className: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' },
      aprovado: { label: 'Aprovado', className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
      reprovado: { label: 'Reprovado', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
      cancelado: { label: 'Cancelado', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' },
      entregue: { label: 'Entregue', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400' }
    };

    const config = statusMap[status] || { label: status, className: 'bg-muted' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "aprovado":
      case "entregue":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "enviado":
      case "em_analise":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "reprovado":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const stats = {
    total: requests.length,
    rascunhos: requests.filter(r => r.status === 'rascunho').length,
    enviadas: requests.filter(r => r.status === 'enviado').length,
    aprovadas: requests.filter(r => r.status === 'aprovado').length,
    reprovadas: requests.filter(r => r.status === 'reprovado').length,
    valorTotal: requests.reduce((sum, r) => sum + r.valor_total, 0)
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Solicitação de Compras/Serviços</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie e acompanhe as solicitações de compras e serviços
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Nova Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipo} onValueChange={setTipo} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tipo === 'servico' && (
                  <div className="space-y-2">
                    <Label htmlFor="tipo-servico">Tipo de Serviço *</Label>
                    <Select value={tipoDeServico} onValueChange={setTipoDeServico}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manutencao_infraestrutura">Manutenção Infraestrutura</SelectItem>
                        <SelectItem value="servicos_tecnicos">Serviços Técnicos</SelectItem>
                        <SelectItem value="limpeza_conservacao">Serviços de Limpeza e Conservação</SelectItem>
                        <SelectItem value="seguranca_controle">Segurança e Controle</SelectItem>
                        <SelectItem value="servicos_logisticos">Serviços Logísticos</SelectItem>
                        <SelectItem value="servicos_ti">Serviços de T.I</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prioridade">Prioridade *</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-necessaria">Data Necessária</Label>
                    <div className="relative">
                      <Input
                        id="data-necessaria"
                        type="date"
                        value={dataNecessaria}
                        onChange={(e) => setDataNecessaria(e.target.value)}
                        className="pl-10"
                      />
                      <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-blue-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição da Solicitação *</Label>
                  <Textarea
                    id="descricao"
                    placeholder={tipo === 'compra' ? "Descreva o que está sendo solicitado" : "Descreva detalhadamente o serviço necessário, incluindo escopo, requisitos e especificações"}
                    rows={tipo === 'servico' ? 4 : 2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    placeholder="Ex: Operações"
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                  />
                </div>

                {tipo === 'compra' && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Itens da Solicitação *</h3>
                  
                    <div className="space-y-3 mb-4">
                      <div className="space-y-1">
                        <Label htmlFor="item-desc" className="text-sm">Descrição *</Label>
                        <Input
                          id="item-desc"
                          placeholder="Descrição do item"
                          value={itemDescricao}
                          onChange={(e) => setItemDescricao(e.target.value)}
                          className="text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="item-qtd" className="text-sm">Quantidade</Label>
                          <Input
                            id="item-qtd"
                            type="number"
                            placeholder="0"
                            step="0.01"
                            value={itemQuantidade}
                            onChange={(e) => setItemQuantidade(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="item-unit" className="text-sm">Unidade</Label>
                          <Select value={itemUnidade} onValueChange={setItemUnidade}>
                            <SelectTrigger className="text-sm h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unidade">Unidade</SelectItem>
                              <SelectItem value="caixa">Caixa</SelectItem>
                              <SelectItem value="litro">Litro</SelectItem>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="hora">Hora</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="item-valor" className="text-sm">Valor Unit. (R$)</Label>
                          <Input
                            id="item-valor"
                            type="number"
                            placeholder="0,00"
                            step="0.01"
                            value={itemValor}
                            onChange={(e) => setItemValor(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Item
                      </Button>
                    </div>

                    {tempItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Itens Adicionados:</div>
                        <div className="border rounded-lg overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-2 py-1 text-left">Descrição</th>
                                <th className="px-2 py-1 text-right">Qtd</th>
                                <th className="px-2 py-1 text-right">Valor Unit.</th>
                                <th className="px-2 py-1 text-right">Total</th>
                                <th className="px-2 py-1 text-center">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tempItems.map((item, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-2 py-1">{item.descricao}</td>
                                  <td className="px-2 py-1 text-right">{item.quantidade}</td>
                                  <td className="px-2 py-1 text-right">{formatCurrency(item.valor_unitario)}</td>
                                  <td className="px-2 py-1 text-right font-semibold">{formatCurrency(item.valor_total)}</td>
                                  <td className="px-2 py-1 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeItem(idx)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-right font-semibold text-sm">
                          Total: {formatCurrency(tempItems.reduce((sum, item) => sum + item.valor_total, 0))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {loading ? 'Criando...' : 'Criar Solicitação'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Rascunhos</span>
                  <Badge className="bg-gray-500/20">{stats.rascunhos}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Enviadas</span>
                  <Badge className="bg-blue-500/20">{stats.enviadas}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Aprovadas</span>
                  <Badge className="bg-green-500/20">{stats.aprovadas}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Reprovadas</span>
                  <Badge className="bg-red-500/20">{stats.reprovadas}</Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Valor Total</span>
                  <span className="font-bold text-primary">{formatCurrency(stats.valorTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma solicitação encontrada. Crie uma nova solicitação para começar.
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-xs">{request.numero_solicitacao}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          {request.descricao}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{request.tipo}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(request.valor_total)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(request.data_solicitacao), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === 'rascunho' && request.user_id === currentUserId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => enviarSolicitacao(request.id)}
                            >
                              Enviar
                            </Button>
                          )}
                          {canEditRequests && request.status !== 'rascunho' && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRequest(request);
                                    setEditStatus(request.status);
                                    setEditAprovador("");
                                    setEditMotivo("");
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Gerenciar Solicitação</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Número</Label>
                                    <p className="text-sm text-muted-foreground">{request.numero_solicitacao}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Descrição</Label>
                                    <p className="text-sm text-muted-foreground">{request.descricao}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-status">Status</Label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="enviado">Enviado</SelectItem>
                                        <SelectItem value="em_analise">Em Análise</SelectItem>
                                        <SelectItem value="aprovado">Aprovado</SelectItem>
                                        <SelectItem value="reprovado">Reprovado</SelectItem>
                                        <SelectItem value="cancelado">Cancelado</SelectItem>
                                        <SelectItem value="entregue">Entregue</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {editStatus === 'aprovado' && (
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-aprovador">Nível de Aprovação</Label>
                                      <Select value={editAprovador} onValueChange={setEditAprovador}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione o nível" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="nivel1">Gestor Direto (Nível 1)</SelectItem>
                                          <SelectItem value="nivel2">Admin/Gestor Master (Nível 2)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {editStatus === 'reprovado' && (
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-motivo">Motivo da Rejeição</Label>
                                      <Textarea
                                        id="edit-motivo"
                                        placeholder="Descreva o motivo da rejeição"
                                        rows={3}
                                        value={editMotivo}
                                        onChange={(e) => setEditMotivo(e.target.value)}
                                      />
                                    </div>
                                  )}

                                  <Button onClick={handleUpdateStatus} className="w-full">
                                    Salvar Alterações
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}