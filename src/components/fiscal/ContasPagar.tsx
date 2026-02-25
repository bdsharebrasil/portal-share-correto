import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Filter, Trash2, Edit2, TrendingDown, Wallet, ChevronDown, ChevronUp, Bell, AlertCircle, CheckCircle2, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Sub-components
import { FormDespesasEmpresa } from "./contas-pagar/FormDespesasEmpresa";
import { FormDespesasParticulares } from "./contas-pagar/FormDespesasParticulares";
import { FormDespesasReembolsaveis } from "./contas-pagar/FormDespesasReembolsaveis";
import { FormImpostos } from "./contas-pagar/FormImpostos";
import { ContaPagarExpandedDetails } from "./contas-pagar/ContaPagarExpandedDetails";
import { PaymentDialog } from "./contas-pagar/PaymentDialog";

const CATEGORIAS_FIXAS = [
  { value: "DESPESAS EMPRESA", label: "Despesas Empresa" },
  { value: "DESPESAS PARTICULARES", label: "Despesas Particulares" },
  { value: "DESPESAS REEMBOLSAVEIS", label: "Despesas Reembolsáveis" },
  { value: "IMPOSTOS", label: "Impostos" },
];

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const initialFormState = {
  numero: "",
  fornecedor_nome: "",
  fornecedor_cnpj: "",
  data_recebimento: format(new Date(), "yyyy-MM-dd"),
  data_vencimento: format(new Date(), "yyyy-MM-dd"),
  valor: "",
  categoria: "",
  descricao: "",
  status: "agendado",
  observacoes: "",
  aeronave: "",
  aeronave_id: null as string | null,
  aeronave_registro: "",
  fornecedor_favorito_id: null as string | null,
  conta_pagamento_fornecedor: "",
  client_id: null as string | null,
  client_partner_id: null as string | null,
  empresa_id: null as string | null,
  empresa: "",
  // Boleto
  possui_boleto: false,
  boleto_url: "",
  data_recebimento_boleto: "",
  data_prazo_pagamento: "",
  codigo_barras: "",
  // NF
  possui_nf: false,
  nf_numero: "",
  nf_url: "",
  // DECEA
  numero_documento_decea: "",
  competencia_decea: "",
  // Impostos
  periodo_apuracao: "",
  documento_url: "",
};

