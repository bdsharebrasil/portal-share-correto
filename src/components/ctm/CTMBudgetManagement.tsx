import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Eye, Edit, Trash2, DollarSign, FileUp, Building2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Helper function to parse Brazilian currency input (e.g., "1.234,56" -> 1234.56)
const parseBrazilianCurrency = (value: string): number => {
  if (!value) return 0;
  // Remove all non-digit characters except comma and dot
  const cleaned = value.replace(/[^0-9.,]/g, '');
  // If there's a comma, treat it as decimal separator and remove all dots
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Otherwise treat as regular number with optional dot
  return parseFloat(cleaned.replace(/\./g, '')) || 0;
};

// Helper function to format number to Brazilian currency display
const formatBrazilianCurrencyDisplay = (value: number): string => {
  if (!value && value !== 0) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface BudgetItem {
  code: string;
  description: string;
  quantity: number;
  unit_value: number;
  total: number;
}

interface BudgetDetails {
  supplier_name?: string;
  supplier_type?: "oficina" | "fornecedor";
  items?: BudgetItem[];
  notes?: string;
  pdf_file_path?: string;
  pdf_file_name?: string;
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
  budget_details?: BudgetDetails;
  status: "draft" | "submitted" | "approved" | "rejected";
  created_by?: string;
  created_at: string;
  updated_at?: string;
  description?: string;
  total_value?: number;
  payment_status?: string | null;
  payment_type?: string | null;
  approved_by_name?: string | null;
  approval_status?: string | null;
}

interface Oficina {
  id: string;
  razao_social: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  mecanico_responsavel?: string;
  tipo_aeronave?: string;
  ativo?: boolean;
}

interface FornecedorFavorito {
  id: string;
  nome_completo: string;
  categoria?: string;
  cidade?: string;
  telefone?: string;
  documento?: string;
}

interface ComboboxItem {
  id: string;
  label: string;
  type: "oficina" | "fornecedor";
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
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([{ code: "", description: "", quantity: 1, unit_value: "" as any, total: 0 }]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [comboboxItems, setComboboxItems] = useState<ComboboxItem[]>([]);
  const [suppliers, setSuppliers] = useState<ComboboxItem[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    supplier_id: "",
    supplier_name: "",
    supplier_type: "" as "" | "oficina" | "fornecedor",
    notes: "",
  });

  const [newSupplierData, setNewSupplierData] = useState({
    type: "oficina" as "oficina" | "fornecedor",
    name: "",
    cnpj_documento: "",
    ciudad_endereco: "",
    telefone: "",
    mecanico_responsavel: "",
    tipo_aeronave: "",
    categoria: "",
  });

  useEffect(() => {
    loadBudgets();
    loadSuppliers();
  }, [aircraftId]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const items: ComboboxItem[] = [];

      // Carregar oficinas
      const { data: oficinas, error: oficinasError } = await supabase
        .from("oficinas")
        .select("id, razao_social")
        .eq("ativo", true)
        .order("razao_social", { ascending: true });

      if (oficinas) {
        oficinas.forEach((o) => {
          items.push({
            id: o.id,
            label: o.razao_social,
            type: "oficina",
          });
        });
      }

      // Carregar fornecedores (categoria = "share")
      const { data: fornecedores, error: fornecedoresError } = await supabase
        .from("fornecedores_favoritos")
        .select("id, nome_completo")
        .eq("categoria", "share")
        .order("nome_completo", { ascending: true });

      if (fornecedores) {
        fornecedores.forEach((f) => {
          items.push({
            id: f.id,
            label: f.nome_completo,
            type: "fornecedor",
          });
        });
      }

      setComboboxItems(items);
      setSuppliers(items);
    } catch (error: any) {
      console.error("Error loading suppliers:", error);
      toast.error("Erro ao carregar fornecedores/oficinas");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleCreateNewSupplier = async () => {
    try {
      if (!newSupplierData.name.trim()) {
        toast.error("Nome é obrigatório");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      let supplierId: string;

      if (newSupplierData.type === "oficina") {
        const { data, error } = await supabase
          .from("oficinas")
          .insert([
            {
              razao_social: newSupplierData.name,
              cnpj: newSupplierData.cnpj_documento || null,
              endereco: newSupplierData.ciudad_endereco || null,
              telefone: newSupplierData.telefone || null,
              mecanico_responsavel: newSupplierData.mecanico_responsavel || null,
              tipo_aeronave: newSupplierData.tipo_aeronave || null,
              ativo: true,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;
        supplierId = data.id;
      } else {
        const { data, error } = await supabase
          .from("fornecedores_favoritos")
          .insert([
            {
              nome_completo: newSupplierData.name,
              documento: newSupplierData.cnpj_documento || null,
              cidade: newSupplierData.ciudad_endereco || null,
              telefone: newSupplierData.telefone || null,
              categoria: "share",
              criado_por: user.id,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;
        supplierId = data.id;
      }

      toast.success("Fornecedor/Oficina criado com sucesso!");
      setShowNewSupplierDialog(false);
      setNewSupplierData({
        type: "oficina",
        name: "",
        cnpj_documento: "",
        ciudad_endereco: "",
        telefone: "",
        mecanico_responsavel: "",
        tipo_aeronave: "",
        categoria: "",
      });

      // Recarregar fornecedores e selecionar o novo
      await loadSuppliers();
      setFormData({
        ...formData,
        supplier_id: supplierId,
        supplier_type: newSupplierData.type,
      });
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      toast.error("Erro ao criar fornecedor/oficina: " + error.message);
    }
  };

  const handleAddItem = () => {
    setBudgetItems(prev => [...prev, { code: "", description: "", quantity: 1, unit_value: "" as any, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setBudgetItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof BudgetItem, value: string | number) => {
    setBudgetItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === "code") {
        item.code = value as string;
      } else if (field === "description") {
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

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Apenas arquivos PDF são permitidos");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo deve ter no máximo 10MB");
        return;
      }
      setPdfFile(file);
      setPdfFileName(file.name);
    }
  };

  const resetForm = () => {
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      supplier_id: "",
      supplier_name: "",
      supplier_type: "",
      notes: "",
    });
    setBudgetItems([{ code: "", description: "", quantity: 1, unit_value: "" as any, total: 0 }]);
    setPdfFile(null);
    setPdfFileName("");
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("ctm_budgets")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBudgets(data as CTMBudget[] || []);
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

  const getStatusColor = (status: string, paymentStatus?: string | null) => {
    if (status === "approved" && paymentStatus === "agendado") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (status === "approved" && paymentStatus === "pago") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (status === "approved" && paymentStatus === "aguardando_cliente") return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    switch (status) {
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "submitted": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "approved": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string, paymentStatus?: string | null, approvedByName?: string | null) => {
    if (status === "approved" && paymentStatus === "agendado") return `Aprovado - Agendado Pgto${approvedByName ? ` (${approvedByName})` : ''}`;
    if (status === "approved" && paymentStatus === "pago") return `Aprovado - Pago${approvedByName ? ` (${approvedByName})` : ''}`;
    if (status === "approved" && paymentStatus === "aguardando_cliente") return `Aprovado - Aguardando Cliente${approvedByName ? ` (${approvedByName})` : ''}`;
    switch (status) {
      case "draft": return "Rascunho";
      case "submitted": return "Pendente Aprovação";
      case "approved": return `Aprovado${approvedByName ? ` por ${approvedByName}` : ''}`;
      case "rejected": return "Rejeitado";
      default: return status;
    }
  };

  const handleCreateBudget = async () => {
    try {
      if (!formData.supplier_id) {
        toast.error("Selecione um fornecedor/oficina");
        return;
      }

      if (!formData.supplier_type) {
        toast.error("Tipo de fornecedor é obrigatório");
        return;
      }

      if (budgetItems.filter(i => i.description).length === 0) {
        toast.error("Adicione pelo menos um item ao orçamento");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        toast.error("Você precisa estar logado"); 
        return; 
      }

      let pdfPath: string | undefined;
      let pdfName: string | undefined;

      // Upload PDF se fornecido
      if (pdfFile) {
        try {
          const fileExt = "pdf";
          const fileName = `${aircraftId}_${formData.month}_${formData.year}_${Date.now()}.${fileExt}`;
          const filePath = `ctm_budgets/${aircraftId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(filePath, pdfFile, { upsert: true });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            toast.error("Erro ao fazer upload do PDF");
            return;
          }

          pdfPath = filePath;
          pdfName = pdfFileName;
        } catch (error) {
          console.error("PDF upload failed:", error);
          toast.error("Falha ao enviar PDF");
          return;
        }
      }

      const budgetDetails: BudgetDetails = {
        supplier_name: formData.supplier_name,
        supplier_type: formData.supplier_type as "oficina" | "fornecedor",
        items: budgetItems.filter(i => i.description),
        notes: formData.notes || undefined,
        pdf_file_path: pdfPath,
        pdf_file_name: pdfName,
      };

      const budgetPayload = {
        aircraft_id: aircraftId,
        month: formData.month,
        year: formData.year,
        status: "draft",
        created_by: user.id,
        created_at: new Date().toISOString(),
        supplier_name: formData.supplier_name,
        supplier_type: formData.supplier_type,
        notes: formData.notes || null,
        budget_items: budgetItems.filter(i => i.description),
        budget_details: budgetDetails,
      };

      console.log("Inserting budget with payload:", budgetPayload);

      const { data, error } = await (supabase as any)
        .from("ctm_budgets")
        .insert([budgetPayload])
        .select();

      console.log("Insert response - Data:", data, "Error:", error);

      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(error.message || "Erro ao salvar orçamento no banco de dados");
      }

      toast.success("Orçamento criado com sucesso!");
      setShowNewBudgetDialog(false);
      resetForm();
      await loadBudgets();
    } catch (error: any) {
      console.error("Error creating budget:", error);
      toast.error("Erro ao criar orçamento: " + (error.message || "Erro desconhecido"));
    }
  };

  const handleSubmitForApproval = async (budgetId: string) => {
    try {
      const { error } = await supabase
        .from("ctm_budgets")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", budgetId);

      if (error) throw error;

      toast.success("Orçamento enviado para aprovação do financeiro!");
      await loadBudgets();
    } catch (error: any) {
      console.error("Error submitting budget:", error);
      toast.error("Erro ao enviar orçamento para aprovação");
    }
  };

  const handleApproveBudget = async (budgetId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      // Get user name
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const approverName = (profile as any)?.full_name || "Usuário";

      const { error } = await (supabase as any)
        .from("ctm_budgets")
        .update({
          status: "approved",
          approval_status: "aprovado",
          approved_by: user.id,
          approved_by_name: approverName,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", budgetId);

      if (error) throw error;

      toast.success(`Orçamento aprovado por ${approverName}!`);

      // Ask about payment
      const paymentChoice = window.confirm(
        "Deseja agendar o pagamento?\n\nOK = Agendar Pagamento\nCancelar = Pagamento Enviado ao Cliente"
      );

      const budget = budgets.find(b => b.id === budgetId);
      const budgetTotal = budget?.budget_details?.items?.reduce((sum, item) => sum + item.total, 0) || (budget as any)?.total_value || 0;

      if (paymentChoice) {
        // AGENDAR PAGAMENTO -> contas_apagar
        const contaPayload: any = {
          data_vencimento: new Date().toISOString().split('T')[0],
          valor: budgetTotal,
          categoria: "Manutenção CTM",
          descricao: `Orçamento CTM - ${budget?.budget_details?.supplier_name || 'N/A'} - ${budget?.description || ''}`,
          status: "pendente",
          criado_por: user.id,
          client_id: (budget as any)?.client_id || null,
          client_partner_id: (budget as any)?.client_partner_id || null,
          aeronave_registro: aircraftRegistration,
        };

        const { data: contaData, error: contaError } = await supabase
          .from("contas_apagar")
          .insert(contaPayload)
          .select("id")
          .single();

        if (contaError) {
          console.error("Erro ao criar conta a pagar:", contaError);
          toast.error("Erro ao agendar pagamento");
        } else {
          // Update budget with payment info
          await (supabase as any).from("ctm_budgets").update({
            payment_status: "agendado",
            payment_type: "agendar_pagamento",
            financial_reference_id: contaData.id,
            financial_reference_table: "contas_apagar",
          }).eq("id", budgetId);

          toast.success("Pagamento agendado em Contas a Pagar!");
        }
      } else {
        // PAGAMENTO ENVIADO AO CLIENTE -> despesas_cliente_direto
        const despesaPayload: any = {
          client_id: (budget as any)?.client_id || null,
          aeronave_id: null,
          aeronave_registro: aircraftRegistration,
          descricao: `Orçamento CTM - ${budget?.budget_details?.supplier_name || 'N/A'} - ${budget?.description || ''}`,
          valor: budgetTotal,
          data_vencimento: new Date().toISOString().split('T')[0],
          fornecedor_nome: budget?.budget_details?.supplier_name || null,
          status: "pendente",
          criado_por: user.id,
          categoria_nome: "Manutenção CTM",
        };

        const { data: despesaData, error: despesaError } = await (supabase as any)
          .from("despesas_cliente_direto")
          .insert([despesaPayload])
          .select("id")
          .single();

        if (despesaError) {
          console.error("Erro ao enviar ao cliente:", despesaError);
          toast.error("Erro ao enviar ao cliente");
        } else {
          await (supabase as any).from("ctm_budgets").update({
            payment_status: "aguardando_cliente",
            payment_type: "enviado_cliente",
            financial_reference_id: despesaData.id,
            financial_reference_table: "despesas_cliente_direto",
          }).eq("id", budgetId);

          toast.success("Pagamento enviado ao cliente!");
        }
      }

      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao aprovar orçamento");
      console.error(error);
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
                <th className="px-6 py-4">Nº Orçamento</th>
                <th className="px-6 py-4">Data Emissão</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4">Fornecedor/Oficina</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4 w-1/4">Arquivos</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-foreground text-sm divide-y divide-border">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum orçamento encontrado
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((budget) => {
                  const budgetTotal = budget.budget_details?.items?.reduce((sum, item) => sum + item.total, 0) || 0;
                  return (
                    <tr key={budget.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-primary">
                        #{(budget as any).numero_orcamento || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(new Date(budget.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {budget.month}/{budget.year}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="font-medium">{budget.budget_details?.supplier_name || "—"}</p>
                          {budget.budget_details?.supplier_type && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {budget.budget_details.supplier_type === "oficina" ? "Oficina" : "Fornecedor"}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-primary">
                        {budgetTotal > 0 ? `R$ ${budgetTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {budget.budget_details?.pdf_file_name && (
                            <Badge variant="outline" className="text-xs">
                              <Download className="h-3 w-3 mr-1" />
                              PDF
                            </Badge>
                          )}
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
                          {!budget.budget_details?.pdf_file_name && !budget.budget_file_name && !budget.report_file_name && (
                            <span className="text-xs text-muted-foreground italic">Sem arquivos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge className={`text-xs font-bold border ${getStatusColor(budget.status, budget.payment_status)}`}>
                          {getStatusLabel(budget.status, budget.payment_status, budget.approved_by_name)}
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
                          {budget.status === "draft" && (
                            <button
                              onClick={() => handleSubmitForApproval(budget.id)}
                              className="p-1.5 rounded hover:bg-slate-700 text-muted-foreground hover:text-blue-400 transition-colors"
                              title="Enviar para Aprovação Financeira"
                            >
                              <FileUp className="h-4 w-4" />
                            </button>
                          )}
                          {budget.status === "submitted" && (
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
                  );
                })
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Novo Orçamento — {aircraftRegistration}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Período */}
            <div className="grid grid-cols-3 gap-4">
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

            {/* Fornecedor/Oficina */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Fornecedor ou Oficina *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSupplierDialog(true)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              <SearchableCombobox
                items={comboboxItems}
                value={formData.supplier_id}
                onChange={(supplierId, label) => {
                  const selectedItem = comboboxItems.find(item => item.id === supplierId);
                  if (selectedItem) {
                    setFormData({
                      ...formData,
                      supplier_id: supplierId,
                      supplier_name: label,
                      supplier_type: selectedItem.type,
                    });
                  }
                }}
                placeholder="Selecione um fornecedor ou oficina"
                searchPlaceholder="Buscar empresa..."
                emptyMessage={loadingSuppliers ? "Carregando..." : "Nenhuma empresa encontrada"}
                icon={<Building2 className="h-4 w-4" />}
                disabled={loadingSuppliers}
              />
            </div>

            <div className="border-t border-border pt-4" />

            {/* Itens do Orçamento */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Itens do Orçamento *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                </Button>
              </div>

              <div className="space-y-2 border border-border rounded-lg p-3 bg-slate-900/20">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <div className="col-span-2">Código</div>
                  <div className="col-span-4">Descrição</div>
                  <div className="col-span-2 text-center">Qtd</div>
                  <div className="col-span-2 text-center">Vlr. Unit.</div>
                  <div className="col-span-1 text-right">Vlr. Total</div>
                  <div className="col-span-1"></div>
                </div>

                {budgetItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-background/40 p-2 rounded">
                    <div className="col-span-2">
                      <Input
                        placeholder="Código"
                        value={item.code}
                        onChange={(e) => handleItemChange(index, "code", e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Descrição"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="text-center text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={formatBrazilianCurrencyDisplay(item.unit_value)}
                        onChange={(e) => {
                          const numValue = parseBrazilianCurrency(e.target.value);
                          handleItemChange(index, "unit_value", numValue);
                        }}
                        className="text-center text-xs"
                      />
                    </div>
                    <div className="col-span-1 text-right font-medium text-xs pr-1">
                      R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 text-center">
                      {budgetItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total geral */}
                <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-border mt-2 font-semibold text-sm">
                  <div className="col-span-9 text-right">Total do Orçamento:</div>
                  <div className="col-span-2 text-right text-primary text-base">
                    R$ {budgetItemsTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            </div>

            {/* Upload PDF */}
            <div>
              <Label className="text-sm font-semibold">Anexar PDF (Orçamento)</Label>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-slate-900/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {pdfFileName ? pdfFileName : "Clique para selecionar PDF"}
                    </span>
                  </div>
                  <input type="file" accept=".pdf" onChange={handlePdfFileChange} className="hidden" />
                </label>
                {pdfFileName && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setPdfFile(null);
                      setPdfFileName("");
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-sm font-semibold">Observações</Label>
              <Textarea
                placeholder="Observações adicionais..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowNewBudgetDialog(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleCreateBudget}>Criar Orçamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for New Supplier/Workshop */}
      <Dialog open={showNewSupplierDialog} onOpenChange={setShowNewSupplierDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Adicionar Nova Empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tipo */}
            <div>
              <Label className="text-sm font-semibold">Tipo de Empresa *</Label>
              <Select value={newSupplierData.type} onValueChange={(v) => setNewSupplierData({ ...newSupplierData, type: v as "oficina" | "fornecedor" })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oficina">Oficina</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div>
              <Label className="text-sm font-semibold">
                {newSupplierData.type === "oficina" ? "Razão Social" : "Nome Completo"} *
              </Label>
              <Input
                placeholder={newSupplierData.type === "oficina" ? "Razão Social" : "Nome completo"}
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* CNPJ/Documento */}
            <div>
              <Label className="text-sm font-semibold">
                {newSupplierData.type === "oficina" ? "CNPJ" : "Documento"}
              </Label>
              <Input
                placeholder={newSupplierData.type === "oficina" ? "CNPJ" : "CPF/Documento"}
                value={newSupplierData.cnpj_documento}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, cnpj_documento: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Endereço/Cidade */}
            <div>
              <Label className="text-sm font-semibold">
                {newSupplierData.type === "oficina" ? "Endereço" : "Cidade"}
              </Label>
              <Input
                placeholder={newSupplierData.type === "oficina" ? "Endereço completo" : "Cidade"}
                value={newSupplierData.ciudad_endereco}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, ciudad_endereco: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Telefone */}
            <div>
              <Label className="text-sm font-semibold">Telefone</Label>
              <Input
                placeholder="Telefone"
                value={newSupplierData.telefone}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, telefone: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Campos específicos por tipo */}
            {newSupplierData.type === "oficina" && (
              <>
                <div>
                  <Label className="text-sm font-semibold">Mecânico Responsável</Label>
                  <Input
                    placeholder="Nome do mecânico responsável"
                    value={newSupplierData.mecanico_responsavel}
                    onChange={(e) => setNewSupplierData({ ...newSupplierData, mecanico_responsavel: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Tipo de Aeronave</Label>
                  <Input
                    placeholder="Ex: Cessna 172, Beechcraft Baron"
                    value={newSupplierData.tipo_aeronave}
                    onChange={(e) => setNewSupplierData({ ...newSupplierData, tipo_aeronave: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {newSupplierData.type === "fornecedor" && (
              <div>
                <Label className="text-sm font-semibold">Categoria</Label>
                <Select value={newSupplierData.categoria} onValueChange={(v) => setNewSupplierData({ ...newSupplierData, categoria: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="share">Share</SelectItem>
                    <SelectItem value="combustivel">Combustível</SelectItem>
                    <SelectItem value="pecas">Peças</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewSupplierDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateNewSupplier}>Criar Empresa</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
