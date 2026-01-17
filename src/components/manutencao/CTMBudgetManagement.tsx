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
import { Plus, Download, Eye, Edit, Trash2, DollarSign, Users, Clock, PieChart } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClientFlightHours } from "@/hooks/useCTMData";

interface BudgetDetails {
  workshop_name?: string;
  motor_data?: string;
  budget_value?: number;
  components?: string;
  notes?: string;
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

export function CTMBudgetManagement({ aircraftId, aircraftRegistration }: CTMBudgetManagementProps) {
  const [budgets, setBudgets] = useState<CTMBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "submitted" | "approved">("all");
  const [showNewBudgetDialog, setShowNewBudgetDialog] = useState(false);
  const [showRateioDialog, setShowRateioDialog] = useState(false);
  const [rateioMonth, setRateioMonth] = useState(new Date().getMonth() + 1);
  const [rateioYear, setRateioYear] = useState(new Date().getFullYear());
  const [maintenanceValue, setMaintenanceValue] = useState("");
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    workshop_name: "",
    motor_data: "",
    budget_value: "",
    components: "",
    notes: "",
  });

  // Calculate date range for flight hours
  const selectedDate = new Date(rateioYear, rateioMonth - 1);
  const startDate = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const endDate = format(endOfMonth(selectedDate), "yyyy-MM-dd");

  // Hook para buscar horas de voo por cliente
  const { data: flightHoursData, isLoading: loadingHours } = useClientFlightHours(aircraftId, startDate, endDate);

  useEffect(() => {
    loadBudgets();
  }, [aircraftId]);

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
      case "draft":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "submitted":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "approved":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Rascunho";
      case "submitted":
        return "Enviado";
      case "approved":
        return "Aprovado";
      default:
        return status;
    }
  };

  const handleCreateBudget = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Você precisa estar logado para criar orçamentos");
        return;
      }

      const budgetDetails: BudgetDetails = {
        workshop_name: formData.workshop_name || undefined,
        motor_data: formData.motor_data || undefined,
        budget_value: formData.budget_value ? parseFloat(formData.budget_value) : undefined,
        components: formData.components || undefined,
        notes: formData.notes || undefined,
      };

      const { error } = await supabase.from("ctm_budgets").insert([
        {
          aircraft_id: aircraftId,
          month: formData.month,
          year: formData.year,
          status: "draft",
          created_by: user.id,
          created_at: new Date().toISOString(),
          budget_details: budgetDetails,
        },
      ]);

      if (error) throw error;

      toast.success("Orçamento criado com sucesso!");
      setShowNewBudgetDialog(false);
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        workshop_name: "",
        motor_data: "",
        budget_value: "",
        components: "",
        notes: "",
      });
      await loadBudgets();
    } catch (error: any) {
      console.error("Error creating budget:", error);
      toast.error("Erro ao criar orçamento: " + error.message);
    }
  };

  const handleApproveBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from("ctm_budgets")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", budgetId);

      if (error) throw error;

      toast.success("Orçamento aprovado!");
      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao aprovar orçamento");
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Tem certeza que deseja deletar este orçamento?")) return;

    try {
      const { error } = await supabase.from("ctm_budgets").delete().eq("id", budgetId);

      if (error) throw error;

      toast.success("Orçamento deletado!");
      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao deletar orçamento");
    }
  };

  // Calcular valor por sócio baseado em horas
  const calculateRateio = (totalValue: number) => {
    if (!flightHoursData?.clients || flightHoursData.clients.length === 0) return [];

    const totalHours = flightHoursData.totalHours;

    return flightHoursData.clients.map((client) => {
      // Se há horas voadas, calcula por uso; senão, usa percentual de participação
      const percentToUse = totalHours > 0
        ? client.percentage_used
        : client.share_percentage;

      return {
        ...client,
        value_to_pay: (totalValue * percentToUse) / 100,
        calculation_type: totalHours > 0 ? "Por uso (horas)" : "Por participação (%)",
      };
    });
  };

  const rateioResults = maintenanceValue
    ? calculateRateio(parseFloat(maintenanceValue) || 0)
    : [];

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
            <Button
              onClick={() => setShowRateioDialog(true)}
              variant="outline"
              className="gap-2"
            >
              <PieChart className="h-4 w-4" />
              Calcular Rateio
            </Button>
            <Button
              onClick={() => setShowNewBudgetDialog(true)}
              className="gap-2 bg-primary hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Resumo de Horas por Sócio */}
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Horas de Voo por Sócio (Últimos 3 meses)</h3>
          </div>

          {loadingHours ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : flightHoursData?.clients && flightHoursData.clients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {flightHoursData.clients.map((client) => (
                <div
                  key={client.client_id}
                  className="p-3 bg-background/50 rounded border border-border"
                >
                  <p className="text-sm font-medium text-foreground truncate" title={client.client_name}>
                    {client.client_name}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-lg font-bold text-foreground">
                        {client.total_hours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {client.percentage_used}% uso
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cota: {client.share_percentage}%
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-border h-1.5 rounded-full mt-2">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(client.percentage_used, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum sócio cadastrado ou sem registros de voo no período
            </p>
          )}

          {flightHoursData?.totalHours !== undefined && flightHoursData.totalHours > 0 && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Total de horas voadas: <span className="font-bold text-foreground">{flightHoursData.totalHours.toFixed(1)}h</span>
            </p>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex items-center bg-slate-800/30 rounded-lg p-1 gap-1">
            {(["all", "draft", "submitted", "approved"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${filterStatus === status
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
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
            <thead className="bg-slate-900/30 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Data Emissão</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4 w-1/3">Arquivos</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-foreground text-sm divide-y divide-border">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum orçamento encontrado
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(budget.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {budget.month}/{budget.year}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {budget.budget_file_name && (
                          <Badge variant="outline" className="text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Orçamento
                          </Badge>
                        )}
                        {budget.report_file_name && (
                          <Badge variant="outline" className="text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Relatório
                          </Badge>
                        )}
                        {budget.oas_file_name && (
                          <Badge variant="outline" className="text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            OAS
                          </Badge>
                        )}
                        {!budget.budget_file_name && !budget.report_file_name && !budget.oas_file_name && (
                          <span className="text-xs text-muted-foreground italic">Sem arquivos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={`text-xs font-bold border ${getStatusColor(budget.status)}`}>
                        {getStatusLabel(budget.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1.5 rounded hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-slate-700 text-muted-foreground hover:text-blue-400 transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {budget.status !== "approved" && (
                          <button
                            onClick={() => handleApproveBudget(budget.id)}
                            className="p-1.5 rounded hover:bg-slate-700 text-muted-foreground hover:text-green-400 transition-colors"
                            title="Aprovar"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBudget(budget.id)}
                          className="p-1.5 rounded hover:bg-slate-700 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center bg-slate-900/20 rounded-b">
          <span className="text-xs text-muted-foreground px-6 py-3">
            Mostrando {filteredBudgets.length} de {budgets.length} orçamentos
          </span>
        </div>
      </CardContent>

      {/* Dialog for New Budget */}
      <Dialog open={showNewBudgetDialog} onOpenChange={setShowNewBudgetDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Data Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="month">Mês</Label>
                <Select
                  value={formData.month.toString()}
                  onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {format(new Date(2024, month - 1), "MMMM", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Ano</Label>
                <Select
                  value={formData.year.toString()}
                  onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-4" />

            {/* Workshop Section */}
            <div>
              <Label htmlFor="workshop_name" className="text-sm font-medium">
                Nome da Oficina
              </Label>
              <Input
                id="workshop_name"
                placeholder="Ex: Manutenção XYZ Ltda"
                value={formData.workshop_name}
                onChange={(e) => setFormData({ ...formData, workshop_name: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Motor Data Section */}
            <div>
              <Label htmlFor="motor_data" className="text-sm font-medium">
                Dados do Motor
              </Label>
              <Input
                id="motor_data"
                placeholder="Ex: Pratt & Whitney PT6A-135A, Horas de operação: 2.500h"
                value={formData.motor_data}
                onChange={(e) => setFormData({ ...formData, motor_data: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Budget Value Section */}
            <div>
              <Label htmlFor="budget_value" className="text-sm font-medium">
                Valor do Orçamento (R$)
              </Label>
              <Input
                id="budget_value"
                type="number"
                placeholder="Ex: 50000.00"
                value={formData.budget_value}
                onChange={(e) => setFormData({ ...formData, budget_value: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Aircraft Components Section */}
            <div>
              <Label htmlFor="components" className="text-sm font-medium">
                Componentes da Aeronave a Reparar/Manutenção
              </Label>
              <textarea
                id="components"
                placeholder="Ex: Pneus, Freios, Sistema de combustível, Bateria, etc"
                value={formData.components}
                onChange={(e) => setFormData({ ...formData, components: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
              />
            </div>

            {/* Notes Section */}
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">
                Observações Adicionais
              </Label>
              <textarea
                id="notes"
                placeholder="Adicione qualquer informação relevante sobre este orçamento"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewBudgetDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBudget}>Criar Orçamento</Button>
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
                <Select
                  value={rateioMonth.toString()}
                  onValueChange={(value) => setRateioMonth(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {format(new Date(2024, month - 1), "MMMM", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select
                  value={rateioYear.toString()}
                  onValueChange={(value) => setRateioYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da Manutenção (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 50000"
                  value={maintenanceValue}
                  onChange={(e) => setMaintenanceValue(e.target.value)}
                />
              </div>
            </div>

            {/* Horas por Sócio no período */}
            <div className="p-4 bg-slate-800/30 rounded-lg border border-border">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horas Voadas em {format(new Date(rateioYear, rateioMonth - 1), "MMMM yyyy", { locale: ptBR })}
              </h4>

              {loadingHours ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : flightHoursData?.clients && flightHoursData.clients.length > 0 ? (
                <div className="space-y-2">
                  {flightHoursData.clients.map((client) => (
                    <div
                      key={client.client_id}
                      className="flex items-center justify-between p-2 bg-background/50 rounded"
                    >
                      <span className="text-sm truncate max-w-[200px]" title={client.client_name}>
                        {client.client_name}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold">{client.total_hours.toFixed(1)}h</span>
                        <Badge variant="outline" className="text-xs">
                          {client.percentage_used}% do uso
                        </Badge>
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

            {/* Resultado do Rateio */}
            {maintenanceValue && parseFloat(maintenanceValue) > 0 && (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-green-500">
                  <DollarSign className="h-4 w-4" />
                  Rateio de Custos
                </h4>
                <div className="space-y-2">
                  {rateioResults.map((result) => (
                    <div
                      key={result.client_id}
                      className="flex items-center justify-between p-3 bg-background/50 rounded"
                    >
                      <div>
                        <span className="text-sm font-medium truncate block max-w-[200px]" title={result.client_name}>
                          {result.client_name}
                        </span>
                        <span className="text-xs text-muted-foreground">{result.calculation_type}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-500">
                          R$ {result.value_to_pay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {result.percentage_used > 0 ? result.percentage_used : result.share_percentage}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowRateioDialog(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
