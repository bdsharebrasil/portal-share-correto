import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AutocompleteInput, type AutocompleteOption } from "@/components/ui/autocomplete-input";
import { Plus, Search, Filter, Trash2, Edit2, TrendingUp, Wallet, ChevronDown, Bell, AlertCircle, CheckCircle2, DollarSign, X, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function ContasReceber() {
  const { user } = useAuth();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const [contas, setContas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [aeronaveSearch, setAeronaveSearch] = useState("");
  const [openAeronavePopover, setOpenAeronavePopover] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [contasReceberData, setContasReceberData] = useState<any>(null);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    numero: "",
    cliente_nome: "",
    cliente_cnpj: "",
    data_criacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    categoria: "Serviços",
    descricao: "",
    status: "pendente",
    aeronave: "",
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
    loadClients();
    loadCategorias();
    loadContasBancarias();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, cnpj")
        .order("company_name", { ascending: true });

      if (error) {
        console.error("Erro ao carregar clientes:", error);
        return;
      }

      setClients(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar clientes:", error.message);
    }
  };

  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("id, nome")
        .eq("tipo", "receita")
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        return;
      }

      setCategorias(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar categorias:", error.message);
    }
  };

  const loadContasBancarias = async () => {
    try {
      const { data, error } = await supabase
        .from("categorias_financeiro")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar contas bancárias:", error);
        return;
      }

      setContasBancarias(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas bancárias:", error.message);
    }
  };

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contas_areceber")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (error) {
        toast.error(`Erro ao carregar: ${error.message}`);
        return;
      }

      setContas(data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar contas a receber");
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
      const fileName = `nf_areceber_${Date.now()}_${formData.numero || 'sem_numero'}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(filePath);

      setPdfUrl(publicUrlData.publicUrl);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar arquivo");
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formData.numero || !formData.cliente_nome || !formData.valor || !formData.data_vencimento) {
      toast.error("Preencha os campos obrigatórios: Número, Cliente, Valor e Data de Vencimento");
      return;
    }

    setIsSavingForm(true);
    try {
      const { error } = await supabase
        .from("contas_areceber")
        .insert([
          {
            numero: formData.numero,
            cliente_nome: formData.cliente_nome,
            cliente_cnpj: formData.cliente_cnpj || "",
            data_criacao: formData.data_criacao,
            data_vencimento: formData.data_vencimento,
            valor: parseFloat(formData.valor),
            categoria: formData.categoria || "Serviços",
            descricao: formData.descricao || null,
            status: formData.status,
            arquivo_pdf_url: pdfUrl || null,
            criado_por: user?.id,
            aeronave: formData.aeronave || null,
          }
        ]);

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      toast.success("Conta a receber criada com sucesso!");
      setShowFormDialog(false);
      resetForm();
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta a receber");
    } finally {
      setIsSavingForm(false);
    }
  };

  const resetForm = () => {
    setFormData({
      numero: "",
      cliente_nome: "",
      cliente_cnpj: "",
      data_criacao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      categoria: "Serviços",
      descricao: "",
      status: "pendente",
      aeronave: "",
    });
    setPdfUrl("");
    setAeronaveSearch("");
  };

  const filteredContas = useMemo(() => {
    return contas.filter(conta => {
      const searchMatch = filters.searchTerm === "" ||
        conta.cliente_nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
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

  const contasPendentes = useMemo(() => {
    return filteredContas.filter(conta => conta.status === "pendente").length;
  }, [filteredContas]);

  const proximoVencimento = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureContas = filteredContas
      .filter(conta => parseLocalDate(conta.data_vencimento) >= today && conta.status !== "recebido")
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());
    
    return futureContas.length > 0 ? futureContas[0].data_vencimento : null;
  }, [filteredContas]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("contas_areceber")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Conta a receber deletada com sucesso!");
      setDeleteConfirmId(null);
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleChangeStatus = async (contaId: string, newStatus: string) => {
    // Se vai mudar para "recebido", abrir dialog para selecionar banco
    if (newStatus === "recebido") {
      const conta = contas.find(c => c.id === contaId);
      setContasReceberData(conta);
      setSelectedBank("");
      setShowBankDialog(true);
      return;
    }

    try {
      const { error } = await supabase
        .from("contas_areceber")
        .update({ status: newStatus, atualizado_em: new Date().toISOString() })
        .eq("id", contaId);

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`);
        return;
      }

      toast.success("Status atualizado com sucesso!");
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

  const handleMarkAsReceived = async () => {
    if (!contasReceberData) return;

    if (!selectedBank) {
      toast.error("Selecione um banco para registrar o recebimento");
      return;
    }

    try {
      // 1. Atualizar status da conta para "recebido"
      const { error: updateError } = await supabase
        .from("contas_areceber")
        .update({
          status: "recebido",
          atualizado_em: new Date().toISOString()
        })
        .eq("id", contasReceberData.id);

      if (updateError) {
        toast.error(`Erro ao atualizar: ${updateError.message}`);
        return;
      }

      // 2. Atualizar status na conciliação bancária se houver referência
      if (contasReceberData.banco_conciliacao_id) {
        const { error: updateConciliacao } = await supabase
          .from("bank_reconciliations")
          .update({ status: "conferido" })
          .eq("id", contasReceberData.banco_conciliacao_id);

        if (updateConciliacao) {
          console.error("Erro ao atualizar conciliação:", updateConciliacao);
        }
      }

      // 3. Chamar função RPC para criar entrada no controle_bancario
      const { error: rpcError } = await supabase.rpc('create_entrada_bancaria_from_conta_receber', {
        p_conta_receber_id: contasReceberData.id,
        p_conta_banco: selectedBank
      });

      if (rpcError) {
        console.error("Erro ao criar entrada bancária:", rpcError);
        toast.warning("Conta marcada como recebida, mas houve um pequeno erro ao registrar no fluxo bancário. Por favor, revise.");
        return;
      }

      toast.success("Conta marcada como recebida e registrada no fluxo bancário!");
      setShowBankDialog(false);
      setContasReceberData(null);
      setSelectedBank("");
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao marcar como recebido");
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
      case "recebido":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pendente":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 auto-rows-max">
        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total a Receber</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-green-500 mb-3">
              R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Período selecionado</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Contas Pendentes</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-blue-500 mb-3">
              {contasPendentes}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando recebimento</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Próximo Recebimento</CardTitle>
            <Bell className="h-5 w-5 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-primary mb-3">
              {proximoVencimento ? format(parseLocalDate(proximoVencimento), "dd/MM/yyyy") : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Próxima data de recebimento</p>
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
              Nova Conta a Receber
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
                placeholder="Buscar cliente ou NF..."
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
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
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
              <CardTitle className="text-lg font-semibold">Nova Conta a Receber</CardTitle>
              <Button
                variant="ghost"
                onClick={() => { setShowFormDialog(false); resetForm(); }}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
          <div className="space-y-5">
            {/* Linha 1 - Número NF e Cliente */}
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
                  Cliente *
                </label>
                <AutocompleteInput
                  value={formData.cliente_nome}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, cliente_nome: value }));
                    const cliente = clients.find(c => c.company_name === value);
                    if (cliente) {
                      setFormData(prev => ({ ...prev, cliente_cnpj: cliente.cnpj || "" }));
                    } else {
                      setFormData(prev => ({ ...prev, cliente_cnpj: "" }));
                    }
                  }}
                  onSelect={(option) => {
                    const cliente = clients.find(c => c.id === option.id);
                    if (cliente) {
                      setFormData(prev => ({
                        ...prev,
                        cliente_nome: cliente.company_name,
                        cliente_cnpj: cliente.cnpj || ""
                      }));
                    }
                  }}
                  options={clients.map(c => ({
                    id: c.id,
                    label: c.company_name
                  }))}
                  placeholder="Buscar ou digite um cliente"
                />
              </div>
            </div>

            {/* Linha 2 - CNPJ e Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  CNPJ
                </label>
                <Input
                  placeholder="CNPJ do cliente"
                  value={formData.cliente_cnpj}
                  onChange={(e) => setFormData(prev => ({ ...prev, cliente_cnpj: e.target.value }))}
                  className="bg-background"
                />
              </div>
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
            </div>

            {/* Linha 3 - Data Criação e Vencimento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Data de Criação
                </label>
                <Input
                  type="date"
                  value={formData.data_criacao}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_criacao: e.target.value }))}
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

            {/* Linha 4 - Aeronave */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Aeronave (Opcional)
              </label>
              <Popover open={openAeronavePopover} onOpenChange={setOpenAeronavePopover}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      value={formData.aeronave}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, aeronave: e.target.value }));
                        setAeronaveSearch(e.target.value);
                        setOpenAeronavePopover(true);
                      }}
                      onFocus={() => setOpenAeronavePopover(true)}
                      placeholder="Buscar ou digitar aeronave..."
                      className="bg-background pr-10"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                  <Command className="bg-card">
                    <CommandInput
                      placeholder="Buscar por prefixo, modelo..."
                      value={aeronaveSearch}
                      onValueChange={setAeronaveSearch}
                      className="bg-background"
                    />
                    <CommandList>
                      {isLoadingAeronaves ? (
                        <div className="text-center py-3 text-muted-foreground text-sm">
                          Carregando aeronaves...
                        </div>
                      ) : (
                        <>
                          <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                            Nenhuma aeronave encontrada
                          </CommandEmpty>
                          <CommandGroup heading="Aeronaves" className="text-muted-foreground">
                            {aeronaves.filter(a =>
                              a.registration.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                              a.model.toLowerCase().includes(aeronaveSearch.toLowerCase())
                            ).slice(0, 10).map((aero) => (
                              <CommandItem
                                key={aero.id}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    aeronave: aero.registration
                                  });
                                  setOpenAeronavePopover(false);
                                  setAeronaveSearch("");
                                }}
                                className="cursor-pointer hover:bg-muted"
                              >
                                <div>
                                  <p className="font-medium text-foreground">{aero.registration}</p>
                                  <p className="text-xs text-muted-foreground">{aero.manufacturer} {aero.model}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Linha 5 - Categoria e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Categoria
                </label>
                <AutocompleteInput
                  value={formData.categoria}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, categoria: value }));
                  }}
                  onSelect={(option) => {
                    const categoria = categorias.find(c => c.id === option.id);
                    if (categoria) {
                      setFormData(prev => ({ ...prev, categoria: categoria.nome }));
                    }
                  }}
                  options={categorias.map(c => ({
                    id: c.id,
                    label: c.nome
                  }))}
                  placeholder="Selecione ou digite uma categoria"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Status
                </label>
                <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 6 - Descrição */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Descrição
              </label>
              <Input
                placeholder="Descrição da conta a receber"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                className="bg-background"
              />
            </div>

            {/* Linha 7 - Anexar PDF */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">
                Nota Fiscal (PDF)
              </label>
              {pdfUrl ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <a
                    href={pdfUrl}
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
                    onClick={() => setPdfUrl("")}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
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
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => { setShowFormDialog(false); resetForm(); }}
              disabled={isSavingForm || isUploadingPDF}
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

      {/* Tabela de Contas a Receber */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <CardTitle className="text-lg font-semibold text-foreground">
            Contas a Receber - {(() => {
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
              <div className="hidden lg:grid items-center px-6 py-4 bg-muted/40 border-b border-border/50 font-semibold text-sm text-muted-foreground sticky top-0 z-10" style={{gridTemplateColumns: '80px 140px 1fr 110px 120px 100px 100px'}}>
                <div>NF</div>
                <div>Cliente</div>
                <div>Descrição</div>
                <div>Vencimento</div>
                <div className="text-right">Valor</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>

              {filteredContas.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <Wallet className="w-20 h-20 text-muted-foreground/20 mx-auto mb-6" />
                  <p className="text-muted-foreground text-lg font-medium">Nenhuma conta a receber encontrada</p>
                  <p className="text-muted-foreground text-sm mt-3">Clique em "Nova Conta a Receber" para adicionar</p>
                </div>
              ) : (
                filteredContas.map((conta) => {
                  const isExpanded = expandedRows.has(conta.id);
                  return (
                    <div key={conta.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors last:border-b-0">
                      {/* Desktop Layout - Grid */}
                      <div className="hidden lg:grid py-5 items-center px-6 text-sm" style={{gridTemplateColumns: '80px 140px 1fr 110px 120px 100px 100px'}}>
                        <div className="text-foreground font-medium truncate">
                          {conta.numero}
                        </div>
                        <div className="font-semibold text-foreground truncate" title={conta.cliente_nome}>
                          {conta.cliente_nome}
                        </div>
                        <div className="text-muted-foreground truncate" title={conta.descricao || "-"}>
                          {conta.descricao || "-"}
                        </div>
                        <div className="text-foreground font-medium">
                          {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}
                        </div>
                        <div className="text-right font-semibold text-green-500 whitespace-nowrap">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="col-span-1">
                          <Select value={conta.status} onValueChange={(value) => handleChangeStatus(conta.id, value)}>
                            <SelectTrigger className={`h-8 text-xs font-medium border rounded-lg ${getStatusColor(conta.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="recebido">Recebido</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-1 justify-end items-center">
                          {conta.arquivo_pdf_url && (
                            <a
                              href={conta.arquivo_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors p-1"
                              title="Ver PDF"
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
                                {conta.cliente_nome}
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">NF: {conta.numero}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>Venc: {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <span className="font-semibold text-sm whitespace-nowrap text-green-500">
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
                            
                            {conta.cliente_cnpj && (
                              <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">CNPJ</p>
                                <p className="text-foreground text-sm">{conta.cliente_cnpj}</p>
                              </div>
                            )}

                            {conta.aeronave && (
                              <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Aeronave</p>
                                <p className="text-foreground text-sm">{conta.aeronave}</p>
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
                                  Ver PDF
                                </a>
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

      {/* Dialog de seleção de banco para recebimento */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Banco para Recebimento</DialogTitle>
          </DialogHeader>

          {contasReceberData && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                <p className="font-semibold text-foreground">{contasReceberData.cliente_nome}</p>
                <p className="text-sm text-muted-foreground mt-2">NF: {contasReceberData.numero}</p>
                <p className="text-sm text-muted-foreground">Valor: R$ {parseFloat(contasReceberData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Selecione o Banco de Recebimento *
                </label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione um banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancarias.length > 0 ? (
                      contasBancarias.map((conta) => (
                        <SelectItem key={conta.id} value={conta.nome}>
                          {conta.nome}
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
                setShowBankDialog(false);
                setContasReceberData(null);
                setSelectedBank("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsReceived}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmar Recebimento
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
          <p className="text-muted-foreground py-4">Deseja realmente deletar esta conta a receber? Esta ação não pode ser desfeita.</p>
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
