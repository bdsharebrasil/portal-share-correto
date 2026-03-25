import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronUp, Plus, Trash2, Save, Loader2, Wrench, Package, Users, DollarSign,
  Building, Edit2, X, CheckCircle, FileText, Droplets, Receipt, Download, Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDateToBR } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CTMServiceItemsForm } from "./CTMServiceItemsForm";
import { OASBudgetsSection } from "./OASBudgetsSection";
import { OASRASSection } from "./OASRASSection";
import { OASOilAnalysisSection } from "./OASOilAnalysisSection";
import { OASFlightHoursRateio } from "./OASFlightHoursRateio";
import { OASMaintenanceExpensesTable } from "./OASMaintenanceExpensesTable";
import { generateOASPDF } from "./oasPdfExport";

interface CTMOASDetailProps {
  orderId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export function CTMOASDetail({ orderId, onClose, onDeleted }: CTMOASDetailProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string>("info");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);

  const { data: order, refetch: refetchOrder } = useQuery({
    queryKey: ["oas-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_service_orders").select("*, aircraft(registration, model)").eq("id", orderId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ["oas-services", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_services").select("*").eq("service_order_id", orderId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: parts = [], refetch: refetchParts } = useQuery({
    queryKey: ["oas-parts", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_parts").select("*").eq("service_order_id", orderId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: costSharing = [], refetch: refetchCostSharing } = useQuery({
    queryKey: ["oas-cost-sharing", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_cost_sharing")
        .select("*, client:clients(id, company_name, proprietario)")
        .eq("service_order_id", orderId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: budgets = [], refetch: refetchBudgets } = useQuery({
    queryKey: ["oas-budgets", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("oas_budgets").select("*").eq("service_order_id", orderId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rasReports = [], refetch: refetchRAS } = useQuery({
    queryKey: ["oas-ras", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ras").select("*").eq("service_order_id", orderId).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: oilAnalyses = [], refetch: refetchOil } = useQuery({
    queryKey: ["oas-oil", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("oil_analysis").select("*").eq("service_order_id", orderId).order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch despesas de manutenção vinculadas a esta OAS
  const { data: despesasManutencao = [] } = useQuery({
    queryKey: ["oas-despesas-manutencao", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_manutencao")
        .select("*")
        .eq("service_order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totalServicos = services.reduce((sum: number, s: any) => sum + (s.valor || 0), 0);
  const totalPecas = parts.reduce((sum: number, p: any) => sum + (p.valor_total || 0), 0);
  const totalDespesas = despesasManutencao.reduce((sum: number, d: any) => sum + (d.valor || 0), 0);
  const totalGeral = totalServicos + totalPecas + totalDespesas;

  // Edit handlers
  const startEdit = () => {
    setEditForm({
      numero: order?.numero || "",
      oficina_nome: order?.oficina_nome || "",
      oficina_contato: order?.oficina_contato || "",
      data_entrada: order?.data_entrada || "",
      data_saida: order?.data_saida || "",
      dias_previstos: order?.dias_previstos?.toString() || "",
      dias_efetivos: order?.dias_efetivos?.toString() || "",
      horas_celula: order?.horas_celula?.toString() || "",
      objetivo: order?.objetivo || "",
      observacoes: order?.observacoes || "",
      status: order?.status || "pendente",
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("ctm_service_orders").update({
        numero: editForm.numero,
        oficina_nome: editForm.oficina_nome || null,
        oficina_contato: editForm.oficina_contato || null,
        data_entrada: editForm.data_entrada || null,
        data_saida: editForm.data_saida || null,
        dias_previstos: editForm.dias_previstos ? parseInt(editForm.dias_previstos) : null,
        dias_efetivos: editForm.dias_efetivos ? parseInt(editForm.dias_efetivos) : null,
        horas_celula: editForm.horas_celula ? parseFloat(editForm.horas_celula) : null,
        objetivo: editForm.objetivo || null,
        observacoes: editForm.observacoes || null,
        status: editForm.status,
      }).eq("id", orderId);
      if (error) throw error;
      toast.success("OAS atualizada com sucesso!");
      setIsEditing(false);
      refetchOrder();
      queryClient.invalidateQueries({ queryKey: ["all-oas"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("ctm_service_orders").delete().eq("id", orderId);
      if (error) throw error;
      toast.success("OAS excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["all-oas"] });
      onDeleted?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConcluir = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("ctm_service_orders").update({
        status: "concluido",
        data_saida: new Date().toISOString().split("T")[0],
      }).eq("id", orderId);
      if (error) throw error;
      toast.success("OAS concluída! Gerando relatório PDF...");
      setShowConcluirDialog(false);
      await refetchOrder();
      queryClient.invalidateQueries({ queryKey: ["all-oas"] });

      // Generate PDF
      setTimeout(() => {
        generateOASPDF({
          order: { ...order, status: "concluido" },
          services,
          parts,
          costSharing,
          budgets,
          rasReports,
          oilAnalyses,
        });
      }, 500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    generateOASPDF({
      order,
      services,
      parts,
      costSharing,
      budgets,
      rasReports,
      oilAnalyses,
    });
  };

  const statusColor = order?.status === "concluido"
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : order?.status === "em_andamento"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  const sections = [
    { key: "info", label: "Informações", icon: Building },
    { key: "servicos", label: `Serviços (${services.length})`, icon: Wrench },
    { key: "pecas", label: `Peças (${parts.length})`, icon: Package },
    { key: "ras", label: `RAS (${rasReports.length})`, icon: FileText },
    { key: "oleo", label: `Óleo (${oilAnalyses.length})`, icon: Droplets },
    { key: "orcamentos", label: `Orçamentos (${budgets.length})`, icon: Receipt },
    { key: "rateio", label: `Rateio (${costSharing.length})`, icon: Users },
    { key: "despesas", label: `Despesas (${despesasManutencao.length})`, icon: DollarSign },
    { key: "resumo", label: "Resumo", icon: DollarSign },
  ];

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-3">
                OAS #{order?.numero}
                <Badge className={cn("text-xs", statusColor)}>
                  {order?.status === "concluido" ? "Concluído" : order?.status === "em_andamento" ? "Em Andamento" : "Pendente"}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {order?.oficina_nome && `Oficina: ${order.oficina_nome}`}
                {order?.data_entrada && ` • Entrada: ${formatDateToBR(order.data_entrada)}`}
                {order?.data_saida && ` • Saída: ${formatDateToBR(order.data_saida)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {order?.status !== "concluido" && (
                <>
                  <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5 text-xs">
                    <Edit2 className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowConcluirDialog(true)}
                    className="gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Concluir
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <Button
                  key={s.key}
                  variant={activeSection === s.key ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setActiveSection(s.key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div key={activeSection} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Info Section - Edit or View */}
              {activeSection === "info" && (
                isEditing ? (
                  <EditInfoForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setIsEditing(false)} saving={saving} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <InfoItem label="Número" value={order?.numero} />
                    <InfoItem label="Oficina" value={order?.oficina_nome} />
                    <InfoItem label="Contato" value={order?.oficina_contato} />
                    <InfoItem label="Horas Célula" value={order?.horas_celula ? `${order.horas_celula}H` : "-"} />
                    <InfoItem label="Dias Previstos" value={order?.dias_previstos?.toString()} />
                    <InfoItem label="Dias Efetivos" value={order?.dias_efetivos?.toString()} />
                    <InfoItem label="Objetivo" value={order?.objetivo} />
                    <InfoItem label="Observações" value={order?.observacoes} />
                  </div>
                )
              )}

              {activeSection === "servicos" && (
                <ServicesSection orderId={orderId} services={services} onRefetch={refetchServices} />
              )}

              {activeSection === "pecas" && (
                <PartsSection orderId={orderId} parts={parts} onRefetch={refetchParts} />
              )}

              {activeSection === "ras" && (
                <OASRASSection
                  orderId={orderId}
                  aircraftId={order?.aircraft_id || ""}
                  aircraftRegistration={(order?.aircraft as any)?.registration || ""}
                  reports={rasReports}
                  onRefetch={refetchRAS}
                />
              )}

              {activeSection === "oleo" && (
                <OASOilAnalysisSection
                  orderId={orderId}
                  aircraftId={order?.aircraft_id || ""}
                  analyses={oilAnalyses}
                  onRefetch={refetchOil}
                />
              )}

              {activeSection === "orcamentos" && (
                <OASBudgetsSection
                  orderId={orderId}
                  budgets={budgets}
                  onRefetch={refetchBudgets}
                />
              )}

              {activeSection === "rateio" && (
                <OASFlightHoursRateio
                  orderId={orderId}
                  aircraftId={order?.aircraft_id || ""}
                  costSharing={costSharing}
                  totalGeral={totalGeral}
                  periodoInicio={order?.periodo_inicio || order?.data_entrada}
                  periodoFim={order?.periodo_fim || order?.data_saida}
                  onRefetch={refetchCostSharing}
                />
              )}

              {activeSection === "despesas" && (
                <OASMaintenanceExpensesTable orderId={orderId} />
              )}

              {activeSection === "resumo" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryCard label="Total Serviços" value={totalServicos} color="text-blue-400" />
                    <SummaryCard label="Total Peças" value={totalPecas} color="text-orange-400" />
                    <SummaryCard label="Total Orçamentos" value={budgets.reduce((s: number, b: any) => s + (b.valor_total || 0), 0)} color="text-purple-400" />
                    <SummaryCard label="Despesas Manutenção" value={totalDespesas} color="text-amber-400" />
                    <SummaryCard label="Total Geral" value={totalGeral} color="text-foreground" highlight />
                  </div>

                  {/* Tabela de Despesas no Resumo */}
                  {despesasManutencao.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Detalhes de Despesas de Manutenção
                      </h3>
                      <OASMaintenanceExpensesTable orderId={orderId} />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir OAS #{order?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os serviços, peças, orçamentos e rateios associados serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Concluir Dialog */}
      <AlertDialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir OAS #{order?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao concluir, o status será alterado para "Concluído" e um relatório PDF completo será gerado automaticamente com todos os dados da OAS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConcluir} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Concluir OAS
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ===== Edit Info Form =====
function EditInfoForm({ form, setForm, onSave, onCancel, saving }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Número *</Label><Input value={form.numero} onChange={e => setForm((f: any) => ({ ...f, numero: e.target.value }))} /></div>
        <div><Label className="text-xs">Oficina</Label><Input value={form.oficina_nome} onChange={e => setForm((f: any) => ({ ...f, oficina_nome: e.target.value }))} /></div>
        <div><Label className="text-xs">Contato</Label><Input value={form.oficina_contato} onChange={e => setForm((f: any) => ({ ...f, oficina_contato: e.target.value }))} /></div>
        <div><Label className="text-xs">Horas Célula</Label><Input type="number" step="0.1" value={form.horas_celula} onChange={e => setForm((f: any) => ({ ...f, horas_celula: e.target.value }))} /></div>
        <div><Label className="text-xs">Data Entrada</Label><Input type="date" value={form.data_entrada} onChange={e => setForm((f: any) => ({ ...f, data_entrada: e.target.value }))} /></div>
        <div><Label className="text-xs">Data Saída</Label><Input type="date" value={form.data_saida} onChange={e => setForm((f: any) => ({ ...f, data_saida: e.target.value }))} /></div>
        <div><Label className="text-xs">Dias Previstos</Label><Input type="number" value={form.dias_previstos} onChange={e => setForm((f: any) => ({ ...f, dias_previstos: e.target.value }))} /></div>
        <div><Label className="text-xs">Dias Efetivos</Label><Input type="number" value={form.dias_efetivos} onChange={e => setForm((f: any) => ({ ...f, dias_efetivos: e.target.value }))} /></div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-3"><Label className="text-xs">Objetivo</Label><Textarea value={form.objetivo} onChange={e => setForm((f: any) => ({ ...f, objetivo: e.target.value }))} rows={2} /></div>
        <div className="col-span-2 md:col-span-4"><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm((f: any) => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5 mr-1" /> Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Salvar</Button>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value || "-"}</p>
    </div>
  );
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl p-4 text-center", highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30")}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-black", color)}>
        R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ===== Services Section =====
function ServicesSection({ orderId, services, onRefetch }: { orderId: string; services: any[]; onRefetch: () => void }) {
  const [showMultipleItems, setShowMultipleItems] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", fornecedor: "", quantidade: "1", valor_unitario: "" });
  const [saving, setSaving] = useState(false);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ctm_services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Serviço removido"); onRefetch(); }
  };

  const handleEdit = (service: any) => {
    setEditingServiceId(service.id);
    setEditForm({
      descricao: service.descricao,
      fornecedor: service.fornecedor || "",
      quantidade: String(service.quantidade || 1),
      valor_unitario: String(service.valor_unitario || (service.valor / (service.quantidade || 1))),
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.descricao) return toast.error("Descrição é obrigatória");
    if (!editForm.valor_unitario) return toast.error("Valor unitário é obrigatório");

    setSaving(true);
    const qty = parseInt(editForm.quantidade) || 1;
    const unitVal = parseFloat(editForm.valor_unitario) || 0;

    try {
      const { error } = await supabase.from("ctm_services").update({
        descricao: editForm.descricao,
        fornecedor: editForm.fornecedor || null,
        quantidade: qty,
        valor_unitario: unitVal,
        valor: qty * unitVal,
      }).eq("id", editingServiceId);

      if (error) throw error;
      toast.success("Serviço atualizado com sucesso!");
      setEditingServiceId(null);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {services.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.descricao}</TableCell>
                <TableCell>{s.fornecedor || "-"}</TableCell>
                <TableCell>{s.quantidade || 1}</TableCell>
                <TableCell className="text-right">R$ {(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(s)} className="text-blue-400 hover:text-blue-300">
                      <span className="text-lg">✎</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {showMultipleItems && (
        <div className="border-t pt-6">
          <CTMServiceItemsForm orderId={orderId} onSaved={() => { setShowMultipleItems(false); onRefetch(); }} onCancel={() => setShowMultipleItems(false)} />
        </div>
      )}
      {!showMultipleItems && (
        <Button variant="outline" size="sm" onClick={() => setShowMultipleItems(true)} className="gap-1.5 w-full">
          <Plus className="h-3.5 w-3.5" /> Criar Serviços
        </Button>
      )}

      {/* Dialog para editar serviço */}
      <Dialog open={!!editingServiceId} onOpenChange={(open) => !open && setEditingServiceId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>
              Atualize os dados do serviço
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={editForm.fornecedor} onChange={e => setEditForm(f => ({ ...f, fornecedor: e.target.value }))} />
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingServiceId(null)}
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
    </div>
  );
}

// ===== Parts Section =====
function PartsSection({ orderId, parts, onRefetch }: { orderId: string; parts: any[]; onRefetch: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ descricao: "", part_number: "", fornecedor: "", quantidade: "1", valor_unitario: "" });
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", part_number: "", fornecedor: "", quantidade: "1", valor_unitario: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.descricao) return toast.error("Descrição é obrigatória");
    setSaving(true);
    const qty = parseInt(form.quantidade) || 1;
    const unitVal = parseFloat(form.valor_unitario) || 0;
    try {
      const { error } = await supabase.from("ctm_parts").insert([{
        service_order_id: orderId, descricao: form.descricao, part_number: form.part_number || null,
        fornecedor: form.fornecedor || null, quantidade: qty, valor_unitario: unitVal, valor_total: qty * unitVal,
      }]);
      if (error) throw error;
      toast.success("Peça adicionada");
      setForm({ descricao: "", part_number: "", fornecedor: "", quantidade: "1", valor_unitario: "" });
      setAdding(false);
      onRefetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ctm_parts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Peça removida"); onRefetch(); }
  };

  const handleEdit = (part: any) => {
    setEditingPartId(part.id);
    setEditForm({
      descricao: part.descricao,
      part_number: part.part_number || "",
      fornecedor: part.fornecedor || "",
      quantidade: String(part.quantidade),
      valor_unitario: String(part.valor_unitario),
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.descricao) return toast.error("Descrição é obrigatória");
    if (!editForm.valor_unitario) return toast.error("Valor unitário é obrigatório");

    setSaving(true);
    const qty = parseInt(editForm.quantidade) || 1;
    const unitVal = parseFloat(editForm.valor_unitario) || 0;

    try {
      const { error } = await supabase.from("ctm_parts").update({
        descricao: editForm.descricao,
        part_number: editForm.part_number || null,
        fornecedor: editForm.fornecedor || null,
        quantidade: qty,
        valor_unitario: unitVal,
        valor_total: qty * unitVal,
      }).eq("id", editingPartId);

      if (error) throw error;
      toast.success("Peça atualizada com sucesso!");
      setEditingPartId(null);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {parts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>P/N</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell>{p.part_number || "-"}</TableCell>
                <TableCell>{p.fornecedor || "-"}</TableCell>
                <TableCell>{p.quantidade}</TableCell>
                <TableCell className="text-right">R$ {(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(p)} className="text-blue-400 hover:text-blue-300">
                      <span className="text-lg">✎</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="col-span-2"><Label className="text-xs">Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><Label className="text-xs">P/N</Label><Input value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} /></div>
            <div><Label className="text-xs">Fornecedor</Label><Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
            <div><Label className="text-xs">Qtd</Label><Input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} /></div>
            <div><Label className="text-xs">Valor Unit.</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar Peça</Button>
      )}

      {/* Dialog para editar peça */}
      <Dialog open={!!editingPartId} onOpenChange={(open) => !open && setEditingPartId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Peça</DialogTitle>
            <DialogDescription>
              Atualize os dados da peça
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">P/N</Label>
                <Input value={editForm.part_number} onChange={e => setEditForm(f => ({ ...f, part_number: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Input value={editForm.fornecedor} onChange={e => setEditForm(f => ({ ...f, fornecedor: e.target.value }))} />
              </div>
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingPartId(null)}
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
    </div>
  );
}
