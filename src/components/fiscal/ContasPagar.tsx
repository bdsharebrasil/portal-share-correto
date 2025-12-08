import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AutocompleteInput, type AutocompleteOption } from "@/components/ui/autocomplete-input";
import { Plus, Search, Filter, Trash2, Edit2, TrendingDown, Wallet, ChevronDown, Bell, AlertCircle, Clock, CheckCircle2, X, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function ContasPagar() {
  const { user } = useAuth();
  const { categorias: allCategorias, contas: bancarias } = useCategoriasConta();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const categoriaNomes = allCategorias.map(c => c.nome);
  const contaBancariaNames = bancarias.map(c => c.nome);

  const [contas, setContas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleDatetime, setScheduleDatetime] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    hora: "09:00"
  });
  const [showPaymentBankDialog, setShowPaymentBankDialog] = useState(false);
  const [paymentBankData, setPaymentBankData] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState("");
  const [fornecedorUserProfiles, setFornecedorUserProfiles] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    numero: "",
    fornecedor_nome: "",
    fornecedor_cnpj: "",
    data_recebimento: format(new Date(), "yyyy-MM-dd"),
    data_vencimento: format(new Date(), "yyyy-MM-dd"),
    valor: "",
    categoria: "",
    descricao: "",
    status: "agendada",
    metodo_pagamento: "",
    arquivo_pdf_url: "",
    observacoes: "",
    aeronave_id: ""
  });

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentYear = () => {
    return new Date().getFullYear().toString();
  };

  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    periodo: "mes",
    mes: getCurrentMonth(),
    ano: getCurrentYear()
  });

  useEffect(() => {
    loadContas();
    loadFornecedorProfiles();
  }, []);

  const loadFornecedorProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, cpf, email")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Erro ao carregar fornecedores:", error);
        return;
      }

      setFornecedorUserProfiles(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar fornecedores:", error.message);
    }
  };

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_apagar")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (error) {
        toast.error(`Erro ao carregar: ${error.message}`);
        return;
      }

      setContas(data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar contas a pagar");
    }
    setIsLoading(false);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    setIsUploadingPDF(true);
    try {
      const fileName = `nf_${Date.now()}_${formData.numero || 'sem_numero'}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-recebidas")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-recebidas")
        .getPublicUrl(filePath);

      setFormData({ ...formData, arquivo_pdf_url: publicUrlData.publicUrl });
      toast.success("Nota Fiscal enviada com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar arquivo");
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formData.numero || !formData.fornecedor_nome || !formData.valor || !formData.data_vencimento) {
      toast.error("Preencha os campos obrigatórios: Número NF, Fornecedor, Valor e Data de Vencimento");
      return;
    }

    setIsSavingForm(true);
    try {
      const { error } = await supabase
        .from("contas_apagar")
        .insert([
          {
            numero: formData.numero,
            fornecedor_nome: formData.fornecedor_nome,
            fornecedor_cnpj: formData.fornecedor_cnpj || null,
            data_recebimento: formData.data_recebimento,
            data_vencimento: formData.data_vencimento,
            valor: parseFloat(formData.valor),
            categoria: formData.categoria || "Geral",
            descricao: formData.descricao || null,
            status: formData.status,
            metodo_pagamento: formData.metodo_pagamento || null,
            arquivo_pdf_url: formData.arquivo_pdf_url || null,
            observacoes: formData.observacoes || null,
            criado_por: user?.id,
          }
        ]);

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      toast.success("Conta a pagar criada com sucesso!");
      setShowFormDialog(false);
      setFormData({
        numero: "",
        fornecedor_nome: "",
        fornecedor_cnpj: "",
        data_recebimento: format(new Date(), "yyyy-MM-dd"),
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        valor: "",
        categoria: "",
        descricao: "",
        status: "agendada",
        metodo_pagamento: "",
        arquivo_pdf_url: "",
        observacoes: "",
        aeronave_id: ""
      });
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta a pagar");
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleOpenPaymentDialog = (conta: any) => {
    setPaymentBankData(conta);
    setSelectedBank("");
    setShowPaymentBankDialog(true);
  };

  const handleMarkAsPaid = async () => {
    if (!paymentBankData) return;

    if (!selectedBank) {
      toast.error("Selecione um banco para registrar o pagamento");
      return;
    }

    try {
      // Atualizar status para pago na tabela contas_apagar
      // O trigger automático criará o registro no controle_bancario
      const { error: updateError } = await supabase
        .from("contas_apagar")
        .update({
          status: "paga",
          atualizado_em: new Date().toISOString()
        })
        .eq("id", paymentBankData.id);

      if (updateError) {
        toast.error(`Erro ao atualizar: ${updateError.message}`);
        return;
      }

      // Atualizar o banco no controle_bancario usando a função SQL
      const { data: updateBancoResult, error: updateBancoError } = await supabase
        .rpc('update_controle_bancario_banco', {
          p_conta_apagar_id: paymentBankData.id,
          p_conta_banco: selectedBank
        });

      if (updateBancoError) {
        console.error("Erro ao atualizar banco:", updateBancoError);
        toast.warning("Conta marcada como paga, mas houve um pequeno erro ao registrar o banco. Por favor, revise.");
        return;
      }

      toast.success("Conta marcada como paga e registrada no fluxo bancário!");
      setShowPaymentBankDialog(false);
      setPaymentBankData(null);
      setSelectedBank("");
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao marcar como pago");
    }
  };

  const handleSchedulePayment = async () => {
    if (!scheduleData || !scheduleDatetime.data) {
      toast.error("Preencha a data do agendamento");
      return;
    }

    try {
      const { error } = await supabase
        .from("contas_apagar")
        .update({ 
          status: "agendada", 
          data_pagamento_agendado: scheduleDatetime.data,
          atualizado_em: new Date().toISOString() 
        })
        .eq("id", scheduleData.id);

      if (error) {
        toast.error(`Erro ao agendar: ${error.message}`);
        return;
      }

      toast.success("Pagamento agendado com sucesso!");
      setShowScheduleDialog(false);
      setScheduleData(null);
      setScheduleDatetime({
        data: format(new Date(), "yyyy-MM-dd"),
        hora: "09:00"
      });
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar pagamento");
    }
  };

  const filteredContas = useMemo(() => {
    return contas.filter(conta => {
      const searchMatch = filters.searchTerm === "" ||
        conta.fornecedor_nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        conta.numero.toLowerCase().includes(filters.searchTerm.toLowerCase());

      const statusMatch = filters.status === "all" || conta.status === filters.status;

      let periodoMatch = true;
      if (filters.periodo === "mes") {
        periodoMatch = conta.data_vencimento.startsWith(filters.mes);
      } else if (filters.periodo === "ano") {
        periodoMatch = conta.data_vencimento.startsWith(filters.ano);
      }

      return searchMatch && statusMatch && periodoMatch;
    });
  }, [contas, filters]);

  const totals = useMemo(() => {
    return filteredContas.reduce((sum, conta) => sum + parseFloat(conta.valor), 0);
  }, [filteredContas]);

  const contasVencidas = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredContas.filter(conta => {
      const contaDate = parseLocalDate(conta.data_vencimento);
      return contaDate < today && conta.status !== "paga";
    }).length;
  }, [filteredContas]);

  const proximoVencimento = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureContas = filteredContas
      .filter(conta => parseLocalDate(conta.data_vencimento) >= today && conta.status !== "paga")
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());
    
    return futureContas.length > 0 ? futureContas[0].data_vencimento : null;
  }, [filteredContas]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("contas_apagar")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Conta a pagar deletada com sucesso!");
      setDeleteConfirmId(null);
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paga":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "agendada":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelada":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isVencida = (dataVencimento: string, status: string) => {
    if (status === "paga" || status === "cancelada") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contaDate = parseLocalDate(dataVencimento);
    return contaDate < today;
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 auto-rows-max">
        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total a Pagar</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-red-500 mb-3">
              R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Período selecionado</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full border-orange-500/20 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Contas Vencidas</CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-orange-500 mb-3">
              {contasVencidas}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Próximo Vencimento</CardTitle>
            <Bell className="h-5 w-5 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-primary mb-3">
              {proximoVencimento ? format(parseLocalDate(proximoVencimento), "dd/MM/yyyy") : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Próxima data de vencimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" /> Filtros e Período
            </CardTitle>
            <Button
              onClick={() => setShowFormDialog(true)}
              className="bg-primary hover:bg-primary/90 w-full md:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 px-6">
          {/* Período - Destaque */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/40 rounded-lg border border-border/50">
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">Período:</span>
            <div className="flex gap-2">
              <Button
                variant={filters.periodo === "mes" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, periodo: "mes" }))}
                className="min-w-[90px]"
              >
                Mês
              </Button>
              <Button
                variant={filters.periodo === "ano" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, periodo: "ano" }))}
                className="min-w-[90px]"
              >
                Ano
              </Button>
            </div>

            {filters.periodo === "mes" ? (
              <Input
                type="month"
                value={filters.mes}
                onChange={(e) => setFilters(prev => ({ ...prev, mes: e.target.value }))}
                className="bg-background w-full lg:w-auto lg:min-w-[200px] h-10"
              />
            ) : (
              <Select value={filters.ano} onValueChange={(value) => setFilters(prev => ({ ...prev, ano: value }))}>
                <SelectTrigger className="bg-background w-full lg:w-[160px] h-10">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Outros Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fornecedor ou NF..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-10 bg-background h-10"
              />
            </div>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Formulário Inline - Antes da tabela */}
      {showFormDialog && (
        <Card className="bg-card border-border/50 border-primary/50 bg-primary/5">
          <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold">Nova Conta a Pagar</CardTitle>
              <Button
                variant="ghost"
                onClick={() => setShowFormDialog(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
          <div className="space-y-5">
            {/* Informações Básicas */}
            <div className="space-y-4 pb-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informações da Nota Fiscal</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Número NF *
                  </label>
                  <Input
                    placeholder="Ex: 1234"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Data de Recebimento
                  </label>
                  <Input
                    type="date"
                    value={formData.data_recebimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_recebimento: e.target.value }))}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Fornecedor */}
            <div className="space-y-4 pb-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Fornecedor</h3>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Fornecedor *
                </label>
                <AutocompleteInput
                  value={formData.fornecedor_nome}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, fornecedor_nome: value }));
                    // Tentar encontrar e preencher CPF se o fornecedor existe em user_profiles
                    const fornecedor = fornecedorUserProfiles.find(f => f.full_name === value);
                    if (fornecedor) {
                      setFormData(prev => ({ ...prev, fornecedor_cnpj: fornecedor.cpf || "" }));
                    } else {
                      setFormData(prev => ({ ...prev, fornecedor_cnpj: "" }));
                    }
                  }}
                  onSelect={(option) => {
                    const fornecedor = fornecedorUserProfiles.find(f => f.id === option.id);
                    if (fornecedor) {
                      setFormData(prev => ({
                        ...prev,
                        fornecedor_nome: fornecedor.full_name,
                        fornecedor_cnpj: fornecedor.cpf || ""
                      }));
                    }
                  }}
                  options={fornecedorUserProfiles.map(f => ({
                    id: f.id,
                    label: f.full_name
                  }))}
                  placeholder="Buscar ou digite um fornecedor"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    CPF/CNPJ
                  </label>
                  <Input
                    placeholder="CPF/CNPJ"
                    value={formData.fornecedor_cnpj}
                    onChange={(e) => setFormData(prev => ({ ...prev, fornecedor_cnpj: e.target.value }))}
                    className="bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Aeronave (Opcional)
                  </label>
                  <AutocompleteInput
                    value={formData.aeronave_id ? aeronaves.find(a => a.id === formData.aeronave_id)?.registration || "" : ""}
                    onChange={(value) => {
                      const aeronave = aeronaves.find(a => a.registration === value);
                      if (aeronave) {
                        setFormData(prev => ({ ...prev, aeronave_id: aeronave.id }));
                      } else {
                        setFormData(prev => ({ ...prev, aeronave_id: "" }));
                      }
                    }}
                    onSelect={(option) => {
                      const aeronave = aeronaves.find(a => a.id === option.id);
                      if (aeronave) {
                        setFormData(prev => ({ ...prev, aeronave_id: aeronave.id }));
                      }
                    }}
                    options={aeronaves.map(a => ({
                      id: a.id,
                      label: `${a.registration} - ${a.model}`
                    }))}
                    placeholder="Buscar aeronave..."
                    isLoading={isLoadingAeronaves}
                    disabled={isLoadingAeronaves}
                  />
                </div>
              </div>
            </div>

            {/* Valores e Datas */}
            <div className="space-y-4 pb-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valores e Vencimento</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Valor *
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Data de Vencimento *
                  </label>
                  <Input
                    type="date"
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Classificação */}
            <div className="space-y-4 pb-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classificação</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Categoria
                  </label>
                  <Select value={formData.categoria} onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriaNomes.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Status *
                  </label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="paga">Paga</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Detalhes Adicionais */}
            <div className="space-y-4 pb-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detalhes Adicionais</h3>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Descrição
                </label>
                <Input
                  placeholder="Descrição da conta a pagar"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Método de Pagamento
                </label>
                <Input
                  placeholder="Ex: Transferência, Boleto, PIX"
                  value={formData.metodo_pagamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, metodo_pagamento: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Observações
                </label>
                <Input
                  placeholder="Informações adicionais"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Documentos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Documentos</h3>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground block">
                  Nota Fiscal (PDF)
                </label>
                {formData.arquivo_pdf_url ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border/50">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <a
                      href={formData.arquivo_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      NF anexada
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, arquivo_pdf_url: "" })}
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handlePDFUpload}
                      disabled={isUploadingPDF}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                      disabled={isUploadingPDF}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingPDF ? "Enviando..." : "Anexar Nota Fiscal (PDF)"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">* Campos obrigatórios</p>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
              disabled={isSavingForm}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveForm}
              disabled={isSavingForm || isUploadingPDF}
              className="bg-primary hover:bg-primary/90 flex-1"
            >
              {isSavingForm ? "Salvando..." : "Salvar Conta"}
            </Button>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Contas a Pagar */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <CardTitle className="text-lg font-semibold text-foreground">
            Contas a Pagar - {(() => {
              if (filters.periodo === "ano") {
                return `Ano ${filters.ano}`;
              }
              const [year, month] = filters.mes.split("-");
              return format(new Date(parseInt(year), parseInt(month) - 1, 15), "MMMM 'de' yyyy", { locale: ptBR });
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-0 overflow-x-auto">
              {/* Cabeçalho Fixo - Desktop */}
              <div className="hidden lg:grid items-center gap-4 px-6 py-4 bg-muted/40 border-b border-border/50 font-semibold text-sm text-muted-foreground sticky top-0 z-10">
                <div className="w-20 flex-shrink-0">NF</div>
                <div className="w-28 flex-shrink-0">Fornecedor</div>
                <div className="flex-1 min-w-[150px]">Descrição</div>
                <div className="w-28 flex-shrink-0 text-right">Valor</div>
                <div className="w-20 flex-shrink-0">Vencimento</div>
                <div className="w-20 flex-shrink-0">Status</div>
                <div className="w-28 flex-shrink-0 text-right">Ações</div>
              </div>

              {filteredContas.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <Wallet className="w-20 h-20 text-muted-foreground/20 mx-auto mb-6" />
                  <p className="text-muted-foreground text-lg font-medium">Nenhuma conta a pagar encontrada</p>
                  <p className="text-muted-foreground text-sm mt-3">Clique em "Nova Conta" para adicionar</p>
                </div>
              ) : (
                filteredContas.map((conta) => {
                  const isExpanded = expandedRows.has(conta.id);
                  const vencida = isVencida(conta.data_vencimento, conta.status);
                  return (
                    <div key={conta.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors last:border-b-0 ${vencida ? "bg-red-500/5" : ""}`}>
                      {/* Desktop Layout - Grid */}
                      <div className="hidden lg:grid gap-4 py-5 items-center px-6 text-sm">
                        <div className="w-20 flex-shrink-0 text-foreground font-medium">
                          {conta.numero}
                        </div>
                        <div className="w-28 flex-shrink-0 font-semibold text-foreground truncate" title={conta.fornecedor_nome}>
                          {conta.fornecedor_nome}
                        </div>
                        <div className="flex-1 min-w-[150px] text-muted-foreground truncate" title={conta.descricao || "-"}>
                          {conta.descricao || "-"}
                        </div>
                        <div className="w-28 flex-shrink-0 text-right font-semibold text-red-500 whitespace-nowrap">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="w-20 flex-shrink-0 text-foreground font-medium">
                          {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}
                          {vencida && <span className="ml-2 text-xs text-red-500 font-semibold">VENCIDA</span>}
                        </div>
                        <div className="w-20 flex-shrink-0">
                          <Badge className={`${getStatusColor(conta.status)} text-xs`}>
                            {conta.status}
                          </Badge>
                        </div>
                        <div className="w-28 flex-shrink-0 flex gap-1 justify-end items-center">
                          {conta.status !== "paga" && (
                            <>
                              <button
                                className="text-muted-foreground hover:text-green-500 transition-colors p-1"
                                title="Marcar como pago"
                                onClick={() => handleOpenPaymentDialog(conta)}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                className="text-muted-foreground hover:text-blue-500 transition-colors p-1"
                                title="Agendar pagamento"
                                onClick={() => {
                                  setScheduleData(conta);
                                  setShowScheduleDialog(true);
                                }}
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {conta.arquivo_pdf_url && (
                            <a
                              href={conta.arquivo_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                              title="Ver Nota Fiscal"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                            title="Deletar"
                            onClick={() => setDeleteConfirmId(conta.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile/Tablet Layout - Card */}
                      <div className="lg:hidden px-5 py-5">
                        <button
                          onClick={() => toggleRowExpand(conta.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm mb-1">
                                {conta.fornecedor_nome}
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">NF: {conta.numero}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>Venc: {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}</span>
                                {vencida && <span className="text-red-500 font-semibold">VENCIDA</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <span className="font-semibold text-sm whitespace-nowrap text-red-500">
                                R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <Badge className={`${getStatusColor(conta.status)} text-xs`}>
                                {conta.status}
                              </Badge>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>

                        {/* Expanded Details - Mobile */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            {conta.descricao && (
                              <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Descrição</p>
                                <p className="text-foreground text-sm">{conta.descricao}</p>
                              </div>
                            )}
                            
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">CNPJ</p>
                              <p className="text-foreground text-sm">{conta.fornecedor_cnpj}</p>
                            </div>

                            {conta.metodo_pagamento && (
                              <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Método de Pagamento</p>
                                <p className="text-foreground text-sm">{conta.metodo_pagamento}</p>
                              </div>
                            )}

                            {conta.observacoes && (
                              <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Observações</p>
                                <p className="text-foreground text-sm">{conta.observacoes}</p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-border flex-wrap">
                              {conta.arquivo_pdf_url && (
                                <a
                                  href={conta.arquivo_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  Ver NF
                                </a>
                              )}
                              {conta.status !== "paga" && (
                                <>
                                  <button
                                className="text-xs px-3 py-1.5 rounded bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                onClick={() => handleOpenPaymentDialog(conta)}
                              >
                                Marcar Pago
                              </button>
                                  <button
                                    className="text-xs px-3 py-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                                    onClick={() => {
                                      setScheduleData(conta);
                                      setShowScheduleDialog(true);
                                    }}
                                  >
                                    Agendar
                                  </button>
                                </>
                              )}
                              <button
                                className="text-xs px-3 py-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                onClick={() => setDeleteConfirmId(conta.id)}
                              >
                                Deletar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Agendamento de Pagamento */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Pagamento</DialogTitle>
          </DialogHeader>

          {scheduleData && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Conta</p>
                <p className="font-semibold text-foreground">{scheduleData.fornecedor_nome}</p>
                <p className="text-sm text-muted-foreground mt-2">NF: {scheduleData.numero}</p>
                <p className="text-sm text-muted-foreground">Valor: R$ {parseFloat(scheduleData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Data do Pagamento *
                </label>
                <Input
                  type="date"
                  value={scheduleDatetime.data}
                  onChange={(e) => setScheduleDatetime(prev => ({ ...prev, data: e.target.value }))}
                  className="bg-background"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleDialog(false);
                setScheduleData(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSchedulePayment}
              className="bg-primary hover:bg-primary/90"
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de seleção de banco para pagamento */}
      <Dialog open={showPaymentBankDialog} onOpenChange={setShowPaymentBankDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Banco para Pagamento</DialogTitle>
          </DialogHeader>

          {paymentBankData && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Fornecedor</p>
                <p className="font-semibold text-foreground">{paymentBankData.fornecedor_nome}</p>
                <p className="text-sm text-muted-foreground mt-2">NF: {paymentBankData.numero}</p>
                <p className="text-sm text-muted-foreground">Valor: R$ {parseFloat(paymentBankData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Selecione o Banco de Pagamento *
                </label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione um banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {contaBancariaNames.length > 0 ? (
                      contaBancariaNames.map((conta) => (
                        <SelectItem key={conta} value={conta}>
                          {conta}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhuma conta disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentBankDialog(false);
                setPaymentBankData(null);
                setSelectedBank("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">Deseja realmente deletar esta conta a pagar? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
