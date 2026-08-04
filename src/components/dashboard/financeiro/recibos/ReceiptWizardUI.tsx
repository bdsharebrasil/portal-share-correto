// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import {
  FileText, Star, Calendar, ChevronRight,
  Check, User, DollarSign, FileCheck, Building2,
  Upload, X, AlertCircle, Search,
  ChevronDown, ClipboardList, Plus, Users
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// --- Primitives ---
function Input({ className = "", ...props }: any) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 bg-[#0f1623] border border-[#1e2d45] rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/40 transition-colors ${className}`}
    />
  );
}
function MoneyInput({ className = "", ...props }: any) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
      <input
        {...props}
        className={`w-full pl-9 pr-3 py-2.5 bg-[#0f1623] border border-[#1e2d45] rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/40 transition-colors ${className}`}
        placeholder="0,00"
      />
    </div>
  );
}
function Label({ children, className = "", htmlFor }: any) {
  return (
    <label htmlFor={htmlFor} className={`block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase ${className}`}>
      {children}
    </label>
  );
}
function Textarea({ className = "", ...props }: any) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 bg-[#0f1623] border border-[#1e2d45] rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/40 transition-colors resize-none ${className}`}
    />
  );
}
function Checkbox({ id, checked, onCheckedChange, label }: any) {
  return (
    <div className="flex items-center space-x-3">
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
          checked ? "bg-[#3b82f6] border-[#3b82f6]" : "bg-[#0f1623] border-[#1e2d45] hover:border-[#3b82f6]"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      {label && (
        <Label htmlFor={id} className="mb-0 cursor-pointer text-slate-200 normal-case tracking-normal">
          {label}
        </Label>
      )}
    </div>
  );
}

