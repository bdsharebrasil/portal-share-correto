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
import { ShoppingCart, FileText, Clock, CheckCircle, XCircle, Edit, AlertCircle, CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

type Role = 'admin' | 'financeiro_master' | 'gestor_master';

export default function SolicitacaoCompras() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [formExpanded, setFormExpanded] = useState(false);
  const [tipo, setTipo] = useState("compra");
  const [descricao, setDescricao] = useState("");
  const [dataNecessaria, setDataNecessaria] = useState("");
  const [dataNecessariaDate, setDataNecessariaDate] = useState<Date | undefined>();
  const [departamento, setDepartamento] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [tipoDeServico, setTipoDeServico] = useState("");

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

    setLoading(true);

    try {
      const numeroSolicitacao = await gerarNumeroSolicitacao();

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
          status: 'rascunho',
          valor_total: 0
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Sucesso",
        description: `Solicitação ${numeroSolicitacao} criada com sucesso!`
      });

      // Reset form
      setTipo("compra");
      setDescricao("");
      setDataNecessaria("");
      setDataNecessariaDate(undefined);
      setDepartamento("");
      setPrioridade("normal");
      setTipoDeServico("");

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
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Solicitação de Compras/Serviços</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie e acompanhe suas solicitações
            </p>
          </div>
          <Button
            onClick={() => setFormExpanded(!formExpanded)}
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Solicitação</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>

        {/* Form Card - Collapsible */}
        {formExpanded && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Criar Nova Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="tipo" className="text-xs md:text-sm">Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo} required>
                      <SelectTrigger className="text-xs md:text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compra">Compra</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prioridade" className="text-xs md:text-sm">Prioridade *</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger className="text-xs md:text-sm h-9">
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
                </div>

                {tipo === 'servico' && (
                  <div className="space-y-2">
                    <Label htmlFor="tipo-servico" className="text-xs md:text-sm">Tipo de Serviço *</Label>
                    <Select value={tipoDeServico} onValueChange={setTipoDeServico}>
                      <SelectTrigger className="text-xs md:text-sm h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manutencao_infraestrutura">Manutenção Infraestrutura</SelectItem>
                        <SelectItem value="servicos_tecnicos">Serviços Técnicos</SelectItem>
                        <SelectItem value="limpeza_conservacao">Limpeza e Conservação</SelectItem>
                        <SelectItem value="seguranca_controle">Segurança e Controle</SelectItem>
                        <SelectItem value="servicos_logisticos">Serviços Logísticos</SelectItem>
                        <SelectItem value="servicos_ti">Serviços de T.I</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="departamento" className="text-xs md:text-sm">Departamento</Label>
                    <Input
                      id="departamento"
                      placeholder="Ex: Operações"
                      className="text-xs md:text-sm h-9"
                      value={departamento}
                      onChange={(e) => setDepartamento(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data-necessaria" className="text-xs md:text-sm">Data Necessária</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal text-xs md:text-sm h-9"
                        >
                          <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                          {dataNecessariaDate ? format(dataNecessariaDate, "dd/MM") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dataNecessariaDate}
                          onSelect={(date) => {
                            setDataNecessariaDate(date);
                            if (date) {
                              setDataNecessaria(format(date, "yyyy-MM-dd"));
                            } else {
                              setDataNecessaria("");
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao" className="text-xs md:text-sm">Descrição *</Label>
                  <Textarea
                    id="descricao"
                    placeholder={tipo === 'compra' ? "O que está sendo solicitado?" : "Descreva o serviço necessário"}
                    rows={2}
                    className="text-xs md:text-sm"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1 h-9 text-xs md:text-sm gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {loading ? 'Criando...' : 'Criar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormExpanded(false)}
                    className="h-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Total</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Rascunhos</p>
              <p className="text-xl md:text-2xl font-bold text-gray-600">{stats.rascunhos}</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Enviadas</p>
              <p className="text-xl md:text-2xl font-bold text-blue-600">{stats.enviadas}</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Aprovadas</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">{stats.aprovadas}</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-3 md:p-4">
              <p className="text-xs md:text-sm text-muted-foreground">Reprovadas</p>
              <p className="text-xl md:text-2xl font-bold text-red-600">{stats.reprovadas}</p>
            </CardContent>
          </Card>
        </div>

        {/* Requests Grid */}
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Solicitações
          </h2>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma solicitação. Crie uma para começar.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((request) => (
                <Card
                  key={request.id}
                  className="flex flex-col hover:shadow-lg transition-all duration-300 border-primary/10 hover:border-primary/30"
                >
                  <CardContent className="p-4 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded w-fit">
                          {request.numero_solicitacao}
                        </p>
                        <h3 className="font-semibold text-sm text-foreground mt-2 line-clamp-2">
                          {request.descricao}
                        </h3>
                      </div>
                      <div className="ml-2">
                        {getStatusIcon(request.status)}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border my-3"></div>

                    {/* Body */}
                    <div className="space-y-2 flex-1 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Tipo:</span>
                        <span className="text-xs font-medium text-foreground capitalize">{request.tipo}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Valor:</span>
                        <span className="text-xs font-semibold text-primary">
                          {formatCurrency(request.valor_total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Data:</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.data_solicitacao), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="space-y-3">
                      <div>{getStatusBadge(request.status)}</div>
                      <div className="flex gap-2">
                        {request.status === 'rascunho' && request.user_id === currentUserId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enviarSolicitacao(request.id)}
                            className="flex-1 text-xs h-8"
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
                                className="flex-1 text-xs h-8 gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                <span>Gerenciar</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Gerenciar Solicitação</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label className="text-xs">Número</Label>
                                  <p className="text-sm text-muted-foreground">{request.numero_solicitacao}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Descrição</Label>
                                  <p className="text-sm text-muted-foreground line-clamp-3">{request.descricao}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-status" className="text-xs">Status</Label>
                                  <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger className="h-9 text-sm">
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
                                    <Label htmlFor="edit-aprovador" className="text-xs">Nível de Aprovação</Label>
                                    <Select value={editAprovador} onValueChange={setEditAprovador}>
                                      <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Selecione" />
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
                                    <Label htmlFor="edit-motivo" className="text-xs">Motivo da Rejeição</Label>
                                    <Textarea
                                      id="edit-motivo"
                                      placeholder="Descreva o motivo"
                                      rows={3}
                                      className="text-sm"
                                      value={editMotivo}
                                      onChange={(e) => setEditMotivo(e.target.value)}
                                    />
                                  </div>
                                )}

                                <Button onClick={handleUpdateStatus} className="w-full h-9">
                                  Salvar
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
