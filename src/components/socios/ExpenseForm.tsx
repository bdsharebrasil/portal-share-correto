import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Receipt,
  Plus,
  ChevronRight,
  ArrowLeft,
  Fuel,
  CalendarIcon,
  UserPlus,
  Landmark,
} from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { useCreateExpense } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { useClientAbastecimentos } from "@/hooks/useAbastecimentos";
import { useAircraftMaintenances, useCreateMaintenanceExpense } from "@/hooks/useMaintenanceExpenses";
import { useFornecedoresFavoritos } from "@/hooks/useFornecedoresFavoritos";
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { AddFornecedorDialog } from "@/components/fiscal/contas-pagar/AddFornecedorDialog";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF } from "@/lib/formatters";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { generateReportNumber } from "@/lib/travelReportUtils";
import toast from "../ui/modern-toast";

// ─── Categorias ───────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { id: "ABASTECIMENTO", label: "ABASTECIMENTO", icon: "⛽" },
  { id: "ASSINATURAS", label: "Assinaturas", icon: "📋" },
  { id: "ATENDIMENTO_PISTA", label: "Atendimento de Pista", icon: "🛬" },
  { id: "COMPRAS", label: "Compras / Aquisições", icon: "🛒" },
  { id: "CONTABILIDADE", label: "Honorários Contabilidade", icon: "📊" },
  { id: "DECEA", label: "DECEA", icon: "🛬" },
  { id: "DESPESA_VIAGEM", label: "Despesas de Viagem", icon: "🧳" },
  { id: "HANGAR", label: "Hangaragem", icon: "🏠" },
  { id: "INFRAERO", label: "INFRAERO", icon: "🛬" },
  { id: "MANUTENCAO", label: "Manutenção", icon: "🔧" },
  { id: "OUTROS", label: "Outros", icon: "📎" },
  { id: "POUSO_DECOLAGEM", label: "Tarifa de Pouso/Decolagem", icon: "✈️" },
  { id: "REEMBOLSO", label: "Ressarcimento/Reembolso", icon: "💸" },
  { id: "TAXAS_BANCO", label: "TARIFAS BANCARIAS", icon: "🏦" },
] as const;

