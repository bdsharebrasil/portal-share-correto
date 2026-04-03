import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CTMServiceOrder, MaintenanceCategory } from "@/types/ctm";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { useCTMServiceOrders, Oficina } from "@/hooks/useCTMServiceOrders";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  CalendarRange,
  Clock4,
  FileText,
  DollarSign,
  ShieldCheck,
  Hash,
  Plane,
} from "lucide-react";

interface NewServiceOrderPageProps {
  aircraftId: string;
  aircraftRegistration: string;
  onBack: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onServiceOrderCreated?: (order: CTMServiceOrder) => void;
  editingOrder?: CTMServiceOrder | null; // Suporte a modo edição
}

const MAINTENANCE_TYPES = [
  "CORRETIVO", "50HORAS", "100HORAS", "CVA",
  "HELICE_GOVERNADOR", "OLEO", "PNEU_DIREITO",
  "PNEU_ESQUERDO", "PNEU_TREM_NARIZ",
];

const SERVICE_STATUS = [
  "PLANEJADA", "INICIADA", "EM_ANDAMENTO",
  "CONCLUÍDA", "CANCELADA", "SUSPENSA",
];

const APPROVAL_STATUS = ["draft", "submitted", "approved", "rejected"];

const TIPO_RATEIO = ["HORAS", "CICLOS", "CALENDARIO"];

