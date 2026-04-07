import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { ControlledSelect, SelectItem as ControlledSelectItem } from "@/components/ui/controlled-select";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Trash2, Save, Send, Upload, Eye, FileText,
  AlertTriangle, CalendarIcon, Building2, Plane, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClientes } from "@/hooks/useClientes";
import { useAeronaves } from "@/hooks/useAeronaves";
import { useTripulantes } from "@/hooks/useTripulantes";
import {
  calculateReportTotals,
  getValidExpenses,
} from "@/lib/travelReportUtils";
import { validateReceiptFile } from "@/lib/receiptUtils";
import type { TravelReportDraft } from "@/lib/travelReportDraft";
import { ReceiptPreviewModal } from "./ReceiptPreviewModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXPENSE_CATEGORIES = [
  "Combustível",
  "Hospedagem",
  "Alimentação",
  "Transporte",
  "Outros",
];

// ---------------------------------------------------------------------------
// Types — campos alinhados com colunas reais da tabela travel_expense_reports
// ---------------------------------------------------------------------------
export interface Expense {
  id?: string;
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  expense_date?: string;
}

export interface TravelReport {
  // PK
  id?: string;
  numero_relatorio: string;

  // FKs
  clientes_id: string;
  socios_cliente_id?: string | null;
  aeronave_id: string;
  matricula_aeronave: string;       // coluna: matricula_aeronave
  tripulacao_id: string;            // FK → tripulacao.id (crew 1)
  nome_tripulante: string;          // coluna: nome_tripulante
  tripulante_id2?: string | null;   // FK → membros_tripulacao.id (crew 2)
  nome_tripulante_2?: string | null; // coluna: nome_tripulante_2

  rota: string;
  data_inicio: string;              // yyyy-MM-dd
  data_fim: string;                 // yyyy-MM-dd
  dias_count: number;
  observacoes: string;

  // Despesas — salvas como JSON text na coluna `despesas`
  expenses: Expense[];

  // Totais — colunas reais da tabela
  total_valor: number;
  total_combustivel: number;
  total_hospedagem: number;
  total_alimentacao: number;
  total_transporte: number;
  total_outros: number;
  total_tripulacao: number;
  total_trip: number;       // crew 1
  total_trip2: number;      // crew 2
  total_clientes: number;
  total_sharebrasil: number;

  status: "Rascunho" | "Finalizado" | "Enviado";

