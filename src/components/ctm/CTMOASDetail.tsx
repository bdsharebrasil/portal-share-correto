import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Plus, Trash2, Save, Loader2, Wrench, Package, Users, DollarSign, Building } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CTMServiceItemsForm } from "./CTMServiceItemsForm";

interface CTMOASDetailProps {
  orderId: string;
  onClose: () => void;
}

// Helper para formatar data sem problemas de timezone
const formatDateFromString = (dateStr: string): string => {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
};

export function CTMOASDetail({ orderId, onClose }: CTMOASDetailProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string>("info");

  // Load OAS details
  const { data: order } = useQuery({
    queryKey: ["oas-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_service_orders").select("*").eq("id", orderId).single();
      if (error) throw error;
      return data;
    },
  });

  // Load services
  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ["oas-services", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_services").select("*").eq("service_order_id", orderId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Load parts
  const { data: parts = [], refetch: refetchParts } = useQuery({
    queryKey: ["oas-parts", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctm_parts").select("*").eq("service_order_id", orderId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Load cost sharing
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

  const totalServicos = services.reduce((sum: number, s: any) => sum + (s.valor || 0), 0);
  const totalPecas = parts.reduce((sum: number, p: any) => sum + (p.valor_total || 0), 0);
  const totalGeral = totalServicos + totalPecas;
  const totalPago = costSharing.filter((c: any) => c.status_pagamento === "pago").reduce((s: number, c: any) => s + (c.valor || 0), 0);
  const totalPendente = costSharing.filter((c: any) => c.status_pagamento !== "pago").reduce((s: number, c: any) => s + (c.valor || 0), 0);

  const statusColor = order?.status === "concluido"
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : order?.status === "em_andamento"
    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  const sections = [
    { key: "info", label: "Informações", icon: Building },
    { key: "servicos", label: `Serviços (${services.length})`, icon: Wrench },
    { key: "pecas", label: `Peças (${parts.length})`, icon: Package },
    { key: "rateio", label: `Rateio (${costSharing.length})`, icon: Users },
    { key: "resumo", label: "Resumo Financeiro", icon: DollarSign },
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
                {order?.data_entrada && ` • Entrada: ${formatDateFromString(order.data_entrada)}`}
                {order?.data_saida && ` • Saída: ${formatDateFromString(order.data_saida)}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>

          {/* Section Tabs */}
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
              {/* Info Section */}
              {activeSection === "info" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <InfoItem label="Oficina" value={order?.oficina_nome} />
                  <InfoItem label="Contato" value={order?.oficina_contato} />
                  <InfoItem label="Horas Célula" value={order?.horas_celula ? `${order.horas_celula}H` : "-"} />
                  <InfoItem label="Dias Previstos" value={order?.dias_previstos?.toString()} />
                  <InfoItem label="Dias Efetivos" value={order?.dias_efetivos?.toString()} />
                  <InfoItem label="Objetivo" value={order?.objetivo} />
                  <InfoItem label="Tipo Rateio" value={order?.tipo_rateio} />
                  <InfoItem label="Observações" value={order?.observacoes} />
                </div>
              )}

              {/* Services Section */}
              {activeSection === "servicos" && (
                <ServicesSection orderId={orderId} services={services} onRefetch={refetchServices} />
              )}

              {/* Parts Section */}
              {activeSection === "pecas" && (
                <PartsSection orderId={orderId} parts={parts} onRefetch={refetchParts} />
              )}

              {/* Cost Sharing Section */}
              {activeSection === "rateio" && (
                <CostSharingSection orderId={orderId} costSharing={costSharing} onRefetch={refetchCostSharing} />
              )}

              {/* Financial Summary */}
              {activeSection === "resumo" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SummaryCard label="Total Serviços" value={totalServicos} color="text-blue-400" />
                    <SummaryCard label="Total Peças" value={totalPecas} color="text-orange-400" />
                    <SummaryCard label="Total Geral" value={totalGeral} color="text-foreground" highlight />
                    <SummaryCard label="Pago" value={totalPago} color="text-green-400" />
                    <SummaryCard label="Pendente" value={totalPendente} color="text-red-400" />
                  </div>

                  {costSharing.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sócio</TableHead>
                          <TableHead>% Rateio</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Pgto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costSharing.map((cs: any) => (
                          <TableRow key={cs.id}>
                            <TableCell>{cs.client?.company_name || cs.client?.proprietario || "-"}</TableCell>
                            <TableCell>{cs.percentual?.toFixed(1)}%</TableCell>
                            <TableCell>R$ {(cs.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Badge className={cs.status_pagamento === "pago" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>
                                {cs.status_pagamento === "pago" ? "Pago" : "Pendente"}
                              </Badge>
                            </TableCell>
                            <TableCell>{cs.data_pagamento ? new Date(cs.data_pagamento).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ctm_services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Serviço removido"); onRefetch(); }
  };

  return (
    <div className="space-y-4">
      {/* Tabela de serviços simples */}
      {services.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Modo Pag.</TableHead>
              <TableHead>NF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.descricao}</TableCell>
                <TableCell className="text-sm">{s.modelo || "-"}</TableCell>
                <TableCell>{s.fornecedor || "-"}</TableCell>
                <TableCell className="text-center">{s.quantidade || 1}</TableCell>
                <TableCell className="text-xs">{s.modo_pagamento || "-"}</TableCell>
                <TableCell>{s.nota_fiscal || "-"}</TableCell>
                <TableCell className="text-right">R$ {(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Formulário inline de múltiplos itens */}
      {showMultipleItems && (
        <div className="border-t pt-6">
          <CTMServiceItemsForm
            orderId={orderId}
            onSaved={() => {
              setShowMultipleItems(false);
              onRefetch();
            }}
            onCancel={() => setShowMultipleItems(false)}
          />
        </div>
      )}

      {/* Botão para criar serviço com múltiplos itens */}
      {!showMultipleItems && (
        <Button variant="outline" size="sm" onClick={() => setShowMultipleItems(true)} className="gap-1.5 w-full">
          <Plus className="h-3.5 w-3.5" /> Criar Serviços
        </Button>
      )}
    </div>
  );
}

// ===== Parts Section =====
function PartsSection({ orderId, parts, onRefetch }: { orderId: string; parts: any[]; onRefetch: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    part_number: "",
    serial_number: "",
    fornecedor: "",
    quantidade: "1",
    valor_unitario: "",
    nota_fiscal: "",
    modo_pagamento: "",
    dados_pagamento: ""
  });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.descricao) return toast.error("Descrição é obrigatória");
    setSaving(true);
    const qty = parseInt(form.quantidade) || 1;
    const unitVal = parseFloat(form.valor_unitario) || 0;
    try {
      const { error } = await supabase.from("ctm_parts").insert([{
        service_order_id: orderId,
        descricao: form.descricao,
        part_number: form.part_number || null,
        serial_number: form.serial_number || null,
        fornecedor: form.fornecedor || null,
        quantidade: qty,
        valor_unitario: unitVal,
        valor_total: qty * unitVal,
        nota_fiscal: form.nota_fiscal || null,
        modelo: form.part_number || null,
        modo_pagamento: form.modo_pagamento || null,
        dados_pagamento: form.dados_pagamento || null,
      }]);
      if (error) throw error;
      toast.success("Peça adicionada");
      setForm({
        descricao: "",
        part_number: "",
        serial_number: "",
        fornecedor: "",
        quantidade: "1",
        valor_unitario: "",
        nota_fiscal: "",
        modo_pagamento: "",
        dados_pagamento: ""
      });
      setAdding(false);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ctm_parts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Peça removida"); onRefetch(); }
  };

  return (
    <div className="space-y-4">
      {parts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>P/N</TableHead>
              <TableHead>S/N</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Modo Pag.</TableHead>
              <TableHead>NF</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell>{p.part_number || "-"}</TableCell>
                <TableCell>{p.serial_number || "-"}</TableCell>
                <TableCell>{p.fornecedor || "-"}</TableCell>
                <TableCell>{p.quantidade}</TableCell>
                <TableCell className="text-xs">{p.modo_pagamento || "-"}</TableCell>
                <TableCell>{p.nota_fiscal || "-"}</TableCell>
                <TableCell className="text-right">R$ {(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-4"><Label className="text-xs">Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição da peça" /></div>
            <div><Label className="text-xs">Part Number</Label><Input value={form.part_number} onChange={(e) => setForm(f => ({ ...f, part_number: e.target.value }))} placeholder="ex: 32005-007" /></div>
            <div><Label className="text-xs">Serial Number</Label><Input value={form.serial_number} onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="ex: 318551" /></div>
            <div><Label className="text-xs">Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
            <div><Label className="text-xs">Quantidade</Label><Input type="number" min="1" value={form.quantidade} onChange={(e) => setForm(f => ({ ...f, quantidade: e.target.value }))} /></div>
            <div><Label className="text-xs">Valor Unitário</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setForm(f => ({ ...f, valor_unitario: e.target.value }))} /></div>
            <div><Label className="text-xs">Modo Pagamento</Label><Input value={form.modo_pagamento} onChange={(e) => setForm(f => ({ ...f, modo_pagamento: e.target.value }))} placeholder="Boleto, Transferência..." /></div>
            <div><Label className="text-xs">Nota Fiscal</Label><Input value={form.nota_fiscal} onChange={(e) => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs">Dados para Pagamento</Label><Textarea value={form.dados_pagamento} onChange={(e) => setForm(f => ({ ...f, dados_pagamento: e.target.value }))} placeholder="Banco: 001 | Agência: 0000-0 | Conta: 00000-0" rows={2} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar Peça
        </Button>
      )}
    </div>
  );
}

// ===== Cost Sharing Section =====
function CostSharingSection({ orderId, costSharing, onRefetch }: { orderId: string; costSharing: any[]; onRefetch: () => void }) {
  const [adding, setAdding] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({ client_id: "", percentual: "", valor: "", status_pagamento: "pendente" });
  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    const { data } = await supabase.from("clients").select("id, company_name, proprietario").order("company_name");
    setClients(data || []);
  };

  const handleAdd = async () => {
    if (!form.client_id) return toast.error("Selecione um sócio");
    setSaving(true);
    try {
      const { error } = await supabase.from("ctm_cost_sharing").insert([{
        service_order_id: orderId,
        client_id: form.client_id,
        percentual: form.percentual ? parseFloat(form.percentual) : null,
        valor: form.valor ? parseFloat(form.valor) : null,
        status_pagamento: form.status_pagamento,
      }]);
      if (error) throw error;
      toast.success("Rateio adicionado");
      setForm({ client_id: "", percentual: "", valor: "", status_pagamento: "pendente" });
      setAdding(false);
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePago = async (id: string, current: string) => {
    const newStatus = current === "pago" ? "pendente" : "pago";
    const updateData: any = { status_pagamento: newStatus };
    if (newStatus === "pago") updateData.data_pagamento = new Date().toISOString().split("T")[0];
    else updateData.data_pagamento = null;
    
    const { error } = await supabase.from("ctm_cost_sharing").update(updateData).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus === "pago" ? "Marcado como pago" : "Revertido para pendente"); onRefetch(); }
  };

  return (
    <div className="space-y-4">
      {costSharing.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sócio</TableHead>
              <TableHead>% Rateio</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costSharing.map((cs: any) => (
              <TableRow key={cs.id}>
                <TableCell className="font-medium">{cs.client?.company_name || cs.client?.proprietario || "-"}</TableCell>
                <TableCell>{cs.percentual?.toFixed(1)}%</TableCell>
                <TableCell>R$ {(cs.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge
                    className={cn("cursor-pointer", cs.status_pagamento === "pago" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400")}
                    onClick={() => togglePago(cs.id, cs.status_pagamento)}
                  >
                    {cs.status_pagamento === "pago" ? "✓ Pago" : "Pendente"}
                  </Badge>
                </TableCell>
                <TableCell>{cs.data_pagamento ? new Date(cs.data_pagamento).toLocaleDateString("pt-BR") : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {adding ? (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Sócio *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.client_id}
                onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || c.proprietario}</option>
                ))}
              </select>
            </div>
            <div><Label className="text-xs">% Rateio</Label><Input type="number" step="0.1" value={form.percentual} onChange={(e) => setForm(f => ({ ...f, percentual: e.target.value }))} /></div>
            <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { setAdding(true); loadClients(); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar Rateio
        </Button>
      )}
    </div>
  );
}
