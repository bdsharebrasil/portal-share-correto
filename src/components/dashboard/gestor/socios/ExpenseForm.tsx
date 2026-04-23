// @ts-nocheck
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
import { AerodromeCombobox } from "@/components/plano-voo/AerodromeCombobox";
import { useCreateExpense } from "@/hooks/useFinanceiroSocios";
import { useClientPartners } from "@/hooks/useClientPartners";
import { useAerodromes } from "@/hooks/useAerodromes";
import { useClientAbastecimentos } from "@/hooks/useAbastecimentos";
import { useFornecedoresFavoritos } from "@/hooks/useFornecedoresFavoritos";
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { AddFornecedorDialog } from "@/components/dashboard/gestor/financeiro-share/contas-pagar/AddFornecedorDialog";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF } from "@/lib/formatters";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { generateReportNumber } from "@/lib/travelReportUtils";
import toast from "../../../ui/modern-toast";
import { FileUploadField } from "./FileUploadField";

// ─── Categorias ───────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { id: "ABASTECIMENTO", label: "ABASTECIMENTO", icon: "⛽" },
  { id: "ASSINATURAS", label: "ASSINATURAS", icon: "📋" },
  { id: "ATENDIMENTO DE PISTA", label: "ATENDIMENTO DE PISTA", icon: "🛬" },
  { id: "COMPRAS / AQUISIÇÕES", label: "COMPRAS / AQUISIÇÕES", icon: "🛒" },
  { id: "CONTABILIDADE", label: "CONTABILIDADE", icon: "📊" },
  { id: "DECEA", label: "DECEA", icon: "🛬" },
  { id: "IMPOSTOS", label: "IMPOSTOS", icon: "🏦" },
  { id: "DESPESAS DE VIAGEM", label: "DESPESAS DE VIAGEM", icon: "🧳" },
  { id: "HANGARAGEM", label: "HANGARAGEM", icon: "🏠" },
  { id: "INFRAERO", label: "INFRAERO", icon: "🛬" },
  { id: "MANUTENÇÃO", label: "MANUTENÇÃO", icon: "🔧" },
  { id: "OUTROS", label: "OUTROS", icon: "📎" },
  { id: "TARIFAS POUSO/DECOLAGEM", label: "TARIFAS POUSO/DECOLAGEM", icon: "✈️" },
  { id: "REEMBOLSOS", label: "REEMBOLSOS", icon: "💸" },
] as const;

