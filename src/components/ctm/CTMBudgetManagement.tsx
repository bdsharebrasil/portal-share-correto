import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Eye, Edit, Trash2, DollarSign, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BudgetServiceItem {
  ordem: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

interface BudgetPartItem {
  ordem: number;
  quantidade: number;
  descricao: string;
  part_number: string;
  valor_unitario: number;
  subtotal: number;
}

interface BudgetComponent {
  descricao: string;
  modelo: string;
  part_number: string;
  serial_number: string;
  servicos: BudgetServiceItem[];
  pecas: BudgetPartItem[];
  total_servico: number;
  total_pecas: number;
}

interface BudgetDetails {
  matricula: string;
  proprietario: string;
  cpf_cnpj: string;
  operador: string;
  telefone: string;
  serie: string;
  com: string;
  data_emissao: string;
  componentes: BudgetComponent[];
  total_geral_pecas: number;
  total_geral_servicos: number;
  total_geral: number;
  desconto: number;
  frete: number;
  outras_despesas: number;
  total_final: number;
  valor_combinar: string;
}

interface CTMBudget {
  id: string;
  aeronave_id: string;
  month: number;
  year: number;
  status: "draft" | "submitted" | "approved";
  budget_details?: BudgetDetails | null;
  total_value?: number;
  description?: string;
  supplier_name?: string;
  created_at: string;
  updated_at?: string;
}

interface CTMBudgetManagementProps {
  aircraftId: string;
  aircraftRegistration: string;
}

const emptyComponent = (): BudgetComponent => ({
  descricao: "",
  modelo: "",
  part_number: "",
  serial_number: "",
  servicos: [{ ordem: 1, descricao: "", quantidade: 1, valor_unitario: 0, subtotal: 0 }],
  pecas: [],
  total_servico: 0,
  total_pecas: 0,
});

const emptyDetails = (registration: string): BudgetDetails => ({
  matricula: registration,
  proprietario: "",
  cpf_cnpj: "",
  operador: "",
  telefone: "",
  serie: "",
  com: "",
  data_emissao: format(new Date(), "yyyy-MM-dd"),
  componentes: [emptyComponent()],
  total_geral_pecas: 0,
  total_geral_servicos: 0,
  total_geral: 0,
  desconto: 0,
  frete: 0,
  outras_despesas: 0,
  total_final: 0,
  valor_combinar: "",
});

export function CTMBudgetManagement({ aircraftId, aircraftRegistration }: CTMBudgetManagementProps) {
  const [budgets, setBudgets] = useState<CTMBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "submitted" | "approved">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formSupplier, setFormSupplier] = useState("");
  const [details, setDetails] = useState<BudgetDetails>(emptyDetails(aircraftRegistration));

  useEffect(() => {
    loadBudgets();
  }, [aircraftId]);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("ctm_budgets")
        .select("*")
        .eq("id_aeronave", aircraftId)
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setBudgets(data as CTMBudget[] || []);
    } catch (error: any) {
      console.error("Error loading budgets:", error);
      toast.error("Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  };

  const recalcTotals = (d: BudgetDetails): BudgetDetails => {
    const componentes = d.componentes.map(c => {
      const servicos = c.servicos.map(s => ({ ...s, subtotal: s.quantidade * s.valor_unitario }));
      const pecas = c.pecas.map(p => ({ ...p, subtotal: p.quantidade * p.valor_unitario }));
      return {
        ...c,
        servicos,
        pecas,
        total_servico: servicos.reduce((s, i) => s + i.subtotal, 0),
        total_pecas: pecas.reduce((s, i) => s + i.subtotal, 0),
      };
    });
    const total_geral_servicos = componentes.reduce((s, c) => s + c.total_servico, 0);
    const total_geral_pecas = componentes.reduce((s, c) => s + c.total_pecas, 0);
    const total_geral = total_geral_servicos + total_geral_pecas;
    const total_final = total_geral - d.desconto + d.frete + d.outras_despesas;
    return { ...d, componentes, total_geral_servicos, total_geral_pecas, total_geral, total_final };
  };

  const updateDetails = (partial: Partial<BudgetDetails>) => {
    setDetails(prev => recalcTotals({ ...prev, ...partial }));
  };

  const updateComponent = (idx: number, partial: Partial<BudgetComponent>) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      componentes[idx] = { ...componentes[idx], ...partial };
      return recalcTotals({ ...prev, componentes });
    });
  };

  const addComponent = () => {
    setDetails(prev => recalcTotals({ ...prev, componentes: [...prev.componentes, emptyComponent()] }));
  };

  const removeComponent = (idx: number) => {
    setDetails(prev => {
      const componentes = prev.componentes.filter((_, i) => i !== idx);
      return recalcTotals({ ...prev, componentes: componentes.length ? componentes : [emptyComponent()] });
    });
  };

  const addServiceItem = (compIdx: number) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.servicos = [...c.servicos, { ordem: c.servicos.length + 1, descricao: "", quantidade: 1, valor_unitario: 0, subtotal: 0 }];
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const updateServiceItem = (compIdx: number, itemIdx: number, partial: Partial<BudgetServiceItem>) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.servicos = c.servicos.map((s, i) => i === itemIdx ? { ...s, ...partial } : s);
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const removeServiceItem = (compIdx: number, itemIdx: number) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.servicos = c.servicos.filter((_, i) => i !== itemIdx);
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const addPartItem = (compIdx: number) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.pecas = [...c.pecas, { ordem: c.pecas.length + 1, quantidade: 1, descricao: "", part_number: "", valor_unitario: 0, subtotal: 0 }];
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const updatePartItem = (compIdx: number, itemIdx: number, partial: Partial<BudgetPartItem>) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.pecas = c.pecas.map((p, i) => i === itemIdx ? { ...p, ...partial } : p);
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const removePartItem = (compIdx: number, itemIdx: number) => {
    setDetails(prev => {
      const componentes = [...prev.componentes];
      const c = { ...componentes[compIdx] };
      c.pecas = c.pecas.filter((_, i) => i !== itemIdx);
      componentes[compIdx] = c;
      return recalcTotals({ ...prev, componentes });
    });
  };

  const handleSaveBudget = async () => {
    try {
      const payload = {
        aeronave_id: aircraftId,
        month: formMonth,
        year: formYear,
        supplier_name: formSupplier,
        status: "draft",
        budget_details: details as any,
        total_value: details.total_final,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await (supabase as any).from("ctm_budgets").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Orçamento atualizado!");
      } else {
        const { error } = await (supabase as any).from("ctm_budgets").insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
        toast.success("Orçamento criado!");
      }

      resetForm();
      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao salvar orçamento: " + error.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setFormSupplier("");
    setDetails(emptyDetails(aircraftRegistration));
  };

  const handleEdit = (budget: CTMBudget) => {
    setEditingId(budget.id);
    setFormMonth(budget.month);
    setFormYear(budget.year);
    setFormSupplier(budget.supplier_name || "");
    if (budget.budget_details) {
      const budgetData = budget.budget_details as unknown as BudgetDetails;
      setDetails({
        ...budgetData,
        componentes: budgetData.componentes || [emptyComponent()]
      });
    } else {
      setDetails(emptyDetails(aircraftRegistration));
    }
    setShowForm(true);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Tem certeza que deseja deletar este orçamento?")) return;
    try {
      const { error } = await (supabase as any).from("ctm_budgets").delete().eq("id", budgetId);
      if (error) throw error;
      toast.success("Orçamento deletado!");
      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao deletar orçamento");
    }
  };

  const handleApproveBudget = async (budgetId: string) => {
    try {
      const { error } = await (supabase as any).from("ctm_budgets").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", budgetId);
      if (error) throw error;
      toast.success("Orçamento aprovado!");
      await loadBudgets();
    } catch (error: any) {
      toast.error("Erro ao aprovar orçamento");
    }
  };

  const filteredBudgets = budgets.filter(b => filterStatus === "all" || (b as any).status === filterStatus);

  // ✅ FIX: defensivo contra undefined/null
  const fmtCurrency = (v: number | undefined | null) =>
    (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const getStatusColor = (s: string) => {
    if (s === "draft") return "bg-muted/50 text-muted-foreground border-border";
    if (s === "submitted") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-green-500/10 text-green-500 border-green-500/20";
  };

  const getStatusLabel = (s: string) => {
    if (s === "draft") return "Rascunho";
    if (s === "submitted") return "Enviado";
    return "Aprovado";
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

  // ==================== INLINE FORM ====================
  if (showForm) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <DollarSign className="h-5 w-5 text-primary" />
              {editingId ? "Editar Orçamento" : "Novo Orçamento de Manutenção"}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div>
              <Label>Mês</Label>
              <Select value={formMonth.toString()} onValueChange={v => setFormMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {format(new Date(2024, i), "MMMM", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Select value={formYear.toString()} onValueChange={v => setFormYear(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Emissão</Label>
              <Input type="data" value={details.data_emissao} onChange={e => updateDetails({ data_emissao: e.target.value })} />
            </div>
          </div>

          {/* Supplier / Owner Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Dados da Oficina</h3>
              <div>
                <Label>Nome da Oficina/Fornecedor</Label>
                <Input value={formSupplier} onChange={e => setFormSupplier(e.target.value)} placeholder="Ex: LEADER TECH LTDA" />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={details.serie} onChange={e => updateDetails({ serie: e.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Dados do Proprietário</h3>
              <div>
                <Label>Matrícula (Prefixo)</Label>
                <Input value={details.matricula} onChange={e => updateDetails({ matricula: e.target.value })} />
              </div>
              <div>
                <Label>Proprietário</Label>
                <Input value={details.proprietario} onChange={e => updateDetails({ proprietario: e.target.value })} placeholder="JP. MARTINS AVIAÇÃO LTDA" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CPF/CNPJ</Label>
                  <Input value={details.cpf_cnpj} onChange={e => updateDetails({ cpf_cnpj: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={details.telefone} onChange={e => updateDetails({ telefone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Operador</Label>
                  <Input value={details.operador} onChange={e => updateDetails({ operador: e.target.value })} />
                </div>
                <div>
                  <Label>COM</Label>
                  <Input value={details.com} onChange={e => updateDetails({ com: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Components */}
          {details.componentes.map((comp, ci) => (
            <div key={ci} className="p-4 rounded-lg border border-border bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">Componente {ci + 1}</h3>
                {details.componentes.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeComponent(ci)} className="text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Descrição</Label>
                  <Input value={comp.descricao} onChange={e => updateComponent(ci, { descricao: e.target.value })} placeholder="GERADOR DE TACHOMETRO" />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input value={comp.modelo} onChange={e => updateComponent(ci, { modelo: e.target.value })} placeholder="25140/22A703" />
                </div>
                <div>
                  <Label>P/N</Label>
                  <Input value={comp.part_number} onChange={e => updateComponent(ci, { part_number: e.target.value })} placeholder="32005-007" />
                </div>
                <div>
                  <Label>N/S</Label>
                  <Input value={comp.serial_number} onChange={e => updateComponent(ci, { serial_number: e.target.value })} placeholder="318551" />
                </div>
              </div>

              {/* Services */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground">Serviços</h4>
                  <Button variant="outline" size="sm" onClick={() => addServiceItem(ci)} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Serviço
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-1 w-8">Ord.</th>
                        <th className="text-left py-1">Descrição do Serviço</th>
                        <th className="text-right py-1 w-20">Qtde</th>
                        <th className="text-right py-1 w-28">Valor Unit. R$</th>
                        <th className="text-right py-1 w-28">Subtotal R$</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.servicos.map((s, si) => (
                        <tr key={si} className="border-b border-border/50">
                          <td className="py-1 text-muted-foreground">{String(si + 1).padStart(2, "0")}</td>
                          <td className="py-1">
                            <Input className="h-7 text-xs" value={s.descricao} onChange={e => updateServiceItem(ci, si, { descricao: e.target.value })} />
                          </td>
                          <td className="py-1">
                            <Input className="h-7 text-xs text-right" type="number" step="0.01" value={s.quantidade} onChange={e => updateServiceItem(ci, si, { quantidade: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="py-1">
                            <Input className="h-7 text-xs text-right" type="number" step="0.01" value={s.valor_unitario} onChange={e => updateServiceItem(ci, si, { valor_unitario: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="py-1 text-right font-medium">{fmtCurrency(s.subtotal)}</td>
                          <td className="py-1">
                            <button onClick={() => removeServiceItem(ci, si)} className="text-destructive/70 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right text-xs font-semibold py-1">Total do Serviço:</td>
                        <td className="text-right font-bold text-primary">{fmtCurrency(comp.total_servico)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Parts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground">Peças</h4>
                  <Button variant="outline" size="sm" onClick={() => addPartItem(ci)} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Peça
                  </Button>
                </div>
                {comp.pecas.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left py-1 w-8">Ord.</th>
                          <th className="text-right py-1 w-16">Qtde</th>
                          <th className="text-left py-1">Descrição</th>
                          <th className="text-left py-1 w-28">PN</th>
                          <th className="text-right py-1 w-28">Valor Unit. R$</th>
                          <th className="text-right py-1 w-28">Subtotal R$</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {comp.pecas.map((p, pi) => (
                          <tr key={pi} className="border-b border-border/50">
                            <td className="py-1 text-muted-foreground">{String(pi + 1).padStart(2, "0")}</td>
                            <td className="py-1">
                              <Input className="h-7 text-xs text-right" type="number" value={p.quantidade} onChange={e => updatePartItem(ci, pi, { quantidade: parseFloat(e.target.value) || 0 })} />
                            </td>
                            <td className="py-1">
                              <Input className="h-7 text-xs" value={p.descricao} onChange={e => updatePartItem(ci, pi, { descricao: e.target.value })} />
                            </td>
                            <td className="py-1">
                              <Input className="h-7 text-xs" value={p.part_number} onChange={e => updatePartItem(ci, pi, { part_number: e.target.value })} />
                            </td>
                            <td className="py-1">
                              <Input className="h-7 text-xs text-right" type="number" step="0.01" value={p.valor_unitario} onChange={e => updatePartItem(ci, pi, { valor_unitario: parseFloat(e.target.value) || 0 })} />
                            </td>
                            <td className="py-1 text-right font-medium">{fmtCurrency(p.subtotal)}</td>
                            <td className="py-1">
                              <button onClick={() => removePartItem(ci, pi)} className="text-destructive/70 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="text-right text-xs font-semibold py-1">Total de Peças:</td>
                          <td className="text-right font-bold text-primary">{fmtCurrency(comp.total_pecas)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addComponent} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Adicionar Componente
          </Button>

          {/* Totals */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Geral de Peças:</span>
                <p className="font-bold">{fmtCurrency(details.total_geral_pecas)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Geral de Serviços:</span>
                <p className="font-bold">{fmtCurrency(details.total_geral_servicos)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Geral:</span>
                <p className="font-bold text-lg">{fmtCurrency(details.total_geral)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div>
                <Label>Desconto (-)</Label>
                <Input type="number" step="0.01" value={details.desconto} onChange={e => updateDetails({ desconto: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Frete (+)</Label>
                <Input type="number" step="0.01" value={details.frete} onChange={e => updateDetails({ frete: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Outras Despesas (+)</Label>
                <Input type="number" step="0.01" value={details.outras_despesas} onChange={e => updateDetails({ outras_despesas: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Total Final</Label>
                <p className="text-2xl font-black text-primary mt-1">R$ {fmtCurrency(details.total_final)}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <Label>Valor a Combinar</Label>
              <Input value={details.valor_combinar} onChange={e => updateDetails({ valor_combinar: e.target.value })} placeholder="1 x 4.100,00 = 4.100,00" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSaveBudget} className="gap-2">
              {editingId ? "Atualizar Orçamento" : "Criar Orçamento"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ==================== LIST VIEW ====================
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
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Novo Orçamento
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filter */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex items-center bg-muted/30 rounded-lg p-1 gap-1">
            {(["all", "draft", "submitted", "approved"] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${filterStatus === status
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {status === "all" ? "Todos" : status === "draft" ? "Rascunhos" : status === "submitted" ? "Pendentes" : "Aprovados"}
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
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4 text-right">Valor Total</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-foreground text-sm divide-y divide-border">
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum orçamento encontrado
                  </td>
                </tr>
              ) : (
                filteredBudgets.map(budget => (
                  <tr key={budget.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date((budget as any).created_at || (budget as any).criado_em), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 font-medium">{budget.month}/{budget.year}</td>
                    <td className="px-6 py-4">{budget.supplier_name || "-"}</td>
                    <td className="px-6 py-4 text-right font-bold">
                      R$ {fmtCurrency(budget.total_value)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={`text-xs font-bold border ${getStatusColor((budget as any).status)}`}>
                        {getStatusLabel((budget as any).status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(budget)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
                          <Edit className="h-4 w-4" />
                        </button>
                        {(budget as any).status !== "approved" && (
                          <button onClick={() => handleApproveBudget(budget.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-green-500" title="Aprovar">
                            ✓
                          </button>
                        )}
                        <button onClick={() => handleDeleteBudget(budget.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Deletar">
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

        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground px-2">
            Mostrando {filteredBudgets.length} de {budgets.length} orçamentos
          </span>
        </div>
      </CardContent>
    </Card>
  );
}