export const IMPOSTOS_SUBTYPES = [
  { value: "fgts", label: "FGTS" },
  { value: "inss", label: "INSS" },
  { value: "pis", label: "PIS" },
  { value: "cofins", label: "COFINS" },
  { value: "das", label: "DAS" },
  { value: "irpj", label: "IRPJ" },
  { value: "csll", label: "CSLL" },
  { value: "iss", label: "ISS" },
  { value: "outros_impostos", label: "Outros Impostos" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

const EMPTY_FORM = {
  description: "",
  totalAmount: "",
  category: "" as ExpenseCategoryId | "",
  expenseType: "",
  assignedPartnerCpf: "none",
  paidDate: format(new Date(), "yyyy-MM-dd"),
  dueDate: format(new Date(), "yyyy-MM-dd"),
  supplierName: "",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "nao_informado",
  notes: "",
  status: "pago",
  abastecimentoId: "",
  criarNovoAbastecimento: false,
  // Campos para novo abastecimento
  novoAbastData: format(new Date(), "yyyy-MM-dd"),
  novoAbastLocal: "",
  novoAbastLitros: "",
  // Não incluir valor unitário - será calculado a partir do totalAmount
  bankName: "",
  prazo: "extra" as "mensal" | "extra",
  isInstallment: false,
  installmentCount: "1",
  installmentStartDate: format(new Date(), "yyyy-MM-dd"),
};

const BANK_EXPENSE_CATEGORIES = [
  { id: "cartao_credito", label: "Cartão de Crédito", icon: "💳" },
  { id: "anuidade_cartao", label: "Anuidade de Cartão", icon: "📅" },
  { id: "taxas_bancarias", label: "Taxas Bancárias", icon: "🏦" },
  { id: "tarifa_manutencao", label: "Tarifa de Manutenção de Conta", icon: "📋" },
  { id: "iof", label: "IOF", icon: "📊" },
  { id: "ted_doc", label: "Tarifa TED/DOC", icon: "🔁" },
  { id: "juros_bancarios", label: "Juros Bancários", icon: "📈" },
  { id: "seguros_banco", label: "Seguros Bancários", icon: "🛡️" },
  { id: "outras_taxas_banco", label: "Outras Taxas Bancárias", icon: "📎" },
] as const;

type BankExpenseCategoryId = (typeof BANK_EXPENSE_CATEGORIES)[number]["id"];

const EMPTY_BANK_FORM = {
  category: "" as BankExpenseCategoryId | "",
  description: "",
  amount: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
  notes: "",
  prazo: "mensal" as "mensal" | "extra",
  assignMode: "geral" as "geral" | "rateio" | "socio",
  assignedPartnerCpf: "none",
};

interface ExpenseFormProps {
  clienteId: string;
}

export function ExpenseForm({ clienteId }: ExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"expense" | "bank">("expense");
  const [form, setForm] = useState(EMPTY_FORM);
  const [bankForm, setBankForm] = useState(EMPTY_BANK_FORM);
  const [showAddFornecedor, setShowAddFornecedor] = useState(false);
  const [showAddFuelSupplier, setShowAddFuelSupplier] = useState(false);
  const [newFuelSupplier, setNewFuelSupplier] = useState({ supplier_name: '', city_name: '', icao_code: '' });
  const [savingFuelSupplier, setSavingFuelSupplier] = useState(false);
  const queryClient = useQueryClient();

  // Travel report linking states
  const [linkOption, setLinkOption] = useState<"existing" | "new" | null>(null);
  const [existingReports, setExistingReports] = useState<
    Array<{ id: string; report_number: string; status: string }>
  >([]);
  const [selectedReport, setSelectedReport] = useState<{
    id: string;
    report_number: string;
    status: string;
  } | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Maintenance linking states
  const [selectedManutencaoId, setSelectedManutencaoId] = useState<string>("");
  const [manutencaoTipoRateio, setManutencaoTipoRateio] = useState<"igual" | "por_uso" | "manual">("igual");
  const [manualRateios, setManualRateios] = useState<Record<string, number>>({});

  const addExpense = useCreateExpense(false);
  const createMaintenanceExpense = useCreateMaintenanceExpense();
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);
  const { data: abastecimentos = [] } = useClientAbastecimentos(clienteId);
  const { data: fornecedoresFavoritos = [] } = useFornecedoresFavoritos();
  const { data: fuelSuppliers = [] } = useFuelSuppliers();
  const { data: contasBancarias = [], isLoading: loadingContas } = useContasBancarias();

  // Fetch aircraft ID for this client
  const [clientAircraftId, setClientAircraftId] = useState<string | null>(null);
  useEffect(() => {
    const fetchAircraft = async () => {
      const { data } = await supabase
        .from("client_aircraft")
        .select("aircraft_id")
        .eq("client_id", clienteId)
        .limit(1)
        .single();
      setClientAircraftId(data?.aircraft_id || null);
    };
    if (clienteId) fetchAircraft();
  }, [clienteId]);

  const { data: manutencoes = [] } = useAircraftMaintenances(clientAircraftId);

  // Filtrar apenas fornecedores da categoria 'share'
  const fornecedoresShare = fornecedoresFavoritos.filter((f) => f.categoria === "share");

  const set =
    (key: keyof typeof EMPTY_FORM) => (value: string | boolean) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  // Fetch aircraft_id for this client
  const getAircraftId = async (): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from("client_aircraft")
        .select("aircraft_id")
        .eq("client_id", clienteId)
        .limit(1)
        .single();
      return data?.aircraft_id || null;
    } catch {
      return null;
    }
  };

  // helper to get partner object from CPF
  const assignedPartner =
    form.assignedPartnerCpf && form.assignedPartnerCpf !== "none"
      ? partners.find((p) => p.cpf === form.assignedPartnerCpf)
      : null;

  // when category changes, reset link states
  useEffect(() => {
    if (form.category !== "DESPESA_VIAGEM") {
      setLinkOption(null);
      setExistingReports([]);
      setSelectedReport(null);
    }
    if (form.category !== "MANUTENCAO") {
      setSelectedManutencaoId("");
      setManutencaoTipoRateio("igual");
      setManualRateios({});
    }
  }, [form.category]);

  // when the user chooses to link existing and we have a partner, fetch reports
  useEffect(() => {
    const fetchReportsForPartner = async (partnerId: string) => {
      setLoadingReports(true);
      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select("id, report_number, status")
        .eq("client_partner", partnerId)
        .in("status", ["Finalizado", "Rascunho", "Enviado"])
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Erro ao carregar relatórios para sócio:", error);
        setExistingReports([]);
      } else {
        setExistingReports(data || []);
      }
      setLoadingReports(false);
    };

    if (linkOption === "existing" && assignedPartner?.id) {
      fetchReportsForPartner(assignedPartner.id);
    }
  }, [linkOption, assignedPartner?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.totalAmount || !form.category) return;

    if (form.category === "DESPESA_VIAGEM" && linkOption === "existing" && !selectedReport) {
      toast.error("Selecione um relatório de viagem para vincular");
      return;
    }

    const assignedPartnerCpf =
      form.assignedPartnerCpf === "none" ? null : form.assignedPartnerCpf;

    // Resolve bank name from ID
    const selectedConta = contasBancarias.find((c) => c.id === form.bankName);
    const bankNameResolved = selectedConta ? selectedConta.banco : form.bankName || null;

    // Fetch aircraft_id
    const aircraftId = await getAircraftId();

    // Determine reference information for travel report linking
    let referenceType: string | null = null;
    let referenceId: string | null = null;

    if (form.category === "DESPESA_VIAGEM") {
      if (linkOption === "existing" && selectedReport) {
        referenceType = "travel_report";
        referenceId = selectedReport.id;
      } else if (linkOption === "new") {
        try {
          const { data: clientData } = await supabase
            .from("clients")
            .select("company_name")
            .eq("id", clienteId)
            .single();
          const clientName = clientData?.company_name || "";
          const reportNumber = await generateReportNumber(clientName);
          const today = format(new Date(), "yyyy-MM-dd");
          const expenseItem = {
            category: selectedCategory?.label || "Desconhecido",
            description: form.description,
            amount: parseFloat(form.totalAmount),
            paid_by: "Cliente",
            expense_date: today,
          };
          const { data: newReport, error: newReportError } = await supabase
            .from("travel_expense_reports")
            .insert({
              client_id: clienteId,
              client_partner: assignedPartner?.id || null,
              report_number: reportNumber,
              start_date: today,
              end_date: today,
              days_count: 1,
              status: "Rascunho",
              expenses: JSON.stringify([expenseItem]),
            })
            .select()
            .single();
          if (newReportError) throw newReportError;
          referenceType = "travel_report";
          referenceId = newReport.id;
        } catch (err) {
          console.error("Erro ao criar novo relatório de viagem:", err);
          toast.error("Erro ao criar relatório de viagem");
        }
      }
    }

    // ─── CRIAR NOVO ABASTECIMENTO SE NECESSÁRIO ───
    let abastecimentoId = form.abastecimentoId || null;

    if (form.category === "ABASTECIMENTO" && form.criarNovoAbastecimento) {
      if (!form.novoAbastLocal || !form.novoAbastLitros || !form.totalAmount) {
        toast.error("Preencha Local, Litros e Valor Total para criar novo abastecimento");
        return;
      }

      try {
        const litros = parseFloat(form.novoAbastLitros);
        const valorTotal = parseFloat(form.totalAmount);
        const valorUnitario = valorTotal / litros;

        const { data: newAbastecimento, error: abastError } = await supabase
          .from("abastecimentos")
          .insert({
            client_id: clienteId,
            aeronave_id: aircraftId || null,
            data: form.novoAbastData,
            trecho: form.description || "N/A",
            local: form.novoAbastLocal,
            litros: litros,
            valor_unitario: valorUnitario,
            valor_total: valorTotal,
            abastecedor: form.supplierName || null,
            partner_name: assignedPartner?.name || null,
            status_pagamento: form.status === "pago" ? "pago" : "pendente",
            data_pagamento: form.status === "pago" ? form.paidDate : null,
          })
          .select()
          .single();

        if (abastError) throw abastError;
        abastecimentoId = newAbastecimento.id;
      } catch (err: any) {
        console.error("Erro ao criar abastecimento:", err);
        toast.error("Erro ao criar novo abastecimento: " + err.message);
        return;
      }
    }

    const basePayload = {
      clientId: clienteId,
      description: form.description,
      totalAmount: parseFloat(form.totalAmount),
      category: form.category,
      expenseType: form.expenseType || form.category,
      dueDate: form.dueDate,
      supplierName: form.supplierName || null,
      invoiceNumber: form.invoiceNumber || null,
      invoiceUrl: form.invoiceUrl || null,
      paymentMethod:
        form.paymentMethod === "nao_informado" ? null : form.paymentMethod || null,
      notes: form.notes || null,
      bankName: bankNameResolved,
      prazo: form.prazo || "extra",
      isInstallment: form.isInstallment && form.paymentMethod === "cartao",
      installmentCount:
        form.isInstallment && form.paymentMethod === "cartao"
          ? parseInt(form.installmentCount)
          : 1,
      installmentStartDate:
        form.isInstallment && form.paymentMethod === "cartao"
          ? form.installmentStartDate
          : null,
      aircraftId,
      status: form.status,
      referenceType,
      referenceId,
      abastecimentoId: abastecimentoId,
    };

    // If no partner assigned, split equally among all partners
    if (!assignedPartnerCpf && partners.length > 1) {
      const splitAmount = parseFloat(form.totalAmount) / partners.length;
      const splitAmountRounded = Math.round(splitAmount * 100) / 100;

      for (const partner of partners) {
        await addExpense.mutateAsync({
          ...basePayload,
          totalAmount: splitAmountRounded,
          assignedPartnerCpf: partner.cpf,
          assignedPartnerName: partner.name,
        });
      }
    } else {
      await addExpense.mutateAsync({
        ...basePayload,
        assignedPartnerCpf,
        assignedPartnerName: assignedPartner?.name || null,
      });
    }

    // If MANUTENCAO category with a selected maintenance, create despesa_manutencao record
    if (form.category === "MANUTENCAO" && selectedManutencaoId) {
      try {
        const valor = parseFloat(form.totalAmount);
        let rateios: Array<{ clientPartnerId: string; percentual: number; valor: number }> = [];

        if (manutencaoTipoRateio === "igual" && partners.length > 0) {
          const pct = 100 / partners.length;
          const partVal = Math.round((valor / partners.length) * 100) / 100;
          rateios = partners.map((p) => ({
            clientPartnerId: p.id,
            percentual: Math.round(pct * 100) / 100,
            valor: partVal,
          }));
        } else if (manutencaoTipoRateio === "por_uso" && partners.length > 0) {
          // Use share_percentage or equal if not set
          const totalPct = partners.reduce((s, p) => s + (p.share_percentage || 0), 0);
          if (totalPct > 0) {
            rateios = partners.map((p) => {
              const pct = (p.share_percentage || 0) / totalPct * 100;
              return {
                clientPartnerId: p.id,
                percentual: Math.round(pct * 100) / 100,
                valor: Math.round((valor * pct / 100) * 100) / 100,
              };
            });
          } else {
            // Fallback to equal
            const pct = 100 / partners.length;
            rateios = partners.map((p) => ({
              clientPartnerId: p.id,
              percentual: Math.round(pct * 100) / 100,
              valor: Math.round((valor / partners.length) * 100) / 100,
            }));
          }
        } else if (manutencaoTipoRateio === "manual") {
          rateios = partners.map((p) => {
            const pct = manualRateios[p.id] || 0;
            return {
              clientPartnerId: p.id,
              percentual: pct,
              valor: Math.round((valor * pct / 100) * 100) / 100,
            };
          });
        }

        await createMaintenanceExpense.mutateAsync({
          manutencaoId: selectedManutencaoId,
          aircraftId: clientAircraftId,
          clientId: clienteId,
          descricao: form.description,
          valor,
          tipoRateio: manutencaoTipoRateio,
          rateios,
        });
      } catch (err) {
        console.error("Erro ao criar despesa de manutenção:", err);
      }
    }

    toast.success("Despesa criada com sucesso!");
    setOpen(false);
    setForm(EMPTY_FORM);
    setTab("expense");
    setLinkOption(null);
    setExistingReports([]);
    setSelectedReport(null);
    setSelectedManutencaoId("");
    setManutencaoTipoRateio("igual");
    setManualRateios({});
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.category || !bankForm.amount || !bankForm.description) return;

    const aircraftId = await getAircraftId();

    // Resolve bank name from ID
    const selectedConta = contasBancarias.find((c) => c.id === bankForm.bankName);
    const bankNameResolved = selectedConta ? selectedConta.banco : bankForm.bankName || null;

    const basePayload = {
      clientId: clienteId,
      description: bankForm.description,
      totalAmount: parseFloat(bankForm.amount),
      category: "despesa_bancaria",
      expenseType: bankForm.category,
      dueDate: bankForm.date,
      supplierName: bankNameResolved,
      notes: bankForm.notes || null,
      bankName: bankNameResolved,
      prazo: bankForm.prazo,
      aircraftId,
      status: "pago",
    };

    if (bankForm.assignMode === "rateio" && partners.length > 1) {
      const splitAmount = parseFloat(bankForm.amount) / partners.length;
      const splitAmountRounded = Math.round(splitAmount * 100) / 100;
      for (const partner of partners) {
        await addExpense.mutateAsync({
          ...basePayload,
          totalAmount: splitAmountRounded,
          assignedPartnerCpf: partner.cpf,
          assignedPartnerName: partner.name,
        });
      }
    } else if (bankForm.assignMode === "socio" && bankForm.assignedPartnerCpf !== "none") {
      const partner = partners.find((p) => p.cpf === bankForm.assignedPartnerCpf);
      await addExpense.mutateAsync({
        ...basePayload,
        assignedPartnerCpf: bankForm.assignedPartnerCpf,
        assignedPartnerName: partner?.name || null,
      });
    } else {
      await addExpense.mutateAsync({
        ...basePayload,
        assignedPartnerCpf: null,
        assignedPartnerName: null,
      });
    }

    toast.success("Despesa criada com sucesso!");
    setOpen(false);
    setBankForm(EMPTY_BANK_FORM);
    setTab("expense");
  };

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.id === form.category);
  const isAbastecimento = form.category === "ABASTECIMENTO";
  const isValid = !!form.description && !!form.totalAmount && !!form.category;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="gap-2 h-11 px-5 text-sm font-semibold rounded-xl
                       bg-red-600 hover:bg-red-500 text-white border-0
                       transition-all duration-200 hover:-translate-y-px hover:shadow-md"
          >
            <Receipt className="h-4 w-4" />
            Nova Despesa
          </Button>
        </DialogTrigger>

        <DialogContent
          className="
            w-full max-w-5xl
            max-h-[92vh] overflow-y-auto
            rounded-2xl border border-border/60
            bg-background/95 backdrop-blur-sm
            shadow-2xl p-0
          "
        >
          {/* ── Header ── */}
          <div className="relative px-8 pt-8 pb-6 border-b border-red-700/40 bg-gradient-to-br from-red-700 to-rose-800 rounded-t-2xl overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-full h-px bg-white/10" />
            </div>
            <DialogHeader className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                    Registrar Despesa
                  </DialogTitle>
                  <p className="text-sm text-red-100/80 mt-0.5">
                    Informe os dados da movimentação de saída
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── Body ── */}
          <div className="px-8 py-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "expense" | "bank")}>
              <TabsList className="w-full h-11 rounded-xl bg-muted/60 p-1 mb-8">
                <TabsTrigger
                  value="expense"
                  className="flex-1 gap-2 h-9 rounded-lg text-sm font-medium
                             data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                             data-[state=active]:shadow-sm data-[state=active]:text-red-700
                             dark:data-[state=active]:text-red-400 transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  Despesa
                </TabsTrigger>
                <TabsTrigger
                  value="bank"
                  className="flex-1 gap-2 h-9 rounded-lg text-sm font-medium
                             data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                             data-[state=active]:shadow-sm data-[state=active]:text-blue-700
                             dark:data-[state=active]:text-blue-400 transition-all"
                >
                  <Landmark className="h-4 w-4" />
                  Despesas Banco
                </TabsTrigger>
              </TabsList>

              {/* ── TAB: DESPESA NORMAL ── */}
              <TabsContent value="expense">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Sócio Responsável (único, no topo) ── */}
              <FormSection label="Sócio Responsável">
                <Select
                  value={form.assignedPartnerCpf}
                  onValueChange={set("assignedPartnerCpf")}
                  disabled={loadingPartners}
                >
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue
                      placeholder={
                        loadingPartners
                          ? "Carregando sócios..."
                          : "Atribuir a um sócio (opcional)"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none" className="py-3">
                      <span className="text-muted-foreground text-sm">— Sem atribuição —</span>
                    </SelectItem>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.cpf} className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                            {partner.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{partner.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatCPF(partner.cpf)}
                              {partner.share_percentage && ` · ${partner.share_percentage}%`}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSection>

              {/* ── Categoria ── */}
              <FormSection label="Categoria" required>
                <Select value={form.category} onValueChange={set("category")}>
                  <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                    <SelectValue placeholder="Selecione a categoria da despesa" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg leading-none">{cat.icon}</span>
                          <span className="font-medium text-sm">{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedCategory && (
                  <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mt-2 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800/50 dark:text-red-300">
                    <span className="text-base">{selectedCategory.icon}</span>
                    <span className="font-medium">{selectedCategory.label} selecionada</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                  </div>
                )}
              </FormSection>

              {/* ── Vincular Relatório de Viagem ── */}
              {form.category === "DESPESA_VIAGEM" && (
                <FormSection label="Deseja vincular a um relatório de viagem?">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      type="button"
                      variant={linkOption === "existing" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setLinkOption("existing")}
                      disabled={!assignedPartner?.id}
                    >
                      Vincular a relatório existente
                    </Button>
                    <Button
                      type="button"
                      variant={linkOption === "new" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setLinkOption("new")}
                    >
                      Iniciar novo relatório
                    </Button>
                  </div>

                  {!assignedPartner?.id && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selecione um sócio para vincular a um relatório existente.
                    </p>
                  )}

                  {linkOption === "existing" && (
                    <div className="mt-3">
                      <Select
                        value={selectedReport?.id || ""}
                        onValueChange={(v) => {
                          const found = existingReports.find((r) => r.id === v);
                          setSelectedReport(found || null);
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                          <SelectValue
                            placeholder={
                              loadingReports
                                ? "Carregando relatórios..."
                                : existingReports.length === 0
                                ? "Nenhum relatório encontrado para este sócio"
                                : "Selecione um relatório existente"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {existingReports.map((r) => (
                            <SelectItem key={r.id} value={r.id} className="py-3">
                              {r.report_number}
                              {r.status && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({r.status})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {linkOption === "new" && (
                    <p className="text-xs text-muted-foreground mt-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      Um novo relatório de viagem será criado em Rascunho com esta despesa vinculada.
                    </p>
                  )}
                </FormSection>
              )}

              {/* ── Abastecimento ── */}
              {isAbastecimento && (
                <div className="rounded-2xl bg-amber-950/40 border border-amber-700/50 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/60">
                      <Fuel className="h-4 w-4 text-amber-400" />
                    </div>
                    <p className="font-semibold text-sm text-amber-200">
                      Vincular com Abastecimento
                    </p>
                  </div>

                  {!form.criarNovoAbastecimento ? (
                    <>
                      <Select
                        value={form.abastecimentoId}
                        onValueChange={(v) => set("abastecimentoId")(v)}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-amber-700/50 bg-background text-foreground text-sm">
                          <SelectValue placeholder="Selecione um abastecimento registrado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {abastecimentos.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                              Nenhum abastecimento não pago
                            </div>
                          ) : (
                            abastecimentos.map((abast) => (
                              <SelectItem key={abast.id} value={abast.id} className="py-3">
                                <div className="text-sm space-y-0.5">
                                  <div>
                                    {format(new Date(abast.data), "dd/MM/yyyy")} · {abast.local}{" "}
                                    · R$ {Number(abast.valor_total).toFixed(2)}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex gap-2">
                                    {abast.comanda && <span>Comanda: {abast.comanda}</span>}
                                    {abast.partner_name && (
                                      <span>Sócio: {abast.partner_name}</span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2 text-amber-400 hover:bg-amber-900/30 rounded-xl h-10"
                        onClick={() => set("criarNovoAbastecimento")(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Criar novo abastecimento
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormSection label="Data do Abastecimento">
                          <Input
                            type="date"
                            value={form.novoAbastData}
                            onChange={(e) => set("novoAbastData")(e.target.value)}
                            className="h-12 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                            disabled={addExpense.isPending}
                          />
                        </FormSection>
                        <FormSection label="Local">
                          <Input
                            placeholder="Ex: Portimão, Portugal"
                            value={form.novoAbastLocal}
                            onChange={(e) => set("novoAbastLocal")(e.target.value)}
                            className="h-12 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                            disabled={addExpense.isPending}
                          />
                        </FormSection>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <FormSection label="Litros">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={form.novoAbastLitros}
                            onChange={(e) => set("novoAbastLitros")(e.target.value)}
                            className="h-12 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                            disabled={addExpense.isPending}
                          />
                        </FormSection>
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            💡 <strong>Valor Unitário:</strong> Será calculado automaticamente a partir do valor total da despesa e dos litros informados.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-xl h-10"
                        onClick={() => set("criarNovoAbastecimento")(false)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Usar abastecimento existente
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* ── Manutenção ── */}
              {form.category === "MANUTENCAO" && (
                <div className="rounded-2xl bg-muted/50 border border-border/60 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <span className="text-base">🔧</span>
                    </div>
                    <p className="font-semibold text-sm text-foreground">
                      Vincular com Manutenção
                    </p>
                  </div>

                  <Select value={selectedManutencaoId} onValueChange={setSelectedManutencaoId}>
                    <SelectTrigger className="h-12 rounded-xl border-border/60 text-sm">
                      <SelectValue placeholder="Selecione a manutenção da aeronave" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {manutencoes.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          Nenhuma manutenção encontrada
                        </div>
                      ) : (
                        manutencoes.map((m) => {
                          const formatDate = (dateStr: string) => {
                            try {
                              const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
                              return format(parsed, "dd/MM/yyyy", { locale: ptBR });
                            } catch {
                              return dateStr;
                            }
                          };

                          const formatStatus = (status: string) => {
                            return status
                              .toLowerCase()
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (char) => char.toUpperCase());
                          };

                          return (
                            <SelectItem key={m.id} value={m.id} className="py-3">
                              <div className="text-sm space-y-0.5">
                                <div className="font-medium">
                                  {m.tipo} {m.numero_os ? `(${m.numero_os})` : ""}
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                  <span>{formatDate(m.data_programada)}</span>
                                  <span>{formatStatus(m.etapa)}</span>
                                  {m.oficina && <span>• {m.oficina}</span>}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>

                  {selectedManutencaoId && (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tipo de Rateio
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "igual" as const, label: "Igual", desc: "Dividido igualmente" },
                          { value: "por_uso" as const, label: "Por Uso", desc: "Proporcional ao uso" },
                          { value: "manual" as const, label: "Manual", desc: "Definir percentuais" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setManutencaoTipoRateio(opt.value)}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all text-sm",
                              manutencaoTipoRateio === opt.value
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border/50 hover:border-border text-muted-foreground"
                            )}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {manutencaoTipoRateio === "manual" && partners.length > 0 && (
                        <div className="space-y-2 rounded-xl border border-border/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Percentual por sócio</p>
                          {partners.map((p) => (
                            <div key={p.id} className="flex items-center gap-3">
                              <span className="text-sm flex-1 truncate">{p.name}</span>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={manualRateios[p.id] || ""}
                                  onChange={(e) =>
                                    setManualRateios((prev) => ({
                                      ...prev,
                                      [p.id]: parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                  className="w-20 h-8 text-sm rounded-lg"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            </div>
                          ))}
                          {(() => {
                            const total = Object.values(manualRateios).reduce((s, v) => s + v, 0);
                            return (
                              <p className={cn(
                                "text-xs font-medium text-right",
                                Math.abs(total - 100) < 0.01 ? "text-emerald-500" : "text-destructive"
                              )}>
                                Total: {total.toFixed(2)}%
                              </p>
                            );
                          })()}
                        </div>
                      )}

                      {manutencaoTipoRateio === "por_uso" && partners.length > 0 && (
                        <div className="rounded-xl border border-border/40 p-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Rateio estimado por uso</p>
                          {partners.map((p) => {
                            const totalPct = partners.reduce((s, pp) => s + (pp.share_percentage || 0), 0);
                            const pct = totalPct > 0 ? ((p.share_percentage || 0) / totalPct * 100) : (100 / partners.length);
                            return (
                              <div key={p.id} className="flex items-center justify-between text-sm">
                                <span className="truncate">{p.name}</span>
                                <span className="text-muted-foreground font-mono">{pct.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <FormSection label="Descrição" required>
                <Input
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                  placeholder={
                    selectedCategory
                      ? `Ex: ${selectedCategory.label} - detalhe da despesa`
                      : "Descreva a despesa"
                  }
                  required
                  disabled={addExpense.isPending}
                  className="h-12 rounded-xl border-border/70 text-sm"
                />
              </FormSection>

              {/* ── Impostos subtype ── */}
              {(form.category as string) === "IMPOSTOS" && (
                <div className="rounded-2xl bg-blue-950/40 border border-blue-700/50 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/60">
                      <span className="text-base">🏦</span>
                    </div>
                    <p className="font-semibold text-sm text-blue-200">Tipo de Imposto</p>
                  </div>
                  <Select value={form.expenseType} onValueChange={set("expenseType")}>
                    <SelectTrigger className="h-12 rounded-xl border-blue-700/50 bg-zinc-900 text-sm">
                      <SelectValue placeholder="Selecione o tipo de imposto" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {IMPOSTOS_SUBTYPES.map((imp) => (
                        <SelectItem key={imp.value} value={imp.value} className="py-3">
                          <span className="font-medium text-sm">{imp.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── Valor + Datas ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <FormSection label="Valor (R$)" required>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.totalAmount}
                      onChange={(e) => set("totalAmount")(e.target.value)}
                      placeholder="0,00"
                      required
                      disabled={addExpense.isPending}
                      className="h-12 rounded-xl border-border/70 text-sm pl-10 font-mono"
                    />
                  </div>
                </FormSection>
                <FormSection label="Data de Pagamento" required>
                  <DateFieldWithInput value={form.paidDate} onChange={(v) => set("paidDate")(v)} />
                </FormSection>
                <FormSection label="Data de Vencimento">
                  <DateFieldWithInput value={form.dueDate} onChange={(v) => set("dueDate")(v)} />
                </FormSection>
              </div>

              {/* ── Fornecedor + NF ── */}
              <div className="space-y-4">
                <FormSection label="Fornecedor">
                  {isAbastecimento ? (
                    <div className="space-y-2">
                      <SearchableCombobox
                        items={fuelSuppliers.map((f) => ({
                          id: f.id,
                          label: `${f.supplier_name} - ${f.city_name} (${f.icao_code})`,
                        }))}
                        value={
                          fuelSuppliers.find((f) => f.supplier_name === form.supplierName)?.id || ""
                        }
                        onChange={(id) => {
                          const supplier = fuelSuppliers.find((f) => f.id === id);
                          set("supplierName")(supplier?.supplier_name || "");
                        }}
                        placeholder="Selecione um fornecedor de combustível..."
                        searchPlaceholder="Buscar fornecedor..."
                        emptyMessage="Nenhum fornecedor cadastrado"
                        disabled={addExpense.isPending}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewFuelSupplier({ supplier_name: '', city_name: '', icao_code: '' });
                          setShowAddFuelSupplier(true);
                        }}
                        className="w-full gap-2 h-9 text-xs rounded-lg border-dashed border-border/60 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Cadastrar novo fornecedor de combustível
                      </Button>
                    </div>
                  ) : (
                    <>
                      <SearchableCombobox
                        items={fornecedoresShare.map((f) => ({
                          id: f.id,
                          label: `${f.nome_completo}${f.documento ? ` (${f.documento})` : ""}`,
                        }))}
                        value={
                          fornecedoresShare.find((f) => f.nome_completo === form.supplierName)
                            ?.id || form.supplierName
                        }
                        onChange={(id) => {
                          const fornecedor = fornecedoresShare.find((f) => f.id === id);
                          set("supplierName")(fornecedor ? fornecedor.nome_completo : id);
                        }}
                        placeholder="Selecione ou digite o fornecedor..."
                        searchPlaceholder="Buscar fornecedor..."
                        emptyMessage="Nenhum fornecedor encontrado"
                        disabled={addExpense.isPending}
                        allowFreeText={true}
                      />
                      {form.supplierName &&
                        !fornecedoresShare.some((f) => f.nome_completo === form.supplierName) && (
                          <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-2">
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex-1">
                              Fornecedor não encontrado nos favoritos.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAddFornecedor(true)}
                              className="h-7 text-xs"
                            >
                              <UserPlus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                          </div>
                        )}
                    </>
                  )}
                </FormSection>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormSection label="Nº Nota / NF">
                    <Input
                      value={form.invoiceNumber}
                      onChange={(e) => set("invoiceNumber")(e.target.value)}
                      placeholder="Ex: 2025180"
                      disabled={addExpense.isPending}
                      className="h-12 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>
                  <FormSection label="URL Nota Fiscal">
                    <Input
                      type="url"
                      value={form.invoiceUrl}
                      onChange={(e) => set("invoiceUrl")(e.target.value)}
                      placeholder="https://..."
                      disabled={addExpense.isPending}
                      className="h-12 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>
                </div>
              </div>

              {/* ── Status + Forma de Pagamento ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSection label="Status da Despesa">
                  <Select value={form.status} onValueChange={set("status")}>
                    <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="pago" className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-sm font-medium">Pago</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pendente" className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-sm font-medium">Pendente</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelado" className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-zinc-400 flex-shrink-0" />
                          <span className="text-sm font-medium">Cancelado</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormSection>
                <FormSection label="Forma de Pagamento">
                  <Select value={form.paymentMethod} onValueChange={set("paymentMethod")}>
                    <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="nao_informado" className="py-2">
                        — Não informado —
                      </SelectItem>
                      <SelectItem value="pix" className="py-2">PIX</SelectItem>
                      <SelectItem value="ted" className="py-2">TED</SelectItem>
                      <SelectItem value="boleto" className="py-2">Boleto</SelectItem>
                      <SelectItem value="cartao" className="py-2">Cartão</SelectItem>
                      <SelectItem value="dinheiro" className="py-2">Dinheiro</SelectItem>
                      <SelectItem value="outros" className="py-2">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </FormSection>
              </div>

              {/* ── Parcelamento em Cartão ── */}
              {form.paymentMethod === "cartao" && (
                <div className="rounded-2xl bg-slate-500 border border-slate-900 dark:bg-slate-600 dark:border-slate-900 p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                      <span className="text-base">💳</span>
                    </div>
                    <p className="font-semibold text-sm text-white">Pagamento em Cartão</p>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isInstallment}
                        onChange={(e) => set("isInstallment")(e.target.checked)}
                        disabled={addExpense.isPending}
                        className="w-4 h-4 rounded border-white/50 cursor-pointer accent-white"
                      />
                      <span className="text-sm font-medium text-white">Parcelar despesa</span>
                    </label>
                  </div>

                  {form.isInstallment && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/20 [&_label]:text-white">
                      <FormSection label="Nº de Parcelas" required>
                        <Select
                          value={form.installmentCount}
                          onValueChange={set("installmentCount")}
                        >
                          <SelectTrigger className="h-12 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                              <SelectItem key={num} value={String(num)} className="py-3">
                                <span className="text-sm font-medium">{num}x</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.installmentCount !== "1" && (
                          <div className="mt-3 p-3 rounded-lg bg-white/15 text-sm text-white/90">
                            <p className="font-medium">Resumo do parcelamento:</p>
                            <p className="mt-1">
                              <strong>{form.description || "Despesa"}</strong>{" "}
                              {parseInt(form.installmentCount)}X{" "}
                              <strong>
                                R${" "}
                                {(
                                  parseFloat(form.totalAmount || "0") /
                                  parseInt(form.installmentCount)
                                ).toFixed(2)}
                              </strong>
                            </p>
                            <div className="mt-2 space-y-1 text-xs">
                              {Array.from({
                                length: Math.min(parseInt(form.installmentCount), 3),
                              }).map((_, i) => {
                                const date = new Date(form.installmentStartDate);
                                date.setMonth(date.getMonth() + i);
                                return (
                                  <p key={i}>
                                    Mês {i + 1}/{form.installmentCount}: R${" "}
                                    {(
                                      parseFloat(form.totalAmount || "0") /
                                      parseInt(form.installmentCount)
                                    ).toFixed(2)}{" "}
                                    - {format(date, "MMM/yyyy", { locale: ptBR })}
                                  </p>
                                );
                              })}
                              {parseInt(form.installmentCount) > 3 && (
                                <p className="italic opacity-75">
                                  ... +{parseInt(form.installmentCount) - 3} parcelas
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </FormSection>

                      <FormSection label="Data 1ª Parcela" required>
                        <Input
                          type="date"
                          value={form.installmentStartDate}
                          onChange={(e) => set("installmentStartDate")(e.target.value)}
                          disabled={addExpense.isPending}
                          className="h-12 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white"
                        />
                      </FormSection>
                    </div>
                  )}
                </div>
              )}

              {/* ── Conta Bancária + Prazo ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSection label="Conta Bancária">
                  <Select
                    value={form.bankName}
                    onValueChange={set("bankName")}
                    disabled={loadingContas}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                      <SelectValue
                        placeholder={loadingContas ? "Carregando contas..." : "Selecione a conta"}
                      />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {contasBancarias.length === 0 && !loadingContas ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          Nenhuma conta bancária cadastrada
                        </div>
                      ) : (
                        contasBancarias.map((conta) => (
                          <SelectItem key={conta.id} value={conta.id} className="py-3">
                            <div>
                              <div className="font-medium text-sm">{conta.banco}</div>
                              {conta.numero_conta && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  Cta: {conta.numero_conta}
                                  {conta.tipo_conta ? ` · ${conta.tipo_conta}` : ""}
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormSection>
                <FormSection label="Prazo" required>
                  <Select
                    value={form.prazo}
                    onValueChange={(v) => set("prazo")(v as "mensal" | "extra")}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="mensal" className="py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-sm">Mensal</div>
                            <div className="text-xs text-muted-foreground">Ciclo mensal regular</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="extra" className="py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-sm">Extra</div>
                            <div className="text-xs text-muted-foreground">Evento ou gasto avulso</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormSection>
              </div>

              {/* ── Observações ── */}
              <FormSection label="Observações">
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes")(e.target.value)}
                  placeholder="Informações adicionais sobre a despesa..."
                  rows={3}
                  disabled={addExpense.isPending}
                  className="rounded-xl border-border/70 text-sm resize-none"
                />
              </FormSection>

              {/* ── Submit ── */}
              <Button
                type="submit"
                className="
                  w-full h-12 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-red-600 to-rose-600
                  hover:from-red-500 hover:to-rose-500
                  text-white shadow-red-500/20
                  transition-all duration-200 hover:-translate-y-px hover:shadow-md
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
                "
                disabled={addExpense.isPending || !isValid}
              >
                {addExpense.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Registrando Despesa...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {selectedCategory
                      ? `${selectedCategory.icon} Registrar ${selectedCategory.label}`
                      : "Registrar Despesa"}
                  </span>
                )}
              </Button>
            </form>
              </TabsContent>

              {/* ── TAB: DESPESAS BANCO ── */}
              <TabsContent value="bank">
                <form onSubmit={handleBankSubmit} className="space-y-6">
                  {/* Info banner */}
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-300">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold mb-0.5">Despesas Bancárias</p>
                      <p className="text-blue-700/80 dark:text-blue-400/70">
                        Registre despesas relacionadas a instituições bancárias como taxas, anuidades, cartão de crédito, etc.
                      </p>
                    </div>
                  </div>

                  {/* Atribuição: Geral / Rateio / Sócio Específico */}
                  <FormSection label="Atribuição da Despesa" required>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "geral", label: "Geral", desc: "Sem vínculo com sócio" },
                        { value: "rateio", label: "Ratear Igual", desc: "Dividir entre todos" },
                        { value: "socio", label: "Sócio Específico", desc: "Atribuir a um sócio" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBankForm((p) => ({ ...p, assignMode: opt.value as any, assignedPartnerCpf: "none" }))}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all",
                            bankForm.assignMode === opt.value
                              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500"
                              : "border-border/70 text-muted-foreground hover:border-border"
                          )}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className="text-[10px] opacity-70">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </FormSection>

                  {/* Sócio selector (only when "socio" mode) */}
                  {bankForm.assignMode === "socio" && (
                    <FormSection label="Sócio Responsável" required>
                      <Select
                        value={bankForm.assignedPartnerCpf}
                        onValueChange={(v) => setBankForm((p) => ({ ...p, assignedPartnerCpf: v }))}
                        disabled={loadingPartners}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                          <SelectValue placeholder={loadingPartners ? "Carregando sócios..." : "Selecione o sócio"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {partners.map((partner) => (
                            <SelectItem key={partner.id} value={partner.cpf} className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                                  {partner.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{partner.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {formatCPF(partner.cpf)}
                                    {partner.share_percentage && ` · ${partner.share_percentage}%`}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormSection>
                  )}

                  {bankForm.assignMode === "rateio" && partners.length > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300">
                      <span>💡</span>
                      <span>O valor será dividido igualmente entre <strong>{partners.length} sócios</strong></span>
                    </div>
                  )}

                  {/* Categoria bancária */}
                  <FormSection label="Tipo de Despesa Bancária" required>
                    <Select
                      value={bankForm.category}
                      onValueChange={(v) => setBankForm((p) => ({ ...p, category: v as BankExpenseCategoryId }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                        <SelectValue placeholder="Selecione o tipo de despesa bancária" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {BANK_EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg leading-none">{cat.icon}</span>
                              <span className="font-medium text-sm">{cat.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormSection>

                  {/* Descrição */}
                  <FormSection label="Descrição" required>
                    <Input
                      value={bankForm.description}
                      onChange={(e) => setBankForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Ex: Anuidade cartão Visa, Taxa TED, etc."
                      required
                      disabled={addExpense.isPending}
                      className="h-12 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>

                  {/* Conta Bancária + Prazo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormSection label="Instituição Bancária" required>
                      <Select
                        value={bankForm.bankName}
                        onValueChange={(v) => setBankForm((p) => ({ ...p, bankName: v }))}
                        disabled={loadingContas}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                          <SelectValue
                            placeholder={loadingContas ? "Carregando contas..." : "Selecione a conta"}
                          />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {contasBancarias.length === 0 && !loadingContas ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                              Nenhuma conta bancária cadastrada
                            </div>
                          ) : (
                            contasBancarias.map((conta) => (
                              <SelectItem key={conta.id} value={conta.id} className="py-3">
                                <div>
                                  <div className="font-medium text-sm">{conta.banco}</div>
                                  {conta.numero_conta && (
                                    <div className="text-xs text-muted-foreground font-mono">
                                      Cta: {conta.numero_conta}
                                      {conta.tipo_conta ? ` · ${conta.tipo_conta}` : ""}
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormSection>
                    <FormSection label="Prazo" required>
                      <Select
                        value={bankForm.prazo}
                        onValueChange={(v) => setBankForm((p) => ({ ...p, prazo: v as "mensal" | "extra" }))}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-border/70 text-sm">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="mensal" className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">Mensal</div>
                                <div className="text-xs text-muted-foreground">Ciclo mensal regular</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="extra" className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">Extra</div>
                                <div className="text-xs text-muted-foreground">Evento ou gasto avulso</div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormSection>
                  </div>

                  {/* Valor + Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormSection label="Valor (R$)" required>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={bankForm.amount}
                          onChange={(e) => setBankForm((p) => ({ ...p, amount: e.target.value }))}
                          placeholder="0,00"
                          required
                          disabled={addExpense.isPending}
                          className="h-12 rounded-xl border-border/70 text-sm pl-10 font-mono"
                        />
                      </div>
                    </FormSection>
                    <FormSection label="Data" required>
                      <DateFieldWithInput
                        value={bankForm.date}
                        onChange={(v) => setBankForm((p) => ({ ...p, date: v }))}
                      />
                    </FormSection>
                  </div>

                  {/* Observação */}
                  <FormSection label="Observação">
                    <Input
                      value={bankForm.notes}
                      onChange={(e) => setBankForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Informações adicionais..."
                      disabled={addExpense.isPending}
                      className="h-12 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="
                      w-full h-12 rounded-xl font-semibold text-sm
                      bg-gradient-to-r from-blue-600 to-indigo-600
                      hover:from-blue-500 hover:to-indigo-500
                      text-white shadow-blue-500/20
                      transition-all duration-200 hover:-translate-y-px hover:shadow-md
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
                    "
                    disabled={addExpense.isPending || !bankForm.category || !bankForm.amount || !bankForm.description || !bankForm.bankName || (bankForm.assignMode === "socio" && bankForm.assignedPartnerCpf === "none")}
                  >
                    {addExpense.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Registrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        🏦 Registrar Despesa Bancária
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <AddFornecedorDialog
        open={showAddFornecedor}
        onOpenChange={setShowAddFornecedor}
        initialName={form.supplierName}
        onSaved={(forn) => {
          set("supplierName")(forn.nome_completo);
        }}
        onFornecedorAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["fornecedores-favoritos"] });
        }}
      />

      {/* Dialog para cadastrar fornecedor de combustível inline */}
      <Dialog open={showAddFuelSupplier} onOpenChange={setShowAddFuelSupplier}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-amber-500" />
              Novo Fornecedor de Combustível
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFuelSupplier.supplier_name.trim() || !newFuelSupplier.city_name.trim() || !newFuelSupplier.icao_code.trim()) {
                toast.error('Preencha todos os campos obrigatórios');
                return;
              }
              setSavingFuelSupplier(true);
              try {
                const { data, error } = await supabase
                  .from('fuel_suppliers')
                  .insert({
                    supplier_name: newFuelSupplier.supplier_name.trim(),
                    city_name: newFuelSupplier.city_name.trim(),
                    icao_code: newFuelSupplier.icao_code.trim().toUpperCase(),
                  })
                  .select()
                  .single();
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ['fuel-suppliers'] });
                set('supplierName')(data.supplier_name);
                setShowAddFuelSupplier(false);
                toast.success('Fornecedor de combustível cadastrado!');
              } catch (err: any) {
                toast.error('Erro ao cadastrar: ' + (err.message || 'Erro desconhecido'));
              } finally {
                setSavingFuelSupplier(false);
              }
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1">
              <Label>Nome do Fornecedor *</Label>
              <Input
                value={newFuelSupplier.supplier_name}
                onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, supplier_name: e.target.value }))}
                placeholder="Ex: BR Aviation"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade *</Label>
                <Input
                  value={newFuelSupplier.city_name}
                  onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, city_name: e.target.value }))}
                  placeholder="Ex: São Paulo"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label>Código ICAO *</Label>
                <Input
                  value={newFuelSupplier.icao_code}
                  onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, icao_code: e.target.value }))}
                  placeholder="Ex: SBSP"
                  className="h-10 uppercase"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddFuelSupplier(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingFuelSupplier}>
                {savingFuelSupplier ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── FormSection ─────────────────────────────────────────────────────────────
function FormSection({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground/80 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500 text-base leading-none">*</span>}
      </Label>
      {children}
    </div>
  );
}

function DateFieldWithInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [inputValue, setInputValue] = useState(
    value ? format(new Date(value + "T12:00:00"), "dd/MM/yyyy") : ""
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateValue = value ? new Date(value + "T12:00:00") : undefined;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length >= 5) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
    else if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    setInputValue(v);

    if (v.length === 10) {
      const [dd, mm, yyyy] = v.split("/");
      const parsed = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
      if (!isNaN(parsed.getTime())) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "dd/MM/yyyy"));
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder="dd/mm/aaaa"
        className="h-12 rounded-xl border-border/70 text-sm flex-1"
        maxLength={10}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl border-border/70 flex-shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="end" sideOffset={4}>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