export const IMPOSTOS_SUBTYPES = [
  { value: "FGTS", label: "FGTS" },
  { value: "INSS", label: "INSS" },
  { value: "PIS", label: "PIS" },
  { value: "COFINS", label: "COFINS" },
  { value: "DAS", label: "DAS" },
  { value: "IRPJ", label: "IRPJ" },
  { value: "CSLL", label: "CSLL" },
  { value: "ISS", label: "ISS" },
  { value: "OUTROS IMPOSTOS", label: "OUTROS IMPOSTOS" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

// ─── Helpers para lógica de campos condicionais ───────────────────────────────
const CATEGORIES_WITH_DOC_FIELD = ["IMPOSTOS", "DECEA", "INFRAERO"] as const;
type DocFieldCategory = (typeof CATEGORIES_WITH_DOC_FIELD)[number];

function isDocFieldCategory(cat: string): cat is DocFieldCategory {
  return (CATEGORIES_WITH_DOC_FIELD as readonly string[]).includes(cat);
}

function getDocFieldLabel(category: string): string {
  if (category === "IMPOSTOS") return "Número do Documento";
  if (category === "DECEA" || category === "INFRAERO") return "Número Demonstrativo";
  return "Número do Documento";
}

function getDocFieldPlaceholder(category: string): string {
  if (category === "IMPOSTOS") return "Ex: DARF-2025-001";
  if (category === "DECEA") return "Ex: DECEA-2025-001";
  if (category === "INFRAERO") return "Ex: INFRAERO-2025-001";
  return "Ex: DOC-001";
}

const INFRAERO_DECEA_CATEGORIES = ["DECEA", "INFRAERO"] as const;
type InfraeoDeceaCategory = (typeof INFRAERO_DECEA_CATEGORIES)[number];

function isInfraeoDececaCategory(cat: string): cat is InfraeoDeceaCategory {
  return (INFRAERO_DECEA_CATEGORIES as readonly string[]).includes(cat);
}

const EMPTY_FORM = {
  description: "",
  totalAmount: "",
  category: "" as ExpenseCategoryId | "",
  expenseType: "",
  assignedPartnerCpf: "none",
  paidDate: format(new Date(), "yyyy-MM-dd"),
  dueDate: "",
  supplierName: "",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "nao_informado",
  notes: "",
  status: "pago",
  abastecimentoId: "",
  criarNovoAbastecimento: false,
  demonstrativoNumber: "",
  mesReferente: format(new Date(), "MM-yyyy"),
  doc: "",
  boletoUrl: "",
  demonstrativoUrl: "",
  novoAbastVincularDiario: false,
  novoAbastData: format(new Date(), "yyyy-MM-dd"),
  novoAbastLocal: "",
  novoAbastLitros: "",
  novoAbastTrecho: "",
  novoAbastTrechoOrigem: "",
  novoAbastTrechoDestino: "",
  novoAbastComandaNumero: "",
  novoAbastNF: "",
  novoAbastGaloes: "",
  novoAbastCombustivel: "" as "avgas" | "jet" | "",
  novoAbastTipoFaturamento: "",
  novoAbastStatusPagamento: "em aberto" as "pago" | "em aberto",
  novoAbastDataPagamento: "",
  novoAbastDataVencimento: "",
  novoAbastBanco: "",
  novoAbastObservacoes: "",
  novoAbastValorUnitario: "",
  novoAbastBoleto: "",
  bankName: "",
  prazo: "extra" as "mensal" | "extra",
  percentualSocio: "" as string,
  isInstallment: false,
  installmentCount: "1",
  installmentStartDate: format(new Date(), "yyyy-MM-dd"),
  comandaUrl: "",
  comprovantePagamento: "",
  notaFiscalUrl: "",
};

export const BANK_EXPENSE_CATEGORIES = [
  { id: "CARTÃO DE CRÉDITO", label: "CARTÃO DE CRÉDITO", icon: "💳" },
  { id: "ANUIDADE DE CARTÃO", label: "ANUIDADE DE CARTÃO", icon: "📅" },
  { id: "TARIFAS BANCARIAS", label: "TARIFAS BANCARIAS", icon: "🏦" },
  { id: "TARIFA DE MANUTENÇÃO DE CONTA", label: "TARIFA DE MANUTENÇÃO DE CONTA", icon: "📋" },
  { id: "IOF", label: "IOF", icon: "📊" },
  { id: "TARIFA PIX TED/DOC", label: "TARIFA PIX TED/DOC", icon: "🔁" },
  { id: "JUROS BANCÁRIOS", label: "JUROS BANCÁRIOS", icon: "📈" },
  { id: "SEGUROS BANCÁRIOS", label: "SEGUROS BANCÁRIOS", icon: "🛡️" },
  { id: "OUTRAS TAXAS BANCÁRIAS", label: "OUTRAS TAXAS BANCÁRIAS", icon: "📎" },
] as const;

type BankExpenseCategoryId = (typeof BANK_EXPENSE_CATEGORIES)[number]["id"];

const EMPTY_BANK_FORM = {
  category: "" as BankExpenseCategoryId | "",
  description: "",
  amount: "",
  date: format(new Date(), "yyyy-MM-dd"),
  bankName: "",
  notes: "",
  prazo: "MENSAL" as "MENSAL" | "EXTRA",
  assignMode: "geral" as "geral" | "rateio" | "socio",
  assignedPartnerCpf: "none",
  paymentMethod: "OUTROS",
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
  const [newFuelSupplier, setNewFuelSupplier] = useState({ nome_fornecedor: '', city_name: '', icao_code: '' });
  const [savingFuelSupplier, setSavingFuelSupplier] = useState(false);
  const queryClient = useQueryClient();

  // Travel report linking states
  const [linkOption, setLinkOption] = useState<"existing" | "new" | null>(null);
  const [existingReports, setExistingReports] = useState<
    Array<{ id: string; numero_relatorio: string; status: string }>
  >([]);
  const [selectedReport, setSelectedReport] = useState<{
    id: string;
    numero_relatorio: string;
    status: string;
  } | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const addExpense = useCreateExpense(false);
  const { data: partners = [], isLoading: loadingPartners } = useClientPartners(clienteId);
  const { data: abastecimentos = [] } = useClientAbastecimentos(clienteId);
  const { data: fornecedoresFavoritos = [] } = useFornecedoresFavoritos();
  const { data: fuelSuppliers = [] } = useFuelSuppliers();
  const { data: contasBancarias = [], isLoading: loadingContas } = useContasBancarias();
  const { aerodromes } = useAerodromes();

  const fornecedoresShare = fornecedoresFavoritos.filter((f) => f.categoria === "share");

  const set =
    (key: keyof typeof EMPTY_FORM) => (value: string | boolean) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const getAircraftId = async (): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from("cotistas_aeronave")
        .select("id_aeronave")
        .eq("id_clientes", clienteId)
        .limit(1)
        .single();
      return data?.id_aeronave || null;
    } catch {
      return null;
    }
  };

  const assignedPartner =
    form.assignedPartnerCpf && form.assignedPartnerCpf !== "none"
      ? partners.find((p) => p.cpf === form.assignedPartnerCpf)
      : null;

  // Auto-fill percentual when partner changes
  useEffect(() => {
    if (assignedPartner?.percentual_participacao) {
      setForm(prev => ({ ...prev, percentualSocio: assignedPartner.percentual_participacao!.toString() }));
    } else if (form.assignedPartnerCpf === "none") {
      setForm(prev => ({ ...prev, percentualSocio: "" }));
    }
  }, [form.assignedPartnerCpf]);

  // when category changes, reset link states and doc field
  useEffect(() => {
    if (form.categoria !== "DESPESAS DE VIAGEM") {
      setLinkOption(null);
      setExistingReports([]);
      setSelectedReport(null);
    }
    setForm((prev) => ({ ...prev, doc: "", demonstrativoNumber: "", mesReferente: format(new Date(), "MM-yyyy") }));
  }, [form.categoria]);

  // Auto-fill valor unitário when supplier and combustível are selected
  useEffect(() => {
    if (form.categoria === "ABASTECIMENTO" && form.criarNovoAbastecimento) {
      const selectedSupplier = fuelSuppliers.find(s => s.nome_fornecedor === form.supplierName);
      if (selectedSupplier && form.novoAbastCombustivel) {
        let valorUnitario = "";
        if (form.novoAbastCombustivel === "avgas" && selectedSupplier.fuel_price_avgas) {
          valorUnitario = selectedSupplier.fuel_price_avgas.toString();
        } else if (form.novoAbastCombustivel === "jet" && selectedSupplier.fuel_price_jet) {
          valorUnitario = selectedSupplier.fuel_price_jet.toString();
        }
        if (valorUnitario) {
          setForm(prev => ({ ...prev, novoAbastValorUnitario: valorUnitario }));
        }
      }
    }
  }, [form.supplierName, form.novoAbastCombustivel, form.categoria, form.criarNovoAbastecimento, fuelSuppliers]);

  // Auto-calculate totalAmount for abastecimento
  useEffect(() => {
    if (form.categoria === "ABASTECIMENTO" && form.criarNovoAbastecimento) {
      const litros = parseFloat(form.novoAbastLitros || "0");
      const valorUnitario = parseFloat(form.novoAbastValorUnitario || "0");
      if (litros > 0 && valorUnitario > 0) {
        const total = (litros * valorUnitario).toFixed(2);
        setForm(prev => ({
          ...prev,
          totalAmount: total,
          description: prev.novoAbastCombustivel ? `Combustível: ${prev.novoAbastCombustivel.toUpperCase()}` : "Abastecimento",
          paidDate: prev.novoAbastStatusPagamento === "pago" && prev.novoAbastDataPagamento ? prev.novoAbastDataPagamento : prev.novoAbastData || prev.paidDate,
        }));
      }
    }
  }, [form.novoAbastLitros, form.novoAbastValorUnitario, form.categoria, form.criarNovoAbastecimento, form.novoAbastCombustivel]);

  useEffect(() => {
    const fetchReportsForPartner = async (partnerId: string | null) => {
      setLoadingReports(true);
      try {
        if (partnerId) {
          const { data, error } = await supabase
            .from("travel_expense_reports")
            .select("id, numero_relatorio, status")
            .eq("clientes_id", clienteId)
            .or(`socios_cliente_id.eq.${partnerId},socios_cliente_id.is.null`)
            .in("status", ["Finalizado", "Rascunho", "Enviado"])
            .order("created_at", { ascending: false });
          if (error) { setExistingReports([]); } else { setExistingReports(data || []); }
        } else {
          const { data, error } = await supabase
            .from("travel_expense_reports")
            .select("id, numero_relatorio, status")
            .eq("clientes_id", clienteId)
            .is("socios_cliente_id", null)
            .in("status", ["Finalizado", "Rascunho", "Enviado"])
            .order("created_at", { ascending: false });
          if (error) { setExistingReports([]); } else { setExistingReports(data || []); }
        }
      } finally {
        setLoadingReports(false);
      }
    };
    if (linkOption === "existing") {
      fetchReportsForPartner(assignedPartner?.id || null);
    }
  }, [linkOption, assignedPartner?.id, clienteId]);

  const isDocCategory = isDocFieldCategory(form.categoria as string);
  const isInfraeoDececaExpense = isInfraeoDececaCategory(form.categoria as string);
  const hideDescriptionAndSupplier = isDocCategory || isInfraeoDececaExpense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInfraeoDececaExpense) {
      if (!form.demonstrativoNumber || !form.mesReferente || !form.totalAmount || !form.categoria) return;
    } else if (isDocCategory) {
      if (!form.documento || !form.totalAmount || !form.categoria) return;
    } else {
      if (!form.descricao || !form.totalAmount || !form.categoria) return;
    }

    if (form.categoria === "DESPESAS DE VIAGEM" && linkOption === "existing" && !selectedReport) {
      toast.error("Selecione um relatório de viagem para vincular");
      return;
    }

    const assignedPartnerCpf =
      form.assignedPartnerCpf === "none" ? null : form.assignedPartnerCpf;

    const selectedConta = contasBancarias.find((c) => c.id === form.bankName);
    const bankNameResolved = selectedConta ? selectedConta.banco : form.bankName || null;
    const aircraftId = await getAircraftId();

    let effectiveDescription = "";
    let effectiveDoc = "";

    if (isInfraeoDececaExpense) {
      effectiveDescription = `${form.categoria}/${form.mesReferente}`;
      effectiveDoc = form.mesReferente;
    } else if (isDocCategory) {
      effectiveDescription = form.documento;
    } else {
      effectiveDescription = form.descricao;
    }

    let referenceType: string | null = null;
    let referenceId: string | null = null;

    if (form.categoria === "DESPESAS DE VIAGEM") {
      if (linkOption === "existing" && selectedReport) {
        referenceType = "travel_report";
        referenceId = selectedReport.id;
      } else if (linkOption === "new") {
        try {
          const reportNumber = await generateReportNumber(clienteId, aircraftId);
          const today = format(new Date(), "yyyy-MM-dd");
          const expenseItem = {
            category: selectedCategory?.label || "Desconhecido",
            description: effectiveDescription,
            amount: parseFloat(form.totalAmount),
            paid_by: "Cliente",
            expense_date: today,
          };
          const { data: newReport, error: newReportError } = await supabase
            .from("travel_expense_reports")
            .insert({
              clientes_id: clienteId,
              socios_cliente_id: assignedPartner?.id || null,
              numero_relatorio: reportNumber,
              data_inicio: today,
              data_fim: today,
              dias_count: 1,
              status: "Rascunho",
              expenses: JSON.stringify([expenseItem]),
              aeronave_id: aircraftId,
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

    let abastecimentoId = form.abastecimentoId || null;

    if (form.categoria === "ABASTECIMENTO" && form.criarNovoAbastecimento) {
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
            id_clientes: clienteId,
            aeronave_id: aircraftId || null,
            data: form.novoAbastData,
            trecho: form.novoAbastTrecho || form.descricao || "N/A",
            local: form.novoAbastLocal,
            litros: litros,
            valor_unitario: form.novoAbastValorUnitario ? parseFloat(form.novoAbastValorUnitario) : valorUnitario,
            abastecedor: form.supplierName || null,
            abastecedor_id: fuelSuppliers.find(s => s.nome_fornecedor === form.supplierName)?.id || null,
            abastecimento_galoes: form.novoAbastGaloes ? parseFloat(form.novoAbastGaloes) : null,
            socio_nome: assignedPartner?.nome || null,
            status_pagamento: form.novoAbastStatusPagamento,
            tipo_faturamento: form.novoAbastTipoFaturamento || null,
            forma_pagamento: form.paymentMethod && form.paymentMethod !== "nao_informado" ? form.paymentMethod.toUpperCase() : null,
            prazo: form.prazo ? form.prazo.toUpperCase() : null,
            banco: form.novoAbastBanco || null,
            data_pagamento: form.novoAbastStatusPagamento === "pago" ? form.novoAbastDataPagamento : null,
            data_vencimento_boleto: form.novoAbastStatusPagamento === "em aberto" ? form.novoAbastDataVencimento : null,
            comanda: form.novoAbastComandaNumero || null,
            comanda_url: form.comandaUrl || null,
            comprovante_pagamento: form.comprovantePagamento || null,
            boleto_url: form.novoAbastBoleto || null,
            nota_url: form.notaFiscalUrl || form.invoiceUrl || null,
            nf: form.novoAbastNF || form.invoiceNumber || null,
            tipo_combustivel: form.novoAbastCombustivel || null,
            descricao: form.novoAbastCombustivel ? `Combustível: ${form.novoAbastCombustivel.toUpperCase()}` : null,
            observacao: form.novoAbastObservacoes || form.notes || null,
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
      description: effectiveDescription,
      totalAmount: parseFloat(form.totalAmount),
      category: form.categoria,
      expenseType: form.expenseType || form.categoria,
      dueDate: form.dueDate,
      supplierName: isDocCategory || isInfraeoDececaExpense ? null : (form.supplierName?.toUpperCase() || null),
      invoiceNumber: isInfraeoDececaExpense ? (form.demonstrativoNumber || null) : (form.invoiceNumber || null),
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
      doc: isInfraeoDececaExpense ? effectiveDoc : (isDocCategory ? form.documento : null),
      boletoUrl: isInfraeoDececaExpense ? (form.boletoUrl || null) : (isDocCategory ? form.boletoUrl || null : null),
      demonstrativoUrl: isInfraeoDececaExpense ? (form.demonstrativoUrl || null) : (isDocCategory ? form.demonstrativoUrl || null : null),
      percentualSocio: form.percentualSocio ? parseFloat(form.percentualSocio) : null,
    };

    if (form.categoria !== "ABASTECIMENTO") {
      if (!assignedPartnerCpf && partners.length > 1) {
        const splitAmount = parseFloat(form.totalAmount) / partners.length;
        const splitAmountRounded = Math.round(splitAmount * 100) / 100;

        for (const partner of partners) {
          const isLast = partners.indexOf(partner) === partners.length - 1;
          const alreadyAssigned = splitAmountRounded * (partners.indexOf(partner));
          const amount = isLast
            ? parseFloat(form.totalAmount) - alreadyAssigned
            : splitAmountRounded;

          const finalPayload = form.categoria === "DESPESAS DE VIAGEM" && referenceId
            ? {
                ...basePayload,
                totalAmount: amount,
                assignedPartnerCpf: partner.cpf,
                assignedPartnerName: partner.nome,
                referenceType: "travel_report",
                referenceId: referenceId,
              }
            : {
                ...basePayload,
                totalAmount: amount,
                assignedPartnerCpf: partner.cpf,
                assignedPartnerName: partner.nome,
              };

          await addExpense.mutateAsync(finalPayload);
        }
      } else {
        await addExpense.mutateAsync({
          ...basePayload,
          assignedPartnerCpf,
          assignedPartnerName: assignedPartner?.nome || null,
        });
      }
    }

    toast.success("Despesa criada com sucesso!");
    setOpen(false);
    setForm(EMPTY_FORM);
    setTab("expense");
    setLinkOption(null);
    setExistingReports([]);
    setSelectedReport(null);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.categoria || !bankForm.valor || !bankForm.descricao) return;

    const aircraftId = await getAircraftId();
    const selectedConta = contasBancarias.find((c) => c.id === bankForm.bankName);
    const bankNameResolved = selectedConta ? selectedConta.banco : bankForm.bankName || null;
    const bankNameUppercase = bankNameResolved ? bankNameResolved.toUpperCase() : null;

    const basePayload = {
      clientId: clienteId,
      description: bankForm.descricao,
      totalAmount: parseFloat(bankForm.valor),
      category: "TARIFAS BANCARIAS",
      expenseType: bankForm.categoria,
      dueDate: bankForm.data,
      supplierName: bankNameResolved ? bankNameResolved.toUpperCase() : null,
      notes: bankForm.notes || null,
      bankName: bankNameUppercase,
      prazo: bankForm.prazo,
      aircraftId,
      status: "pago",
      paymentMethod: "OUTROS",
    };

    if (bankForm.assignMode === "rateio" && partners.length > 1) {
      const splitAmount = parseFloat(bankForm.valor) / partners.length;
      const splitAmountRounded = Math.round(splitAmount * 100) / 100;
      for (const partner of partners) {
        const isLast = partners.indexOf(partner) === partners.length - 1;
        const alreadyAssigned = splitAmountRounded * (partners.indexOf(partner));
        const amount = isLast
          ? parseFloat(bankForm.valor) - alreadyAssigned
          : splitAmountRounded;

        await addExpense.mutateAsync({
          ...basePayload,
          totalAmount: amount,
          assignedPartnerCpf: partner.cpf,
          assignedPartnerName: partner.nome,
        });
      }
    } else if (bankForm.assignMode === "socio" && bankForm.assignedPartnerCpf !== "none") {
      const partner = partners.find((p) => p.cpf === bankForm.assignedPartnerCpf);
      await addExpense.mutateAsync({
        ...basePayload,
        assignedPartnerCpf: bankForm.assignedPartnerCpf,
        assignedPartnerName: partner?.nome || null,
      });
    } else {
      await addExpense.mutateAsync({
        ...basePayload,
        assignedPartnerCpf: null,
        assignedPartnerName: bankNameUppercase || "CONTA BANCÁRIA",
      });
    }

    toast.success("Despesa criada com sucesso!");
    setOpen(false);
    setBankForm(EMPTY_BANK_FORM);
    setTab("expense");
  };

  const selectedCategory = EXPENSE_CATEGORIES.find((c) => c.id === form.categoria);
  const isAbastecimento = form.categoria === "ABASTECIMENTO";

  const isValid = isInfraeoDececaExpense
    ? !!form.demonstrativoNumber && !!form.mesReferente && !!form.totalAmount && !!form.categoria
    : isDocCategory
    ? !!form.documento && !!form.totalAmount && !!form.categoria
    : !!form.descricao && !!form.totalAmount && !!form.categoria;

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
            w-full max-w-6xl
            max-h-[95vh] overflow-y-auto
            rounded-2xl border border-border/60
            bg-background/95 backdrop-blur-sm
            shadow-2xl p-0
          "
        >
          {/* ── Header ── */}
          <div className="relative px-10 pt-8 pb-6 border-b border-red-700/40 bg-gradient-to-br from-red-700 to-rose-800 rounded-t-2xl overflow-hidden">
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
          <div className="px-10 py-8">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "expense" | "bank")}>
              <TabsList className="w-full h-12 rounded-xl bg-muted/60 p-1 mb-8">
                <TabsTrigger
                  value="expense"
                  className="flex-1 gap-2 h-10 rounded-lg text-sm font-medium
                             data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                             data-[state=active]:shadow-sm data-[state=active]:text-red-700
                             dark:data-[state=active]:text-red-400 transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  Despesa
                </TabsTrigger>
                <TabsTrigger
                  value="bank"
                  className="flex-1 gap-2 h-10 rounded-lg text-sm font-medium
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
                <form onSubmit={handleSubmit} className="space-y-7">

                  {/* Sócio Responsável + Categoria */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormSection label="Sócio Responsável">
                      <Select
                        value={form.assignedPartnerCpf}
                        onValueChange={set("assignedPartnerCpf")}
                        disabled={loadingPartners}
                      >
                        <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
                          <SelectValue
                            placeholder={
                              loadingPartners ? "Carregando sócios..." : "Atribuir a um sócio"
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
                                  {partner.nome.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{partner.nome}</div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {formatCPF(partner.cpf)}
                                    {partner.percentual_participacao && ` · ${partner.percentual_participacao}%`}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormSection>

                    <FormSection label="Categoria" required>
                      <Select value={form.categoria} onValueChange={set("categoria")}>
                        <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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
                    </FormSection>
                  </div>

                  {/* Percentual do Sócio */}
                  {assignedPartner && partners.length > 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormSection label="% Compartilhamento">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={form.percentualSocio}
                            onChange={(e) => set("percentualSocio")(e.target.value)}
                            placeholder="Ex: 50"
                            className="h-13 rounded-xl border-border/70 text-sm"
                          />
                          <span className="text-sm text-muted-foreground font-medium">%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Deixe vazio ou 100% se a despesa é exclusiva deste sócio (não compartilhada)
                        </p>
                      </FormSection>
                    </div>
                  )}

                  {/* Categoria selecionada badge */}
                  {selectedCategory && (
                    <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800/50 dark:text-red-300">
                      <span className="text-base">{selectedCategory.icon}</span>
                      <span className="font-medium">{selectedCategory.label} selecionada</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                    </div>
                  )}

                  {/* IMPOSTOS: Tipo de Imposto */}
                  {(form.categoria as string) === "IMPOSTOS" && (
                    <div className="rounded-2xl bg-blue-950/40 border border-blue-700/50 p-6 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/60">
                          <span className="text-base">🏦</span>
                        </div>
                        <p className="font-semibold text-sm text-blue-200">Tipo de Imposto</p>
                      </div>
                      <Select value={form.expenseType} onValueChange={set("expenseType")}>
                        <SelectTrigger className="h-13 rounded-xl border-blue-700/50 bg-zinc-900 text-sm">
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

                  {/* INFRAERO/DECEA */}
                  {isInfraeoDececaExpense && (
                    <div className="rounded-2xl bg-sky-950/30 border border-sky-700/40 p-6 space-y-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-900/60">
                          <span className="text-base">🛬</span>
                        </div>
                        <p className="font-semibold text-sm text-sky-200">
                          Informações de {form.categoria}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Número Demonstrativo</Label>
                          <Input
                            value={form.demonstrativoNumber}
                            onChange={(e) => set("demonstrativoNumber")(e.target.value)}
                            placeholder={`Ex: ${form.categoria}-2025-001`}
                            required
                            disabled={addExpense.isPending}
                            className="h-13 rounded-xl text-sm border-sky-700/40 bg-zinc-900"
                          />
                          <p className="text-xs text-muted-foreground">
                            Este número será salvo como referência do demonstrativo.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Mês Referente</Label>
                          <Input
                            type="month"
                            value={form.mesReferente}
                            onChange={(e) => set("mesReferente")(e.target.value)}
                            required
                            disabled={addExpense.isPending}
                            className="h-13 rounded-xl text-sm border-sky-700/40 bg-zinc-900"
                          />
                          <p className="text-xs text-muted-foreground">
                            Será preenchido na coluna DOC como MM-YYYY
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-2xl border border-dashed border-border mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-red-600" />
                            Anexar Boleto (PDF/Imagem)
                          </Label>
                          <FileUploadField
                            value={form.boletoUrl}
                            onChange={set("boletoUrl")}
                            label="Anexar Boleto"
                            accept=".pdf,.jpg,.jpeg,.png"
                            bucket="nfs-share-recebidas"
                            prefix="boleto"
                            disabled={addExpense.isPending}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-blue-600" />
                            Anexar Demonstrativo (PDF/Imagem)
                          </Label>
                          <FileUploadField
                            value={form.demonstrativoUrl}
                            onChange={set("demonstrativoUrl")}
                            label="Anexar Demonstrativo"
                            accept=".pdf,.jpg,.jpeg,.png"
                            bucket="nfs-share-recebidas"
                            prefix="demonstrativo"
                            disabled={addExpense.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campo DOC (IMPOSTOS only) */}
                  {form.categoria === "IMPOSTOS" && (
                    <div className={cn(
                      "rounded-2xl border p-6 space-y-2",
                      form.categoria === "IMPOSTOS"
                        ? "bg-blue-950/30 border-blue-700/40"
                        : "bg-sky-950/30 border-sky-700/40"
                    )}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          form.categoria === "IMPOSTOS" ? "bg-blue-900/60" : "bg-sky-900/60"
                        )}>
                          <span className="text-base">
                            {form.categoria === "IMPOSTOS" ? "🏦" : "🛬"}
                          </span>
                        </div>
                        <p className={cn(
                          "font-semibold text-sm",
                          form.categoria === "IMPOSTOS" ? "text-blue-200" : "text-sky-200"
                        )}>
                          {getDocFieldLabel(form.categoria as string)}
                        </p>
                      </div>
                      <Input
                        value={form.documento}
                        onChange={(e) => set("documento")(e.target.value)}
                        placeholder={getDocFieldPlaceholder(form.categoria as string)}
                        required
                        disabled={addExpense.isPending}
                        className={cn(
                          "h-13 rounded-xl text-sm",
                          form.categoria === "IMPOSTOS"
                            ? "border-blue-700/40 bg-zinc-900"
                            : "border-sky-700/40 bg-zinc-900"
                        )}
                      />
                      <p className="text-xs text-muted-foreground pt-1">
                        {form.categoria === "IMPOSTOS"
                          ? "Este número será salvo como identificador do documento fiscal."
                          : "Este número será salvo como referência do demonstrativo."}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-2xl border border-dashed border-border mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-red-600" />
                            Anexar Boleto (PDF/Imagem)
                          </Label>
                          <FileUploadField
                            value={form.boletoUrl}
                            onChange={set("boletoUrl")}
                            label="Anexar Boleto"
                            accept=".pdf,.jpg,.jpeg,.png"
                            bucket="nfs-share-recebidas"
                            prefix="boleto"
                            disabled={addExpense.isPending}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-blue-600" />
                            Anexar Demonstrativo (PDF/Imagem)
                          </Label>
                          <FileUploadField
                            value={form.demonstrativoUrl}
                            onChange={set("demonstrativoUrl")}
                            label="Anexar Demonstrativo"
                            accept=".pdf,.jpg,.jpeg,.png"
                            bucket="nfs-share-recebidas"
                            prefix="demonstrativo"
                            disabled={addExpense.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vincular Relatório de Viagem */}
                  {form.categoria === "DESPESAS DE VIAGEM" && (
                    <FormSection label="Deseja vincular a um relatório de viagem?">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                          type="button"
                          variant={linkOption === "existing" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setLinkOption("existing")}
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

                      {linkOption === "existing" && (
                        <div className="mt-3">
                          <Select
                            value={selectedReport?.id || ""}
                            onValueChange={(v) => {
                              const found = existingReports.find((r) => r.id === v);
                              setSelectedReport(found || null);
                            }}
                          >
                            <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
                              <SelectValue
                                placeholder={
                                  loadingReports
                                    ? "Carregando relatórios..."
                                    : existingReports.length === 0
                                      ? "Nenhum relatório encontrado"
                                      : "Selecione um relatório existente"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {existingReports.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="py-3">
                                  {r.numero_relatorio}
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

                  {/* Abastecimento */}
                  {isAbastecimento && (
                    <div className="rounded-2xl bg-amber-950/40 border border-amber-700/50 p-6 space-y-5">
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
                            <SelectTrigger className="h-13 rounded-xl border-amber-700/50 bg-background text-foreground text-sm">
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
                                        {abast.nome_socio && (
                                          <span>Sócio: {abast.nome_socio}</span>
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
                            className="w-full gap-2 text-amber-400 hover:bg-amber-900/30 rounded-xl h-11"
                            onClick={() => set("criarNovoAbastecimento")(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Criar novo abastecimento
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-5">
                          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="vincular-diario"
                                checked={form.novoAbastVincularDiario}
                                onChange={(e) => set("novoAbastVincularDiario")(e.target.checked)}
                                className="h-4 w-4 rounded border-border"
                                disabled={addExpense.isPending}
                              />
                              <label htmlFor="vincular-diario" className="text-sm font-semibold text-foreground cursor-pointer">
                                ✈️ Vincular a um trecho do Diário de Bordo?
                              </label>
                            </div>
                          </div>

                          {!form.novoAbastVincularDiario && (
                            <FormSection label="📅 Data do Abastecimento">
                              <Input
                                type="data"
                                value={form.novoAbastData}
                                onChange={(e) => set("novoAbastData")(e.target.value)}
                                className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                disabled={addExpense.isPending}
                              />
                            </FormSection>
                          )}

                          {!form.novoAbastVincularDiario && (
                            <div>
                              <Label className="text-sm font-semibold mb-2 block">✈️ Trecho (Origem x Destino)</Label>
                              <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                  <Label className="text-xs text-muted-foreground mb-1 block">Origem</Label>
                                  <AerodromeCombobox
                                    aerodromes={aerodromes}
                                    value={form.novoAbastTrechoOrigem}
                                    onChange={(value) => {
                                      set("novoAbastTrechoOrigem")(value);
                                      const destino = form.novoAbastTrechoDestino;
                                      if (value && destino) {
                                        set("novoAbastTrecho")(`${value} X ${destino}`);
                                      }
                                    }}
                                    disabled={addExpense.isPending}
                                    placeholder="Origem"
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground mb-3">X</span>
                                <div className="flex-1">
                                  <Label className="text-xs text-muted-foreground mb-1 block">Destino</Label>
                                  <AerodromeCombobox
                                    aerodromes={aerodromes}
                                    value={form.novoAbastTrechoDestino}
                                    onChange={(value) => {
                                      set("novoAbastTrechoDestino")(value);
                                      const origem = form.novoAbastTrechoOrigem;
                                      if (origem && value) {
                                        set("novoAbastTrecho")(`${origem} X ${value}`);
                                      }
                                    }}
                                    disabled={addExpense.isPending}
                                    placeholder="Destino"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                            <FormSection label="🛢️ Fornecedor">
                              <div className="flex gap-2">
                                <SearchableCombobox
                                  items={fuelSuppliers.map(s => ({
                                    id: s.nome_fornecedor,
                                    label: `${s.nome_fornecedor} (${s.cidade_name})`
                                  }))}
                                  value={form.supplierName}
                                  onChange={(v) => {
                                    set("supplierName")(v);
                                    const supplier = fuelSuppliers.find(s => s.nome_fornecedor === v);
                                    if (supplier) {
                                      set("novoAbastLocal")(supplier.cidade_name);
                                    }
                                  }}
                                  placeholder="Selecione fornecedor"
                                  searchPlaceholder="Buscar fornecedor..."
                                  emptyMessage="Nenhum fornecedor encontrado"
                                  disabled={addExpense.isPending}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-12"
                                  onClick={() => setShowAddFuelSupplier(true)}
                                  disabled={addExpense.isPending}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </FormSection>

                            <FormSection label="⛽ Tipo de Combustível">
                              <Select
                                value={form.novoAbastCombustivel}
                                onValueChange={(v) => set("novoAbastCombustivel")(v as "avgas" | "jet" | "")}
                                disabled={addExpense.isPending}
                              >
                                <SelectTrigger className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm">
                                  <SelectValue placeholder="Selecione combustível" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="avgas">AVGAS</SelectItem>
                                  <SelectItem value="jet">JET</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormSection>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormSection label="💰 Valor Unitário (R$)">
                              <Input
                                type="number"
                                step="0.0001"
                                value={form.novoAbastValorUnitario}
                                onChange={(e) => set("novoAbastValorUnitario")(e.target.value)}
                                placeholder="Auto-preenchido"
                                className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                disabled={addExpense.isPending}
                              />
                              {form.novoAbastValorUnitario && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  ✓ Preço auto-preenchido
                                </p>
                              )}
                            </FormSection>
                            <FormSection label="📊 Litros">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={form.novoAbastLitros}
                                onChange={(e) => set("novoAbastLitros")(e.target.value)}
                                className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                disabled={addExpense.isPending}
                              />
                            </FormSection>
                            <FormSection label="📏 Galões (opcional)">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                value={form.novoAbastGaloes}
                                onChange={(e) => set("novoAbastGaloes")(e.target.value)}
                                className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                disabled={addExpense.isPending}
                              />
                            </FormSection>
                          </div>

                          {form.novoAbastLitros && form.novoAbastValorUnitario && (
                            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-3 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Cálculo Automático</p>
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {form.novoAbastLitros} L × R$ {parseFloat(form.novoAbastValorUnitario || "0").toFixed(4)} = R$ {(parseFloat(form.novoAbastLitros || "0") * parseFloat(form.novoAbastValorUnitario || "0")).toFixed(2)}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                            <FormSection label="📋 Tipo de Faturamento">
                              <Select
                                value={form.novoAbastTipoFaturamento}
                                onValueChange={(v) => set("novoAbastTipoFaturamento")(v)}
                                disabled={addExpense.isPending}
                              >
                                <SelectTrigger className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm">
                                  <SelectValue placeholder="Selecione tipo" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="pagamento a vista">Pagamento à Vista</SelectItem>
                                  <SelectItem value="a vista cartao de credito">À Vista Cartão de Crédito</SelectItem>
                                  <SelectItem value="a vista transferencia pix">À Vista Transferência (PIX)</SelectItem>
                                  <SelectItem value="faturado boleto">Faturado Boleto</SelectItem>
                                  <SelectItem value="faturado nota fiscal">Faturado Nota Fiscal</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormSection>

                            <FormSection label="💳 Status de Pagamento">
                              <Select
                                value={form.novoAbastStatusPagamento}
                                onValueChange={(v) => set("novoAbastStatusPagamento")(v as "pago" | "em aberto")}
                                disabled={addExpense.isPending}
                              >
                                <SelectTrigger className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm">
                                  <SelectValue placeholder="Selecione status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="em aberto">⏱️ Em Aberto</SelectItem>
                                  <SelectItem value="pago">✓ Pago</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormSection>
                          </div>

                          {form.novoAbastStatusPagamento === "pago" && (
                            <div className="space-y-4 pt-2 border-t bg-green-500/5 border-l-4 border-l-green-500 pl-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormSection label="📅 Data de Pagamento">
                                  <Input
                                    type="data"
                                    value={form.novoAbastDataPagamento}
                                    onChange={(e) => set("novoAbastDataPagamento")(e.target.value)}
                                    className="h-13 rounded-xl border-green-700/30 bg-background text-foreground text-sm"
                                    disabled={addExpense.isPending}
                                  />
                                </FormSection>
                                <FormSection label="🏦 Banco">
                                  <Select
                                    value={form.novoAbastBanco}
                                    onValueChange={(v) => set("novoAbastBanco")(v)}
                                    disabled={addExpense.isPending}
                                  >
                                    <SelectTrigger className="h-13 rounded-xl border-green-700/30 bg-background text-foreground text-sm">
                                      <SelectValue placeholder="Selecione banco" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {contasBancarias.map(banco => (
                                        <SelectItem key={banco.id} value={banco.banco}>{banco.banco}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormSection>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormSection label="💳 Forma de Pagamento">
                                  <Select value={form.paymentMethod} onValueChange={set("paymentMethod")}>
                                    <SelectTrigger className="h-13 rounded-xl border-green-700/30 bg-background text-foreground text-sm">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="nao_informado">— Não informado —</SelectItem>
                                      <SelectItem value="pix">PIX</SelectItem>
                                      <SelectItem value="ted">TED</SelectItem>
                                      <SelectItem value="boleto">Boleto</SelectItem>
                                      <SelectItem value="cartao">Cartão</SelectItem>
                                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                      <SelectItem value="outros">Outros</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormSection>
                                <FormSection label="📋 Prazo">
                                  <Select value={form.prazo} onValueChange={(v) => set("prazo")(v as "mensal" | "extra")}>
                                    <SelectTrigger className="h-13 rounded-xl border-green-700/30 bg-background text-foreground text-sm">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="mensal">Mensal</SelectItem>
                                      <SelectItem value="extra">Extra</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormSection>
                              </div>
                              <FormSection label="📄 Comprovante de Pagamento">
                                <FileUploadField
                                  value={form.comprovantePagamento}
                                  onChange={(url) => set("comprovantePagamento")(url)}
                                  label="Anexar Comprovante"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  bucket="nfs-share-recebidas"
                                  prefix="comprovante"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                            </div>
                          )}

                          {form.novoAbastStatusPagamento === "em aberto" && (
                            <div className="space-y-3 pt-2 border-t bg-orange-500/5 border-l-4 border-l-orange-500 pl-4">
                              <FormSection label="📅 Data de Vencimento">
                                <Input
                                  type="data"
                                  value={form.novoAbastDataVencimento}
                                  onChange={(e) => set("novoAbastDataVencimento")(e.target.value)}
                                  className="h-13 rounded-xl border-orange-700/30 bg-background text-foreground text-sm"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                            </div>
                          )}

                          <div className="space-y-4 pt-2 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <FormSection label="🧾 Nº Comanda">
                                <Input
                                  placeholder="Comanda"
                                  value={form.novoAbastComandaNumero}
                                  onChange={(e) => set("novoAbastComandaNumero")(e.target.value)}
                                  className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                              <FormSection label="📸 Anexo Comanda">
                                <FileUploadField
                                  value={form.comandaUrl}
                                  onChange={(url) => set("comandaUrl")(url)}
                                  label="Anexar Comanda"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  bucket="nfs-share-recebidas"
                                  prefix="comanda"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <FormSection label="📄 Nº Nota Fiscal">
                                <Input
                                  placeholder="NF"
                                  value={form.novoAbastNF}
                                  onChange={(e) => set("novoAbastNF")(e.target.value)}
                                  className="h-13 rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                              <FormSection label="📸 Anexo NF">
                                <FileUploadField
                                  value={form.notaFiscalUrl}
                                  onChange={(url) => set("notaFiscalUrl")(url)}
                                  label="Anexar Nota Fiscal"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  bucket="nfs-share-recebidas"
                                  prefix="nota-fiscal"
                                  disabled={addExpense.isPending}
                                />
                              </FormSection>
                            </div>
                            <FormSection label="💰 Boleto (Opcional)">
                              <FileUploadField
                                value={form.novoAbastBoleto}
                                onChange={(url) => set("novoAbastBoleto")(url)}
                                label="Anexar Boleto"
                                accept=".pdf,.jpg,.jpeg,.png"
                                bucket="nfs-share-recebidas"
                                prefix="boleto"
                                disabled={addExpense.isPending}
                              />
                            </FormSection>
                            <FormSection label="📝 Observações">
                              <Textarea
                                placeholder="Adicione observações sobre este abastecimento..."
                                value={form.novoAbastObservacoes}
                                onChange={(e) => set("novoAbastObservacoes")(e.target.value)}
                                className="rounded-xl border-amber-700/30 bg-background text-foreground text-sm"
                                disabled={addExpense.isPending}
                              />
                            </FormSection>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full gap-2 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-xl h-11"
                            onClick={() => set("criarNovoAbastecimento")(false)}
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Usar abastecimento existente
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Descrição */}
                  {!hideDescriptionAndSupplier && !(isAbastecimento && form.criarNovoAbastecimento) && (
                    <FormSection label="Descrição" required>
                      <Input
                        value={form.descricao}
                        onChange={(e) => set("descricao")(e.target.value)}
                        placeholder={
                          selectedCategory
                            ? `Ex: ${selectedCategory.label} - detalhe da despesa`
                            : "Descreva a despesa"
                        }
                        required={!(isAbastecimento && form.criarNovoAbastecimento)}
                        disabled={addExpense.isPending}
                        className="h-13 rounded-xl border-border/70 text-sm"
                      />
                    </FormSection>
                  )}

                  {/* Valor + Datas */}
                  {!(isAbastecimento && form.criarNovoAbastecimento) && (
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
                            className="h-13 rounded-xl border-border/70 text-sm pl-10 font-mono"
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
                  )}

                  {/* Fornecedor + NF */}
                  {!hideDescriptionAndSupplier && !(isAbastecimento && form.criarNovoAbastecimento) && (
                    <div className="space-y-5">
                      <FormSection label="Fornecedor">
                        {isAbastecimento ? (
                          <div className="space-y-2">
                            <SearchableCombobox
                              items={fuelSuppliers.map((f) => ({
                                id: f.id,
                                label: `${f.nome_fornecedor} - ${f.cidade_name} (${f.icao_code})`,
                              }))}
                              value={
                                fuelSuppliers.find((f) => f.nome_fornecedor === form.supplierName)?.id || ""
                              }
                              onChange={(id) => {
                                const supplier = fuelSuppliers.find((f) => f.id === id);
                                set("supplierName")(supplier?.nome_fornecedor || "");
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
                                setNewFuelSupplier({ nome_fornecedor: '', city_name: '', icao_code: '' });
                                setShowAddFuelSupplier(true);
                              }}
                              className="w-full gap-2 h-10 text-xs rounded-lg border-dashed border-border/60 text-muted-foreground hover:text-foreground"
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
                                label: `${f.nome_completo}${f.documentoumento ? ` (${f.documentoumento})` : ""}`,
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormSection label="Nº Nota / NF">
                          <Input
                            value={form.invoiceNumber}
                            onChange={(e) => set("invoiceNumber")(e.target.value)}
                            placeholder="Ex: 2025180"
                            disabled={addExpense.isPending}
                            className="h-13 rounded-xl border-border/70 text-sm"
                          />
                        </FormSection>
                        <FormSection label="Nota Fiscal">
                          <FileUploadField
                            value={form.invoiceUrl}
                            onChange={(url) => set("invoiceUrl")(url)}
                            label="Anexar NF"
                            accept=".pdf,.jpg,.jpeg,.png"
                            bucket="nfs-share-recebidas"
                            prefix="nf_socio"
                            disabled={addExpense.isPending}
                          />
                        </FormSection>
                      </div>
                    </div>
                  )}

                  {/* Status + Forma de Pagamento */}
                  {!(isAbastecimento && form.criarNovoAbastecimento) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormSection label="Status da Despesa">
                        <Select value={form.status} onValueChange={set("status")}>
                          <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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
                          <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="nao_informado" className="py-2">— Não informado —</SelectItem>
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
                  )}

                  {/* Parcelamento em Cartão */}
                  {form.paymentMethod === "cartao" && (
                    <div className="rounded-2xl bg-slate-500 border border-slate-900 dark:bg-slate-600 dark:border-slate-900 p-6 space-y-4">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-white/20 [&_label]:text-white">
                          <FormSection label="Nº de Parcelas" required>
                            <Select
                              value={form.installmentCount}
                              onValueChange={set("installmentCount")}
                            >
                              <SelectTrigger className="h-13 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white">
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
                                  <strong>{form.descricao || "Despesa"}</strong>{" "}
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
                              type="data"
                              value={form.installmentStartDate}
                              onChange={(e) => set("installmentStartDate")(e.target.value)}
                              disabled={addExpense.isPending}
                              className="h-13 rounded-xl border-white/30 bg-white/10 dark:bg-white/5 text-sm text-white"
                            />
                          </FormSection>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conta Bancária + Prazo */}
                  {!(isAbastecimento && form.criarNovoAbastecimento) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormSection label="Conta Bancaria">
                        <Select
                          value={form.bankName}
                          onValueChange={set("bankName")}
                          disabled={loadingContas}
                        >
                          <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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
                          <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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
                  )}

                  {/* Observações */}
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

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="
                      w-full h-13 rounded-xl font-semibold text-sm
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
                <form onSubmit={handleBankSubmit} className="space-y-7">
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-300">
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

                  <FormSection label="Atribuição da Despesa" required>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "geral", label: "Geral", desc: "Valor a parte do saldo individual dos sócios" },
                        { value: "rateio", label: "Ratear Igual", desc: "Dividir entre todos, entra no saldo de cada sócio por igual" },
                        { value: "socio", label: "Sócio Específico", desc: "Atribuir no saldo de um sócio" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBankForm((p) => ({ ...p, assignMode: opt.value as any, assignedPartnerCpf: "none" }))}
                          className={cn(
                            "flex flex-col items-center gap-1 p-4 rounded-xl border text-xs font-medium transition-all",
                            bankForm.assignMode === opt.value
                              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500"
                              : "border-border/70 text-muted-foreground hover:border-border"
                          )}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className="text-[10px] opacity-70 text-center">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </FormSection>

                  {bankForm.assignMode === "socio" && (
                    <FormSection label="Sócio Responsável" required>
                      <Select
                        value={bankForm.assignedPartnerCpf}
                        onValueChange={(v) => setBankForm((p) => ({ ...p, assignedPartnerCpf: v }))}
                        disabled={loadingPartners}
                      >
                        <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
                          <SelectValue placeholder={loadingPartners ? "Carregando sócios..." : "Selecione o sócio"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {partners.map((partner) => (
                            <SelectItem key={partner.id} value={partner.cpf} className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                                  {partner.nome.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{partner.nome}</div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {formatCPF(partner.cpf)}
                                    {partner.percentual_participacao && ` · ${partner.percentual_participacao}%`}
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

                  <FormSection label="Tipo de Despesa Bancária" required>
                    <Select
                      value={bankForm.categoria}
                      onValueChange={(v) => setBankForm((p) => ({ ...p, category: v as BankExpenseCategoryId }))}
                    >
                      <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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

                  <FormSection label="Descrição" required>
                    <Input
                      value={bankForm.descricao}
                      onChange={(e) => setBankForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Ex: Anuidade cartão Visa, Taxa TED, etc."
                      required
                      disabled={addExpense.isPending}
                      className="h-13 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormSection label="Instituição Bancária" required>
                      <Select
                        value={bankForm.bankName}
                        onValueChange={(v) => setBankForm((p) => ({ ...p, bankName: v }))}
                        disabled={loadingContas}
                      >
                        <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
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
                        onValueChange={(v) => setBankForm((p) => ({ ...p, prazo: v as "MENSAL" | "EXTRA" }))}
                      >
                        <SelectTrigger className="h-13 rounded-xl border-border/70 text-sm">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="mensal" className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">MENSAL</div>
                                <div className="text-xs text-muted-foreground">Ciclo mensal regular</div>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="EXTRA" className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">EXTRA</div>
                                <div className="text-xs text-muted-foreground">Evento ou gasto avulso</div>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormSection>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormSection label="Valor (R$)" required>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={bankForm.valor}
                          onChange={(e) => setBankForm((p) => ({ ...p, amount: e.target.value }))}
                          placeholder="0,00"
                          required
                          disabled={addExpense.isPending}
                          className="h-13 rounded-xl border-border/70 text-sm pl-10 font-mono"
                        />
                      </div>
                    </FormSection>
                    <FormSection label="Data" required>
                      <DateFieldWithInput
                        value={bankForm.data}
                        onChange={(v) => setBankForm((p) => ({ ...p, date: v }))}
                      />
                    </FormSection>
                  </div>

                  <FormSection label="Observação">
                    <Input
                      value={bankForm.notes}
                      onChange={(e) => setBankForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Informações adicionais..."
                      disabled={addExpense.isPending}
                      className="h-13 rounded-xl border-border/70 text-sm"
                    />
                  </FormSection>

                  <Button
                    type="submit"
                    className="
                      w-full h-13 rounded-xl font-semibold text-sm
                      bg-gradient-to-r from-blue-600 to-indigo-600
                      hover:from-blue-500 hover:to-indigo-500
                      text-white shadow-blue-500/20
                      transition-all duration-200 hover:-translate-y-px hover:shadow-md
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none
                    "
                    disabled={addExpense.isPending || !bankForm.categoria || !bankForm.valor || !bankForm.descricao || !bankForm.bankName || (bankForm.assignMode === "socio" && bankForm.assignedPartnerCpf === "none")}
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
              if (!newFuelSupplier.nome_fornecedor.trim() || !newFuelSupplier.cidade_name.trim() || !newFuelSupplier.icao_code.trim()) {
                toast.error('Preencha todos os campos obrigatórios');
                return;
              }
              setSavingFuelSupplier(true);
              try {
                const { data, error } = await supabase
                  .from('fornecedores_combustivel')
                  .insert({
                    nome_fornecedor: newFuelSupplier.nome_fornecedor.trim(),
                    city_name: newFuelSupplier.cidade_name.trim(),
                    icao_code: newFuelSupplier.icao_code.trim().toUpperCase(),
                  })
                  .select()
                  .single();
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ['fuel-suppliers'] });
                set('supplierName')(data.nome_fornecedor);
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
                value={newFuelSupplier.nome_fornecedor}
                onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, nome_fornecedor: e.target.value }))}
                placeholder="Ex: BR Aviation"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade *</Label>
                <Input
                  value={newFuelSupplier.cidade_name}
                  onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, city_name: e.target.value }))}
                  placeholder="Ex: São Paulo"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Código ICAO *</Label>
                <Input
                  value={newFuelSupplier.icao_code}
                  onChange={(e) => setNewFuelSupplier(prev => ({ ...prev, icao_code: e.target.value }))}
                  placeholder="Ex: SBSP"
                  className="h-11 uppercase"
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
        className="h-13 rounded-xl border-border/70 text-sm flex-1"
        maxLength={10}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-13 w-13 rounded-xl border-border/70 flex-shrink-0"
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
