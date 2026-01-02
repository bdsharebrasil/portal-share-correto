import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Eye, Edit, Trash2, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    description: "",
  });

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
      setBudgets(data || []);
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
      const { error } = await supabase.from("ctm_budgets").insert([
        {
          aircraft_id: aircraftId,
          month: formData.month,
          year: formData.year,
          status: "draft",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success("Orçamento criado com sucesso!");
      setShowNewBudgetDialog(false);
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        description: "",
      });
      await loadBudgets();
    } catch (error: any) {
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
              Orçamentos para Manutenção
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Gerencie cotações de serviços, aprovações e histórico de custos.
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowNewBudgetDialog(true)}
            className="gap-2 bg-primary hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Adicionar Novo Orçamento
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filter Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex items-center bg-slate-800/30 rounded-lg p-1 gap-1">
            {(["all", "draft", "submitted", "approved"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                  filterStatus === status
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
          <div className="flex gap-1 px-6 py-3">
            <button className="px-3 py-1 text-xs font-medium rounded bg-slate-800 text-muted-foreground hover:text-foreground disabled:opacity-50">
              Anterior
            </button>
            <button className="px-3 py-1 text-xs font-medium rounded bg-slate-800 text-muted-foreground hover:text-foreground">
              Próximo
            </button>
          </div>
        </div>
      </CardContent>

      {/* Dialog for New Budget */}
      <Dialog open={showNewBudgetDialog} onOpenChange={setShowNewBudgetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewBudgetDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBudget}>Criar Orçamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
