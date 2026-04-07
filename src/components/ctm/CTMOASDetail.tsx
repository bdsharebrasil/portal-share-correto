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
  forcedSection?: string; // Nova propriedade
  hideHeader?: boolean;   // Nova propriedade
}

export function CTMOASDetail({ orderId, onClose, onDeleted, forcedSection, hideHeader }: CTMOASDetailProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string>("info");
  
  // Determina se usa a secção forçada pelo pai ou a secção local
  const currentSection = forcedSection || activeSection;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);

  const { data: order, refetch: refetchOrder } = useQuery({
    queryKey: ["oas-detail", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ctm_ordens_servico").select('*, aeronave(matricula, modelo)').eq("id", orderId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ["oas-services", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ctm_services").select("*").eq("service_order_id", orderId).order("criado_em");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: parts = [], refetch: refetchParts } = useQuery({
    queryKey: ["oas-parts", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ctm_parts").select("*").eq("service_order_id", orderId).order("criado_em");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: costSharing = [], refetch: refetchCostSharing } = useQuery({
    queryKey: ["oas-cost-sharing", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ctm_cost_sharing")
        .select("*, client:clients(id, razao_social, proprietario)")
        .eq("service_order_id", orderId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: budgets = [], refetch: refetchBudgets } = useQuery({
    queryKey: ["oas-budgets", orderId],
    queryFn: async () => {
      const { data, error } = (await (supabase as any).from("oas_orcamentos").select("*").eq("service_order_id", orderId).order("criado_em")) as any;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rasReports = [], refetch: refetchRAS } = useQuery({
    queryKey: ["oas-ras", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ras").select("*").eq("service_order_id", orderId).order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: oilAnalyses = [], refetch: refetchOil } = useQuery({
    queryKey: ["oas-oil", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("oil_analysis").select("*").eq("service_order_id", orderId).order("data", { ascending: false });
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
        .order("criado_em", { ascending: false });
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
      const { error } = await (supabase as any).from("ctm_ordens_servico").update({
        numero: editForm?.numero,
        oficina_nome: editForm?.oficina_nome || null,
        oficina_contato: editForm?.oficina_contato || null,
        data_entrada: editForm?.data_entrada || null,
        data_saida: editForm?.data_saida || null,
        dias_previstos: editForm?.dias_previstos ? parseInt(editForm.dias_previstos) : null,
        dias_efetivos: editForm?.dias_efetivos ? parseInt(editForm.dias_efetivos) : null,
        horas_celula: editForm?.horas_celula ? parseFloat(editForm.horas_celula) : null,
        objetivo: editForm?.objetivo || null,
        observacoes: editForm?.observacoes || null,
        status: editForm?.status,
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
      const { error } = await (supabase as any).from("ctm_ordens_servico").delete().eq("id", orderId);
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
      const { error } = await (supabase as any).from("ctm_ordens_servico").update({
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
      <Card className={cn("border-primary/20 bg-gradient-to-br from-background to-muted/10", hideHeader ? "border-0 bg-transparent shadow-none" : "")}>
        
        {/* Esconde o cabeçalho e as abas internas se hideHeader for true */}
        {!hideHeader && (
          <>
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
                    {order?.aeronave?.matricula} · {order?.aeronave?.modelo}
                  </p>
                </div>
                <div className="flex gap-2">
                  {order?.status !== "concluido" && (
                    <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Exportar PDF
                  </Button>
                  {order?.status !== "concluido" && (
                    <Button variant="default" size="sm" onClick={() => setShowConcluirDialog(true)} className="gap-1.5 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-3.5 w-3.5" /> Concluir OAS
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
                    <X className="h-3.5 w-3.5" /> Fechar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="px-6 pb-0 overflow-x-auto">
              <div className="flex gap-2 min-w-min">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Button
                      key={section.key}
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveSection(section.key)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                        activeSection === section.key
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <CardContent className={cn(hideHeader ? "p-0" : "pt-6")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentSection === "info" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Número</p>
                    <p className="font-medium">{order?.numero}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={cn("text-xs", statusColor)}>{order?.status}</Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Aeronave</p>
                    <p className="font-medium">{order?.aeronave?.matricula}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Modelo</p>
                    <p className="font-medium">{order?.aeronave?.modelo}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Oficina</p>
                    <p className="font-medium">{order?.oficina_nome || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Contato Oficina</p>
                    <p className="font-medium">{order?.oficina_contato || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Data Entrada</p>
                    <p className="font-medium">{order?.data_entrada ? formatDateToBR(order.data_entrada) : "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Data Saída</p>
                    <p className="font-medium">{order?.data_saida ? formatDateToBR(order.data_saida) : "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Dias Previstos</p>
                    <p className="font-medium">{order?.dias_previstos || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Dias Efetivos</p>
                    <p className="font-medium">{order?.dias_efetivos || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Horas Célula</p>
                    <p className="font-medium">{order?.horas_celula || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-muted-foreground">Objetivo</p>
                    <p className="font-medium">{order?.objetivo || "-"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="font-medium">{order?.observacoes || "-"}</p>
                  </div>
                </div>
              )}

              {currentSection === "servicos" && <ServicesSection orderId={orderId} services={services} onRefetch={refetchServices} />}
              {currentSection === "pecas" && <PartsSection orderId={orderId} parts={parts} onRefetch={refetchParts} />}
              {currentSection === "ras" && <OASRASSection orderId={orderId} reports={rasReports} onRefetch={refetchRAS} aircraftId={order?.aeronave_id || ""} aircraftRegistration={order?.aeronave?.matricula || ""} />}
              {currentSection === "oleo" && <OASOilAnalysisSection orderId={orderId} analyses={oilAnalyses} onRefetch={refetchOil} aircraftId={order?.aeronave_id || ""} />}
              {currentSection === "orcamentos" && <OASBudgetsSection orderId={orderId} budgets={budgets} onRefetch={refetchBudgets} />}
              {currentSection === "rateio" && <OASFlightHoursRateio orderId={orderId} costSharing={costSharing} onRefetch={refetchCostSharing} aircraftId={order?.aeronave_id || ""} totalGeral={0} />}
              {currentSection === "despesas" && <OASMaintenanceExpensesTable orderId={orderId} />}
              {currentSection === "resumo" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard label="Total Serviços" value={totalServicos} color="text-blue-400" highlight={true} />
                    <SummaryCard label="Total Peças" value={totalPecas} color="text-green-400" highlight={true} />
                    <SummaryCard label="Total Despesas" value={totalDespesas} color="text-yellow-400" highlight={true} />
                  </div>
                  <div className="bg-primary/20 border border-primary/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-primary-foreground mb-2">Total Geral da OAS</p>
                    <p className="text-3xl font-black text-primary-foreground">
                      R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar OAS #{order?.numero}</DialogTitle>
            <DialogDescription>Faça as alterações necessárias na Ordem de Serviço.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" value={editForm?.numero} onChange={e => setEditForm({ ...editForm, numero: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={editForm?.status} onValueChange={value => setEditForm({ ...editForm, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oficina_nome">Oficina</Label>
              <Input id="oficina_nome" value={editForm?.oficina_nome} onChange={e => setEditForm({ ...editForm, oficina_nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oficina_contato">Contato Oficina</Label>
              <Input id="oficina_contato" value={editForm?.oficina_contato} onChange={e => setEditForm({ ...editForm, oficina_contato: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_entrada">Data Entrada</Label>
              <Input id="data_entrada" type="data" value={editForm?.data_entrada} onChange={e => setEditForm({ ...editForm, data_entrada: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_saida">Data Saída</Label>
              <Input id="data_saida" type="data" value={editForm?.data_saida} onChange={e => setEditForm({ ...editForm, data_saida: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_previstos">Dias Previstos</Label>
              <Input id="dias_previstos" type="number" value={editForm?.dias_previstos} onChange={e => setEditForm({ ...editForm, dias_previstos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_efetivos">Dias Efetivos</Label>
              <Input id="dias_efetivos" type="number" value={editForm?.dias_efetivos} onChange={e => setEditForm({ ...editForm, dias_efetivos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horas_celula">Horas Célula</Label>
              <Input id="horas_celula" type="number" step="0.1" value={editForm?.horas_celula} onChange={e => setEditForm({ ...editForm, horas_celula: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Textarea id="objetivo" value={editForm?.objetivo} onChange={e => setEditForm({ ...editForm, objetivo: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" value={editForm?.observacoes} onChange={e => setEditForm({ ...editForm, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente esta Ordem de Serviço e todos os dados relacionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
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
            <AlertDialogTitle>Concluir Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao concluir esta OAS, a data de saída será definida para hoje e o status será alterado para "concluído".
              Um relatório PDF será gerado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConcluir} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concluindo...</> : "Concluir"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ===== Helper Components (mantidos do código original) =====

// ===== Parts Section =====
function PartsSection({ orderId, parts, onRefetch }: { orderId: string; parts: any[]; onRefetch: () => void }) {
  const [showNewPartForm, setShowNewPartForm] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleAddPart = async (newPart: any) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ctm_parts").insert({ ...newPart, service_order_id: orderId });
      if (error) throw error;
      toast.success("Peça adicionada com sucesso!");
      setShowNewPartForm(false);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ctm_parts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Peça removida com sucesso!");
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditPart = (part: any) => {
    setEditingPartId(part.id);
    setEditForm({
      descricao: part.descricao,
      numero_serie: part.numero_serie || "",
      quantidade: String(part.quantidade),
      valor_unitario: String(part.valor_unitario),
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm?.descricao?.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ctm_parts").update({
        descricao: editForm?.descricao,
        numero_serie: editForm?.numero_serie || null,
        quantidade: parseFloat(editForm?.quantidade || "0"),
        valor_unitario: parseFloat(editForm?.valor_unitario || "0"),
        valor_total: parseFloat(editForm?.quantidade || "0") * parseFloat(editForm?.valor_unitario || "0"),
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
              <TableHead>Nº Série</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead className="text-right">Valor Unitário</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell>{p.numero_serie || "-"}</TableCell>
                <TableCell>{p.quantidade}</TableCell>
                <TableCell className="text-right">R$ {(p.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">R$ {(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => handleEditPart(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePart(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!showNewPartForm && (
        <Button variant="outline" size="sm" onClick={() => setShowNewPartForm(true)} className="gap-1.5 w-full">
          <Plus className="h-3.5 w-3.5" /> Adicionar Peça
        </Button>
      )}

      {showNewPartForm && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-md font-semibold mb-3">Nova Peça</h4>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const newPart = {
              descricao: (form.elements.namedItem("descricao") as HTMLInputElement).value,
              numero_serie: (form.elements.namedItem("numero_serie") as HTMLInputElement).value,
              quantidade: parseFloat((form.elements.namedItem("quantidade") as HTMLInputElement).value),
              valor_unitario: parseFloat((form.elements.namedItem("valor_unitario") as HTMLInputElement).value),
            };
            await handleAddPart(newPart);
          }} className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_serie">Número de Série</Label>
              <Input id="numero_serie" name="numero_serie" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input id="quantidade" name="quantidade" type="number" step="1" defaultValue="1" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_unitario">Valor Unitário</Label>
              <Input id="valor_unitario" name="valor_unitario" type="number" step="0.01" defaultValue="0" required />
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setShowNewPartForm(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adicionando...</> : "Adicionar Peça"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Part Dialog */}
      <Dialog open={!!editingPartId} onOpenChange={(open) => !open && setEditingPartId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Peça</DialogTitle>
            <DialogDescription>Altere os detalhes da peça selecionada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-descricao">Descrição</Label>
              <Input id="edit-descricao" value={editForm?.descricao} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-numero_serie">Número de Série</Label>
              <Input id="edit-numero_serie" value={editForm?.numero_serie} onChange={e => setEditForm({ ...editForm, numero_serie: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantidade">Quantidade</Label>
                <Input type="number" step="1" value={editForm?.quantidade} onChange={e => setEditForm({ ...editForm, quantidade: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valor_unitario">Valor Unitário</Label>
                <Input type="number" step="0.01" value={editForm?.valor_unitario} onChange={e => setEditForm({ ...editForm, valor_unitario: e.target.value })} />
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
              disabled={saving || !editForm?.descricao?.trim()}
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

// ===== Services Section =====
function ServicesSection({ orderId, services, onRefetch }: { orderId: string; services: any[]; onRefetch: () => void }) {
  const [showMultipleItems, setShowMultipleItems] = useState(false);
  const [expandingServiceId, setExpandingServiceId] = useState<string | null>(null);
  const [expandedService, setExpandedService] = useState<any>(null);
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("ctm_services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Serviço removido"); onRefetch(); }
  };

  const handleExpandService = async (service: any) => {
    setExpandingServiceId(service.id);
    setExpandedService(service);
    setLoadingItems(true);
    try {
      const { data, error } = await (supabase as any)
        .from("ctm_service_items")
        .select("*")
        .eq("service_id", service.id)
        .order("ordenacao");

      if (error) throw error;
      setServiceItems(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar itens do serviço: " + err.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleUpdateServiceItem = async (itemId: string, updates: any) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("ctm_service_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      // Atualizar lista local
      setServiceItems(items =>
        items.map(item => item.id === itemId ? { ...item, ...updates } : item)
      );

      toast.success("Item atualizado com sucesso!");
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServiceItem = async (itemId: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("ctm_service_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setServiceItems(items => items.filter(item => item.id !== itemId));
      toast.success("Item removido com sucesso!");
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
                    <Button variant="ghost" size="icon" title="Expandir" onClick={() => handleExpandService(s)} className="text-blue-400 hover:text-blue-300">
                      <span className="text-lg">📄</span>
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

      {/* Dialog para visualizar serviço expandido */}
      <Dialog open={!!expandingServiceId} onOpenChange={(open) => !open && setExpandingServiceId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {expandedService?.descricao}
            </DialogTitle>
            <DialogDescription>
              Fornecedor: {expandedService?.fornecedor || "-"}
            </DialogDescription>
          </DialogHeader>

          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info do serviço */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm">Informações do Serviço</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Descrição</p>
                    <p className="font-medium">{expandedService?.descricao}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fornecedor</p>
                    <p className="font-medium">{expandedService?.fornecedor || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Quantidade Total</p>
                    <p className="font-medium">{expandedService?.quantidade || 1}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Valor Total</p>
                    <p className="font-medium">R$ {(expandedService?.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Itens do serviço */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Itens do Serviço</h3>
                {serviceItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[100px] text-center">Qtd</TableHead>
                        <TableHead className="w-[120px] text-right">Valor Unit.</TableHead>
                        <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceItems.map((item, index) => (
                        <ExpandedServiceItemRow
                          key={item.id}
                          item={{ ...item, ordenacao: index + 1, subtotal: item.quantidade * item.valor_unitario }}
                          onUpdate={handleUpdateServiceItem}
                          onDelete={handleDeleteServiceItem}
                          saving={saving}
                        />
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum item adicionado a este serviço.</p>
                )}
                <CTMServiceItemsForm
                  orderId={orderId}
                  onSaved={() => {
                    handleExpandService(expandedService);
                    onRefetch();
                  }}
                  onCancel={() => {}}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExpandingServiceId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

// ===== Expanded Service Item Row =====
function ExpandedServiceItemRow({ item, onUpdate, onDelete, saving }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    descricao: item.descricao,
    quantidade: String(item.quantidade),
    valor_unitario: String(item.valor_unitario),
  });

  const handleSave = async () => {
    if (!editForm?.descricao?.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    const qty = parseFloat(editForm?.quantidade || "0") || 1;
    const unitVal = parseFloat(editForm?.valor_unitario || "0") || 0;

    await onUpdate(item.id, {
      descricao: editForm?.descricao || "",
      quantidade: qty,
      valor_unitario: unitVal,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell>{item.ordenacao}</TableCell>
        <TableCell>
          <Input
            size={1}
            className="text-xs"
            value={editForm?.descricao || ""}
            onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min="1"
            step="0.1"
            size={1}
            className="text-xs text-center"
            value={editForm?.quantidade || ""}
            onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.01"
            size={1}
            className="text-xs text-right"
            value={editForm?.valor_unitario || ""}
            onChange={e => setEditForm(f => ({ ...f, valor_unitario: e.target.value }))}
          />
        </TableCell>
        <TableCell className="text-xs text-right font-semibold">
          R$ {((parseFloat(editForm?.quantidade || "0") || 0) * (parseFloat(editForm?.valor_unitario || "0") || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={saving} className="h-7 px-2">
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saving} className="h-7 px-2">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="text-xs">{item.ordenacao}</TableCell>
      <TableCell className="text-xs">{item.descricao}</TableCell>
      <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
      <TableCell className="text-xs text-right">
        R$ {(item.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-xs text-right font-semibold">
        R$ {(item.subtotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={saving}
            className="h-7 px-2 text-blue-400 hover:text-blue-300"
            title="Editar"
          >
            <span className="text-sm">✎</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            disabled={saving}
            className="h-7 px-2"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
