import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Filter, Trash2, Wallet, ChevronDown, ChevronUp, Bell, AlertCircle, X, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format } from "date-fns";

// Sub-componentes
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

// Estado inicial alinhado com as novas colunas do SQL
const initialFormState = {
  numero_doc: "", 
  fornecedor_nome: "", // Usado para exibição/busca, certifique-se que o Form lida com isso
  data_vencimento: format(new Date(), "yyyy-MM-dd"),
  valor: "",
  categoria: "",
  descricao: "",
  status: "agendada",
  data_agendamento: format(new Date(), "yyyy-MM-dd"),
  observacoes: "",
  aeronave_registro: "",
  fornecedor_favorito_id: null as string | null,
  client_id: null as string | null,
  client_partner_id: null as string | null,
  empresa: "", 
  banco: "",
  // Boleto
  possui_boleto: false,
  boleto_url: "",
  data_recebimento_boleto: "",
  vencimento_boleto: "",
  codigo_barras: "",
  // NF
  possui_nf: false,
  nf_numero: "",
  nf_url: "",
  // DECEA / Infraero
  numero_documento_decea: "",
  competencia_decea: "",
  decea_url: "",
  competencia_infraero: "",
  numero_documento_infraero: "",
  infraero_url: "",
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
      .select("id, nome_completo, documento, apelido")
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
      // Query atualizada para buscar relacionamentos com os novos nomes de FK
      const { data, error } = await supabase
        .from("contas_apagar")
        .select(`
          *,
          fornecedores_favoritos:fornecedor_favorito_id(id, nome_completo),
          clients:client_id(id, company_name, proprietario),
          client_partners:client_partner_id(id, name)
        `)
        .neq("status", "paga")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      setContas(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCategoria = (cat: string) => {
    setSelectedCategoria(cat);
    setFormData({ ...initialFormState, categoria: cat });
  };

  const handleSave = async () => {
    // Validação de campos NOT NULL conforme o novo SQL
    if (!formData.data_vencimento || !formData.valor || !formData.status) {
      toast.error("Vencimento, Valor e Status são obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        data_vencimento: formData.data_vencimento,
        numero_doc: formData.numero_doc || null,
        valor: parseFloat(formData.valor.toString()),
        categoria: formData.categoria || null,
        descricao: formData.descricao || null,
        status: formData.status,
        data_agendamento: formData.data_agendamento || null,
        observacoes: formData.observacoes || null,
        criado_por: user?.id,
        
        // Relacionamentos
        client_id: formData.client_id || null,
        client_partner_id: formData.client_partner_id || null,
        fornecedor_favorito_id: formData.fornecedor_favorito_id || null,
        aeronave_registro: formData.aeronave_registro || null,
        
        // Campos de documentos/urls
        possui_boleto: formData.possui_boleto,
        boleto_url: formData.boleto_url || null,
        data_recebimento_boleto: formData.data_recebimento_boleto || null,
        vencimento_boleto: formData.vencimento_boleto || null,
        codigo_barras: formData.codigo_barras || null,
        possui_nf: formData.possui_nf,
        nf_numero: formData.nf_numero || null,
        nf_url: formData.nf_url || null,
        
        // DECEA / Infraero
        numero_documento_decea: formData.numero_documento_decea || null,
        competencia_decea: formData.competencia_decea || null,
        decea_url: formData.decea_url || null,
        competencia_infraero: formData.competencia_infraero || null,
        numero_documento_infraero: formData.numero_documento_infraero || null,
        infraero_url: formData.infraero_url || null,

        empresa: formData.empresa || null, // Agora é TEXT no seu SQL
        banco: formData.banco || null,
      };

      const { error } = await supabase.from("contas_apagar").insert([payload]);
      if (error) throw error;

      toast.success("Conta a pagar criada com sucesso!");
      setShowForm(false);
      setSelectedCategoria("");
      setFormData({ ...initialFormState });
      loadContas();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from("contas_apagar").delete().eq("id", deleteConfirmId);
    if (error) toast.error(error.message);
    else { 
      toast.success("Conta excluída!"); 
      setDeleteConfirmId(null); 
      loadContas(); 
    }
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const isVencida = (dv: string, status: string) => {
    if (status === "paga" || status === "cancelada") return false;
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    return parseLocalDate(dv) < today;
  };

  const filteredContas = useMemo(() => {
    return contas.filter(c => {
      const search = filters.searchTerm.toLowerCase();
      // Ajustado para buscar no novo campo numero_doc e no nome do fornecedor favorito
      const fornecedor = c.fornecedores_favoritos?.nome_completo?.toLowerCase() || "";
      const searchOk = !search || fornecedor.includes(search) || c.numero_doc?.toLowerCase().includes(search);
      
      const statusOk = filters.status === "all" || (
        filters.status === "vencido" ? isVencida(c.data_vencimento, c.status) : c.status === filters.status
      );

      let periodoOk = true;
      if (filters.periodo === "mes") periodoOk = c.data_vencimento?.startsWith(filters.mes);
      
      return searchOk && statusOk && periodoOk;
    });
  }, [contas, filters]);

  const totals = useMemo(() => filteredContas.reduce((s, c) => s + parseFloat(c.valor || 0), 0), [filteredContas]);

  return (
    <div className="space-y-6 pb-8">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL FILTRADO</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Botão Novo */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-card p-6 rounded-xl border border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
          <div className="space-y-2">
            <label className="text-xs font-medium">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9" 
                placeholder="Fornecedor ou Doc..." 
                value={filters.searchTerm}
                onChange={e => setFilters(p => ({ ...p, searchTerm: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Status</label>
            <RegularSelect value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="vencido">Vencida</SelectItem>
              </SelectContent>
            </RegularSelect>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Mês de Vencimento</label>
            <Input type="month" value={filters.mes} onChange={e => setFilters(p => ({ ...p, mes: e.target.value }))} />
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="w-full md:w-auto bg-primary">
          <Plus className="w-4 h-4 mr-2" /> Nova Conta
        </Button>
      </div>

      {/* Form (Apenas se showForm for true) */}
      {showForm && (
        <Card className="border-primary/40 shadow-2xl">
          <CardHeader className="flex flex-row justify-between items-center border-b">
            <CardTitle>Cadastro de Conta a Pagar</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_FIXAS.map(cat => (
                <Button 
                  key={cat.value} 
                  variant={selectedCategoria === cat.value ? "default" : "outline"}
                  onClick={() => handleSelectCategoria(cat.value)}
                  size="sm"
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {selectedCategoria === "DESPESAS EMPRESA" && (
              <FormDespesasEmpresa form={formData} setForm={setFormData} fornecedores={fornecedores} onReloadFornecedores={loadFornecedores} />
            )}
            {/* Outros Forms seguem aqui... */}

            {selectedCategoria && (
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Processando..." : "Salvar no Sistema"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de Contas */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-6 py-4 text-left font-medium">Fornecedor / Doc</th>
                <th className="px-6 py-4 text-left font-medium">Vencimento</th>
                <th className="px-6 py-4 text-right font-medium">Valor</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredContas.map(conta => (
                <React.Fragment key={conta.id}>
                  <tr 
                    className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${isVencida(conta.data_vencimento, conta.status) ? 'bg-red-500/5' : ''}`}
                    onClick={() => toggleExpand(conta.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold">{conta.fornecedores_favoritos?.nome_completo || "Fornecedor não vinculado"}</div>
                      <div className="text-xs text-muted-foreground">{conta.numero_doc || "Sem número"}</div>
                    </td>
                    <td className="px-6 py-4">
                      {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-500">
                      R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={isVencida(conta.data_vencimento, conta.status) ? "destructive" : "outline"}>
                        {isVencida(conta.data_vencimento, conta.status) ? "vencida" : conta.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => setPaymentConta(conta)} className="h-8 w-8 text-green-500"><Wallet className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(conta.id)} className="h-8 w-8 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                  {expandedRows.has(conta.id) && (
                    <tr>
                      <td colSpan={5} className="p-0 bg-muted/5">
                        <ContaPagarExpandedDetails conta={conta} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PaymentDialog
        open={!!paymentConta}
        onOpenChange={(open) => !open && setPaymentConta(null)}
        conta={paymentConta}
        bancos={bancos}
        onPaid={() => { setPaymentConta(null); loadContas(); }}
      />
    </div>
  );
}
