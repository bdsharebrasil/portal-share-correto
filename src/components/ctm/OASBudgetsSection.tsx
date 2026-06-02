import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Send, CheckCircle, XCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

interface OASBudgetsSectionProps {
  orderId: string;
  budgets: any[];
  onRefetch: () => void;
}

export function OASBudgetsSection({ orderId, budgets, onRefetch }: OASBudgetsSectionProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingOficinas, setLoadingOficinas] = useState(false);
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const [newCompanyType, setNewCompanyType] = useState<"oficina" | "fornecedor">("oficina");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [newCompanyData, setNewCompanyData] = useState({
    razao_social: "",
    cnpj: "",
    telefone: "",
    endereco: "",
    mecanico_responsavel: "",
  });
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [form, setForm] = useState({
    tipo: "servico",
    descricao: "",
    empresa_id: "",
    empresa_nome: "",
    quantidade: "1",
    valor_unitario: "",
    part_number: "",
    observacoes: "",
  });
  const [editForm, setEditForm] = useState({
    tipo: "servico",
    descricao: "",
    empresa_id: "",
    empresa_nome: "",
    quantidade: "1",
    valor_unitario: "",
    part_number: "",
    observacoes: "",
  });

  useEffect(() => {
    loadOficinas();
  }, []);

  const loadOficinas = async () => {
    setLoadingOficinas(true);
    try {
      const { data, error } = await supabase
        .from("oficinas")
        .select("id, razao_social")
        .eq("ativo", true)
        .order("razao_social");

      if (error) throw error;
      
      const oficinasItems = (data || []).map(o => ({
        id: o.id,
        label: o.razao_social,
      }));
      setOficinas(oficinasItems);
    } catch (error) {
      console.error("Erro ao carregar oficinas:", error);
      toast.error("Erro ao carregar oficinas");
    } finally {
      setLoadingOficinas(false);
    }
  };

  const handleAdd = async () => {
    if (!form.descricao) return toast.error("Descrição é obrigatória");
    setSaving(true);
    const qty = parseInt(form.quantidade) || 1;
    const unitVal = parseFloat(form.valor_unitario) || 0;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("oas_orcamentos").insert([{
        service_order_id: orderId,
        tipo: form.tipo,
        descricao: form.descricao,
        empresa_id: form.empresa_id || null,
        empresa_nome: form.empresa_nome || null,
        quantidade: qty,
        valor_unitario: unitVal,
        valor_total: qty * unitVal,
        part_number: form.part_number || null,
        observacoes: form.observacoes || null,
        status: "rascunho",
        submitted_by: userData.user?.id || null,
      }]);
      if (error) throw error;
      toast.success("Orçamento adicionado");
      setForm({ tipo: "servico", descricao: "", empresa_id: "", empresa_nome: "", quantidade: "1", valor_unitario: "", part_number: "", observacoes: "" });
      setAdding(false);
      onRefetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleCreateNewCompany = async () => {
    if (!newCompanyData.razao_social.trim()) {
      return toast.error("Razão social é obrigatória");
    }

    try {
      setSaving(true);
      
      if (newCompanyType === "oficina") {
        const { data, error } = await supabase
          .from("oficinas")
          .insert([{
            razao_social: newCompanyData.razao_social,
            cnpj: newCompanyData.cnpj || null,
            telefone: newCompanyData.telefone || null,
            endereco: newCompanyData.endereco || null,
            mecanico_responsavel: newCompanyData.mecanico_responsavel || null,
            ativo: true,
          }])
          .select()
          .single();

        if (error) throw error;

        toast.success("Oficina criada com sucesso!");
        
        // Atualizar a lista de oficinas
        await loadOficinas();
        
        // Selecionar a nova oficina no formulário
        setForm(f => ({
          ...f,
          empresa_id: data.id,
          empresa_nome: data.razao_social,
        }));
      }

      setShowNewCompanyDialog(false);
      setNewCompanyData({
        razao_social: "",
        cnpj: "",
        telefone: "",
        endereco: "",
        mecanico_responsavel: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar empresa:", error);
      toast.error(error.message || "Erro ao criar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (budgetId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("oas_orcamentos").update({
        status: "pendente_aprovacao",
        submitted_by: userData.user?.id || null,
        submitted_at: new Date().toISOString(),
      }).eq("id", budgetId);
      if (error) throw error;
      toast.success("Orçamento enviado para aprovação do gestor!");
      onRefetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSubmitAll = async () => {
    const rascunhos = budgets.filter((b: any) => b.status === "rascunho");
    if (rascunhos.length === 0) return toast.info("Nenhum orçamento em rascunho");
    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const b of rascunhos) {
        await (supabase as any).from("oas_budgets").update({
          status: "pendente_aprovacao",
          submitted_by: userData.user?.id || null,
          submitted_at: new Date().toISOString(),
        }).eq("id", b.id);
      }
      toast.success(`${rascunhos.length} orçamento(s) enviado(s) para aprovação!`);
      onRefetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("oas_orcamentos").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Orçamento removido");
      onRefetch();
      // Invalidar cache do dashboard para remover o orçamento das aprovações pendentes
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    }
  };

  const handleEdit = (budget: any) => {
    setEditingBudgetId(budget.id);
    setEditForm({
      tipo: budget.tipo,
      descricao: budget.descricao,
      empresa_id: budget.empresa_id || "",
      empresa_nome: budget.empresa_nome || "",
      quantidade: String(budget.quantidade),
      valor_unitario: String(budget.valor_unitario),
      part_number: budget.part_number || "",
      observacoes: budget.observacoes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.descricao) return toast.error("Descrição é obrigatória");
    if (!editForm.valor_unitario) return toast.error("Valor unitário é obrigatório");

    setSaving(true);
    const qty = parseInt(editForm.quantidade) || 1;
    const unitVal = parseFloat(editForm.valor_unitario) || 0;

    try {
      const { error } = await (supabase as any).from("oas_orcamentos").update({
        tipo: editForm.tipo,
        descricao: editForm.descricao,
        empresa_id: editForm.empresa_id || null,
        empresa_nome: editForm.empresa_nome || null,
        quantidade: qty,
        valor_unitario: unitVal,
        valor_total: qty * unitVal,
        part_number: editForm.part_number || null,
        observacoes: editForm.observacoes || null,
      }).eq("id", editingBudgetId);

      if (error) throw error;
      toast.success("Orçamento atualizado com sucesso!");
      setEditingBudgetId(null);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
      pendente_aprovacao: { label: "Aguard. Aprovação", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      aprovado: { label: "Aprovado", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
      rejeitado: { label: "Rejeitado", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    };
    const s = map[status] || map.rascunho;
    return <Badge className={cn("text-xs", s.cls)}>{s.label}</Badge>;
  };

  const totalAprovado = budgets.filter((b: any) => b.status === "aprovado").reduce((s: number, b: any) => s + (b.valor_total || 0), 0);
  const totalPendente = budgets.filter((b: any) => b.status === "pendente_aprovacao").reduce((s: number, b: any) => s + (b.valor_total || 0), 0);
  const hasRascunhos = budgets.some((b: any) => b.status === "rascunho");

  return (
    <div className="space-y-4">
      {/* Summary */}
      {budgets.length > 0 && (
        <div className="flex gap-4 text-sm">
          <div className="bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
            <span className="text-green-400 font-bold">Aprovado: R$ {totalAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20">
            <span className="text-yellow-400 font-bold">Pendente: R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          {hasRascunhos && (
            <Button size="sm" variant="default" onClick={handleSubmitAll} className="gap-1.5 ml-auto">
              <Send className="h-3.5 w-3.5" /> Enviar Todos para Aprovação
            </Button>
          )}
        </div>
      )}

      {budgets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{b.tipo === "peca" ? "Peça" : "Serviço"}</Badge>
                </TableCell>
                <TableCell className="font-medium">{b.descricao}</TableCell>
                <TableCell>{b.empresa_nome || "-"}</TableCell>
                <TableCell>{b.quantidade}</TableCell>
                <TableCell className="text-right">R$ {(b.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{statusBadge(b.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {(b.status === "rascunho" || b.status === "rejeitado") && (
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(b)} className="text-blue-400 hover:text-blue-300">
                        <span className="text-lg">✎</span>
                      </Button>
                    )}
                    {b.status === "rascunho" && (
                      <Button variant="ghost" size="icon" title="Enviar para aprovação" onClick={() => handleSubmitForApproval(b.id)}>
                        <Send className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                    {(b.status === "rascunho" || b.status === "rejeitado") && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                    {b.status === "rejeitado" && b.rejection_reason && (
                      <span className="text-xs text-red-400 ml-2" title={b.rejection_reason}>Motivo: {b.rejection_reason}</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="peca">Peça</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-2"><Label className="text-xs">Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            
            {/* Empresa - SearchableCombobox */}
            <div className="col-span-2 md:col-span-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs mb-2 block">Empresa / Oficina</Label>
                  <SearchableCombobox
                    items={oficinas}
                    value={form.empresa_id}
                    onChange={(id, label) => setForm(f => ({ ...f, empresa_id: id, empresa_nome: label }))}
                    placeholder="Selecione uma empresa..."
                    searchPlaceholder="Buscar empresa..."
                    emptyMessage="Nenhuma empresa encontrada"
                    disabled={loadingOficinas}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewCompanyDialog(true)}
                  title="Criar nova empresa"
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {form.tipo === "peca" && <div><Label className="text-xs">P/N</Label><Input value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} /></div>}
            <div><Label className="text-xs">Qtd</Label><Input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} /></div>
            <div><Label className="text-xs">Valor Unitário</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Orçamento
        </Button>
      )}

      {/* Dialog para editar orçamento */}
      <Dialog open={!!editingBudgetId} onOpenChange={(open) => !open && setEditingBudgetId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Orçamento</DialogTitle>
            <DialogDescription>
              Atualize os dados do orçamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={editForm.tipo} onValueChange={v => setEditForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="peca">Peça</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.tipo === "peca" && (
                <div>
                  <Label className="text-xs">P/N</Label>
                  <Input value={editForm.part_number} onChange={e => setEditForm(f => ({ ...f, part_number: e.target.value }))} />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Empresa / Oficina</Label>
              <SearchableCombobox
                items={oficinas}
                value={editForm.empresa_id}
                onChange={(id, label) => setEditForm(f => ({ ...f, empresa_id: id, empresa_nome: label }))}
                placeholder="Selecione uma empresa..."
                searchPlaceholder="Buscar empresa..."
                emptyMessage="Nenhuma empresa encontrada"
                disabled={loadingOficinas}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" min="1" value={editForm.quantidade} onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor Unitário *</Label>
                <Input type="number" step="0.01" value={editForm.valor_unitario} onChange={e => setEditForm(f => ({ ...f, valor_unitario: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingBudgetId(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.descricao.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar nova empresa */}
      <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Adicionar Nova Empresa
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da nova {newCompanyType === "oficina" ? "oficina" : "fornecedor"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Tipo de Empresa</Label>
              <Select value={newCompanyType} onValueChange={(v) => setNewCompanyType(v as "oficina" | "fornecedor")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oficina">Oficina</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Razão Social *</Label>
              <Input
                value={newCompanyData.razao_social}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, razao_social: e.target.value })}
                placeholder="Ex: Oficina ABC LTDA"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">CNPJ</Label>
              <Input
                value={newCompanyData.cnpj}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={newCompanyData.telefone}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, telefone: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Endereço</Label>
              <Input
                value={newCompanyData.endereco}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, endereco: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>

            {newCompanyType === "oficina" && (
              <div className="space-y-2">
                <Label className="text-xs">Mecânico Responsável</Label>
                <Input
                  value={newCompanyData.mecanico_responsavel}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, mecanico_responsavel: e.target.value })}
                  placeholder="Nome do mecânico"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewCompanyDialog(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewCompany}
              disabled={saving || !newCompanyData.razao_social.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar Empresa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
