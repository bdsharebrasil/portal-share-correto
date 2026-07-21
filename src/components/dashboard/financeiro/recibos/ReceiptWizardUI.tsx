import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Star, Calendar, ChevronRight, ChevronLeft,
  Check, User, Plane, DollarSign, FileCheck, Building2,
  Percent, Upload, X, AlertCircle, RefreshCw, Search,
  ChevronDown, ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// Small subset of UI primitives copied from reference for self-contained widget
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
function Checkbox({ id, checked, onCheckedChange }: any) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
        checked
          ? "bg-[#3b82f6] border-[#3b82f6]"
          : "bg-transparent border-[#1e2d45] hover:border-[#3b82f6]"
      }`}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
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
          <div className="p-2 border-b border-[#1e2d45]"><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full pl-7 pr-3 py-1.5 bg-[#0f1623] border border-[#1e2d45] rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#3b82f6]" /></div></div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (<p className="px-3 py-3 text-xs text-slate-500 text-center">{emptyMessage}</p>) : (filtered.map((item: any) => (
              <button key={item.id} type="button" onClick={() => { onChange(item.id, item.label); setOpen(false); setQuery(""); }} className={`w-full px-3 py-2.5 text-sm text-left hover:bg-[#1e2d45] transition-colors ${ item.id === value ? "text-[#3b82f6] bg-[#3b82f6]/10" : "text-slate-200" }`}>
                {item.label}
              </button>
            )))}
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
      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
    </div>
  );
}
function FileUpload({ label, value, onChange, accept }: any) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{label}</Label>
      <div onClick={() => ref.current?.click()} className={`relative flex items-center gap-3 px-3 py-2.5 bg-[#0f1623] border border-dashed rounded-lg cursor-pointer hover:border-[#3b82f6]/60 transition-colors ${ value ? "border-[#3b82f6]/40" : "border-[#1e2d45]" }`}>
        <Upload className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-sm truncate text-slate-400">{value ? value.name : "Clique para selecionar arquivo"}</span>
        {value && (<button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="ml-auto text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>)}
        <input ref={ref} type="file" className="hidden" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </div>
      <p className="text-xs text-slate-600 mt-1">Aceita PDF e imagens</p>
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
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${ isCompleted ? "bg-[#3b82f6] border-[#3b82f6] shadow-md shadow-[#3b82f6]/20" : isActive ? "bg-[#0f1623] border-[#3b82f6] shadow-md shadow-[#3b82f6]/15" : "bg-[#0f1623] border-[#1e2d45]" }`}>
                {isCompleted ? (<Check className="w-4 h-4 text-white" strokeWidth={3} />) : (<Icon className={`w-4 h-4 ${isActive ? "text-[#3b82f6]" : "text-slate-600"}`} />)}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block transition-colors ${ isActive ? "text-[#3b82f6]" : isCompleted ? "text-slate-400" : "text-slate-600" }`}>
                {step.shortLabel}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-2 mb-5 sm:mb-0 mt-0 sm:mt-0 relative overflow-hidden" style={{ marginTop: "-14px" }}>
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
function ReviewItem({ label, value }: { label: string; value: any }) { if (!value && value !== 0) return null; return (<div className="flex items-start justify-between py-2 border-b border-[#1e2d45] last:border-0"><span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span><span className="text-sm text-slate-200 text-right max-w-[60%]">{String(value)}</span></div>); }

interface Props { clientesAtivos?: any[]; favoritePayers?: any[]; isGenerating?: boolean; onSubmit?: (data: any) => void; }
export function ReceiptWizardUI({ clientesAtivos = [], favoritePayers = [], isGenerating = false, onSubmit = () => {} }: Props) {
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
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
    addAsFavorite: false,
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
    categoriaId: "",
    categoriaNome: "",
    subcategoriaSel: "",
    socioId: "",
    socioNome: "",
  });
  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [clientPartners, setClientPartners] = useState<any[]>([]);
  const [expenseConfigs, setExpenseConfigs] = useState<any[]>([]);
  const [favoriteDescriptions, setFavoriteDescriptions] = useState<any[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [valorEditadoManualmente, setValorEditadoManualmente] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";

  const loadAllAircrafts = async () => {
    try {
      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo")
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      const aircraftList = (data || []).map((a: any) => ({
        id: a.id,
        matricula: a.matricula,
        modelo: a.modelo,
        isClient: false,
      }));
      setAircrafts(aircraftList);
      setFormData((prev: any) => {
        if (prev.aircraftId && aircraftList.some((a) => a.id === prev.aircraftId)) {
          return prev;
        }
        return { ...prev, aircraftId: aircraftList[0]?.id || "" };
      });
    } catch (err) {
      console.error("Erro ao carregar aeronaves:", err);
    }
  };

  const loadExpenseConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("expense_configu")
        .select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4")
        .order("expense_type");
      if (error) throw error;
      setExpenseConfigs(data || []);
    } catch (err) {
      console.error("Erro ao carregar categorias de despesa:", err);
    }
  };

  useEffect(() => {
    loadAllAircrafts();
    loadExpenseConfigs();
  }, []);

  useEffect(() => {
    if (!formData.aircraftId) {
      setClientPartners([]);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("cotistas_aeronave")
          .select("id_clientes, socios_id, percentual_sociedade, socios(nome)")
          .eq("id_aeronave", formData.aircraftId);
        if (error) throw error;
        const partners = (data || [])
          .filter((r: any) => r.socios_id)
          .map((r: any) => ({ id: r.socios_id, nome: r.socios?.nome || "Sócio", clienteId: r.id_clientes }));
        setClientPartners(partners);
      } catch (err) {
        console.error("Erro ao carregar sócios da aeronave:", err);
        setClientPartners([]);
      }
    })();
  }, [formData.aircraftId]);

  useEffect(() => { if (formData.reembolsoRateado && formData.reembolsoValorTotal && formData.reembolsoPorcentagem) { const valorTotal = parseFloat(String(formData.reembolsoValorTotal).replace(",", ".")) || 0; const porcentagem = parseFloat(formData.reembolsoPorcentagem) || 0; const valorCalculado = ((valorTotal * porcentagem) / 100).toFixed(2); if (!valorEditadoManualmente) { setFormData((prev: any) => ({ ...prev, valor: valorCalculado })); } } }, [formData.reembolsoValorTotal, formData.reembolsoPorcentagem, formData.reembolsoRateado, valorEditadoManualmente]);

  const clienteItems = clientesAtivos.map((c: any) => ({ id: c.id, label: c.razao_social || "Sem nome" }));
  const aeronaveItems = aircrafts.map((a: any) => ({ id: a.id, label: `${a.matricula} – ${a.modelo}${a.isClient ? " ★" : ""}` }));
  const categoriaItems = expenseConfigs.map((c: any) => ({ id: c.id, label: c.expense_type }));
  const categoriaSel = expenseConfigs.find((c: any) => c.id === formData.categoriaId);
  const subcategoriasCategoria = [
    categoriaSel?.subcategoria_1,
    categoriaSel?.subcategoria_2,
    categoriaSel?.subcategoria_3,
    categoriaSel?.subcategoria_4,
  ].filter(Boolean);
  const submitting = isGenerating || isSaving;

  useEffect(() => {
    if (!formData.clienteId) return;
    const client = clientesAtivos.find((c: any) => c.id === formData.clienteId);
    if (!client) return;
    setFormData((prev: any) => ({
      ...prev,
      pagadorNome: client.razao_social || client.nome || "",
      pagadorDocumento: client.cnpj || "",
      pagadorEndereco: client.endereco || client.address || "",
      pagadorCidade: client.cidade || client.city || "",
      pagadorUF: client.uf || "",
    }));
  }, [formData.clienteId, clientesAtivos]);

  const goNext = () => { setDirection("forward"); setCompletedSteps((prev) => prev.includes(step) ? prev : [...prev, step]); setStep((s) => Math.min(s + 1, STEPS.length)); };
  const goBack = () => { setDirection("back"); setStep((s) => Math.max(s - 1, 1)); };

  const selectFavoriteDescription = (description: string) => { setFormData((prev: any) => ({ ...prev, servicoDescricao: description })); setShowFavorites(false); };
  const handleFileChange = (field: string, file: File | null) => { setFormData((prev: any) => ({ ...prev, [field]: file })); };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSubmit({ ...formData, selectedPartnerId: formData.socioId, originalFormData: formData });
    } finally { setIsSaving(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div><h3 className="text-lg font-semibold text-white mb-1">Tipo de Recibo</h3><p className="text-sm text-slate-500">Selecione a natureza do recibo que será gerado</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><button type="button" onClick={() => setFormData((p: any) => ({ ...p, receiptType: 'pagamento' }))} className={`p-4 rounded-xl w-full text-left ${formData.receiptType==='pagamento' ? 'border-[#3b82f6] bg-[#0f1724]/10 border-2' : 'border-[#1e2d45] border'}`}><div className="font-semibold text-slate-100">Pagamento</div><p className="text-xs text-slate-500">Recibo de serviços prestados ou tarifas avulsas</p></button></div>
              <div><button type="button" onClick={() => setFormData((p: any) => ({ ...p, receiptType: 'reembolso' }))} className={`p-4 rounded-xl w-full text-left ${formData.receiptType==='reembolso' ? 'border-[#f59e0b] bg-[#24130a]/10 border-2' : 'border-[#1e2d45] border'}`}><div className="font-semibold text-slate-100">Reembolso</div><p className="text-xs text-slate-500">Devolução de despesas reembolsáveis ao cliente</p></button></div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Identificação</h3>
              <p className="text-sm text-slate-500">Vincule o cliente, a aeronave e a categoria a este recibo</p>
            </div>
            <Row>
              <Field>
                <Label>Cliente</Label>
                <SearchableCombobox
                  items={clienteItems}
                  value={formData.clienteId}
                  onChange={(id: string) => setFormData((p: any) => ({ ...p, clienteId: id }))}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente encontrado"
                />
              </Field>
              <Field>
                <Label>Aeronave</Label>
                <SearchableCombobox
                  items={aeronaveItems}
                  value={formData.aircraftId}
                  onChange={(id: string) => setFormData((p: any) => ({ ...p, aircraftId: id, socioId: "", socioNome: "" }))}
                  placeholder="Selecione a aeronave"
                  searchPlaceholder="Buscar aeronave..."
                  emptyMessage="Nenhuma aeronave encontrada"
                />
              </Field>
            </Row>
            <Row>
              <Field>
                <Label>Categoria da Despesa</Label>
                <SearchableCombobox
                  items={categoriaItems}
                  value={formData.categoriaId}
                  onChange={(id: string, label?: string) => {
                    const cat = expenseConfigs.find((c: any) => c.id === id);
                    setFormData((p: any) => ({
                      ...p,
                      categoriaId: id,
                      categoriaNome: cat?.expense_type || label || "",
                      subcategoriaSel: "",
                    }));
                  }}
                  placeholder="Selecione a categoria"
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria encontrada"
                />
              </Field>
              {subcategoriasCategoria.length > 0 && (
                <Field>
                  <Label>Subcategoria</Label>
                  <Select value={formData.subcategoriaSel} onValueChange={(v: string) => setFormData((p: any) => ({ ...p, subcategoriaSel: v }))}>
                    {subcategoriasCategoria.map((s: string) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </Select>
                </Field>
              )}
            </Row>
            {isReembolso && formData.aircraftId && clientPartners.length > 0 && (
              <Field>
                <Label>Sócio responsável (opcional — usado na programação de pagamento)</Label>
                <Select
                  value={formData.socioId || ""}
                  onValueChange={(v: string) => {
                    const partner = clientPartners.find((p: any) => p.id === v);
                    setFormData((p: any) => ({ ...p, socioId: v, socioNome: partner?.nome || "" }));
                  }}
                >
                  <SelectItem value="">Nenhum</SelectItem>
                  {clientPartners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div><h3 className="text-lg font-semibold text-white mb-1">Dados do Pagador</h3></div>
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
          <div className="space-y-5">
            <div><h3 className="text-lg font-semibold text-white mb-1">Valores & Detalhes Financeiros</h3></div>
            <Field><Label>Valor do Recibo *</Label><MoneyInput value={formData.valor} onChange={(e:any)=>setFormData((p:any)=>({...p,valor:e.target.value}))} required /></Field>
            {!isReembolso && (<Field><Label>Forma de Pagamento</Label><Select value={formData.formaPagamento} onValueChange={(v: string)=>setFormData((p:any)=>({...p,formaPagamento:v}))}><SelectItem value="pix">PIX</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></Select></Field>)}
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <div><h3 className="text-lg font-semibold text-white mb-1">Descrição & Documentos</h3></div>
            <Field>
              <div className="flex items-center justify-between mb-1.5"><Label className="mb-0">Descrição do Serviço *</Label>{favoriteDescriptions.length>0 && (<button type="button" onClick={()=>setShowFavorites(!showFavorites)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${showFavorites?"bg-[#f59e0b]/20 border-[#f59e0b]/30 text-[#f59e0b]":"border-[#1e2d45] text-slate-500"}`}><Star className="w-3 h-3"/>Favoritas</button>)}</div>
              {showFavorites && favoriteDescriptions.length>0 && (<div className="border border-[#1e2d45] rounded-lg overflow-hidden mb-2 bg-[#0a1020]"><div className="px-3 py-2 border-b border-[#1e2d45] bg-[#0f1623]"><span className="text-xs text-slate-500">Selecione uma descrição favorita</span></div><div className="max-h-36 overflow-y-auto">{favoriteDescriptions.map((desc:any)=>{const text = desc.descricao||desc.description||""; return (<button key={desc.id} type="button" onClick={()=>selectFavoriteDescription(text)} className="w-full text-left px-3 py-2.5 text-sm text-slate-300 hover:bg-[#1e2d45] transition-colors border-b border-[#1e2d45] last:border-0">{text}</button>);})}</div></div>)}
              <Textarea value={formData.servicoDescricao} onChange={(e:any)=>setFormData((p:any)=>({...p,servicoDescricao:e.target.value}))} rows={4} required />
            </Field>
            <Field><Label>Data de Emissão</Label><DateInput value={formData.dataEmissao} onChange={(v:string)=>setFormData((p:any)=>({...p,dataEmissao:v}))} /></Field>
            {isReembolso && !false && (<Row><FileUpload label="Boleto" value={formData.reembolsoBoletoFile} onChange={(f:File|null)=>handleFileChange('reembolsoBoletoFile',f)} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"/><FileUpload label="N.F / Demonstrativo" value={formData.reembolsoNotaFiscalFile} onChange={(f:File|null)=>handleFileChange('reembolsoNotaFiscalFile',f)} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"/></Row>)}
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <div><h3 className="text-lg font-semibold text-white mb-1">Revisão Final</h3></div>
            <div className="space-y-3">
              <SectionCard title="Resumo"><ReviewItem label="Tipo" value={formData.receiptType==='reembolso'?'Reembolso':'Pagamento'} /><ReviewItem label="Pagador" value={formData.pagadorNome} /><ReviewItem label="Valor" value={formData.valor?`R$ ${formData.valor}`:''} /></SectionCard>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="rounded-[19px] bg-card/30 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
      <div className="mb-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Emissor de Recibos</h2><p className="text-xs text-slate-500">Etapa {step} de {STEPS.length} — {STEPS[step-1].label}</p></div><div><span className="text-xs font-mono text-slate-600 bg-[#0f1623] border border-[#1e2d45] px-2.5 py-1 rounded-lg">{formData.receiptType==='reembolso'?'REEMBOLSO':'PAGAMENTO'}</span></div></div></div>
      <div className="mb-6"><StepIndicator current={step} completed={completedSteps} /></div>
      <div className="min-h-[320px]">{renderStep()}</div>
      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={goBack} disabled={step===1} className="px-4 py-2.5 text-sm text-slate-400 border border-[#1e2d45] rounded-xl">Voltar</button>
        <div className="flex items-center gap-3">
          {step < STEPS.length ? (<button type="button" onClick={goNext} className="px-5 py-2.5 bg-[#3b82f6] text-white rounded-xl">Próximo <ChevronRight className="w-4 h-4 inline"/></button>) : (<button type="button" onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white rounded-xl">{submitting? 'Gerando...' : 'Gerar Recibo'}</button>) }
        </div>
      </div>
    </div>
  );
}

export default ReceiptWizardUI;
