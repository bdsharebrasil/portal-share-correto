import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Eye, Edit, Trash2, DollarSign, Users, Clock, PieChart, Building2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClientFlightHours } from "@/hooks/useCTMData";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

interface BudgetDetails {
  workshop_name?: string;
  workshop_id?: string;
  workshop_source?: "oficina" | "fornecedor";
  motor_data?: string;
  budget_value?: number;
  components?: string;
  notes?: string;
  items?: BudgetItem[];
}

interface BudgetItem {
  description: string;
  quantity: number;
  unit_value: number;
  total: number;
}

interface CTMBudget {
  id: string;
  aircraft_id: string;
  month: number;
  year: number;
  oas_file_path?: string;
  oas_file_name?: string;
  report_file_path?: string;
  report_file_name?: string;
  budget_file_path?: string;
  budget_file_name?: string;
  status: "draft" | "submitted" | "approved";
  created_by?: string;
  created_at: string;
  updated_at?: string;
  budget_details?: BudgetDetails;
}

interface CTMBudgetManagementProps {
  aircraftId: string;
  aircraftRegistration: string;
}

interface CompanyOption {
  id: string;
  label: string;
  source: "oficina" | "fornecedor";
}

export function CTMBudgetManagement({ aircraftId, aircraftRegistration }: CTMBudgetManagementProps) {
  const [budgets, setBudgets] = useState<CTMBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "submitted" | "approved">("all");
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false);
  const [showRateioDialog, setShowRateioDialog] = useState(false);
  const [showAddCompanyDialog, setShowAddCompanyDialog] = useState(false);
  const [addCompanyType, setAddCompanyType] = useState<"oficina" | "fornecedor">("oficina");
  const [rateioMonth, setRateioMonth] = useState(new Date().getMonth() + 1);
  const [rateioYear, setRateioYear] = useState(new Date().getFullYear());
  const [maintenanceValue, setMaintenanceValue] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [newCompany, setNewCompany] = useState({ razao_social: "", cnpj: "", telefone: "", endereco: "" });
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([{ description: "", quantity: 1, unit_value: 0, total: 0 }]);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    workshop_id: "",
    workshop_name: "",
    workshop_source: "" as "" | "oficina" | "fornecedor",
    motor_data: "",
    budget_value: "",
    components: "",
    notes: "",
  });

  const selectedDate = new Date(rateioYear, rateioMonth - 1);
  const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");
  const { data: flightHoursData, isLoading: loadingHours } = useClientFlightHours(aircraftId, startDate, endDate);

  useEffect(() => {
    loadBudgets();
    loadCompanies();
  }, [aircraftId]);

  const loadCompanies = async () => {
    try {
      const [oficinasRes, fornecedoresRes] = await Promise.all([
        supabase.from("oficinas").select("id, razao_social").eq("ativo", true).order("razao_social"),
        supabase.from("fornecedores_favoritos").select("id, nome_completo, categoria").eq("categoria", "share").order("nome_completo"),
      ]);

      const oficinas: CompanyOption[] = (oficinasRes.data || []).map((o: any) => ({
        id: `oficina_${o.id}`,
        label: `🔧 ${o.razao_social}`,
        source: "oficina" as const,
      }));

      const fornecedores: CompanyOption[] = (fornecedoresRes.data || []).map((f: any) => ({
        id: `fornecedor_${f.id}`,
        label: `🏢 ${f.nome_completo}`,
        source: "fornecedor" as const,
      }));

      setCompanies([...oficinas, ...fornecedores]);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ctm_budgets")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBudgets((data || []) as CTMBudget[]);
    } catch (error: any) {
      console.error("Error loading budgets:", error);
      toast.error("Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = budgets.filter((budget) => {
    if (filterStatus === "all") return true;
    return budget.status === filterStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "submitted": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "approved": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return "Rascunho";
      case "submitted": return "Enviado";
      case "approved": return "Aprovado";
      default: return status;
    }
  };

  const handleCompanySelect = (compoundId: string, label: string) => {
    const company = companies.find(c => c.id === compoundId);
    if (company) {
      const realId = compoundId.replace(/^(oficina_|fornecedor_)/, "");
      const cleanLabel = label.replace(/^(🔧 |🏢 )/, "");
      setFormData(prev => ({
        ...prev,
        workshop_id: realId,
        workshop_name: cleanLabel,
        workshop_source: company.source,
      }));
    }
  };

  const handleAddItem = () => {
    setBudgetItems(prev => [...prev, { description: "", quantity: 1, unit_value: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setBudgetItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof BudgetItem, value: string | number) => {
    setBudgetItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value) || 0;
        item.total = item.quantity * item.unit_value;
      } else if (field === "unit_value") {
        item.unit_value = Number(value) || 0;
        item.total = item.quantity * item.unit_value;
      }

      updated[index] = item;
      return updated;
    });
  };

  const budgetItemsTotal = budgetItems.reduce((sum, item) => sum + item.total, 0);

  const handleCreateBudget = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      const totalValue = budgetItemsTotal > 0 ? budgetItemsTotal : (formData.budget_value ? parseFloat(formData.budget_value) : undefined);

      const budgetDetails: BudgetDetails = {
        workshop_name: formData.workshop_name || undefined,
        workshop_id: formData.workshop_id || undefined,
        workshop_source: formData.workshop_source as "oficina" | "fornecedor" || undefined,
        motor_data: formData.motor_data || undefined,
        budget_value: totalValue,
        components: formData.components || undefined,
        notes: formData.notes || undefined,
        items: budgetItems.filter(i => i.description),
      };

      const { error } = await supabase.from("ctm_budgets").insert([{
        aircraft_id: aircraftId,
        month: formData.month,
        year: formData.year,
        status: "draft",
        created_by: user.id,
        created_at: new Date().toISOString(),
        budget_details: budgetDetails,
      }]);

      if (error) throw error;
      toast.success("Orçamento criado com sucesso!");
      setShowNewBudgetDialog(false);
      resetForm();
      await loadBudgets();
    } catch (error: any) {
      console.error("Error creating budget:", error);
      toast.error("Erro ao criar orçamento: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      workshop_id: "",
      workshop_name: "",
      workshop_source: "",
      motor_data: "",
      budget_value: "",
      components: "",
      notes: "",
    });
    setBudgetItems([{ description: "", quantity: 1, unit_value: 0, total: 0 }]);
  };

  const handleApproveBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase.from("ctm_budgets").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", budgetId);
      if (error) throw error;
      toast.success("Orçamento aprovado!");
      await loadBudgets();
    } catch { toast.error("Erro ao aprovar orçamento"); }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Tem certeza que deseja deletar este orçamento?")) return;
    try {
      const { error } = await supabase.from("ctm_budgets").delete().eq("id", budgetId);
      if (error) throw error;
      toast.success("Orçamento deletado!");
      await loadBudgets();
    } catch { toast.error("Erro ao deletar orçamento"); }
  };

  const handleSaveNewCompany = async () => {
    if (!newCompany.razao_social.trim()) {
      toast.error("Nome/Razão Social é obrigatório");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      if (addCompanyType === "oficina") {
        const { error } = await supabase.from("oficinas").insert([{
          razao_social: newCompany.razao_social,
          cnpj: newCompany.cnpj || null,
          telefone: newCompany.telefone || null,
          endereco: newCompany.endereco || null,
          ativo: true,
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores_favoritos").insert([{
          nome_completo: newCompany.razao_social,
          documento: newCompany.cnpj || null,
          telefone: newCompany.telefone || null,
          categoria: "share",
          criado_por: user.id,
        }]);
        if (error) throw error;
      }

      toast.success(`${addCompanyType === "oficina" ? "Oficina" : "Fornecedor"} cadastrado com sucesso!`);
      setShowAddCompanyDialog(false);
      setNewCompany({ razao_social: "", cnpj: "", telefone: "", endereco: "" });
      await loadCompanies();
    } catch (error: any) {
      toast.error("Erro ao cadastrar: " + error.message);
    }
  };

  const calculateRateio = (totalValue: number) => {
    if (!flightHoursData?.clients || flightHoursData.clients.length === 0) return [];
    const totalHours = flightHoursData.totalHours;
    return flightHoursData.clients.map((client) => {
      const percentToUse = totalHours > 0 ? client.percentage_used : client.share_percentage;
      return { ...client, value_to_pay: (totalValue * percentToUse) / 100, calculation_type: totalHours > 0 ? "Por uso (horas)" : "Por participação (%)" };
    });
  };

  const rateioResults = maintenanceValue ? calculateRateio(parseFloat(maintenanceValue) || 0) : [];

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Carregando orçamentos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <DollarSign className="h-5 w-5 text-primary" />
              Orçamentos e Rateio de Custos
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Gerencie orçamentos e veja quanto cada sócio deve pagar baseado no uso
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowRateioDialog(true)} variant="outline" className="gap-2">
              <PieChart className="h-4 w-4" />
              Calcular Rateio
            </Button>
            <Button onClick={() => setShowNewBudgetDialog(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Resumo de Horas por Sócio */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Horas de Voo por Sócio (Últimos 3 meses)</h3>
          </div>
          {loadingHours ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : flightHoursData?.clients && flightHoursData.clients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {flightHoursData.clients.map((client) => (
                <div key={client.client_id} className="p-3 bg-background/50 rounded border border-border">
                  <p className="text-sm font-medium text-foreground truncate" title={client.client_name}>{client.client_name}</p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-lg font-bold text-foreground">{client.total_hours.toFixed(1)}h</span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">{client.percentage_used}% uso</Badge>
                      <p className="text-xs text-muted-foreground mt-1">Cota: {client.share_percentage}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-border h-1.5 rounded-full mt-2">
                    <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min(client.percentage_used, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum sócio cadastrado ou sem registros de voo no período</p>
          )}
          {flightHoursData?.totalHours !== undefined && flightHoursData.totalHours > 0 && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Total de horas voadas: <span className="font-bold text-foreground">{flightHoursData.totalHours.toFixed(1)}h</span>
            </p>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex items-center bg-muted/30 rounded-lg p-1 gap-1">
            {(["all", "draft", "submitted", "approved"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${filterStatus === status ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {status === "all" && "Todos"}
                {status === "draft" && "Rascunhos"}
                {status === "submitted" && "Pendentes"}
                {status === "approved" && "Aprovados"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Data Emissão</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4">Empresa</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4 w-1/5">Arquivos</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-foreground text-sm divide-y divide-border">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Nenhum orçamento encontrado</td>
                </tr>
              ) : (
                filteredBudgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(budget.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 font-medium">{budget.month}/{budget.year}</td>
                    <td className="px-6 py-4 text-sm">{budget.budget_details?.workshop_name || "—"}</td>
                    <td className="px-6 py-4 font-medium">
                      {budget.budget_details?.budget_value
                        ? `R$ ${budget.budget_details.budget_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {budget.budget_file_name && <Badge variant="outline" className="text-xs"><Download className="h-3 w-3 mr-1" />Orçamento</Badge>}
                        {budget.report_file_name && <Badge variant="outline" className="text-xs"><Download className="h-3 w-3 mr-1" />Relatório</Badge>}
                        {budget.oas_file_name && <Badge variant="outline" className="text-xs"><Download className="h-3 w-3 mr-1" />OAS</Badge>}
                        {!budget.budget_file_name && !budget.report_file_name && !budget.oas_file_name && (
                          <span className="text-xs text-muted-foreground italic">Sem arquivos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={`text-xs font-bold border ${getStatusColor(budget.status)}`}>{getStatusLabel(budget.status)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Visualizar"><Eye className="h-4 w-4" /></button>
                        <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Editar"><Edit className="h-4 w-4" /></button>
                        {budget.status !== "approved" && (
                          <button onClick={() => handleApproveBudget(budget.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-green-400 transition-colors" title="Aprovar">✓</button>
                        )}
                        <button onClick={() => handleDeleteBudget(budget.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Deletar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground px-6 py-3">Mostrando {filteredBudgets.length} de {budgets.length} orçamentos</span>
        </div>
      </CardContent>

      {/* Dialog for New Budget */}
      <Dialog open={showNewBudgetDialog} onOpenChange={setShowNewBudgetDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Novo Orçamento — {aircraftRegistration}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mês</Label>
                <Select value={formData.month.toString()} onValueChange={(v) => setFormData({ ...formData, month: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>{format(new Date(2024, m - 1), "MMMM", { locale: ptBR })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={formData.year.toString()} onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border pt-4" />

            {/* Empresa (Oficina / Fornecedor) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa (Oficina / Fornecedor)
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddCompanyType("oficina"); setShowAddCompanyDialog(true); }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Oficina
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddCompanyType("fornecedor"); setShowAddCompanyDialog(true); }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Fornecedor
                  </Button>
                </div>
              </div>
              <SearchableCombobox
                items={companies}
                value={formData.workshop_id ? `${formData.workshop_source}_${formData.workshop_id}` : ""}
                onChange={handleCompanySelect}
                placeholder="Buscar oficina ou fornecedor..."
                searchPlaceholder="Digite para buscar..."
                emptyMessage="Nenhuma empresa encontrada"
              />
              {formData.workshop_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selecionado: <span className="font-medium text-foreground">{formData.workshop_name}</span>
                  {formData.workshop_source && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {formData.workshop_source === "oficina" ? "Oficina" : "Fornecedor"}
                    </Badge>
                  )}
                </p>
              )}
            </div>

            {/* Dados do Motor */}
            <div>
              <Label className="text-sm font-medium">Dados do Motor</Label>
              <Input
                placeholder="Ex: Pratt & Whitney PT6A-135A, Horas: 2.500h"
                value={formData.motor_data}
                onChange={(e) => setFormData({ ...formData, motor_data: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Componentes */}
            <div>
              <Label className="text-sm font-medium">Componentes / Serviços</Label>
              <textarea
                placeholder="Ex: Pneus, Freios, Sistema de combustível..."
                value={formData.components}
                onChange={(e) => setFormData({ ...formData, components: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
              />
            </div>

            <div className="border-t border-border pt-4" />

            {/* Itens do Orçamento */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Itens do Orçamento</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <div className="col-span-5">Descrição</div>
                  <div className="col-span-2 text-center">Qtd</div>
                  <div className="col-span-2 text-center">Valor Unit.</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {budgetItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input
                        placeholder="Descrição do item/serviço"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={item.unit_value || ""}
                        onChange={(e) => handleItemChange(index, "unit_value", e.target.value)}
                        className="text-center"
                      />
                    </div>
                    <div className="col-span-2 text-right font-medium text-sm pr-1">
                      R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 text-center">
                      {budgetItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total geral */}
                <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-border mt-2">
                  <div className="col-span-9 text-right font-semibold text-sm">Total do Orçamento:</div>
                  <div className="col-span-2 text-right font-bold text-base text-primary">
                    R$ {budgetItemsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            </div>

            {/* Valor manual (caso não use itens) */}
            {budgetItemsTotal === 0 && (
              <div>
                <Label className="text-sm font-medium">Valor Total do Orçamento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 50000.00"
                  value={formData.budget_value}
                  onChange={(e) => setFormData({ ...formData, budget_value: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Preencha manualmente se não usar itens acima</p>
              </div>
            )}

            {/* Observações */}
            <div>
              <Label className="text-sm font-medium">Observações</Label>
              <textarea
                placeholder="Observações adicionais..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowNewBudgetDialog(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleCreateBudget}>Criar Orçamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Add Company */}
      <Dialog open={showAddCompanyDialog} onOpenChange={setShowAddCompanyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addCompanyType === "oficina" ? "Cadastrar Nova Oficina" : "Cadastrar Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{addCompanyType === "oficina" ? "Razão Social *" : "Nome Completo *"}</Label>
              <Input
                value={newCompany.razao_social}
                onChange={(e) => setNewCompany({ ...newCompany, razao_social: e.target.value })}
                placeholder={addCompanyType === "oficina" ? "Razão Social da oficina" : "Nome do fornecedor"}
              />
            </div>
            <div>
              <Label>{addCompanyType === "oficina" ? "CNPJ" : "Documento (CPF/CNPJ)"}</Label>
              <Input
                value={newCompany.cnpj}
                onChange={(e) => setNewCompany({ ...newCompany, cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={newCompany.telefone}
                onChange={(e) => setNewCompany({ ...newCompany, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            {addCompanyType === "oficina" && (
              <div>
                <Label>Endereço</Label>
                <Input
                  value={newCompany.endereco}
                  onChange={(e) => setNewCompany({ ...newCompany, endereco: e.target.value })}
                  placeholder="Endereço da oficina"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddCompanyDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveNewCompany}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Rateio Calculation */}
      <Dialog open={showRateioDialog} onOpenChange={setShowRateioDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Calcular Rateio de Custos - {aircraftRegistration}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Mês de Referência</Label>
                <Select value={rateioMonth.toString()} onValueChange={(v) => setRateioMonth(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>{format(new Date(2024, m - 1), "MMMM", { locale: ptBR })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={rateioYear.toString()} onValueChange={(v) => setRateioYear(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da Manutenção (R$)</Label>
                <Input type="number" placeholder="Ex: 50000" value={maintenanceValue} onChange={(e) => setMaintenanceValue(e.target.value)} />
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horas Voadas em {format(new Date(rateioYear, rateioMonth - 1), "MMMM yyyy", { locale: ptBR })}
              </h4>
              {loadingHours ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : flightHoursData?.clients && flightHoursData.clients.length > 0 ? (
                <div className="space-y-2">
                  {flightHoursData.clients.map((client) => (
                    <div key={client.client_id} className="flex items-center justify-between p-2 bg-background/50 rounded">
                      <span className="text-sm truncate max-w-[200px]" title={client.client_name}>{client.client_name}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold">{client.total_hours.toFixed(1)}h</span>
                        <Badge variant="outline" className="text-xs">{client.percentage_used}% do uso</Badge>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-bold">{flightHoursData.totalHours.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem registros de voo no período</p>
              )}
            </div>

            {maintenanceValue && parseFloat(maintenanceValue) > 0 && (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-green-500">
                  <DollarSign className="h-4 w-4" />
                  Rateio de Custos
                </h4>
                <div className="space-y-2">
                  {rateioResults.map((result) => (
                    <div key={result.client_id} className="flex items-center justify-between p-3 bg-background/50 rounded">
                      <div>
                        <span className="text-sm font-medium truncate block max-w-[200px]" title={result.client_name}>{result.client_name}</span>
                        <span className="text-xs text-muted-foreground">{result.calculation_type}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-500">R$ {result.value_to_pay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <p className="text-xs text-muted-foreground">{result.percentage_used > 0 ? result.percentage_used : result.share_percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowRateioDialog(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
