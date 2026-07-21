import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import {
  FileText, Star, Calendar, ChevronRight, ChevronLeft,
  Check, User, Plane, DollarSign, FileCheck, Building2,
  Percent, Upload, X, AlertCircle, RefreshCw, Search,
  ChevronDown, ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";

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

function Select({ value, onValueChange, children, placeholder = "Selecione..." }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: { value: string; label: string }[] = [];

  const traverse = (nodes: any) => {
    if (!nodes) return;
    const arr = Array.isArray(nodes) ? nodes : [nodes];
    arr.forEach((node: any) => {
      if (!node) return;
      // FIX: quando o filho é um array puro (ex: resultado de .map()),
      // ele precisa ser percorrido recursivamente — antes era ignorado
      // silenciosamente porque arrays não têm .type nem .props.
      if (Array.isArray(node)) {
        traverse(node);
        return;
      }
      if (node.type === SelectItem) {
        options.push({ value: node.props.value, label: node.props.children });
      } else if (node.props?.children) {
        traverse(node.props.children);
      }
    });
  };
  traverse(children);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 bg-[#0f1623] border border-[#1e2d45] rounded-lg text-sm text-left flex items-center justify-between focus:outline-none focus:border-[#3b82f6] transition-colors"
      >
        <span className={selected ? "text-slate-100" : "text-slate-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#111827] border border-[#1e2d45] rounded-lg shadow-2xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onValueChange(opt.value); setOpen(false); }}
                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-[#1e2d45] transition-colors ${
                  opt.value === value ? "text-[#3b82f6] bg-[#3b82f6]/10" : "text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function SelectItem({ value, children }: any) { return null; }

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
      <Label>{label}</Label>
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
    pagadorNome: "",
    pagadorDocumento: "",
    pagadorEndereco: "",
    pagadorCidade: "",
    pagadorUF: "",
    valor: "",
    servicoDescricao: "",
    dataEmissao: new Date().toISOString().split("T")[0],
    prazoMaximoQuitacao: "",
    formaPagamento: "",
    clienteId: "",
    aircraftId: "",

    // Reembolso fields
    reembolsoValorTotal: "",
    reembolsoPorcentagem: "",
    reembolsoCategoriaId: "",
    reembolsoCategoriaNome: "",
    reembolsoSubcategoria: "",
    reembolsoNumeroDocumento: "",
    reembolsoRateado: false,
    reembolsoBoletoFile: null,
    reembolsoNotaFiscalFile: null,

    // Decea/Infraero
    numeroDocumentoDecea: "",
    competenciaDecea: "",
    decealFile: null,
    numeroDocumentoInfraero: "",
    competenciaInfraero: "",
    infraeroFile: null,
    dataVencimentoBoleto: "",
    valorTotalBoleto: "",

    socioId: "",
    socioNome: "",
  });

  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [clientPartners, setClientPartners] = useState<any[]>([]);
  const [expenseConfigs, setExpenseConfigs] = useState<any[]>([]);
  const [favoriteDescriptions, setFavoriteDescriptions] = useState<any[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFavoritePayers, setShowFavoritePayers] = useState(false);
  const [valorEditadoManualmente, setValorEditadoManualmente] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [enviarParaProgramacao, setEnviarParaProgramacao] = useState(false);

  const normalizeId = (value: any): string | null => {
    if (typeof value !== "string") return value ?? null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("__") ? null : trimmed;
  };

  const isReembolso = formData.receiptType === "reembolso";

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
    (async () => {
      const { data: airData } = await supabase.from("aeronave").select("id, matricula, modelo").eq("status", "ativa").order("matricula");
      setAircrafts((airData || []).map((a: any) => ({ ...a, isClient: false })));

      const { data: favData } = await supabase.from("receipt_descriptions").select("*").order("criado_em", { ascending: false });
      setFavoriteDescriptions(favData || []);
    })();
  }, []);

  useEffect(() => {
    if (!formData.reembolsoRateado) return;

    const total = parseFloat(String(formData.reembolsoValorTotal).replace(",", "."));
    const porcentagem = parseFloat(String(formData.reembolsoPorcentagem).replace(",", "."));
    if (Number.isNaN(total) || Number.isNaN(porcentagem)) return;

    const valorCalculado = ((total * porcentagem) / 100).toFixed(2);
    if (!valorEditadoManualmente) {
      setFormData((prev: any) => ({ ...prev, valor: valorCalculado }));
    }
  }, [formData.reembolsoValorTotal, formData.reembolsoPorcentagem, formData.reembolsoRateado, valorEditadoManualmente]);

  useEffect(() => {
    if (!formData.clienteId) {
      setClientPartners([]);
      setFormData((prev: any) => ({ ...prev, socioId: "", socioNome: "" }));
      return;
    }

    setFormData((prev: any) => ({ ...prev, socioId: "", socioNome: "" }));

    const loadClientPartners = async (clientId: string) => {
      try {
        const { data } = await supabase
          .from("socios")
          .select("id, nome, cpf")
          .eq("cliente_id", clientId)
          .order("nome");

        setClientPartners((data || []).map((item: any) => ({
          id: item.id,
          nome: item.nome,
          cpf: item.cpf,
        })));
      } catch (err) {
        console.error("Erro ao carregar sócios do cliente", err);
      }
    };

    loadClientPartners(formData.clienteId);
  }, [formData.clienteId]);

  const loadExpenseConfigs = async () => {
    try {
      const { data: expData } = await supabase
        .from("expense_configu")
        .select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4")
        .order("expense_type");
      const list = expData || [];
      setExpenseConfigs(list);
    } catch (err) {
      console.error("Erro ao carregar expense_configu", err);
    }
  };

  useEffect(() => {
    if (!isReembolso || !selectedExpenseConfig) return;
    const aer = aircrafts.find((a) => a.id === formData.aircraftId);
    const aerStr = aer?.matricula ? ` AERONAVE ${aer.matricula}` : "";

    if (isInfraero) {
      const c = formData.competenciaInfraero ? ` COMPETÊNCIA ${formData.competenciaInfraero.toUpperCase()}` : "";
      const d = formData.numeroDocumentoInfraero ? ` DEMONSTRATIVO ${formData.numeroDocumentoInfraero.toUpperCase()}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `REFERENTE A INFRAERO${aerStr}${c}${d}`.trim() }));
    } else if (isDecea) {
      const c = formData.competenciaDecea ? ` COMPETÊNCIA ${formData.competenciaDecea.toUpperCase()}` : "";
      const d = formData.numeroDocumentoDecea ? ` DEMONSTRATIVO ${formData.numeroDocumentoDecea.toUpperCase()}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `REFERENTE A DECEA${aerStr}${c}${d}`.trim() }));
    } else {
      const s = formData.reembolsoSubcategoria ? ` / ${formData.reembolsoSubcategoria}` : "";
      setFormData((prev: any) => ({ ...prev, servicoDescricao: `Referente a ${selectedExpenseConfig.expense_type}${s}` }));
    }
  }, [
    formData.reembolsoCategoriaId,
    formData.reembolsoSubcategoria,
    formData.aircraftId,
    formData.competenciaInfraero,
    formData.numeroDocumentoInfraero,
    formData.competenciaDecea,
    formData.numeroDocumentoDecea,
    isInfraero,
    isDecea,
    isReembolso,
    selectedExpenseConfig,
    aircrafts,
  ]);

  const clienteItems = clientesAtivos.map((c: any) => ({ id: c.id, label: c.razao_social || c.nome || "Sem nome" }));
  const aeronaveItems = aircrafts.map((a: any) => ({ id: a.id, label: `${a.matricula} – ${a.modelo}${a.isClient ? " ★" : ""}` }));
  const categoriaItems = expenseConfigs.map((c: any) => ({ id: c.id, label: c.expense_type }));
  const subcategoriasDisponiveis = subcategoriaOptions;

  const submitting = isGenerating || isSaving;

  const goNext = () => {
    setCompletedSteps((prev) => prev.includes(step) ? prev : [...prev, step]);
    setStep((s) => Math.min(s + 1, STEPS.length));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const selectReceiptType = (type: string) => {
    setFormData((p: any) => {
      const nextState: any = {
        ...p,
        receiptType: type,
      };

      if (type === "pagamento") {
        return {
          ...nextState,
          valor: "",
          reembolsoValorTotal: "",
          reembolsoPorcentagem: "",
          reembolsoCategoriaId: "",
          reembolsoCategoriaNome: "",
          reembolsoSubcategoria: "",
          reembolsoNumeroDocumento: "",
          reembolsoRateado: false,
          reembolsoBoletoFile: null,
          reembolsoNotaFiscalFile: null,
          numeroDocumentoDecea: "",
          competenciaDecea: "",
          decealFile: null,
          numeroDocumentoInfraero: "",
          competenciaInfraero: "",
          infraeroFile: null,
          dataVencimentoBoleto: "",
          valorTotalBoleto: "",
          prazoMaximoQuitacao: "",
          enviarParaProgramacao: false,
        };
      }

      return nextState;
    });
  };

  const selectFavoriteDescription = (description: string) => { setFormData((prev: any) => ({ ...prev, servicoDescricao: description })); setShowFavorites(false); };
  const selectFavoritePayer = (payer: any) => {
    setFormData((prev: any) => ({
      ...prev,
      pagadorNome: payer.name || payer.nome || "",
      pagadorDocumento: payer.document || payer.cpf || "",
      pagadorEndereco: payer.address || payer.endereco || "",
      pagadorCidade: payer.city || payer.cidade || "",
      pagadorUF: payer.uf || "",
    }));
    setShowFavoritePayers(false);
  };
  const handleFileChange = (field: string, file: File | null) => { setFormData((prev: any) => ({ ...prev, [field]: file })); };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      let docNum = null;
      if (isReembolso) {
        if (isDecea) docNum = formData.numeroDocumentoDecea;
        else if (isInfraero) docNum = formData.numeroDocumentoInfraero;
        else docNum = formData.reembolsoNumeroDocumento;
      }

      const dataMaxPagamento = formData.prazoMaximoQuitacao || (isDECEAorINFRAERO && formData.dataVencimentoBoleto ? formData.dataVencimentoBoleto : null);

      const sanitizedClienteId = normalizeId(formData.clienteId);
      const sanitizedSocioId = normalizeId(formData.socioId);

      const payload = {
        ...formData,
        clienteId: sanitizedClienteId,
        enviarParaProgramacao,
        selectedPartnerId: sanitizedSocioId,
        nome_categoria: categoriaNome,
        subcategoria_1: selectedExpenseConfig?.subcategoria_1 || null,
        subcategoria_2: selectedExpenseConfig?.subcategoria_2 || null,
        subcategoria_3: selectedExpenseConfig?.subcategoria_3 || null,
        subcategoria_4: selectedExpenseConfig?.subcategoria_4 || null,
        subcategoria_selecionada: formData.reembolsoSubcategoria || null,
        isDecea,
        isInfraero,
        numeroDocumento: docNum,
        dataMaxPagamento,
        originalFormData: formData
      };

      const result = await onSubmit(payload);
    } catch(err) {
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
            <div><h3 className="text-lg font-semibold text-white mb-1">Identificação</h3><p className="text-sm text-slate-500">Vincule o cliente, aeronave e categorize a operação</p></div>
            <Row>
              <Field>
                <Label>Cliente</Label>
                <SearchableCombobox items={clienteItems} value={formData.clienteId} onChange={(id: string) => setFormData((p: any) => ({ ...p, clienteId: id }))} placeholder="Selecione o cliente" searchPlaceholder="Buscar cliente..." emptyMessage="Nenhum cliente" />
              </Field>
              <Field>
                <Label>Aeronave</Label>
                <SearchableCombobox items={aeronaveItems} value={formData.aircraftId} onChange={(id: string) => setFormData((p: any) => ({ ...p, aircraftId: id, socioId: "", socioNome: "" }))} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave" />
              </Field>
            </Row>

            {isReembolso && (
              <Row>
                <Field>
                  <Label>Categoria (Despesas Reembolsáveis)</Label>
                  <SearchableCombobox
                    items={categoriaItems}
                    value={formData.reembolsoCategoriaId}
                    onChange={(id: string, label: string) => {
                      setFormData((p: any) => ({ ...p, reembolsoCategoriaId: id, reembolsoCategoriaNome: label, reembolsoSubcategoria: "", numeroDocumentoDecea: "", competenciaDecea: "", numeroDocumentoInfraero: "", competenciaInfraero: "" }));
                    }}
                    placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria"
                  />
                    <div className="mt-2">
                      <button type="button" onClick={loadExpenseConfigs} className="text-xs text-slate-400 hover:text-slate-200">Atualizar categorias</button>
                    </div>
                </Field>
                {subcategoriasDisponiveis.length > 0 && (
                  <Field>
                    <Label>Subcategoria</Label>
                    <Select value={formData.reembolsoSubcategoria} onValueChange={(v: string) => setFormData((p: any) => ({ ...p, reembolsoSubcategoria: v === "__none__" ? "" : v }))}>
                       <SelectItem value="__none__">— Nenhuma —</SelectItem>
                      {subcategoriasDisponiveis.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </Select>
                  </Field>
                )}
              </Row>
            )}

            {formData.clienteId && clientPartners.length > 0 && (
              <Field>
                <div className="p-3 bg-[#1e2d45]/30 border border-[#1e2d45] rounded-xl mt-2">
                  <Label className="text-slate-300">Sócio responsável pelo Pagamento (Opcional)</Label>
                  <Select value={formData.socioId} onValueChange={(v: string) => {
                      if (v === "__client__") {
                        const cliente = clientesAtivos.find((c) => c.id === formData.clienteId);
                        setFormData((p: any) => ({
                          ...p,
                          socioId: "",
                          socioNome: cliente?.razao_social || cliente?.nome || "",
                        }));
                        return;
                      }

                      const partner = clientPartners.find((p: any) => p.id === v);
                      setFormData((p: any) => ({ ...p, socioId: v, socioNome: partner?.nome || "" }));
                  }}>
                    <SelectItem value="__client__">Cliente Principal ({clientesAtivos.find(c => c.id === formData.clienteId)?.razao_social})</SelectItem>
                    {clientPartners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cpf ? `(${p.cpf})` : ""}</SelectItem>)}
                  </Select>
                </div>
              </Field>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Dados do Pagador</h3><p className="text-xs text-slate-500">Informações que sairão impressas no documento</p></div>
            {favoritePayers.length > 0 && (
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
            <Row>
              <Field><Label>Nome / Razão Social *</Label><Input value={formData.pagadorNome} onChange={(e: any) => setFormData((p:any)=>({...p,pagadorNome:e.target.value}))} required /></Field>
              <Field><Label>CPF / CNPJ *</Label><Input value={formData.pagadorDocumento} onChange={(e:any)=>setFormData((p:any)=>({...p,pagadorDocumento:e.target.value}))} required /></Field>
            </Row>
            <Field><Label>Endereço</Label><Input value={formData.pagadorEndereco} onChange={(e:any)=>setFormData((p:any)=>({...p,pagadorEndereco:e.target.value}))} /></Field>
            <Row>
              <Field><Label>Cidade</Label><Input value={formData.pagadorCidade} onChange={(e:any)=>setFormData((p:any)=>({...p,pagadorCidade:e.target.value}))} /></Field>
              <Field><Label>UF</Label><Input value={formData.pagadorUF} onChange={(e:any)=>setFormData((p:any)=>({...p,pagadorUF:e.target.value}))} maxLength={2} className="uppercase" /></Field>
            </Row>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Valores & Detalhes Financeiros</h3></div>

            {isReembolso && (
              <div className="mb-4">
                <Checkbox id="rateio" checked={formData.reembolsoRateado} label="Despesa será rateada entre sócios" onCheckedChange={(checked: boolean) => {
                  setFormData((p: any) => ({ ...p, reembolsoRateado: checked, ...( !checked && { reembolsoValorTotal: "", reembolsoPorcentagem: "" } ) }));
                  setValorEditadoManualmente(false);
                }} />
              </div>
            )}

            {isReembolso && formData.reembolsoRateado ? (
              <SectionCard accent="border-[#3b82f6]/30 bg-[#3b82f6]/5">
                <Row className="grid-cols-1 sm:grid-cols-3">
                  <Field><Label>Valor Total (NF) *</Label><MoneyInput value={formData.reembolsoValorTotal} onChange={(e:any)=>setFormData((p:any)=>({...p,reembolsoValorTotal:e.target.value}))} required /></Field>
                  <Field><Label>% Cliente *</Label><Input type="number" step="0.001" value={formData.reembolsoPorcentagem} placeholder="Ex: 33.333" onChange={(e:any)=> { setFormData((p:any)=>({...p,reembolsoPorcentagem:e.target.value})); setValorEditadoManualmente(false); }} required /></Field>
                  <Field>
                    <Label>Valor a Cobrar *</Label>
                    <MoneyInput value={formData.valor} onChange={(e:any)=>{ setFormData((p:any)=>({...p,valor:e.target.value})); setValorEditadoManualmente(true); }} required />
                  </Field>
                </Row>
              </SectionCard>
            ) : (
              <Field><Label>Valor do Recibo *</Label><MoneyInput value={formData.valor} onChange={(e:any)=>setFormData((p:any)=>({...p,valor:e.target.value}))} required /></Field>
            )}

            {!isReembolso && (
              <Field>
                <Label>Forma de Pagamento</Label>
                <Select value={formData.formaPagamento} onValueChange={(v: string)=>setFormData((p:any)=>({...p,formaPagamento:v}))}>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </Select>
              </Field>
            )}

            {isReembolso && (
              <Field>
                <Label>Prazo Máximo Quitação</Label>
                <DateInput value={formData.prazoMaximoQuitacao} onChange={(v:string)=>setFormData((p:any)=>({...p,prazoMaximoQuitacao:v}))} />
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
                {favoriteDescriptions.length>0 && (
                  <button type="button" onClick={()=>setShowFavorites(!showFavorites)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${showFavorites?"bg-[#f59e0b]/20 border-[#f59e0b]/30 text-[#f59e0b]":"border-[#1e2d45] text-slate-400 hover:text-slate-200"}`}><Star className="w-3 h-3"/>Favoritas</button>
                )}
              </div>
              {showFavorites && favoriteDescriptions.length>0 && (
                <div className="border border-[#1e2d45] rounded-lg overflow-hidden mb-3 bg-[#0f1623] shadow-inner">
                  <div className="max-h-36 overflow-y-auto">
                    {favoriteDescriptions.map((desc:any)=>{
                      const text = desc.descricao||desc.description||"";
                      return (<button key={desc.id} type="button" onClick={()=>selectFavoriteDescription(text)} className="w-full text-left px-3 py-2.5 text-sm text-slate-300 hover:bg-[#1e2d45] transition-colors border-b border-[#1e2d45] last:border-0">{text}</button>);
                    })}
                  </div>
                </div>
              )}
              <Textarea value={formData.servicoDescricao} onChange={(e:any)=>setFormData((p:any)=>({...p,servicoDescricao:e.target.value}))} rows={3} required />
            </Field>

            <Row>
              <Field><Label>Data Emissão</Label><DateInput value={formData.dataEmissao} onChange={(v:string)=>setFormData((p:any)=>({...p,dataEmissao:v}))} /></Field>
              {isReembolso && !isDECEAorINFRAERO && (
                <Field><Label>Número do Documento (N.F)</Label><Input value={formData.reembolsoNumeroDocumento} onChange={(e:any)=>setFormData((p:any)=>({...p,reembolsoNumeroDocumento:e.target.value}))} placeholder="Ex: 12345" /></Field>
              )}
            </Row>

            {isReembolso && isDecea && (
              <SectionCard title="Dados DECEA" accent="border-amber-500/30 bg-amber-500/5">
                <Row>
                  <Field><Label>Número Doc *</Label><Input value={formData.numeroDocumentoDecea} onChange={(e:any)=>setFormData((p:any)=>({...p,numeroDocumentoDecea:e.target.value}))} required/></Field>
                  <Field><Label>Competência *</Label><Input value={formData.competenciaDecea} onChange={(e:any)=>setFormData((p:any)=>({...p,competenciaDecea:e.target.value}))} placeholder="MM/AAAA" required/></Field>
                </Row>
                <Row>
                  <Field><Label>Vencimento Boleto *</Label><DateInput value={formData.dataVencimentoBoleto} onChange={(v:string)=>setFormData((p:any)=>({...p,dataVencimentoBoleto:v}))} required/></Field>
                  <Field><Label>Valor Boleto *</Label><MoneyInput value={formData.valorTotalBoleto} onChange={(e:any)=>setFormData((p:any)=>({...p,valorTotalBoleto:e.target.value}))} required/></Field>
                </Row>
                <FileUpload label="Demonstrativo DECEA" value={formData.decealFile} onChange={(f:File|null)=>handleFileChange('decealFile',f)} accept=".pdf,.jpg,.png"/>
              </SectionCard>
            )}

            {isReembolso && isInfraero && (
              <SectionCard title="Dados INFRAERO" accent="border-blue-500/30 bg-blue-500/5">
                <Row>
                  <Field><Label>Número Doc *</Label><Input value={formData.numeroDocumentoInfraero} onChange={(e:any)=>setFormData((p:any)=>({...p,numeroDocumentoInfraero:e.target.value}))} required/></Field>
                  <Field><Label>Competência *</Label><Input value={formData.competenciaInfraero} onChange={(e:any)=>setFormData((p:any)=>({...p,competenciaInfraero:e.target.value}))} placeholder="MM/AAAA" required/></Field>
                </Row>
                <Row>
                  <Field><Label>Vencimento Boleto *</Label><DateInput value={formData.dataVencimentoBoleto} onChange={(v:string)=>setFormData((p:any)=>({...p,dataVencimentoBoleto:v}))} required/></Field>
                  <Field><Label>Valor Boleto *</Label><MoneyInput value={formData.valorTotalBoleto} onChange={(e:any)=>setFormData((p:any)=>({...p,valorTotalBoleto:e.target.value}))} required/></Field>
                </Row>
                <FileUpload label="Demonstrativo INFRAERO" value={formData.infraeroFile} onChange={(f:File|null)=>handleFileChange('infraeroFile',f)} accept=".pdf,.jpg,.png"/>
              </SectionCard>
            )}

            {isReembolso && !isDECEAorINFRAERO && (
              <Row>
                <FileUpload label="Boleto" value={formData.reembolsoBoletoFile} onChange={(f:File|null)=>handleFileChange('reembolsoBoletoFile',f)} accept=".pdf,.jpg,.png"/>
                <FileUpload label="N.F / Demonstrativo" value={formData.reembolsoNotaFiscalFile} onChange={(f:File|null)=>handleFileChange('reembolsoNotaFiscalFile',f)} accept=".pdf,.jpg,.png"/>
              </Row>
            )}
          </div>
        );
      case 6:
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div><h3 className="text-lg font-semibold text-white mb-1">Revisão Final</h3></div>

            <SectionCard title="Resumo">
              <ReviewItem label="Tipo" value={formData.receiptType==='reembolso'?'Reembolso':'Pagamento'} />
              <ReviewItem label="Pagador" value={formData.pagadorNome} />
              <ReviewItem label="Valor" value={formData.valor?`R$ ${formData.valor}`:''} />
              <ReviewItem label="Emissão" value={format(new Date(formData.dataEmissao + "T00:00:00"), "dd/MM/yyyy")} />
            </SectionCard>

            {isReembolso && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 mt-4">
                <Checkbox
                  id="programacao"
                  checked={enviarParaProgramacao}
                  label="Deseja enviar esse recibo para programação de pagamento?"
                  onCheckedChange={setEnviarParaProgramacao}
                />
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