// --- Universal selector: usado em TODOS os campos de seleção do formulário ---
function SearchableCombobox({ items, value, onChange, placeholder, searchPlaceholder, emptyMessage }: any) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = items.filter((i: any) => i.label.toLowerCase().includes(query.toLowerCase()));
  const selected = items.find((i: any) => i.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2.5 bg-[#0f1623] border border-[#1e2d45] rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:border-[#3b82f6] transition-colors">
        <span className={selected ? "text-slate-100" : "text-slate-500"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#111827] border border-[#1e2d45] rounded-lg shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1e2d45]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full pl-7 pr-3 py-1.5 bg-[#0f1623] border border-[#1e2d45] rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6]" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500 text-center">{emptyMessage}</p>
            ) : (
              filtered.map((item: any) => (
                <button key={item.id} type="button" onClick={() => { onChange(item.id, item.label); setOpen(false); setQuery(""); }} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-[#1e2d45] transition-colors ${ item.id === value ? "text-[#3b82f6] bg-[#3b82f6]/10" : "text-slate-200" }`}>
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Calendário moderno (digitar ou selecionar) — inalterado
function DateInput({ value, onChange, placeholder = "DD/MM/AAAA", required, className = "" }: any) {
  const displayValue = value ? (() => { try { const [y,m,d] = value.split("-").map(Number); return format(new Date(y,m-1,d), "dd/MM/yyyy"); } catch { return ""; } })() : "";
  return (
    <div className="relative">
      <Input value={displayValue} required={required} placeholder={placeholder} className={`pr-10 ${className}`} onChange={(e: any) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0,8);
        if (raw.length === 8) { const [dd,mm,yyyy] = [raw.slice(0,2), raw.slice(2,4), raw.slice(4,8)]; onChange(`${yyyy}-${mm}-${dd}`); } else if (raw.length === 0) { onChange(""); }
      }} maxLength={10} />
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <Calendar className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0 border-0 z-[9999]">
          <DatePickerCalendar
            value={value ? new Date(value + "T00:00:00") : undefined}
            onChange={(date: Date | undefined) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FileUpload({ label, value, onChange, accept }: any) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <div onClick={() => ref.current?.click()} className={`relative flex items-center gap-3 px-3 py-2.5 bg-[#0f1623] border border-dashed rounded-lg cursor-pointer hover:border-[#3b82f6]/60 transition-colors ${ value ? "border-[#3b82f6]/40 bg-[#3b82f6]/5" : "border-[#1e2d45]" }`}>
        <Upload className={`w-4 h-4 flex-shrink-0 ${value ? "text-[#3b82f6]" : "text-slate-500"}`} />
        <span className="text-sm truncate text-slate-400">{value ? value.name : "Selecionar arquivo (opcional)"}</span>
        {value && (<button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="ml-auto text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>)}
        <input ref={ref} type="file" className="hidden" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent, children }: any) {
  return (
    <div className={`rounded-xl border p-5 space-y-4 ${accent || "border-[#1e2d45] bg-[#0f1623]/60"}`}>
      {title && (<div className="flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-slate-400" />}<span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span></div>)}
      {children}
    </div>
  );
}
function Row({ children, className = "" }: any) { return <div className={`grid gap-4 ${className || "grid-cols-1 sm:grid-cols-2"}`}>{children}</div>; }
function Field({ children }: any) { return <div>{children}</div>; }

// --- Steps Configuration ---
const STEPS = [
  { id: 1, label: "Tipo", shortLabel: "Tipo", icon: FileText },
  { id: 2, label: "Identificação", shortLabel: "ID", icon: User },
  { id: 3, label: "Pagador", shortLabel: "Pagador", icon: Building2 },
  { id: 4, label: "Valores", shortLabel: "Valores", icon: DollarSign },
  { id: 5, label: "Descrição", shortLabel: "Descrição", icon: ClipboardList },
  { id: 6, label: "Confirmar", shortLabel: "Revisar", icon: FileCheck },
];

function StepIndicator({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="flex items-center justify-between px-2">
      {STEPS.map((step, idx) => {
        const isCompleted = completed.includes(step.id);
        const isActive = current === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${ isCompleted ? "bg-[#3b82f6] border-[#3b82f6] shadow-md shadow-[#3b82f6]/20" : isActive ? "bg-[#111827] border-[#3b82f6] shadow-md shadow-[#3b82f6]/15" : "bg-[#111827] border-[#1e2d45]" }`}>
                {isCompleted ? (<Check className="w-4 h-4 text-white" strokeWidth={3} />) : (<Icon className={`w-4 h-4 ${isActive ? "text-[#3b82f6]" : "text-slate-600"}`} />)}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block transition-colors ${ isActive ? "text-[#3b82f6]" : isCompleted ? "text-slate-400" : "text-slate-600" }`}>
                {step.shortLabel}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-2 mb-5 sm:mb-0 relative overflow-hidden" style={{ marginTop: "-14px" }}>
                <div className="absolute inset-0 bg-[#1e2d45]" />
                <div className="absolute inset-0 bg-[#3b82f6] transition-transform duration-500 origin-left" style={{ transform: isCompleted ? "scaleX(1)" : "scaleX(0)" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: any }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#1e2d45] last:border-0">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-200 text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
}

// --- Helpers ---
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
// Busca o primeiro campo existente num objeto vindo do Supabase — protege contra
// nomes de coluna que eu não tenho certeza (ex: "razao_social" vs "nome").
// AJUSTE os nomes de coluna abaixo conforme o schema real da tabela "clientes".
function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k]) return obj[k];
  }
  return "";
}

const ANEXO_TIPOS = [
  { id: "boleto", label: "Boleto" },
  { id: "nota_fiscal", label: "Nota Fiscal" },
  { id: "demonstrativo", label: "Demonstrativo" },
  { id: "recibo", label: "Recibo" },
];

const FORMA_PAGAMENTO_ITEMS = [
  { id: "pix", label: "PIX" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
];

function makeEmptyPagador() {
  return {
    id: uid(),
    clienteId: "",
    socioId: "",
    socioNome: "",
    pagadorNome: "",
    pagadorDocumento: "",
    pagadorEndereco: "",
    pagadorCidade: "",
    pagadorUF: "",
    percentual: "",
    valor: "",
    valorManual: false,
    gerarRecibo: true,
  };
}

function makeEmptyAnexo() {
  return { id: uid(), tipo: "", numeroDocumento: "", file: null as File | null };
}

// --- Main Wizard UI Component ---
interface Props {
  clientesAtivos?: any[];
  favoritePayers?: any[];
  isGenerating?: boolean;
  onSubmit?: (data: any) => Promise<any> | void;
}

export function ReceiptWizardUI({ clientesAtivos = [], favoritePayers = [], isGenerating = false, onSubmit = () => {} }: Props) {
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [formData, setFormData] = useState<any>({
    receiptType: "pagamento",
    multiCliente: false,

    aircraftId: "",
    reembolsoCategoriaId: "",
    reembolsoCategoriaNome: "",
    reembolsoSubcategoria: "",
    competencia: "",

    valorTotalRecibo: "",
    valor: "",
    formaPagamento: "",

    servicoDescricao: "",
    dataEmissao: new Date().toISOString().split("T")[0],
    prazoMaximoQuitacao: "",
  });

  const [pagadores, setPagadores] = useState<any[]>([makeEmptyPagador()]);
  const [anexos, setAnexos] = useState<any[]>([makeEmptyAnexo()]);
  // Recibo do tipo reembolso SEMPRE segue para a Programação de Pagamento (sem perguntar)

  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [expenseConfigs, setExpenseConfigs] = useState<any[]>([]);
  const [favoriteDescriptions, setFavoriteDescriptions] = useState<any[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFavoritePayers, setShowFavoritePayers] = useState(false);
  const [clientPartnersMap, setClientPartnersMap] = useState<Record<string, any[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";
  const isMulti = isReembolso && formData.multiCliente;

  const selectedExpenseConfig = expenseConfigs.find((c: any) => c.id === formData.reembolsoCategoriaId);
  const subcategoriaOptions = selectedExpenseConfig
    ? [selectedExpenseConfig.subcategoria_1, selectedExpenseConfig.subcategoria_2, selectedExpenseConfig.subcategoria_3, selectedExpenseConfig.subcategoria_4].filter(Boolean)
    : [];
  const categoriaNome = selectedExpenseConfig
    ? [selectedExpenseConfig.expense_type, formData.reembolsoSubcategoria].filter(Boolean).join(" / ")
    : formData.reembolsoCategoriaNome || "";

  const isDecea = categoriaNome.toUpperCase().includes("DECEA");
  const isInfraero = categoriaNome.toUpperCase().includes("INFRAERO");
  const isDECEAorINFRAERO = isDecea || isInfraero;

  useEffect(() => {
    loadExpenseConfigs();
    loadAircrafts();
    loadFavoriteDescriptions();
  }, []);

  const loadAircrafts = async () => {
    const { data: airData } = await supabase.from("aeronave").select("id, matricula, modelo").eq("status", "ativa").order("matricula");
    setAircrafts(airData || []);
  };

  const loadFavoriteDescriptions = async () => {
    const { data: favData } = await supabase.from("receipt_descriptions").select("*").order("criado_em", { ascending: false });
    setFavoriteDescriptions(favData || []);
  };

  const loadExpenseConfigs = async () => {
    try {
      const { data: expData } = await supabase
        .from("expense_configu")
        .select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4")
        .order("expense_type");
      setExpenseConfigs(expData || []);
    } catch (err) {
      console.error("Erro ao carregar expense_configu", err);
    }
  };

  // --- Pagadores (lista) ---
  const updatePagador = (rowId: string, field: string, value: any) => {
    setPagadores((prev) => prev.map((p) => (p.id === rowId ? { ...p, [field]: value } : p)));
  };

  const addPagador = () => setPagadores((prev) => [...prev, makeEmptyPagador()]);
  const removePagador = (rowId: string) => setPagadores((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== rowId) : prev));

  // Ao selecionar um cliente na linha do pagador: busca dados completos no Supabase
  // (tabela "clientes") e carrega os sócios daquele cliente para autopreenchimento.
  const handleSelecionaCliente = async (rowId: string, clienteId: string) => {
    updatePagador(rowId, "clienteId", clienteId);
    updatePagador(rowId, "socioId", "");
    updatePagador(rowId, "socioNome", "");
    if (!clienteId) return;

    try {
      const { data: clienteData } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
      if (clienteData) {
        updatePagador(rowId, "pagadorNome", pick(clienteData, ["razao_social", "nome"]));
        updatePagador(rowId, "pagadorDocumento", pick(clienteData, ["cnpj", "cpf", "documento"]));
        updatePagador(rowId, "pagadorEndereco", pick(clienteData, ["endereco", "address"]));
        updatePagador(rowId, "pagadorCidade", pick(clienteData, ["cidade", "city"]));
        updatePagador(rowId, "pagadorUF", pick(clienteData, ["uf", "estado"]));
      } else {
        // fallback: usa ao menos o nome já disponível na lista recebida por prop
        const fallback = clientesAtivos.find((c) => c.id === clienteId);
        if (fallback) updatePagador(rowId, "pagadorNome", fallback.razao_social || fallback.nome || "");
      }
    } catch (err) {
      console.error("Erro ao buscar dados do cliente", err);
    }

    if (!clientPartnersMap[clienteId]) {
      try {
        const { data } = await supabase.from("socios").select("id, nome, cpf").eq("cliente_id", clienteId).order("nome");
        setClientPartnersMap((prev) => ({ ...prev, [clienteId]: data || [] }));
      } catch (err) {
        console.error("Erro ao carregar sócios do cliente", err);
      }
    }
  };

  const handleSelecionaSocio = (rowId: string, socioId: string) => {
    const row = pagadores.find((p) => p.id === rowId);
    const partners = clientPartnersMap[row?.clienteId] || [];
    if (!socioId) {
      updatePagador(rowId, "socioId", "");
      updatePagador(rowId, "socioNome", "");
      return;
    }
    const partner = partners.find((p) => p.id === socioId);
    updatePagador(rowId, "socioId", socioId);
    updatePagador(rowId, "socioNome", partner?.nome || "");
    if (partner?.nome) updatePagador(rowId, "pagadorNome", partner.nome);
    if (partner?.cpf) updatePagador(rowId, "pagadorDocumento", partner.cpf);
  };

  const selectFavoritePayer = (payer: any) => {
    const firstRowId = pagadores[0]?.id;
    if (!firstRowId) return;
    updatePagador(firstRowId, "pagadorNome", payer.name || payer.nome || "");
    updatePagador(firstRowId, "pagadorDocumento", payer.document || payer.cpf || "");
    updatePagador(firstRowId, "pagadorEndereco", payer.address || payer.endereco || "");
    updatePagador(firstRowId, "pagadorCidade", payer.city || payer.cidade || "");
    updatePagador(firstRowId, "pagadorUF", payer.uf || "");
    setShowFavoritePayers(false);
  };

  // Liga/desliga o rateio entre múltiplos clientes
  const setMultiCliente = (value: boolean) => {
    setFormData((prev: any) => ({ ...prev, multiCliente: value }));
    if (value && pagadores.length < 2) {
      setPagadores((prev) => [...prev, makeEmptyPagador()]);
    }
    if (!value) {
      setPagadores((prev) => [prev[0] || makeEmptyPagador()]);
    }
  };

  // Recalcula o valor de cada linha (total * percentual) quando o valor total muda,
  // preservando linhas cujo valor foi editado manualmente.
  useEffect(() => {
    if (!isMulti) return;
    const total = parseFloat(String(formData.valorTotalRecibo).replace(",", "."));
    if (Number.isNaN(total)) return;
    setPagadores((prev) =>
      prev.map((row) => {
        if (row.valorManual) return row;
        const pct = parseFloat(String(row.percentual).replace(",", "."));
        if (Number.isNaN(pct)) return row;
        return { ...row, valor: ((total * pct) / 100).toFixed(2) };
      })
    );
  }, [formData.valorTotalRecibo, isMulti]);

  const updateRowPercentual = (rowId: string, percentual: string) => {
    const total = parseFloat(String(formData.valorTotalRecibo).replace(",", "."));
    const pct = parseFloat(String(percentual).replace(",", "."));
    setPagadores((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const valor = !Number.isNaN(total) && !Number.isNaN(pct) ? ((total * pct) / 100).toFixed(2) : row.valor;
        return { ...row, percentual, valor, valorManual: false };
      })
    );
  };

  // --- Anexos (lista) ---
  const updateAnexo = (rowId: string, field: string, value: any) => setAnexos((prev) => prev.map((a) => (a.id === rowId ? { ...a, [field]: value } : a)));
  const addAnexo = () => setAnexos((prev) => [...prev, makeEmptyAnexo()]);
  const removeAnexo = (rowId: string) => setAnexos((prev) => (prev.length > 1 ? prev.filter((a) => a.id !== rowId) : prev));

  // Auto-geração da descrição (DECEA / INFRAERO / demais categorias)
  useEffect(() => {
    if (!isReembolso || !selectedExpenseConfig) return;
    const aer = aircrafts.find((a) => a.id === formData.aircraftId);
    const aerStr = aer?.matricula ? ` AERONAVE ${aer.matricula}` : "";
    const demonstrativo = anexos.find((a) => a.tipo === "demonstrativo");
    const docNum = demonstrativo?.numeroDocumento ? demonstrativo.numeroDocumento.toUpperCase() : "";

    if (isInfraero) {
      const c = formData.competencia ? ` COMPETÊNCIA ${formData.competencia.toUpperCase()}` : "";
      const d = docNum ? ` DEMONSTRATIVO ${docNum}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `REFERENTE A INFRAERO${aerStr}${c}${d}`.trim() }));
    } else if (isDecea) {
      const c = formData.competencia ? ` COMPETÊNCIA ${formData.competencia.toUpperCase()}` : "";
      const d = docNum ? ` DEMONSTRATIVO ${docNum}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `REFERENTE A DECEA${aerStr}${c}${d}`.trim() }));
    } else {
      const s = formData.reembolsoSubcategoria ? ` / ${formData.reembolsoSubcategoria}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `Referente a ${selectedExpenseConfig.expense_type}${s}` }));
    }
  }, [
    formData.reembolsoCategoriaId,
    formData.reembolsoSubcategoria,
    formData.aircraftId,
    formData.competencia,
    isInfraero,
    isDecea,
    isReembolso,
    selectedExpenseConfig,
    aircrafts,
    anexos,
  ]);

  const clienteItems = clientesAtivos.map((c: any) => ({ id: c.id, label: c.razao_social || c.nome || "Sem nome" }));
  const aeronaveItems = aircrafts.map((a: any) => ({ id: a.id, label: `${a.matricula} – ${a.modelo}` }));
  const categoriaItems = expenseConfigs.map((c: any) => ({ id: c.id, label: c.expense_type }));
  const subcategoriaItems = subcategoriaOptions.map((s: string) => ({ id: s, label: s }));

  const submitting = isGenerating || isSaving;

  const goNext = () => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
    setStep((s) => Math.min(s + 1, STEPS.length));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const selectReceiptType = (type: string) => {
    setFormData((p: any) => {
      const next: any = { ...p, receiptType: type };
      if (type === "pagamento") {
        return {
          ...next,
          multiCliente: false,
          reembolsoCategoriaId: "",
          reembolsoCategoriaNome: "",
          reembolsoSubcategoria: "",
          competencia: "",
          valorTotalRecibo: "",
          prazoMaximoQuitacao: "",
        };
      }
      return next;
    });
    if (type === "pagamento") setPagadores((prev) => [prev[0] || makeEmptyPagador()]);
  };

  const selectFavoriteDescription = (description: string) => {
    setFormData((prev: any) => ({ ...prev, servicoDescricao: description }));
    setShowFavorites(false);
  };

  const totalPercentual = pagadores.reduce((sum, p) => sum + (parseFloat(String(p.percentual).replace(",", ".")) || 0), 0);
  const totalValorAlocado = pagadores.reduce((sum, p) => sum + (parseFloat(String(p.valor).replace(",", ".")) || 0), 0);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const demonstrativo = anexos.find((a) => a.tipo === "demonstrativo");
      const notaFiscal = anexos.find((a) => a.tipo === "nota_fiscal");
      const docNum = isDECEAorINFRAERO ? demonstrativo?.numeroDocumento || null : notaFiscal?.numeroDocumento || null;

      const principal = pagadores.find((p) => p.gerarRecibo && String(p.pagadorNome || "").trim()) || pagadores[0] || {};

      // Formato "plano" esperado pelo handler de geração (EmissaoRecibo)
      const flatOriginalFormData = {
        ...formData,
        receiptType: formData.receiptType,
        aircraftId: formData.aircraftId || "",
        clienteId: principal.clienteId || "",
        pagadorNome: principal.pagadorNome || "",
        pagadorDocumento: principal.pagadorDocumento || "",
        pagadorEndereco: principal.pagadorEndereco || "",
        pagadorCidade: principal.pagadorCidade || "",
        pagadorUF: principal.pagadorUF || "",
        reembolsoRateado: Boolean(formData.multiCliente),
        reembolsoValorTotal: formData.valorTotalRecibo || formData.valor || "",
        reembolsoPorcentagem: principal.percentual || "",
        reembolsoCategoriaId: formData.reembolsoCategoriaId || "",
        reembolsoSubcategoria: formData.reembolsoSubcategoria || "",
        reembolsoNumeroDocumento: docNum,
        categoriaNome,
        pagadores: pagadores.map((p) => ({ ...p })),
        anexos,
      };

      const payload = {
        ...formData,
        valor: formData.valor || principal.valor || formData.valorTotalRecibo || "",
        isDecea,
        isInfraero,
        nome_categoria: categoriaNome,
        subcategoria_1: selectedExpenseConfig?.subcategoria_1 || null,
        subcategoria_2: selectedExpenseConfig?.subcategoria_2 || null,
        subcategoria_3: selectedExpenseConfig?.subcategoria_3 || null,
        subcategoria_4: selectedExpenseConfig?.subcategoria_4 || null,
        subcategoria_selecionada: formData.reembolsoSubcategoria || null,
        numeroDocumento: docNum,
        dataMaxPagamento: formData.prazoMaximoQuitacao || null,
        pagadores: pagadores.map((p) => ({ ...p })),
        anexos: anexos.filter((a) => a.tipo).map((a) => ({ tipo: a.tipo, numeroDocumento: a.numeroDocumento, file: a.file })),
        enviarParaProgramacao: isReembolso,
        originalFormData: flatOriginalFormData,
      };


      await onSubmit(payload);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Tipo de Recibo</h3><p className="text-sm text-slate-500">Selecione a natureza do recibo que será gerado</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => selectReceiptType('pagamento')} className={`p-4 rounded-xl w-full text-left transition-all ${formData.receiptType==='pagamento' ? 'border-[#3b82f6] bg-[#3b82f6]/10 border-2' : 'border-[#1e2d45] bg-[#111827] border hover:border-[#3b82f6]/50'}`}><div className="font-semibold text-slate-100">Pagamento</div><p className="text-xs text-slate-500 mt-1">Recibo de serviços prestados ou tarifas avulsas</p></button>
              <button type="button" onClick={() => selectReceiptType('reembolso')} className={`p-4 rounded-xl w-full text-left transition-all ${formData.receiptType==='reembolso' ? 'border-[#f59e0b] bg-[#f59e0b]/10 border-2' : 'border-[#1e2d45] bg-[#111827] border hover:border-[#f59e0b]/50'}`}><div className="font-semibold text-slate-100">Reembolso</div><p className="text-xs text-slate-500 mt-1">Devolução de despesas reembolsáveis ao cliente</p></button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Identificação</h3><p className="text-sm text-slate-500">Vincule a aeronave e categorize a operação{isReembolso ? ", e defina os clientes envolvidos" : ""}</p></div>

            {isReembolso && (
              <SectionCard title="Clientes Envolvidos" icon={Users}>
                <p className="text-sm text-slate-400 mb-3">Deseja associar esse recibo para mais de um cliente?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setMultiCliente(false)} className={`p-3 rounded-xl w-full text-left transition-all text-sm ${!formData.multiCliente ? 'border-[#3b82f6] bg-[#3b82f6]/10 border-2 text-slate-100' : 'border-[#1e2d45] bg-[#111827] border text-slate-400 hover:border-[#3b82f6]/50'}`}>Não, apenas um cliente</button>
                  <button type="button" onClick={() => setMultiCliente(true)} className={`p-3 rounded-xl w-full text-left transition-all text-sm ${formData.multiCliente ? 'border-[#3b82f6] bg-[#3b82f6]/10 border-2 text-slate-100' : 'border-[#1e2d45] bg-[#111827] border text-slate-400 hover:border-[#3b82f6]/50'}`}>Sim, ratear entre clientes</button>
                </div>
              </SectionCard>
            )}

            <Row>
              <Field>
                <Label>Aeronave</Label>
                <SearchableCombobox items={aeronaveItems} value={formData.aircraftId} onChange={(id: string) => setFormData((p: any) => ({ ...p, aircraftId: id }))} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave" />
              </Field>
              {isReembolso && (
                <Field>
                  <Label>Categoria (Despesas Reembolsáveis)</Label>
                  <SearchableCombobox
                    items={categoriaItems}
                    value={formData.reembolsoCategoriaId}
                    onChange={(id: string, label: string) => setFormData((p: any) => ({ ...p, reembolsoCategoriaId: id, reembolsoCategoriaNome: label, reembolsoSubcategoria: "", competencia: "" }))}
                    placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria"
                  />
                </Field>
              )}
            </Row>

            {isReembolso && (subcategoriaItems.length > 0 || isDECEAorINFRAERO) && (
              <Row>
                {subcategoriaItems.length > 0 && (
                  <Field>
                    <Label>Subcategoria</Label>
                    <SearchableCombobox items={subcategoriaItems} value={formData.reembolsoSubcategoria} onChange={(id: string) => setFormData((p: any) => ({ ...p, reembolsoSubcategoria: id }))} placeholder="Selecione a subcategoria" searchPlaceholder="Buscar subcategoria..." emptyMessage="Nenhuma subcategoria" />
                  </Field>
                )}
                {isDECEAorINFRAERO && (
                  <Field>
                    <Label>Competência</Label>
                    <Input value={formData.competencia} placeholder="MM/AAAA" onChange={(e: any) => setFormData((p: any) => ({ ...p, competencia: e.target.value }))} />
                  </Field>
                )}
              </Row>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Dados do Pagador</h3><p className="text-xs text-slate-500">Informações que sairão impressas no documento{isMulti ? " — uma linha por cliente" : ""}</p></div>

            {!isMulti && favoritePayers.length > 0 && (
              <div className="rounded-xl border border-[#1e2d45] p-4 bg-[#0f1623]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">Pagadores favoritos</span>
                  <button type="button" onClick={() => setShowFavoritePayers((prev) => !prev)} className="text-xs text-slate-400 hover:text-slate-200">{showFavoritePayers ? "Ocultar" : "Selecionar"}</button>
                </div>
                {showFavoritePayers && (
                  <div className="grid gap-2">
                    {favoritePayers.map((payer: any) => (
                      <button key={payer.id} type="button" onClick={() => selectFavoritePayer(payer)} className="w-full text-left px-3 py-2 rounded-lg border border-[#1e2d45] text-sm text-slate-200 hover:border-[#3b82f6] hover:bg-[#1e2d45]/40 transition-colors">
                        <div className="font-semibold">{payer.name || payer.nome}</div>
                        <div className="text-xs text-slate-500">{payer.document || payer.cpf}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pagadores.map((row, idx) => {
              const partners = clientPartnersMap[row.clienteId] || [];
              const partnerItems = partners.map((p: any) => ({ id: p.id, label: `${p.nome}${p.cpf ? ` (${p.cpf})` : ""}` }));
              return (
                <SectionCard key={row.id} title={isMulti ? `Cliente ${idx + 1}` : undefined}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-4">
                      <Row>
                        <Field>
                          <Label>Cliente</Label>
                          <SearchableCombobox items={clienteItems} value={row.clienteId} onChange={(id: string) => handleSelecionaCliente(row.id, id)} placeholder="Selecione o cliente" searchPlaceholder="Buscar cliente..." emptyMessage="Nenhum cliente" />
                        </Field>
                        {partnerItems.length > 0 && (
                          <Field>
                            <Label>Sócio responsável (opcional)</Label>
                            <SearchableCombobox items={partnerItems} value={row.socioId} onChange={(id: string) => handleSelecionaSocio(row.id, id)} placeholder="Cliente principal" searchPlaceholder="Buscar sócio..." emptyMessage="Nenhum sócio" />
                          </Field>
                        )}
                      </Row>
                      <Row>
                        <Field><Label>Nome / Razão Social *</Label><Input value={row.pagadorNome} onChange={(e: any) => updatePagador(row.id, "pagadorNome", e.target.value)} required /></Field>
                        <Field><Label>CPF / CNPJ *</Label><Input value={row.pagadorDocumento} onChange={(e: any) => updatePagador(row.id, "pagadorDocumento", e.target.value)} required /></Field>
                      </Row>
                      <Field><Label>Endereço</Label><Input value={row.pagadorEndereco} onChange={(e: any) => updatePagador(row.id, "pagadorEndereco", e.target.value)} /></Field>
                      <Row>
                        <Field><Label>Cidade</Label><Input value={row.pagadorCidade} onChange={(e: any) => updatePagador(row.id, "pagadorCidade", e.target.value)} /></Field>
                        <Field><Label>UF</Label><Input value={row.pagadorUF} onChange={(e: any) => updatePagador(row.id, "pagadorUF", e.target.value)} maxLength={2} className="uppercase" /></Field>
                      </Row>
                    </div>
                    {isMulti && pagadores.length > 1 && (
                      <button type="button" onClick={() => removePagador(row.id)} className="text-slate-500 hover:text-red-400 mt-1"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                </SectionCard>
              );
            })}

            {isMulti && (
              <button type="button" onClick={addPagador} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#1e2d45] text-slate-400 hover:border-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors text-sm">
                <Plus className="w-4 h-4" /> Adicionar outro cliente
              </button>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Valores & Detalhes Financeiros</h3></div>

            {isMulti ? (
              <>
                <Field><Label>Valor Total do Recibo *</Label><MoneyInput value={formData.valorTotalRecibo} onChange={(e: any) => setFormData((p: any) => ({ ...p, valorTotalRecibo: e.target.value }))} required /></Field>

                <div className="space-y-3">
                  {pagadores.map((row, idx) => (
                    <SectionCard key={row.id} accent="border-[#3b82f6]/20 bg-[#3b82f6]/5">
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                        <span className="text-sm font-medium text-slate-200">{row.pagadorNome || `Cliente ${idx + 1}`}</span>
                        <Checkbox id={`gerar-${row.id}`} checked={row.gerarRecibo} label="Gerar recibo" onCheckedChange={(v: boolean) => updatePagador(row.id, "gerarRecibo", v)} />
                      </div>
                      <Row className="grid-cols-1 sm:grid-cols-2">
                        <Field><Label>% de Uso</Label><Input type="number" step="0.001" value={row.percentual} placeholder="Ex: 33.333" onChange={(e: any) => updateRowPercentual(row.id, e.target.value)} /></Field>
                        <Field><Label>Valor</Label><MoneyInput value={row.valor} onChange={(e: any) => { updatePagador(row.id, "valor", e.target.value); updatePagador(row.id, "valorManual", true); }} /></Field>
                      </Row>
                      {!row.gerarRecibo && (
                        <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Apenas rateio para balanço — nenhum recibo de pagamento será gerado para este cliente.</p>
                      )}
                    </SectionCard>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>% total alocado: {totalPercentual.toFixed(2)}%</span>
                  <span>Valor total alocado: R$ {totalValorAlocado.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <Field><Label>Valor do Recibo *</Label><MoneyInput value={formData.valor} onChange={(e: any) => setFormData((p: any) => ({ ...p, valor: e.target.value }))} required /></Field>
            )}

            {!isReembolso && (
              <Field>
                <Label>Forma de Pagamento</Label>
                <SearchableCombobox items={FORMA_PAGAMENTO_ITEMS} value={formData.formaPagamento} onChange={(id: string) => setFormData((p: any) => ({ ...p, formaPagamento: id }))} placeholder="Selecione" searchPlaceholder="Buscar..." emptyMessage="Nenhuma opção" />
              </Field>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Descrição & Documentos</h3></div>

            <Field>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="mb-0">Descrição do Serviço *</Label>
                {favoriteDescriptions.length > 0 && (
                  <button type="button" onClick={() => setShowFavorites(!showFavorites)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${showFavorites ? "bg-[#f59e0b]/20 border-[#f59e0b]/30 text-[#f59e0b]" : "border-[#1e2d45] text-slate-400 hover:text-slate-200"}`}><Star className="w-3 h-3" />Favoritas</button>
                )}
              </div>
              {showFavorites && favoriteDescriptions.length > 0 && (
                <div className="border border-[#1e2d45] rounded-lg overflow-hidden mb-3 bg-[#0f1623] shadow-inner">
                  <div className="max-h-36 overflow-y-auto">
                    {favoriteDescriptions.map((desc: any) => {
                      const text = desc.descricao || desc.description || "";
                      return (<button key={desc.id} type="button" onClick={() => selectFavoriteDescription(text)} className="w-full text-left px-3 py-2.5 text-sm text-slate-300 hover:bg-[#1e2d45] transition-colors border-b border-[#1e2d45] last:border-0">{text}</button>);
                    })}
                  </div>
                </div>
              )}
              <Textarea value={formData.servicoDescricao} onChange={(e: any) => setFormData((p: any) => ({ ...p, servicoDescricao: e.target.value }))} rows={3} required />
            </Field>

            <Row>
              <Field><Label>Data Emissão</Label><DateInput value={formData.dataEmissao} onChange={(v: string) => setFormData((p: any) => ({ ...p, dataEmissao: v }))} /></Field>
              <Field><Label>Prazo Máximo para Pagamento</Label><DateInput value={formData.prazoMaximoQuitacao} onChange={(v: string) => setFormData((p: any) => ({ ...p, prazoMaximoQuitacao: v }))} /></Field>
            </Row>

            <div className="space-y-3">
              <Label>Anexos</Label>
              {anexos.map((row) => (
                <div key={row.id} className="flex items-start gap-2 p-3 rounded-xl border border-[#1e2d45] bg-[#0f1623]/60">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SearchableCombobox items={ANEXO_TIPOS} value={row.tipo} onChange={(id: string) => updateAnexo(row.id, "tipo", id)} placeholder="Tipo do documento" searchPlaceholder="Buscar tipo..." emptyMessage="Nenhum tipo" />
                    <Input value={row.numeroDocumento} placeholder="Número do documento" onChange={(e: any) => updateAnexo(row.id, "numeroDocumento", e.target.value)} />
                    <FileUpload value={row.file} onChange={(f: File | null) => updateAnexo(row.id, "file", f)} accept=".pdf,.jpg,.png" />
                  </div>
                  {anexos.length > 1 && (
                    <button type="button" onClick={() => removeAnexo(row.id)} className="text-slate-500 hover:text-red-400 mt-2.5"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addAnexo} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#1e2d45] text-slate-400 hover:border-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors text-sm">
                <Plus className="w-4 h-4" /> Adicionar documento
              </button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Revisão Final</h3></div>

            <SectionCard title="Resumo">
              <ReviewItem label="Tipo" value={isReembolso ? 'Reembolso' : 'Pagamento'} />
              <ReviewItem label="Aeronave" value={aircrafts.find((a) => a.id === formData.aircraftId)?.matricula} />
              {isReembolso && <ReviewItem label="Categoria" value={categoriaNome} />}
              <ReviewItem label="Emissão" value={format(new Date(formData.dataEmissao + "T00:00:00"), "dd/MM/yyyy")} />
              <ReviewItem label="Valor" value={isMulti ? `R$ ${totalValorAlocado.toFixed(2)}` : (formData.valor ? `R$ ${formData.valor}` : '')} />
            </SectionCard>

            <SectionCard title={isMulti ? "Clientes / Rateio" : "Pagador"}>
              {pagadores.map((row, idx) => (
                <div key={row.id} className="py-2 border-b border-[#1e2d45] last:border-0">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-sm text-slate-200">{row.pagadorNome || `Cliente ${idx + 1}`}</span>
                    {isMulti && (
                      <span className="text-xs text-slate-500">
                        {row.percentual ? `${row.percentual}%` : ''} {row.valor ? `— R$ ${row.valor}` : ''} {row.gerarRecibo ? '' : '(sem recibo)'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </SectionCard>

            {anexos.some((a) => a.tipo) && (
              <SectionCard title="Anexos">
                {anexos.filter((a) => a.tipo).map((a) => (
                  <ReviewItem key={a.id} label={ANEXO_TIPOS.find((t) => t.id === a.tipo)?.label || a.tipo} value={a.numeroDocumento || (a.file ? a.file.name : '')} />
                ))}
              </SectionCard>
            )}

            {isReembolso && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 mt-4 text-sm text-emerald-300">
                Ao finalizar, este recibo de reembolso será enviado automaticamente para a
                <strong> Programação de Pagamento</strong> (Contas a Pagar, Contas a Receber, Movimentações e Rateio).
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="rounded-[19px] bg-[#090e17] border border-[#1e2d45] p-6 md:p-8 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Emissor de Recibos</h2>
            <p className="text-xs text-slate-500">Etapa {step} de {STEPS.length} — {STEPS[step-1].label}</p>
          </div>
          <div><span className="text-xs font-mono text-slate-600 bg-[#0f1623] border border-[#1e2d45] px-2.5 py-1 rounded-lg">{formData.receiptType==='reembolso'?'REEMBOLSO':'PAGAMENTO'}</span></div>
        </div>
      </div>
      <div className="mb-8"><StepIndicator current={step} completed={completedSteps} /></div>

      <div className="min-h-[360px]">{renderStep()}</div>

      <div className="mt-8 flex items-center justify-between border-t border-[#1e2d45] pt-5">
        <button type="button" onClick={goBack} disabled={step===1} className="px-4 py-2.5 text-sm text-slate-400 border border-[#1e2d45] rounded-xl hover:bg-[#1e2d45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Voltar</button>
        <div className="flex items-center gap-3">
          {step < STEPS.length ? (
            <button type="button" onClick={goNext} className="px-5 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl transition-colors shadow-lg shadow-[#3b82f6]/20 font-medium flex items-center gap-1">
              Próximo <ChevronRight className="w-4 h-4"/>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white rounded-xl shadow-lg shadow-[#3b82f6]/30 font-medium disabled:opacity-70 flex items-center gap-2">
              {submitting ? 'Processando...' : 'Finalizar Recibo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReceiptWizardUI;