export function ContasPagar() {
  const { user } = useAuth();
  const { aeronaves } = useAeronaves();

  const [contas, setContas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState("");
  const [formData, setFormData] = useState({ ...initialFormState });
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [bancos, setBancos] = useState<{ id: string; label: string }[]>([]);
  const [paymentConta, setPaymentConta] = useState<any>(null);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    periodo: "mes",
    mes: getCurrentMonth(),
    ano: new Date().getFullYear().toString()
  });

  useEffect(() => {
    loadContas();
    loadFornecedores();
    loadBancos();
  }, []);

  const loadFornecedores = async () => {
    const { data } = await supabase
      .from("fornecedores_favoritos")
      .select("id, nome_completo, documento, categoria, apelido, conta_pagamento")
      .order("nome_completo");
    setFornecedores(data || []);
  };

  const loadBancos = async () => {
    const { data } = await supabase.from("bank_institutions").select("id, label").order("sort_order");
    setBancos(data || []);
  };

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.from("contas_apagar") as any)
        .select(`*, fornecedores_favoritos:fornecedor_favorito_id(id, nome_completo, conta_pagamento), clients:client_id(id, company_name, proprietario), client_partners:client_partner_id(id, name)`)
        .neq("status", "paga")
        .order("data_vencimento", { ascending: true });

      if (error) { toast.error(error.message); return; }
      setContas(data || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar");
    }
    setIsLoading(false);
  };

  const handleSelectCategoria = (cat: string) => {
    setSelectedCategoria(cat);
    setFormData({ ...initialFormState, categoria: cat });
  };

  const handleSave = async () => {
    if (!formData.fornecedor_nome || !formData.valor || !formData.data_vencimento) {
      toast.error("Preencha Fornecedor, Valor e Data de Vencimento");
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        numero: formData.numero || null,
        fornecedor_nome: formData.fornecedor_nome,
        fornecedor_cnpj: formData.fornecedor_cnpj || "",
        data_recebimento: formData.data_recebimento,
        data_vencimento: formData.data_vencimento,
        valor: parseFloat(formData.valor),
        categoria: formData.categoria,
        descricao: formData.descricao || null,
        status: "agendado",
        observacoes: formData.observacoes || null,
        criado_por: user?.id,
        aeronave: formData.aeronave_registro || "",
        aeronave_id: formData.aeronave_id || null,
        aeronave_registro: formData.aeronave_registro || null,
        fornecedor_favorito_id: formData.fornecedor_favorito_id || null,
        conta_pagamento_fornecedor: formData.conta_pagamento_fornecedor || null,
        client_id: formData.client_id || null,
        client_partner_id: formData.client_partner_id || null,
        empresa_id: formData.empresa_id || null,
        empresa: formData.empresa || null,
        possui_boleto: formData.possui_boleto,
        boleto_url: formData.boleto_url || null,
        data_recebimento_boleto: formData.data_recebimento_boleto || null,
        data_prazo_pagamento: formData.data_prazo_pagamento || null,
        codigo_barras: formData.codigo_barras || null,
        possui_nf: formData.possui_nf,
        nf_numero: formData.nf_numero || null,
        nf_url: formData.nf_url || null,
        numero_documento_decea: formData.numero_documento_decea || null,
        competencia_decea: formData.competencia_decea || null,
        periodo_apuracao: formData.periodo_apuracao || null,
        documento_url: formData.documento_url || null,
      };

      const { error } = await (supabase.from("contas_apagar") as any).insert([payload]);
      if (error) throw error;

      toast.success("Conta a pagar criada!");
      setShowForm(false);
      setSelectedCategoria("");
      setFormData({ ...initialFormState });
      loadContas();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from("contas_apagar").delete().eq("id", deleteConfirmId);
    if (error) toast.error(error.message);
    else { toast.success("Conta deletada!"); setDeleteConfirmId(null); loadContas(); }
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const isVencida = (dv: string, status: string) => {
    if (status === "paga" || status === "cancelada") return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return parseLocalDate(dv) < today;
  };

  const getStatusDisplay = (conta: any) => {
    if (isVencida(conta.data_vencimento, conta.status)) return { label: "vencido", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (conta.status === "paga") return { label: "pago", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    return { label: "agendado", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  };

  const filteredContas = useMemo(() => {
    return contas.filter(c => {
      const search = filters.searchTerm.toLowerCase();
      const searchOk = !search || c.fornecedor_nome?.toLowerCase().includes(search) || c.numero?.toLowerCase().includes(search) || c.categoria?.toLowerCase().includes(search);
      const statusOk = filters.status === "all" || (filters.status === "vencido" ? isVencida(c.data_vencimento, c.status) : filters.status === "proximo_vencimento" ? (() => { const today = new Date(); today.setHours(0,0,0,0); const limit = new Date(today); limit.setDate(limit.getDate() + 3); const dv = parseLocalDate(c.data_vencimento); return c.status !== "paga" && c.status !== "cancelada" && dv >= today && dv <= limit; })() : c.status === filters.status);
      let periodoOk = true;
      if (filters.periodo === "mes") periodoOk = c.data_vencimento?.startsWith(filters.mes);
      else if (filters.periodo === "ano") periodoOk = c.data_vencimento?.startsWith(filters.ano);
      return searchOk && statusOk && periodoOk;
    });
  }, [contas, filters]);

  const totals = useMemo(() => filteredContas.reduce((s, c) => s + parseFloat(c.valor || 0), 0), [filteredContas]);
  const contasVencidas = useMemo(() => filteredContas.filter(c => isVencida(c.data_vencimento, c.status)), [filteredContas]);
  const contasProxVencimento = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 3);
    return filteredContas.filter(c => {
      if (c.status === "paga" || c.status === "cancelada") return false;
      const dv = parseLocalDate(c.data_vencimento);
      return dv >= today && dv <= limit;
    });
  }, [filteredContas]);

  return (
    <div className="space-y-6 pb-8">
      {/* Summary Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl shadow-lg shadow-red-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total a Pagar</CardTitle>
            <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30"><TrendingDown className="h-5 w-5 text-red-400" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-red-400">R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl shadow-lg shadow-orange-500/5 cursor-pointer hover:border-orange-500/30 transition-colors"
          onClick={() => setFilters(p => ({ ...p, status: p.status === "vencido" ? "all" : "vencido" }))}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vencidas</CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30"><AlertCircle className="h-5 w-5 text-orange-400" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-orange-400">{contasVencidas.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Clique para filtrar</p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl shadow-lg shadow-yellow-500/5 cursor-pointer hover:border-yellow-500/30 transition-colors"
          onClick={() => setFilters(p => ({ ...p, status: p.status === "proximo_vencimento" ? "all" : "proximo_vencimento" }))}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Próximo ao Vencimento</CardTitle>
            <div className="p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30"><Bell className="h-5 w-5 text-yellow-400" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-yellow-400">{contasProxVencimento.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Até 3 dias · Clique para filtrar</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Filter className="w-5 h-5" /> Filtros</CardTitle>
            <Button onClick={() => { setShowForm(true); setSelectedCategoria(""); setFormData({ ...initialFormState }); }} className="bg-primary hover:bg-primary/90 w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 px-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-muted/40 rounded-lg border border-border/50">
            <span className="text-sm font-semibold whitespace-nowrap">Período:</span>
            <div className="flex gap-2">
              <Button variant={filters.periodo === "mes" ? "default" : "outline"} size="sm" onClick={() => setFilters(p => ({ ...p, periodo: "mes" }))}>Mês</Button>
              <Button variant={filters.periodo === "ano" ? "default" : "outline"} size="sm" onClick={() => setFilters(p => ({ ...p, periodo: "ano" }))}>Ano</Button>
            </div>
            {filters.periodo === "mes" ? (
              <Input type="month" value={filters.mes} onChange={e => setFilters(p => ({ ...p, mes: e.target.value }))} className="bg-background w-full lg:w-auto lg:min-w-[200px] h-10" />
            ) : (
              <RegularSelect value={filters.ano} onValueChange={v => setFilters(p => ({ ...p, ano: v }))}>
                <SelectTrigger className="bg-background w-full lg:w-[160px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </RegularSelect>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar fornecedor, categoria..." value={filters.searchTerm} onChange={e => setFilters(p => ({ ...p, searchTerm: e.target.value }))} className="pl-10 bg-background h-10" />
            </div>
            <RegularSelect value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v }))}>
              <SelectTrigger className="bg-background h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="proximo_vencimento">Próximo ao Vencimento</SelectItem>
                <SelectItem value="paga">Pago</SelectItem>
              </SelectContent>
            </RegularSelect>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card className="bg-card border-primary/50 bg-primary/5">
          <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">Nova Conta a Pagar</CardTitle>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Category selector */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Selecione a Categoria</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CATEGORIAS_FIXAS.map(cat => (
                  <Button
                    key={cat.value}
                    variant={selectedCategoria === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectCategoria(cat.value)}
                    className="text-xs h-10"
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Dynamic form based on category */}
            {selectedCategoria === "DESPESAS EMPRESA" && (
              <FormDespesasEmpresa form={formData} setForm={setFormData} fornecedores={fornecedores} onReloadFornecedores={loadFornecedores} />
            )}
            {selectedCategoria === "DESPESAS PARTICULARES" && (
              <FormDespesasParticulares form={formData} setForm={setFormData} fornecedores={fornecedores} onReloadFornecedores={loadFornecedores} />
            )}
            {selectedCategoria === "DESPESAS REEMBOLSAVEIS" && (
              <FormDespesasReembolsaveis form={formData} setForm={setFormData} fornecedores={fornecedores} aeronaves={Array.isArray(aeronaves) ? aeronaves : []} onReloadFornecedores={loadFornecedores} />
            )}
            {selectedCategoria === "IMPOSTOS" && (
              <FormImpostos form={formData} setForm={setFormData} />
            )}

            {selectedCategoria && (
              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving} className="flex-1">Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 flex-1">{isSaving ? "Salvando..." : "Salvar Conta"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <CardTitle className="text-lg font-semibold">Contas a Pagar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><p className="text-muted-foreground">Carregando...</p></div>
          ) : (
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="hidden lg:grid items-center gap-3 px-6 py-3 bg-muted/40 border-b border-border/50 font-semibold text-xs text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: "1fr 160px 110px 120px 140px 90px 90px 90px" }}>
                <div>Fornecedor</div>
                <div>Categoria</div>
                <div>Vencimento</div>
                <div className="text-right">Valor</div>
                <div>Cliente</div>
                <div>Aeronave</div>
                <div className="text-center">Pagar</div>
                <div className="text-right">Ações</div>
              </div>

              {filteredContas.length === 0 ? (
                <div className="text-center py-20"><Wallet className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><p className="text-muted-foreground">Nenhuma conta encontrada</p></div>
              ) : (
                filteredContas.map(conta => {
                  const vencida = isVencida(conta.data_vencimento, conta.status);
                  const statusInfo = getStatusDisplay(conta);
                  const expanded = expandedRows.has(conta.id);
                  const clienteNome = conta.clients?.company_name || conta.clients?.proprietario || "-";
                  const partnerNome = conta.client_partners?.name;

                  return (
                    <div key={conta.id} className={`border-b border-border/50 last:border-b-0 ${vencida ? "bg-red-500/5" : ""}`}>
                      {/* Desktop row */}
                      <div
                        className="hidden lg:grid gap-3 py-4 items-center px-6 text-sm cursor-pointer hover:bg-muted/30 transition-colors"
                        style={{ gridTemplateColumns: "1fr 160px 110px 120px 140px 90px 90px 90px" }}
                        onClick={() => toggleExpand(conta.id)}
                      >
                        <div className="flex items-center gap-2">
                          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <span className="font-semibold truncate">{conta.fornecedor_nome}</span>
                        </div>
                        <div><Badge variant="outline" className="text-xs">{conta.categoria || "-"}</Badge></div>
                        <div className="font-medium">
                          {conta.data_vencimento ? format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy") : "-"}
                        </div>
                        <div className="text-right font-semibold text-red-500 whitespace-nowrap">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="truncate text-xs">
                          {partnerNome ? `${clienteNome} (${partnerNome})` : clienteNome}
                        </div>
                        <div className="text-xs">{conta.aeronave_registro || conta.aeronave || "-"}</div>
                        <div className="text-center" onClick={e => e.stopPropagation()}>
                          {conta.status !== "paga" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-500" onClick={() => setPaymentConta(conta)}>
                              Pagar
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <Badge className={`${statusInfo.color} text-[10px]`}>{statusInfo.label}</Badge>
                          <button className="text-muted-foreground hover:text-red-500 transition-colors p-1" onClick={() => setDeleteConfirmId(conta.id)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="lg:hidden px-5 py-4" onClick={() => toggleExpand(conta.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{conta.fornecedor_nome}</p>
                            <p className="text-xs text-muted-foreground">{conta.categoria}</p>
                            <p className="text-xs mt-1">
                              {conta.data_vencimento ? format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy") : "-"}
                              {vencida && <span className="text-red-500 ml-2 font-bold">VENCIDA</span>}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="font-bold text-red-500">R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <Badge className={`${statusInfo.color} text-xs`}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                        {conta.status !== "paga" && (
                          <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1 bg-green-500/10 border-green-500/30 text-green-500" onClick={() => setPaymentConta(conta)}>Pagar</Button>
                            <button className="p-1 text-muted-foreground hover:text-red-500" onClick={() => setDeleteConfirmId(conta.id)}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>

                      {/* Expanded details */}
                      {expanded && <ContaPagarExpandedDetails conta={conta} />}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <PaymentDialog
        open={!!paymentConta}
        onOpenChange={(open) => !open && setPaymentConta(null)}
        conta={paymentConta}
        bancos={bancos}
        onPaid={() => { setPaymentConta(null); loadContas(); }}
      />

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-muted-foreground py-4">Deseja realmente deletar esta conta a pagar?</p>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