  // Helpers de exibição (não persistidos diretamente)
  client?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TravelReportFormProps {
  report?: TravelReport | null;
  onSave: (report: TravelReport, status: "Rascunho" | "Finalizado") => Promise<void>;
  onCancel: () => void;
  onAutoSave?: (report: TravelReportDraft) => void;
  showPartnerModal?: () => void;
  onReceiptView?: (url: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const emptyReport = (): TravelReport => ({
  numero_relatorio: "R-0001",
  clientes_id: "",
  socios_cliente_id: null,
  aeronave_id: "",
  matricula_aeronave: "",
  tripulacao_id: "",
  nome_tripulante: "",
  tripulante_id2: null,
  nome_tripulante_2: null,
  rota: "",
  data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_fim: format(new Date(), "yyyy-MM-dd"),
  dias_count: 1,
  observacoes: "",
  expenses: [],
  total_valor: 0,
  total_combustivel: 0,
  total_hospedagem: 0,
  total_alimentacao: 0,
  total_transporte: 0,
  total_outros: 0,
  total_tripulacao: 0,
  total_trip: 0,
  total_trip2: 0,
  total_clientes: 0,
  total_sharebrasil: 0,
  status: "Rascunho",
});

const calculateDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diffMs = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const fmt = (val: number) =>
  `R$ ${val.toFixed(2).replace(".", ",")}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TravelReportForm({
  report,
  onSave,
  onCancel,
  onAutoSave,
  showPartnerModal,
  onReceiptView,
}: TravelReportFormProps) {
  const { clientes } = useClientes();
  const { aeronaves } = useAeronaves();
  const { tripulantes } = useTripulantes();

  const [current, setCurrent] = useState<TravelReport>(
    report ?? emptyReport()
  );
  const [partners, setPartners] = useState<
    { id?: string; nome: string; cpf?: string; index: number }[]
  >([]);
  const [showSecondCrew, setShowSecondCrew] = useState(
    !!current.nome_tripulante_2
  );
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [expenseDateOpenIndex, setExpenseDateOpenIndex] = useState<number | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ index: number; file: File } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | undefined>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>();

  // -------------------------------------------------------------------------
  // Side-effects
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (current.clientes_id) fetchPartnersForClient(current.clientes_id);
  }, [current.clientes_id]);

  useEffect(() => {
    if (!onAutoSave || current.id) return;
    onAutoSave(current as unknown as TravelReportDraft);
    const interval = setInterval(
      () => onAutoSave(current as unknown as TravelReportDraft),
      30_000
    );
    return () => clearInterval(interval);
  }, [current, onAutoSave]);

  useEffect(() => {
    if (!onAutoSave || current.id) return;
    const handler = () => onAutoSave(current as unknown as TravelReportDraft);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [current, onAutoSave]);

  // Recalcular totais sempre que expenses mudar
  useEffect(() => {
    const valid = getValidExpenses(current.expenses);
    const t = calculateReportTotals(valid);
    setCurrent((prev) => ({
      ...prev,
      total_valor: t.total_amount,
      total_combustivel: t.total_fuel,
      total_hospedagem: t.total_lodging,
      total_alimentacao: t.total_food,
      total_transporte: t.total_transport,
      total_outros: t.total_other,
      total_tripulacao: t.total_crew,
      total_trip: t.total_crew1,
      total_trip2: t.total_crew2,
      total_clientes: t.total_client,
      total_sharebrasil: t.total_sharebrasil,
    }));
  }, [current.expenses]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const set = <K extends keyof TravelReport>(field: K, value: TravelReport[K]) =>
    setCurrent((prev) => ({ ...prev, [field]: value }));

  const fetchPartnersForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("socios_cliente")
        .select("id, nome, cpf")
        .eq("cliente_id", clientId)
        .order("nome");
      if (error || !data) { setPartners([]); return; }
      setPartners(data.map((p: any, i: number) => ({ id: p.id, nome: p.nome, cpf: p.cpf, index: i })));
    } catch {
      setPartners([]);
    }
  };

  const handleExpenseChange = (index: number, field: keyof Expense, value: any) => {
    const next = [...current.expenses];
    next[index] = { ...next[index], [field]: value };
    set("expenses", next);
  };

  const addExpense = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setCurrent((prev) => ({
      ...prev,
      expenses: [
        { category: "", description: "", amount: 0, paid_by: "", expense_date: today },
        ...prev.expenses,
      ],
    }));
  };

  const removeExpense = (index: number) =>
    setCurrent((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index),
    }));

  // --- Upload com preview ---
  const handleFileUpload = (index: number, file: File | undefined) => {
    if (!file) return;
    const errors = validateReceiptFile(file, 10);
    if (errors.length > 0) {
      toast.error(`❌ Arquivo inválido:\n${errors.map((e: any) => e.message).join("\n")}`);
      return;
    }
    setPreviewFile({ index, file });
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(undefined);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
      setPreviewLoading(false);
    };
    reader.onerror = () => {
      setPreviewError("Erro ao ler arquivo");
      setPreviewLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePreviewConfirm = async () => {
    if (!previewFile) return;
    const { index, file } = previewFile;
    setPreviewOpen(false);
    setUploadingIndex(index);
    const toastId = toast.loading("📤 Enviando comprovante...");
    try {
      const ext = file.name.split(".").pop();
      const filePath = `receipts/${Date.now()}-${Math.random()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("travel-reports")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("travel-reports")
        .getPublicUrl(filePath);
      handleExpenseChange(index, "receipt_url", publicUrl);
      toast.success("✓ Comprovante enviado!", { id: toastId });
    } catch (error: any) {
      toast.error(`❌ Erro no upload: ${error?.message ?? "Tente novamente"}`, { id: toastId });
    } finally {
      setUploadingIndex(null);
      setPreviewFile(null);
      setPreviewImage(undefined);
    }
  };

  // --- Save ---
  const handleSave = async (status: "Rascunho" | "Finalizado") => {
    if (status === "Finalizado" && current.status !== "Rascunho") {
      toast.error("⚠️ Este relatório já foi finalizado. Não é possível finalizá-lo novamente.");
      return;
    }
    if (!current.clientes_id) {
      toast.error("⚠️ Preencha o campo obrigatório: Cliente");
      return;
    }
    if (!current.aeronave_id) {
      toast.error("⚠️ Preencha o campo obrigatório: Aeronave");
      return;
    }
    if (!current.rota?.trim()) {
      toast.error("⚠️ Preencha o campo obrigatório: Trecho");
      return;
    }
    if (!current.tripulacao_id && !current.nome_tripulante?.trim()) {
      toast.error("⚠️ Preencha o campo obrigatório: Tripulante 1");
      return;
    }
    if (!current.data_inicio || !current.data_fim) {
      toast.error("⚠️ Preencha as datas de início e fim");
      return;
    }
    if (new Date(current.data_inicio) > new Date(current.data_fim)) {
      toast.error("⚠️ A data final deve ser igual ou posterior à data inicial");
      return;
    }
    if (status !== "Rascunho") {
      const valid = current.expenses.filter((e) => e.category && e.amount > 0);
      if (valid.length === 0) {
        toast.error("⚠️ Adicione pelo menos uma despesa válida");
        return;
      }
    }

    setIsSaving(true);
    try {
      const validExpenses = getValidExpenses(current.expenses);
      const t = calculateReportTotals(validExpenses);
      const reportToSave: TravelReport = {
        ...current,
        dias_count: calculateDays(current.data_inicio, current.data_fim),
        expenses: validExpenses,
        total_valor: t.total_amount,
        total_combustivel: t.total_fuel,
        total_hospedagem: t.total_lodging,
        total_alimentacao: t.total_food,
        total_transporte: t.total_transport,
        total_outros: t.total_other,
        total_tripulacao: t.total_crew,
        total_trip: t.total_crew1,
        total_trip2: t.total_crew2,
        total_clientes: t.total_client,
        total_sharebrasil: t.total_sharebrasil,
        status,
      };
      await onSave(reportToSave, status);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Regras */}
      <Alert className="border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100/50 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <AlertTitle className="text-amber-900 font-bold text-base">
              Regras para Lançamento de Despesas
            </AlertTitle>
            <AlertDescription className="text-amber-700/80 mt-3 space-y-2 leading-relaxed">
              <ul className="list-disc list-inside space-y-2">
                <li>É obrigatório anexar o comprovante de pagamento para cada despesa.</li>
                <li>Cupons de crédito não são aceitos como comprovante de pagamento.</li>
                <li>Não serão reembolsadas despesas com bebidas alcoólicas.</li>
              </ul>
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Informações da Viagem */}
      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold">Informações da Viagem</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Cliente */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Cliente *</Label>
              <SearchableCombobox
                items={clientes.map((c) => ({ id: c.id, label: c.razao_social || "" }))}
                value={current.clientes_id}
                onChange={(id, label) => {
                  setCurrent((prev) => ({
                    ...prev,
                    clientes_id: id,
                    client: label,
                    socios_cliente_id: null,
                  }));
                  fetchPartnersForClient(id);
                }}
                icon={<Building2 className="h-4 w-4" />}
                placeholder="Selecione um cliente..."
                searchPlaceholder="Buscar cliente pelo nome..."
                emptyMessage="Nenhum cliente encontrado."
              />
              {partners.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Sócio</Label>
                  <ControlledSelect
                    value={current.socios_cliente_id || ""}
                    onValueChange={(val) => {
                      const sel = partners.find((p) => p.id === val);
                      if (sel) {
                        setCurrent((prev) => ({
                          ...prev,
                          socios_cliente_id: sel.id ?? null,
                          client: sel.nome,
                        }));
                      }
                    }}
                    placeholder="Selecione o sócio"
                  >
                    {partners.map((p) => (
                      <ControlledSelectItem key={p.id ?? p.index} value={p.id as string}>
                        {p.nome}
                      </ControlledSelectItem>
                    ))}
                  </ControlledSelect>
                </div>
              )}
              {current.clientes_id && (
                <p className="text-xs text-green-600">✓ Cliente selecionado</p>
              )}
              {current.socios_cliente_id && (
                <p className="text-xs text-amber-500">
                  👤 Sócio:{" "}
                  <span className="font-semibold">{current.client}</span>
                  {showPartnerModal && (
                    <button
                      type="button"
                      className="ml-1 underline text-amber-400 hover:text-amber-300"
                      onClick={showPartnerModal}
                    >
                      alterar
                    </button>
                  )}
                </p>
              )}
            </div>

