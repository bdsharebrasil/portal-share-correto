import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ShoppingCart, FileText, Clock, CheckCircle, XCircle,
  Edit, AlertCircle, CalendarIcon, CreditCard, Paperclip,
  Search, Users, Building2, Folder, FolderOpen, ChevronRight,
  ChevronLeft, Wallet, TrendingUp, TrendingDown
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PurchaseRequest {
  id: string;
  numero_solicitacao: string;
  tipo: string;
  tipo_de_servico: string | null;
  descricao: string;
  observacoes: string | null;
  user_id: string;
  solicitante_nome: string | null;
  departamento: string | null;
  centro_custo: string | null;
  data_solicitacao: string;
  data_necessaria: string | null;
 
 
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

interface PaymentRequestHistory {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string | null;
  data_vencimento: string | null;
  status: string | null;
  observacoes: string | null;
  criado_por: string | null;
  solicitante_nome: string | null;
  contas_apagar_id: string | null;
  cliente_id?: string | null;
  socio_id?: string | null;
  data_pagamento: string | null;
  comprovante_pagamento_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  recibo_url: string | null;
  arquivo_pdf_url: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

interface MovimentoPagamento {
  id: string;
  descricao: string | null;
  valor: number | string | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  status: string | null;
  observacoes: string | null;
  criado_por: string | null;
  contas_apagar_id: string | null;
  clientes_id?: string | null;
  recibo_url?: string | null;
  socio_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

interface ContaPagamentoResumo {
  id: string;
  status: string | null;
  data_pagamento: string | null;
  comprovante_pagamento_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  recibo_url: string | null;
  arquivo_pdf_url: string | null;
}

interface Cliente {
  id: string;
  razao_social: string;
  proprietario: string;
}

interface Socio {
  id: string;
  cliente_id: string;
  nome: string;
}

const SEM_CLIENTE = "__sem_cliente__";
const SEM_SOCIO = "__sem_socio__";

const isPagoStatus = (status: string | null | undefined) =>
  ['pago', 'paid', 'quitado', 'liquidado', 'paga'].includes((status || '').toLowerCase());

export default function SolicitacaoCompras() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestHistory[]>([]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);

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

  // Filter states
  const [searchCompras, setSearchCompras] = useState("");
  const [searchPagamentos, setSearchPagamentos] = useState("");
  const [filtroStatusPagamento, setFiltroStatusPagamento] = useState<"todos" | "pago" | "pendente">("todos");

  // Navigation (folder drill-down) states for the Pagamentos tab
  const [navCliente, setNavCliente] = useState<string | null>(null);
  const [navSocio, setNavSocio] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentUser();
    loadRequests();
    loadPaymentRequests();
    loadClientesESocios();
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

    if (profile) setCurrentUserName(profile.full_name || user.email || '');

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roles) setUserRoles(roles.map(r => r.role));
  };

  const loadClientesESocios = async () => {
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('id, razao_social, proprietario')
      .order('razao_social');

    if (clientesData) setClientes(clientesData as Cliente[]);

    const { data: sociosData } = await supabase
      .from('socios')
      .select('id, cliente_id, nome')
      .order('nome');

    if (sociosData) setSocios(sociosData as Socio[]);
  };

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .order('data_solicitacao', { ascending: false });

    if (error) {
      toast({ title: "Erro", description: "Erro ao carregar solicitações", variant: "destructive" });
      return;
    }
    setRequests((data || []) as unknown as PurchaseRequest[]);
  };

  const loadPaymentRequests = async () => {
    try {
      const normalizePaymentStatus = (status?: string | null) => {
        const normalized = (status || '').toString().trim().toLowerCase();
        if (['pago', 'paid', 'quitado', 'liquidado', 'paga'].includes(normalized)) return 'pago';
        return normalized || 'pendente';
      };

      const { data: movements, error: movementsError } = await supabase
        .from('movimentacoes')
        .select('id, descricao, valor, data_competencia, data_vencimento, status, observacoes, criado_por, contas_apagar_id, clientes_id, socio_id, recibo_url, reference_type, reference_id')
        .in('reference_type', ['solicitacao_pagamento', 'travel_expense_report', 'travel_report'])
        .order('data_competencia', { ascending: false });

      if (movementsError) throw movementsError;

      const contaIds = [...new Set((movements || []).map((m: MovimentoPagamento) => m.contas_apagar_id).filter((id: string | null): id is string => typeof id === 'string'))] as string[];
      const contasMap = new Map<string, ContaPagamentoResumo>();

      if (contaIds.length > 0) {
        const { data: contasData, error: contasError } = await supabase
          .from('contas_apagar')
          .select('id, status, data_pagamento, comprovante_pagamento_url, nf_url, boleto_url, recibo_url, arquivo_pdf_url')
          .in('id', contaIds);

        if (contasError) throw contasError;
        (contasData || []).forEach((conta: ContaPagamentoResumo) => contasMap.set(conta.id, conta));
      }

      const userIds: string[] = [...new Set<string>(
        (movements || [])
          .map((m: MovimentoPagamento) => m.criado_por)
          .filter((id: string | null): id is string => typeof id === 'string')
      )];
      const userMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profilesError) throw profilesError;
        (profiles || []).forEach((profile: { id: string; full_name?: string | null }) => userMap.set(profile.id, profile.full_name || ''));
      }

      const mappedPayments = (movements || []).map((movement: MovimentoPagamento) => {
        const conta = movement.contas_apagar_id ? contasMap.get(movement.contas_apagar_id) : null;
        const contaStatus = normalizePaymentStatus(conta?.status);
        const movementStatus = normalizePaymentStatus(movement.status);
        const paymentStatus = contaStatus === 'pago' || movementStatus === 'pago' ? 'pago' : (contaStatus || movementStatus || 'pendente');

        return {
          ...movement,
          cliente_id: movement.clientes_id ?? null,
          status: paymentStatus,
          descricao: movement.descricao || 'Solicitação de pagamento',
          valor: Number(movement.valor || 0),
          solicitante_nome: movement.criado_por ? userMap.get(movement.criado_por) || null : null,
          data_pagamento: conta?.data_pagamento || null,
          comprovante_pagamento_url: conta?.comprovante_pagamento_url || null,
          nf_url: conta?.nf_url || null,
          boleto_url: conta?.boleto_url || null,
          recibo_url: movement.recibo_url || conta?.recibo_url || null,
          arquivo_pdf_url: conta?.arquivo_pdf_url || null,
        } as PaymentRequestHistory;
      });

      setPaymentRequests(mappedPayments);
    } catch (error) {
      console.error('Error loading payment history:', error);
      setPaymentRequests([]);
    }
  };

  const canEditRequests = userRoles.some(role =>
    ['admin', 'financeiro_master', 'gestor_master'].includes(role)
  );

  const gerarNumeroSolicitacao = async () => `SOL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !currentUserName) return toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
    if (!tipo) return toast({ title: "Campo obrigatório", description: "Selecione o tipo de solicitação", variant: "destructive" });
    if (tipo === 'servico' && !tipoDeServico) return toast({ title: "Campo obrigatório", description: "Selecione o tipo de serviço", variant: "destructive" });
    if (!descricao.trim()) return toast({ title: "Campo obrigatório", description: "Descreva a solicitação", variant: "destructive" });

    setLoading(true);
    try {
      const numeroSolicitacao = await gerarNumeroSolicitacao();
      const payload: Record<string, string | number | null> = {
        numero_solicitacao: numeroSolicitacao,
        tipo,
        descricao,
        user_id: currentUserId,
        solicitante_nome: currentUserName,
        priority: prioridade,
        departamento: departamento || null,
        tipo_de_servico: tipoDeServico || null,
        data_necessaria: dataNecessaria || null,
        status: 'enviado',
       
      };

      const { error } = await supabase.from('purchase_requests' as any).insert(payload as any);


      if (error) throw error;

      toast({ title: "Sucesso", description: `Solicitação ${numeroSolicitacao} enviada para aprovação!` });
      setTipo("compra"); setDescricao(""); setDataNecessaria(""); setDataNecessariaDate(undefined);
      setDepartamento(""); setPrioridade("normal"); setTipoDeServico(""); setFormExpanded(false);
      loadRequests();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao criar solicitação", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingRequest) return;
    try {
      const updateData: Record<string, string | null> = { status: editStatus };
      if (editStatus === 'aprovado' && editAprovador === 'nivel1') { updateData.aprovador_1_id = currentUserId; updateData.data_aprovacao_1 = new Date().toISOString(); }
      else if (editStatus === 'aprovado' && editAprovador === 'nivel2') { updateData.aprovador_2_id = currentUserId; updateData.data_aprovacao_2 = new Date().toISOString(); }
      else if (editStatus === 'reprovado' && editAprovador === 'nivel1') { updateData.motivo_rejeicao_1 = editMotivo; }
      else if (editStatus === 'reprovado' && editAprovador === 'nivel2') { updateData.motivo_rejeicao_2 = editMotivo; }

    

      toast({ title: "Sucesso", description: "Solicitação atualizada com sucesso!" });
      setEditingRequest(null);
      loadRequests();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao atualizar solicitação", variant: "destructive" });
    }
  };

  const enviarSolicitacao = async (requestId: string) => {
    try {
      const { error } = await supabase.from('purchase_requests').update({ status: 'enviado' }).eq('id', requestId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Solicitação enviada para análise!" });
      loadRequests();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao enviar solicitação", variant: "destructive" });
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
      case "aprovado": case "entregue": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "enviado": case "em_analise": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "reprovado": return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDateLabel = (value: string | null | undefined) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'dd/MM/yyyy');
  };

  const getPaymentStatusBadge = (status: string | null) => {
    if (isPagoStatus(status)) {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 gap-1"><CheckCircle className="h-3 w-3" /> Paga</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
  };

  const getAttachmentLinks = (request: PaymentRequestHistory) => {
    return [
      { label: 'Comprovante', url: request.comprovante_pagamento_url },
      { label: 'NF', url: request.nf_url },
      { label: 'Boleto', url: request.boleto_url },
      { label: 'Recibo', url: request.recibo_url || request.arquivo_pdf_url || undefined },
      { label: 'Anexo', url: request.arquivo_pdf_url },
    ].filter((link): link is { label: string; url: string } => Boolean(link.url)) as Array<{ label: string; url: string }>;
  };

  // ---------- Compras (unchanged logic) ----------
  const comprasFiltradas = requests.filter(req =>
    req.descricao.toLowerCase().includes(searchCompras.toLowerCase()) ||
    req.numero_solicitacao.toLowerCase().includes(searchCompras.toLowerCase())
  );

  const stats = {
    total: requests.length,
    rascunhos: requests.filter(r => r.status === 'rascunho').length,
    enviadas: requests.filter(r => r.status === 'enviado').length,
    aprovadas: requests.filter(r => r.status === 'aprovado').length,
    reprovadas: requests.filter(r => r.status === 'reprovado').length,
  };

  // ---------- Pagamentos: lookups ----------
  const clienteById = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const socioById = useMemo(() => new Map(socios.map(s => [s.id, s])), [socios]);

  const clienteNome = (id: string) => {
    const c = clienteById.get(id);
    return c?.razao_social || c?.proprietario || 'Cliente';
  };
  const socioNome = (id: string) => socioById.get(id)?.nome || 'Sócio';

  // Base filter: search text + paid/pending status, applied at every navigation level
  const pagamentosBase = useMemo(() => paymentRequests.filter(req => {
    const matchesSearch =
      req.descricao.toLowerCase().includes(searchPagamentos.toLowerCase()) ||
      (req.solicitante_nome || '').toLowerCase().includes(searchPagamentos.toLowerCase());
    const paga = isPagoStatus(req.status);
    const matchesStatus =
      filtroStatusPagamento === 'todos' ||
      (filtroStatusPagamento === 'pago' ? paga : !paga);
    return matchesSearch && matchesStatus;
  }), [paymentRequests, searchPagamentos, filtroStatusPagamento]);

  const paymentStats = useMemo(() => {
    const pagas = paymentRequests.filter(r => isPagoStatus(r.status));
    const pendentes = paymentRequests.filter(r => !isPagoStatus(r.status));
    return {
      total: paymentRequests.length,
      pagas: pagas.length,
      pendentes: pendentes.length,
      valorPago: pagas.reduce((sum, r) => sum + (r.valor || 0), 0),
      valorPendente: pendentes.reduce((sum, r) => sum + (r.valor || 0), 0),
    };
  }, [paymentRequests]);

  // Level 0: group by cliente
  const clienteGroups = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number; valor: number }>();
    pagamentosBase.forEach(req => {
      const key = req.cliente_id || SEM_CLIENTE;
      const nome = req.cliente_id ? clienteNome(req.cliente_id) : 'Sem Cliente Vinculado';
      const existing = map.get(key) || { id: key, nome, count: 0, valor: 0 };
      existing.count += 1;
      existing.valor += req.valor || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === SEM_CLIENTE) return 1;
      if (b.id === SEM_CLIENTE) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [pagamentosBase, clienteById]);

  // Level 1: group by socio, within the selected cliente
  const recordsForCliente = useMemo(() => {
    if (!navCliente) return [];
    return pagamentosBase.filter(req => (req.cliente_id || SEM_CLIENTE) === navCliente);
  }, [pagamentosBase, navCliente]);

  const socioGroups = useMemo(() => {
    if (!navCliente) return [];
    const map = new Map<string, { id: string; nome: string; count: number; valor: number }>();
    recordsForCliente.forEach(req => {
      const key = req.socio_id || SEM_SOCIO;
      const nome = req.socio_id ? socioNome(req.socio_id) : 'Sem Sócio Vinculado';
      const existing = map.get(key) || { id: key, nome, count: 0, valor: 0 };
      existing.count += 1;
      existing.valor += req.valor || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === SEM_SOCIO) return 1;
      if (b.id === SEM_SOCIO) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [recordsForCliente, socioById, navCliente]);

  // Only show the sócio folder level if there's at least one real sócio grouping
  const showSocioLevel = navCliente !== null && socioGroups.some(g => g.id !== SEM_SOCIO);

  // Level 2: final list of requests to display as cards
  const pagamentosFiltrados = useMemo(() => {
    if (!navCliente) return [];
    if (showSocioLevel && !navSocio) return [];
    let list = recordsForCliente;
    if (navSocio) {
      list = list.filter(req => (req.socio_id || SEM_SOCIO) === navSocio);
    }
    return list;
  }, [recordsForCliente, navCliente, navSocio, showSocioLevel]);

  const handleOpenCliente = (id: string) => {
    setNavCliente(id);
    setNavSocio(null);
  };
  const handleOpenSocio = (id: string) => setNavSocio(id);
  const handleBackToClientes = () => { setNavCliente(null); setNavSocio(null); };
  const handleBackToSocios = () => setNavSocio(null);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Solicitações e Pagamentos</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie suas compras, serviços e faturamentos
            </p>
          </div>
        </div>

        <Tabs defaultValue="compras" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[500px]">
            <TabsTrigger value="compras" className="gap-2"><ShoppingCart className="h-4 w-4"/> Compras e Serviços</TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-2"><CreditCard className="h-4 w-4"/> Pagamentos</TabsTrigger>
          </TabsList>

          {/* ABA DE COMPRAS */}
          <TabsContent value="compras" className="space-y-6 animate-in fade-in-50">

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição ou número..."
                  value={searchCompras}
                  onChange={(e) => setSearchCompras(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <Button onClick={() => setFormExpanded(!formExpanded)} className="w-full sm:w-auto gap-2">
                <ShoppingCart className="h-4 w-4" /> Nova Solicitação
              </Button>
            </div>

            {formExpanded && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/2 animate-in slide-in-from-top-4">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Criar Nova Solicitação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select value={tipo} onValueChange={setTipo} required>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compra">Compra</SelectItem>
                            <SelectItem value="servico">Serviço</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prioridade *</Label>
                        <Select value={prioridade} onValueChange={setPrioridade}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <Label>Tipo de Serviço *</Label>
                        <Select value={tipoDeServico} onValueChange={setTipoDeServico}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manutencao_infraestrutura">Manutenção Infraestrutura</SelectItem>
                            <SelectItem value="servicos_tecnicos">Serviços Técnicos</SelectItem>
                            <SelectItem value="limpeza_conservacao">Limpeza e Conservação</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Departamento</Label>
                        <Input placeholder="Ex: Operações" value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Necessária</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dataNecessariaDate ? format(dataNecessariaDate, "dd/MM") : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dataNecessariaDate}
                              onSelect={(date) => {
                                setDataNecessariaDate(date);
                                setDataNecessaria(date ? format(date, "yyyy-MM-dd") : "");
                              }}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição *</Label>
                      <Textarea
                        placeholder={tipo === 'compra' ? "O que está sendo solicitado?" : "Descreva o serviço necessário"}
                        rows={3}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={loading} className="w-32"><ShoppingCart className="mr-2 h-4 w-4" />{loading ? 'Criando...' : 'Criar'}</Button>
                      <Button type="button" variant="ghost" onClick={() => setFormExpanded(false)}>Cancelar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <Card className="text-center p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-sm text-muted-foreground">Rascunhos</p>
                <p className="text-2xl font-bold text-gray-600">{stats.rascunhos}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-sm text-muted-foreground">Enviadas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.enviadas}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.aprovadas}</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-sm text-muted-foreground">Reprovadas</p>
                <p className="text-2xl font-bold text-red-600">{stats.reprovadas}</p>
              </Card>
            </div>

            {/* Grid de Compras */}
            {comprasFiltradas.length === 0 ? (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Nenhuma solicitação encontrada.</AlertDescription></Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {comprasFiltradas.map((request) => (
                  <Card key={request.id} className="flex flex-col hover:shadow-lg transition-all border-primary/10 hover:border-primary/30">
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between mb-2">
                        <Badge variant="outline" className="font-mono">{request.numero_solicitacao}</Badge>
                        {getStatusIcon(request.status)}
                      </div>
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 min-h-[2.5rem]">{request.descricao}</h3>
                      <div className="border-t my-3"></div>
                      <div className="space-y-2 mb-4 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="capitalize">{request.tipo}</span></div>
                        {request.tipo_de_servico && request.tipo === 'servico' && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Tipo de Serviço:</span><span className="capitalize">{request.tipo_de_servico.replace(/_/g, ' ')}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">Solicitante:</span><span className="max-w-[60%] truncate text-right">{request.solicitante_nome || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span>{format(new Date(request.data_solicitacao), 'dd/MM/yy')}</span></div>
                      </div>
                      <div className="space-y-3 mt-auto">
                        <div>{getStatusBadge(request.status)}</div>
                        <div className="flex gap-2">
                          {request.status === 'rascunho' && request.user_id === currentUserId && (
                            <Button variant="outline" size="sm" onClick={() => enviarSolicitacao(request.id)} className="w-full">Enviar</Button>
                          )}
                          {canEditRequests && request.status !== 'rascunho' && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => { setEditingRequest(request); setEditStatus(request.status); }} className="w-full gap-1"><Edit className="h-3 w-3" /> Gerenciar</Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader><DialogTitle>Gerenciar Solicitação</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2"><Label>Status</Label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="enviado">Enviado</SelectItem>
                                        <SelectItem value="em_analise">Em Análise</SelectItem>
                                        <SelectItem value="aprovado">Aprovado</SelectItem>
                                        <SelectItem value="reprovado">Reprovado</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {editStatus === 'aprovado' && (
                                    <div className="space-y-2"><Label>Nível</Label>
                                      <Select value={editAprovador} onValueChange={setEditAprovador}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="nivel1">Gestor (Nível 1)</SelectItem>
                                          <SelectItem value="nivel2">Admin (Nível 2)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  <Button onClick={handleUpdateStatus} className="w-full">Salvar</Button>
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
          </TabsContent>

          {/* ABA DE PAGAMENTOS */}
          <TabsContent value="pagamentos" className="space-y-6 animate-in fade-in-50">

            {/* Stats de pagamentos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{paymentStats.total}</p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagas ({paymentStats.pagas})</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(paymentStats.valorPago)}</p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendentes ({paymentStats.pendentes})</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(paymentStats.valorPendente)}</p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                  <p className="text-xl font-bold">{clienteGroups.filter(g => g.id !== SEM_CLIENTE).length}</p>
                </div>
              </Card>
            </div>

            {/* Busca + filtro de status */}
            <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição ou solicitante..."
                  value={searchPagamentos}
                  onChange={(e) => setSearchPagamentos(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex gap-2 bg-muted/50 p-1 rounded-lg w-fit">
                {([
                  { key: 'todos', label: 'Todas' },
                  { key: 'pendente', label: 'Pendentes' },
                  { key: 'pago', label: 'Pagas' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFiltroStatusPagamento(opt.key)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      filtroStatusPagamento === opt.key
                        ? 'bg-background shadow-sm font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Breadcrumb de navegação */}
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={handleBackToClientes}
                className={`flex items-center gap-1.5 ${navCliente ? 'text-muted-foreground hover:text-foreground' : 'font-semibold text-foreground'}`}
              >
                <Building2 className="h-3.5 w-3.5" /> Pastas de Clientes
              </button>
              {navCliente && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    onClick={handleBackToSocios}
                    className={`${navSocio ? 'text-muted-foreground hover:text-foreground' : 'font-semibold text-foreground'}`}
                  >
                    {navCliente === SEM_CLIENTE ? 'Sem Cliente Vinculado' : clienteNome(navCliente)}
                  </button>
                </>
              )}
              {navSocio && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">
                    {navSocio === SEM_SOCIO ? 'Sem Sócio Vinculado' : socioNome(navSocio)}
                  </span>
                </>
              )}
            </div>

            {/* NÍVEL 0: pastas de clientes */}
            {!navCliente && (
              clienteGroups.length === 0 ? (
                <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Nenhum pagamento encontrado.</AlertDescription></Alert>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {clienteGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => handleOpenCliente(group.id)}
                      className="group text-left bg-card border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center gap-2"
                    >
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <Folder className="h-7 w-7 text-primary" strokeWidth={1.75} />
                      </div>
                      <p className="font-semibold text-sm leading-tight line-clamp-2 w-full">
                        {group.id === SEM_CLIENTE ? 'Sem Cliente Vinculado' : group.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {group.count} {group.count === 1 ? 'solicitação' : 'solicitações'}
                      </p>
                      <p className="text-xs font-medium text-primary">{formatCurrency(group.valor)}</p>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* NÍVEL 1: pastas de sócios (quando aplicável) */}
            {navCliente && showSocioLevel && !navSocio && (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={handleBackToClientes} className="gap-1 -ml-2">
                  <ChevronLeft className="h-4 w-4" /> Voltar para Clientes
                </Button>
                {socioGroups.length === 0 ? (
                  <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Nenhum sócio com pagamentos encontrado.</AlertDescription></Alert>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {socioGroups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => handleOpenSocio(group.id)}
                        className="group text-left bg-card border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all flex flex-col items-center text-center gap-2"
                      >
                        <div className="h-14 w-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/15 transition-colors">
                          <Users className="h-6 w-6 text-amber-600" strokeWidth={1.75} />
                        </div>
                        <p className="font-semibold text-sm leading-tight line-clamp-2 w-full">
                          {group.id === SEM_SOCIO ? 'Sem Sócio Vinculado' : group.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.count} {group.count === 1 ? 'solicitação' : 'solicitações'}
                        </p>
                        <p className="text-xs font-medium text-primary">{formatCurrency(group.valor)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NÍVEL 2: lista de solicitações */}
            {navCliente && (!showSocioLevel || navSocio) && (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={showSocioLevel ? handleBackToSocios : handleBackToClientes}
                  className="gap-1 -ml-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>

                {pagamentosFiltrados.length === 0 ? (
                  <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Nenhum pagamento atende aos filtros aplicados.</AlertDescription></Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pagamentosFiltrados.map((request) => {
                      const attachments = getAttachmentLinks(request);
                      const isPaid = isPagoStatus(request.status);

                      return (
                        <Card key={request.id} className="flex flex-col hover:shadow-lg transition-all border-amber-500/10 hover:border-amber-500/30">
                          <CardContent className="p-4 flex-1 flex flex-col">
                            <div className="flex justify-between mb-2">
                              <Badge variant="secondary" className="font-mono bg-amber-500/10 text-amber-700">
                                PAG-{request.id.slice(0, 8).toUpperCase()}
                              </Badge>
                              {isPaid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                            </div>
                            <h3 className="font-semibold text-sm mb-3 line-clamp-2 min-h-[2.5rem]">{request.descricao}</h3>

                            <div className="border-t my-3"></div>

                            <div className="space-y-2 flex-1 text-xs mb-4">
                              <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-semibold text-primary">{formatCurrency(request.valor)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Solicitante:</span><span className="max-w-[60%] truncate">{request.solicitante_nome || 'N/A'}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span>{formatDateLabel(request.data_competencia)}</span></div>
                            </div>

                            <div className="space-y-3 mt-auto">
                              {getPaymentStatusBadge(request.status)}
                              <p className="text-xs text-muted-foreground">
                                {isPaid ? `Pago em ${request.data_pagamento ? format(new Date(request.data_pagamento), 'dd/MM/yyyy') : 'data não informada'}.` : 'Pagamento pendente ou em análise.'}
                              </p>
                              {attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                                  {attachments.map((attachment) => (
                                    <Button key={attachment.label} variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1" asChild>
                                      <a href={attachment.url} target="_blank" rel="noreferrer">
                                        <Paperclip className="h-3 w-3" /> {attachment.label}
                                      </a>
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
}