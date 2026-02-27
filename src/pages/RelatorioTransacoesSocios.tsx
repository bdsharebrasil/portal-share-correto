import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Edit2, Filter, Plus, X, DollarSign, Eye, ArrowLeft, FileText } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesComSocios } from "@/hooks/useSocioBalanco";
import { useClientPartners, type ClientPartner } from "@/hooks/useClientPartners";
import { useSocioExpenses } from "@/hooks/useFinanceiroSocios";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Helper functions
function formatCPF(cpf: string) {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "N/A";
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Main Component
export default function RelatorioTransacoesSocios() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  
  // State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [editTarget, setEditTarget] = useState<ClientPartner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    cpf: "",
    share_percentage: "",
  });
  
  // Monthly report state
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  
  // State for individual partner view
  const [selectedPartnerCpf, setSelectedPartnerCpf] = useState<string | null>(null);

  // Data hooks
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();
  const { data: partners = [], isLoading: loadingPartners, refetch: refetchPartners } = useClientPartners(clienteId || null);
  const { data: allExpenses = [], isLoading: loadingExpenses } = useSocioExpenses(clienteId || null);

  const selectedClientData = useMemo(
    () => clientesComSocios.find((c) => c.id === clienteId),
    [clientesComSocios, clienteId]
  );

  // Filter partners by search term
  const filteredPartners = useMemo(() => {
    if (!searchTerm) return partners;
    const term = searchTerm.toLowerCase();
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    );
  }, [partners, searchTerm]);

  // Calculate summary stats
  const partnerStats = useMemo(() => {
    const totalPartners = partners.length;
    const totalSharePercentage = partners.reduce(
      (sum, p) => sum + (p.share_percentage || 0),
      0
    );
    const averageSharePercentage = totalPartners > 0 ? totalSharePercentage / totalPartners : 0;
    return { totalPartners, totalSharePercentage, averageSharePercentage };
  }, [partners]);

  // Filter expenses for monthly report
  const filteredExpenses = useMemo(() => {
    let filtered = [...allExpenses];
    
    // Filter by month
    if (monthFilter) {
      filtered = filtered.filter((exp: any) => {
        const expDate = exp.created_at?.slice(0, 7) || exp.due_date?.slice(0, 7);
        return expDate === monthFilter;
      });
    }
    
    // Filter by partner
    if (selectedPartnerFilter && selectedPartnerFilter !== "all") {
      filtered = filtered.filter((exp: any) => exp.assigned_partner_cpf === selectedPartnerFilter);
    }
    
    // Filter by status
    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((exp: any) => exp.status === statusFilter);
    }
    
    return filtered;
  }, [allExpenses, monthFilter, selectedPartnerFilter, statusFilter]);

  // Filter expenses for individual partner view
  const partnerExpenses = useMemo(() => {
    if (!selectedPartnerCpf) return [];
    return allExpenses.filter((exp: any) => exp.assigned_partner_cpf === selectedPartnerCpf);
  }, [allExpenses, selectedPartnerCpf]);

  const selectedPartnerData = useMemo(() => {
    if (!selectedPartnerCpf) return null;
    return partners.find(p => p.cpf === selectedPartnerCpf);
  }, [partners, selectedPartnerCpf]);

  // Edit handlers
  const openEdit = (partner: ClientPartner) => {
    setEditTarget(partner);
    setEditForm({
      name: partner.name,
      cpf: partner.cpf,
      share_percentage: partner.share_percentage?.toString() || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget || !clienteId) return;
    if (!editForm.name.trim() || !editForm.cpf.trim()) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }
    try {
      const { error } = await supabase
        .from("client_partners")
        .update({
          name: editForm.name.trim(),
          cpf: editForm.cpf.replace(/\D/g, ""),
          share_percentage: editForm.share_percentage
            ? parseFloat(editForm.share_percentage)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTarget.id)
        .eq("client_id", clienteId);

      if (error) throw error;
      toast.success("Sócio atualizado com sucesso!");
      setEditTarget(null);
      refetchPartners();
    } catch (err) {
      console.error("[handleEditSave] Erro:", err);
      toast.error("Erro ao atualizar sócio");
    }
  };

  // Loading state
  if (loadingClientes) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!selectedClientData) {
    return (
      <Layout>
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-12 pb-12 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">Cliente não encontrado</h3>
            <Button onClick={() => navigate("/financeiro/financeiro-socios")} className="mt-4">
              ← Voltar
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  // --- INDIVIDUAL PARTNER VIEW ---
  if (selectedPartnerCpf && selectedPartnerData) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Transações de {selectedPartnerData.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  CPF: {formatCPF(selectedPartnerData.cpf)} • {selectedPartnerData.share_percentage?.toFixed(2)}% de participação
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedPartnerCpf(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </div>

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Despesas ({partnerExpenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partnerExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada para este sócio.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Descrição</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Doc</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Prazo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Banco</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerExpenses.map((exp: any, idx: number) => (
                        <tr key={exp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 0 ? "bg-muted/5" : ""}`}>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(exp.created_at || exp.due_date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{exp.description}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{exp.doc || exp.invoice_number || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={exp.status === "paid" ? "default" : "secondary"} className="text-xs">
                              {exp.status || "pendente"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.payment_method || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.prazo || (exp.due_date ? formatDate(exp.due_date) : "—")}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.bank_name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono font-medium text-foreground">
                            {formatCurrency(exp.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-foreground">Total</td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold text-primary">
                          {formatCurrency(partnerExpenses.reduce((sum: number, e: any) => sum + (e.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // --- MONTHLY REPORT VIEW ---
  if (showMonthlyReport) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Relatório Mensal de Despesas</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedClientData?.company_name || selectedClientData?.proprietario}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowMonthlyReport(false)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </div>

          {/* Filters */}
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Filtros</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Mês</Label>
                  <Input
                    type="month"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Sócio</Label>
                  <Select value={selectedPartnerFilter} onValueChange={setSelectedPartnerFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {partners.map(p => (
                        <SelectItem key={p.id} value={p.cpf}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Despesas do Mês
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  ({filteredExpenses.length} registros)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingExpenses ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhuma despesa encontrada</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Sócio</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Descrição</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Doc</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-foreground">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Prazo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground">Banco</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((exp: any, idx: number) => (
                        <tr key={exp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 0 ? "bg-muted/5" : ""}`}>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(exp.created_at || exp.due_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {exp.assigned_partner_name || "Geral"}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{exp.description}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{exp.doc || exp.invoice_number || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={exp.status === "paid" ? "default" : "secondary"} className="text-xs">
                              {exp.status || "pendente"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.payment_method || "—"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.prazo || (exp.due_date ? formatDate(exp.due_date) : "—")}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{exp.bank_name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono font-medium text-foreground">
                            {formatCurrency(exp.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-foreground">Total</td>
                        <td className="px-4 py-3 text-sm text-right font-mono font-bold text-primary">
                          {formatCurrency(filteredExpenses.reduce((sum: number, e: any) => sum + (e.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // --- MAIN VIEW: Partners Table ---
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sócios e Parceiros</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClientData?.company_name || selectedClientData?.proprietario} •{" "}
                {selectedClientData?.cnpj}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/financeiro/financeiro-socios")}
              size="sm"
            >
              ← Voltar
            </Button>
            <Button
              onClick={() => setShowMonthlyReport(true)}
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Relatório Mensal
            </Button>
            <Button
              onClick={() =>
                navigate(`/agenda/clientes?edit=${clienteId}`, { state: { scrollToPartners: true } })
              }
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Gerenciar Sócios
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Total de Sócios
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalPartners}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Percentual Total
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.totalSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Média por Sócio
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {partnerStats.averageSharePercentage.toFixed(2)}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Buscar Sócios</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="search" className="text-sm font-medium">
                  Nome ou CPF
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="search"
                    type="text"
                    placeholder="Digite o nome ou CPF do sócio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setSearchTerm("")}
                      title="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {searchTerm && (
                <div className="text-xs text-muted-foreground">
                  Mostrando {filteredPartners.length} de {partners.length} sócios
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Partners Table - CLICKABLE, NO DELETE */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Sócios e Parceiros
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                ({filteredPartners.length} de {partners.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPartners ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm ? "Nenhum sócio encontrado" : "Nenhum sócio cadastrado"}
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Nome</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">CPF</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Percentual</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Data de Criação</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Última Atualização</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.map((partner, index) => (
                      <tr
                        key={partner.id}
                        className={`border-b border-border/30 hover:bg-primary/5 transition-colors cursor-pointer ${
                          index % 2 === 0 ? "bg-muted/5" : ""
                        }`}
                        onClick={() => setSelectedPartnerCpf(partner.cpf)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {partner.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {formatCPF(partner.cpf)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {partner.share_percentage !== null ? (
                            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                              {partner.share_percentage.toFixed(2)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(partner.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(partner.updated_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors text-primary"
                              title="Editar"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(partner);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-primary/20 transition-colors text-primary"
                              title="Ver Transações"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartnerCpf(partner.cpf);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              Editar Sócio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
                value={editForm.cpf}
                onChange={(e) => setEditForm((p) => ({ ...p, cpf: e.target.value }))}
                className="mt-1"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label htmlFor="edit-share">Percentual de Participação (%)</Label>
              <Input
                id="edit-share"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editForm.share_percentage}
                onChange={(e) => setEditForm((p) => ({ ...p, share_percentage: e.target.value }))}
                className="mt-1"
                placeholder="Ex: 50.00"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