            {/* Aeronave */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Aeronave *</Label>
              <SearchableCombobox
                items={
                  Array.isArray(aeronaves)
                    ? aeronaves.map((a) => ({ id: a.id, label: a.matricula || "" }))
                    : []
                }
                value={current.aeronave_id}
                onChange={(id, label) => {
                  setCurrent((prev) => ({
                    ...prev,
                    aeronave_id: id,
                    matricula_aeronave: label,
                  }));
                }}
                icon={<Plane className="h-4 w-4" />}
                placeholder="Selecione a aeronave..."
                searchPlaceholder="Buscar por prefixo..."
                emptyMessage="Aeronave não encontrada."
              />
              {current.aeronave_id && (
                <p className="text-xs text-green-600">✓ Aeronave selecionada</p>
              )}
            </div>

            {/* Comandante */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Comandante *</Label>
              <SearchableCombobox
                items={tripulantes.map((t) => ({ id: t.id, label: t.nome_completo || "" }))}
                value={current.tripulacao_id}
                onChange={(id, label) => {
                  setCurrent((prev) => ({
                    ...prev,
                    tripulacao_id: id,
                    nome_tripulante: label,
                  }));
                }}
                icon={<User className="h-4 w-4" />}
                placeholder="Selecione o comandante..."
                searchPlaceholder="Buscar tripulante..."
                emptyMessage="Tripulante não encontrado."
                allowFreeText
              />
              {current.tripulacao_id && (
                <p className="text-xs text-green-600">✓ Tripulante selecionado</p>
              )}
            </div>

            {/* Toggle segundo tripulante */}
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showSecondCrew"
                  checked={showSecondCrew || !!current.nome_tripulante_2}
                  onCheckedChange={(checked) => {
                    setShowSecondCrew(!!checked);
                    if (!checked) {
                      setCurrent((prev) => ({
                        ...prev,
                        tripulante_id2: null,
                        nome_tripulante_2: null,
                      }));
                    }
                  }}
                />
                <Label htmlFor="showSecondCrew" className="cursor-pointer">
                  Adicionar Segundo Tripulante
                </Label>
              </div>
            </div>

            {/* Co-piloto */}
            {(showSecondCrew || current.nome_tripulante_2) && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Co-piloto</Label>
                <SearchableCombobox
                  items={tripulantes.map((t) => ({ id: t.id, label: t.nome_completo || "" }))}
                  value={current.tripulante_id2 || ""}
                  onChange={(id, label) => {
                    setCurrent((prev) => ({
                      ...prev,
                      tripulante_id2: id,
                      nome_tripulante_2: label,
                    }));
                  }}
                  icon={<User className="h-4 w-4" />}
                  placeholder="Selecione o co-piloto..."
                  searchPlaceholder="Buscar tripulante..."
                  emptyMessage="Tripulante não encontrado."
                  allowFreeText
                />
              </div>
            )}

            {/* Rota */}
            <div className="space-y-2">
              <Label>Trecho (Ex: SBPF-SBGR) *</Label>
              <Input
                value={current.rota}
                onChange={(e) => set("rota", e.target.value)}
                placeholder="Trecho"
              />
            </div>

            {/* Data início */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Data Início *</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">
                      {current.data_inicio
                        ? format(new Date(current.data_inicio + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={current.data_inicio ? new Date(current.data_inicio + "T00:00:00") : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      const formatted = format(date, "yyyy-MM-dd");
                      setCurrent((prev) => ({
                        ...prev,
                        data_inicio: formatted,
                        data_fim:
                          prev.data_fim && new Date(formatted) > new Date(prev.data_fim)
                            ? formatted
                            : prev.data_fim,
                      }));
                      setStartDateOpen(false);
                    }}
                    disabled={(d) => d > new Date()}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data fim */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Data Fim *</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">
                      {current.data_fim
                        ? format(new Date(current.data_fim + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                  <UICalendar
                    mode="single"
                    selected={current.data_fim ? new Date(current.data_fim + "T00:00:00") : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      const formatted = format(date, "yyyy-MM-dd");
                      if (current.data_inicio && new Date(formatted) < new Date(current.data_inicio)) {
                        toast.error("A data final deve ser igual ou posterior à data inicial");
                        return;
                      }
                      set("data_fim", formatted);
                      setEndDateOpen(false);
                    }}
                    disabled={(d) =>
                      d > new Date() ||
                      (current.data_inicio ? d < new Date(current.data_inicio + "T00:00:00") : false)
                    }
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Badge de duração */}
            {current.data_inicio && current.data_fim && (
              <div className="md:col-span-2">
                <div className="text-sm font-semibold p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-lg">
                  <span className="text-green-700">
                    ✓ Duração:{" "}
                    <strong className="text-lg text-green-600">
                      {calculateDays(current.data_inicio, current.data_fim)}
                    </strong>{" "}
                    dia{calculateDays(current.data_inicio, current.data_fim) > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold">Observações</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            value={current.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
            className="h-32 rounded-lg border-border/50 focus-visible:ring-2 focus-visible:ring-primary resize-none"
            placeholder="Adicione observações importantes sobre a viagem ou despesas..."
          />
        </CardContent>
      </Card>

      {/* Despesas */}
      <Card className="shadow-md rounded-xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-border/30">
          <CardTitle className="text-xl font-bold">Despesas da Viagem</CardTitle>
          <Button
            onClick={addExpense}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Despesa
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {current.expenses.map((expense, index) => (
            <div
              key={expense.id ?? index}
              className="border border-border/50 p-5 rounded-xl bg-card/50 shadow-sm hover:shadow-md transition-all duration-200 relative"
            >
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </span>
                Item de Despesa
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Categoria */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Categoria *</Label>
                  <ControlledSelect
                    value={expense.category}
                    onValueChange={(v) => handleExpenseChange(index, "category", v)}
                    placeholder="Selecione"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <ControlledSelectItem key={cat} value={cat}>
                        {cat}
                      </ControlledSelectItem>
                    ))}
                  </ControlledSelect>
                </div>

                {/* Data da despesa */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Data da Despesa</Label>
                  <Popover
                    open={expenseDateOpenIndex === index}
                    onOpenChange={(open) => setExpenseDateOpenIndex(open ? index : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-11 rounded-lg border-border/50"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">
                          {expense.expense_date
                            ? format(new Date(expense.expense_date + "T00:00:00"), "dd/MM", { locale: ptBR })
                            : "Data"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                      <UICalendar
                        mode="single"
                        selected={expense.expense_date ? new Date(expense.expense_date + "T00:00:00") : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          handleExpenseChange(index, "expense_date", format(date, "yyyy-MM-dd"));
                          setExpenseDateOpenIndex(null);
                        }}
                        disabled={(d) => d > new Date()}
                        locale={ptBR}
                        defaultMonth={
                          expense.expense_date
                            ? new Date(expense.expense_date + "T00:00:00")
                            : new Date()
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expense.amount}
                    onChange={(e) =>
                      handleExpenseChange(index, "amount", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="h-11 rounded-lg border-border/50 font-mono"
                  />
                </div>

                {/* Pago por */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Pago Por *</Label>
                  <ControlledSelect
                    value={expense.paid_by}
                    onValueChange={(v) => handleExpenseChange(index, "paid_by", v)}
                    placeholder="Selecione"
                  >
                    <ControlledSelectItem value="Tripulante 1">
                      {current.nome_tripulante
                        ? `T1 (${current.nome_tripulante.split(" ")[0]})`
                        : "Tripulante 1"}
                    </ControlledSelectItem>
                    {(showSecondCrew || current.nome_tripulante_2) && (
                      <ControlledSelectItem value="Tripulante 2">
                        {current.nome_tripulante_2
                          ? `T2 (${current.nome_tripulante_2.split(" ")[0]})`
                          : "Tripulante 2"}
                      </ControlledSelectItem>
                    )}
                    <ControlledSelectItem value="Cliente">Cliente</ControlledSelectItem>
                    <ControlledSelectItem value="ShareBrasil">ShareBrasil</ControlledSelectItem>
                  </ControlledSelect>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Descrição */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Descrição Detalhada</Label>
                  <Input
                    value={expense.description}
                    onChange={(e) => handleExpenseChange(index, "description", e.target.value)}
                    placeholder="Breve descrição"
                    className="h-11 rounded-lg border-border/50"
                  />
                </div>

                {/* Comprovante */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Comprovante</Label>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`receipt-upload-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 px-3 h-11 border border-border/50 rounded-lg hover:bg-accent/50 transition-all duration-200">
                        {uploadingIndex === index ? (
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        ) : expense.receipt_url ? (
                          <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">
                          {expense.receipt_url ? "Anexado" : "Enviar"}
                        </span>
                      </div>
                    </label>
                    <input
                      id={`receipt-upload-${index}`}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(index, e.target.files?.[0])}
                      disabled={uploadingIndex !== null}
                    />
                    {expense.receipt_url && onReceiptView && (
                      <button
                        onClick={() => onReceiptView(expense.receipt_url!)}
                        className="p-2 rounded-lg hover:bg-accent transition-all duration-200"
                        title="Ver Comprovante"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Remover despesa */}
              <button
                onClick={() => removeExpense(index)}
                className="absolute top-4 right-4 text-destructive/60 hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-all duration-200"
                title="Remover Despesa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Botões de ação */}
      <div className="flex gap-4 flex-wrap">
        <Button
          onClick={() => handleSave("Rascunho")}
          disabled={isSaving}
          variant="outline"
          className="rounded-lg border-border/50 hover:bg-accent"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar Rascunho"}
        </Button>
        <Button
          onClick={() => handleSave("Finalizado")}
          disabled={isSaving}
          size="lg"
          className="flex-1 md:flex-initial bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg font-semibold"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSaving ? "Salvando..." : "Finalizar Relatório"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border-border/50 hover:bg-accent"
        >
          Voltar
        </Button>
      </div>

      {/* Resumo de totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por pagador */}
        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6 border-b border-border/30">
            <CardTitle className="text-lg font-bold">Por Pagador</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tripulante 1</span>
                <span className="font-semibold font-mono">{fmt(current.total_trip)}</span>
              </div>
              {(showSecondCrew || current.nome_tripulante_2) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tripulante 2</span>
                  <span className="font-semibold font-mono">{fmt(current.total_trip2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-semibold font-mono">{fmt(current.total_clientes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ShareBrasil</span>
                <span className="font-semibold font-mono">{fmt(current.total_sharebrasil)}</span>
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-border/30">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-lg text-green-600 font-mono">{fmt(current.total_valor)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por categoria */}
        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6 border-b border-border/30">
            <CardTitle className="text-lg font-bold">Por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {(
                [
                  ["Combustível", current.total_combustivel],
                  ["Hospedagem", current.total_hospedagem],
                  ["Alimentação", current.total_alimentacao],
                  ["Transporte", current.total_transporte],
                  ["Outros", current.total_outros],
                ] as [string, number][]
              ).map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold font-mono">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 mt-3 border-t border-border/30">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-lg text-green-600 font-mono">{fmt(current.total_valor)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observações resumo */}
        {current.observacoes?.trim() && (
          <Card className="shadow-md rounded-xl border-border/50 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <CardHeader className="p-6 border-b border-border/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <span>📝</span> Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {current.observacoes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de preview do comprovante */}
      <ReceiptPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
          setPreviewImage(undefined);
          setPreviewError(undefined);
        }}
        onConfirm={handlePreviewConfirm}
        imageUrl={previewImage}
        fileName={previewFile?.file.name}
        isLoading={previewLoading}
        error={previewError}
      />
    </div>
  );
}