const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border/60">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ─── Field wrapper ───────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function NewServiceOrderPage({
  aircraftId,
  aircraftRegistration,
  onBack,
  onServiceOrderCreated,
  editingOrder,
}: NewServiceOrderPageProps) {
  const [loading, setLoading] = useState(false);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [createNewOficina, setCreateNewOficina] = useState(false);
  const [loadingOficinas, setLoadingOficinas] = useState(false);

  // Use o hook para carregar oficinas
  const { loadOficinas, createOficina } = useCTMServiceOrders();

  const [formData, setFormData] = useState({
    // Identificação
    numero: "",
    os_oficina: "",
    tipo_manutencao: "CORRETIVO" as MaintenanceCategory,
    // Célula / horas
    horas_celula: "",
    periodo: "",
    periodo_inicio: "",
    periodo_fim: "",
    tipo_rateio: "HORAS",
    // Oficina
    oficina_id: "",
    oficina_nome: "",
    oficina_contato: "",
    mecanico_responsavel: "",
    // Datas
    data_entrada: getTodayString(),
    data_saida: "",
    // Duração
    dias_previstos: "",
    dias_efetivos: "",
    // Status
    status: "PLANEJADA",
    approval_status: "draft",
    rejection_reason: "",
    // Vínculo
    vencimento_id: "",
    // Detalhes
    objetivo: "CÉLULA",
    observacoes: "",
  });

  // Carregar oficinas ao montar o componente
  useEffect(() => {
    const fetchOficinas = async () => {
      setLoadingOficinas(true);
      try {
        const data = await loadOficinas();
        setOficinas(data);
      } catch (error) {
        console.error("Erro ao carregar oficinas:", error);
        toast.error("Erro ao carregar oficinas");
      } finally {
        setLoadingOficinas(false);
      }
    };

    fetchOficinas();
  }, [loadOficinas]);

  // Carregar dados da ordem quando editando
  useEffect(() => {
    if (editingOrder) {
      setFormData({
        numero: editingOrder.numero || "",
        os_oficina: editingOrder.os_oficina || "",
        tipo_manutencao: (editingOrder.tipo_manutencao as MaintenanceCategory) || "CORRETIVO",
        horas_celula: editingOrder.horas_celula ? String(editingOrder.horas_celula) : "",
        periodo: editingOrder.periodo || "",
        periodo_inicio: editingOrder.periodo_inicio || "",
        periodo_fim: editingOrder.periodo_fim || "",
        tipo_rateio: editingOrder.tipo_rateio || "HORAS",
        oficina_id: editingOrder.id || "",
        oficina_nome: editingOrder.oficina_nome || "",
        oficina_contato: editingOrder.oficina_contato || "",
        mecanico_responsavel: editingOrder.mecanico_responsavel || "",
        data_entrada: editingOrder.data_entrada || getTodayString(),
        data_saida: editingOrder.data_saida || "",
        dias_previstos: editingOrder.dias_previstos ? String(editingOrder.dias_previstos) : "",
        dias_efetivos: editingOrder.dias_efetivos ? String(editingOrder.dias_efetivos) : "",
        status: editingOrder.status || "PLANEJADA",
        approval_status: editingOrder.approval_status || "draft",
        rejection_reason: editingOrder.rejection_reason || "",
        vencimento_id: editingOrder.vencimento_id || "",
        objetivo: editingOrder.objetivo || "CÉLULA",
        observacoes: editingOrder.observacoes || "",
      });
      setCreateNewOficina(false);
    }
  }, [editingOrder]);

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Quando seleciona uma oficina, preencher automaticamente telefone e mecanico
  const handleOficinaSelect = (oficinaId: string, label: string) => {
    const selectedOficina = oficinas.find(o => o.id === oficinaId);

    set("oficina_id", oficinaId);
    set("oficina_nome", label);

    if (selectedOficina) {
      // Oficina existente - preencher automaticamente
      set("oficina_contato", selectedOficina.telefone || "");
      set("mecanico_responsavel", selectedOficina.mecanico_responsavel || "");
      setCreateNewOficina(false);
    } else {
      // Nova oficina (texto livre)
      set("oficina_contato", "");
      set("mecanico_responsavel", "");
      setCreateNewOficina(true);
    }
  };

  // Criar nova oficina e adicionar aos dados da OAS
  const createNewOficinAndAddOrder = async () => {
    if (!formData.oficina_nome.trim()) {
      toast.error("Nome da oficina é obrigatório");
      return;
    }

    try {
      // Use o hook para criar a oficina
      const newOficina = await createOficina({
        razao_social: formData.oficina_nome,
        telefone: formData.oficina_contato || null,
        mecanico_responsavel: formData.mecanico_responsavel || null,
      });

      if (!newOficina) return null;

      // Atualizar estado com a nova oficina
      set("oficina_id", newOficina.id);
      setOficinas([...oficinas, newOficina]);
      setCreateNewOficina(false);

      return newOficina.id;
    } catch (error: any) {
      console.error("Erro ao criar oficina:", error);
      toast.error(error.message || "Erro ao criar oficina");
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.numero || !formData.tipo_manutencao) {
      toast.error("Número e tipo de manutenção são obrigatórios");
      return;
    }
    if (!formData.oficina_nome) {
      toast.error("Nome da oficina é obrigatório");
      return;
    }

    setLoading(true);
    try {
      // Se é nova oficina, criar antes
      let oficinaId = formData.oficina_id;
      if (createNewOficina && !formData.oficina_id) {
        const newOficinaId = await createNewOficinAndAddOrder();
        if (!newOficinaId) {
          setLoading(false);
          return;
        }
        oficinaId = newOficinaId;
      }

      const payload = {
        aircraft_id: aircraftId,
        numero: formData.numero,
        os_oficina: formData.os_oficina || null,
        tipo_manutencao: formData.tipo_manutencao,
        horas_celula: formData.horas_celula ? parseFloat(formData.horas_celula) : null,
        periodo: formData.periodo || null,
        periodo_inicio: formData.periodo_inicio || null,
        periodo_fim: formData.periodo_fim || null,
        tipo_rateio: formData.tipo_rateio || "HORAS",
        oficina_nome: formData.oficina_nome,
        oficina_contato: formData.oficina_contato || null,
        mecanico_responsavel: formData.mecanico_responsavel || null,
        data_entrada: formData.data_entrada || null,
        data_saida: formData.data_saida || null,
        dias_previstos: formData.dias_previstos ? parseInt(formData.dias_previstos) : null,
        dias_efetivos: formData.dias_efetivos ? parseInt(formData.dias_efetivos) : null,
        status: formData.status,
        approval_status: formData.approval_status,
        rejection_reason: formData.rejection_reason || null,
        vencimento_id: formData.vencimento_id || null,
        objetivo: formData.objetivo || null,
        observacoes: formData.observacoes || null,
      };

      let data;
      let error;

      if (editingOrder) {
        // Modo edição - UPDATE
        const { data: updated, error: err } = await supabase
          .from("ctm_service_orders")
          .update(payload)
          .eq("id", editingOrder.id)
          .select()
          .single();
        data = updated;
        error = err;
      } else {
        // Modo novo - INSERT
        const { data: inserted, error: err } = await supabase
          .from("ctm_service_orders")
          .insert([payload])
          .select()
          .single();
        data = inserted;
        error = err;
      }

      if (error) throw error;

      // Sync: manutencoes (somente para criação nova)
      if (data && !editingOrder) {
        const { error: me } = await supabase.from("manutencoes").insert([{
          aeronave_id: aircraftId,
          tipo: formData.tipo_manutencao,
          data_programada: formData.data_entrada,
          mecanico: formData.mecanico_responsavel || "A designar",
          etapa: "em_andamento",
          oficina: formData.oficina_nome || null,
          observacoes: formData.observacoes || null,
          vencimento_tipo: "horas",
          vencimento_horas: formData.horas_celula ? parseFloat(formData.horas_celula) : null,
        }]);
        if (me) console.error("Sync manutencoes:", me);

        // Sync: aircraft_maintenance_records
        const mapType = (tipo: string, horas?: number) => {
          if (tipo.includes("50")) return "50h";
          if (tipo.includes("100")) return "100h";
          if (horas && horas <= 50) return "50h";
          return "100h";
        };
        const ph = formData.horas_celula ? parseFloat(formData.horas_celula) : 0;
        const { error: re } = await supabase.from("aircraft_maintenance_records").insert([{
          aircraft_id: aircraftId,
          maintenance_type: mapType(formData.tipo_manutencao, ph),
          performed_at_hours: ph,
          performed_date: formData.data_entrada,
          next_due_hours: ph + 50,
          mechanic_name: formData.mecanico_responsavel || "A designar",
          maintenance_center: formData.oficina_nome || null,
          service_order_number: formData.numero || null,
          description: formData.observacoes || null,
        }]);
        if (re) console.error("Sync aircraft_maintenance_records:", re);
      }

      const action = editingOrder ? "atualizada" : "registrada";
      toast.success(`O.A.S nº ${formData.numero} ${action} com sucesso!`);
      onServiceOrderCreated?.(data as unknown as CTMServiceOrder);
      onBack();
    } catch (error: any) {
      console.error("Erro ao registrar O.A.S:", error);
      toast.error(error.message || "Erro ao registrar Ordem de Serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} disabled={loading}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none">
                {editingOrder ? "Editar Ordem de Acompanhamento de Serviço" : "Nova Ordem de Acompanhamento de Serviço"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aeronave:{" "}
                <span className="font-semibold text-primary">{aircraftRegistration}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Plane className="h-3 w-3" />
              {aircraftRegistration}
            </Badge>
            <Button variant="outline" onClick={onBack} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="gap-2 min-w-[180px]">
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {editingOrder ? "Atualizando..." : "Registrando..."}
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4" />
                  {editingOrder ? "Atualizar O.A.S" : "Registrar O.A.S"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* 1 · Identificação */}
        <Section icon={Hash} title="O.A.S">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Número da O.A.S" required>
              <Input
                placeholder="Ex: OAS-2026-001"
                value={formData.numero}
                onChange={(e) => set("numero", e.target.value)}
                required
              />
             </Field>
            <Field label="Tipo de Manutenção" required>
              <Select value={formData.tipo_manutencao} onValueChange={(v) => set("tipo_manutencao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
             
          <Field label="HORAS DE CÉLULA">
            <Input
              type="number"
              placeholder="Ex: 1001.1"
              value={formData.horas_celula}
              onChange={(e) => set("horas_celula", e.target.value)}
              min="0"
              step="any"
            />
          </Field>
          <Field label="PERÍODO">
            <Input
              type="text"
              placeholder="corretiva"
              value={formData.periodo}
              onChange={(e) => set("periodo", e.target.value)}
             
            />
          </Field>
          </div>
        </Section>

        {/* 2 · Oficina */}
        <Section icon={Building2} title="Dados da Oficina">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Oficina" required>
              <SearchableCombobox
                items={oficinas.map(o => ({ id: o.id, label: o.razao_social }))}
                value={formData.oficina_id}
                onChange={handleOficinaSelect}
                placeholder="Selecionar oficina..."
                searchPlaceholder="Buscar oficina..."
                emptyMessage="Nenhuma oficina encontrada"
                disabled={loadingOficinas}
                allowFreeText={true}
              />
            </Field>
            <Field label="Contato / Telefone">
              <Input
                placeholder="Ex: (11) 98765-4321"
                value={formData.oficina_contato}
                onChange={(e) => set("oficina_contato", e.target.value)}
              />
            </Field>
            <Field label="Mecânico Responsável">
              <Input
                placeholder="Nome do mecânico"
                value={formData.mecanico_responsavel}
                onChange={(e) => set("mecanico_responsavel", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 3 · Datas */}
        <Section icon={CalendarRange} title="Datas">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Field label="Data de Entrada" required>
              <Input
                type="date"
                value={formData.data_entrada}
                onChange={(e) => set("data_entrada", e.target.value)}
                required
              />
            </Field>
            <Field label="Data de Saída (Prevista)">
              <Input
                type="date"
                value={formData.data_saida}
                onChange={(e) => set("data_saida", e.target.value)}
              />
            </Field>
          </div>
        </Section>

      {/* 4 · Duração e Horas */}
      <Section icon={Clock4} title="Duração ">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Field label="Dias Previstos">
            <Input
              type="number"
              placeholder="Ex: 5"
              value={formData.dias_previstos}
              onChange={(e) => set("dias_previstos", e.target.value)}
              min="0"
              step="1"
            />
          </Field>
        </div>
      </Section>

      {/* 6 · Detalhes */}
        <Section icon={FileText} title="Detalhes da Manutenção">
          <div className="grid grid-cols-1 gap-5">
            <Field label="Objetivo">
              <Input
                placeholder="Ex: Substituição de bateria"
                value={formData.objetivo}
                onChange={(e) => set("objetivo", e.target.value)}
              />
            </Field>
            <Field label="Observações">
              <Textarea
                placeholder="Adicione observações relevantes..."
                value={formData.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={4}
              />
            </Field>
          </div>
        </Section>

        {/* Bottom submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
          <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 min-w-[200px]">
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {editingOrder ? "Atualizando..." : "Registrando..."}
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" />
                {editingOrder ? "Atualizar O.A.S" : "Registrar O.A.S"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}