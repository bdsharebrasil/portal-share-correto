import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Search, Paperclip, CheckCircle2, Clock, XCircle, Trash2, DollarSign, ExternalLink, Upload, Loader2, FileDigit, ArrowDownCircle, ArrowUpCircle, FileText, Wallet, Receipt, TrendingUp, TrendingDown, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// --- HOOK DE ANIMAÇÃO DE NÚMEROS ---
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      // Easing out quart
      const easeOut = 1 - Math.pow(1 - percentage, 4);
      setCount(end * easeOut);
      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);
  return count;
}

function AnimatedCurrency({ value, className }: { value: number, className?: string }) {
  const count = useCountUp(value, 1200);
  return <span className={className}>{formatBRL(count)}</span>;
}

function AnimatedNumber({ value, className }: { value: number, className?: string }) {
  const count = useCountUp(value, 1200);
  return <span className={className}>{Math.round(count)}</span>;
}
// -----------------------------------

interface Cotista { id: string; nome: string; percentual: number; }

interface CentroLancamentosProps {
  aeronaveId: string;
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPOS_RATEIO = ["FIXO", "VARIAVEL_POR_HORA", "VARIAVEL_POR_VOO", "EXTRA"] as const;
const PERIODICIDADES = ["MENSAL", "SEMESTRAL", "ANUAL", "EVENTUAL"] as const;

const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const formatNumberPTBR = (n: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const parsePTBRNumber = (s: string) => {
  if (!s) return 0;
  const cleaned = String(s).replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const maskCurrencyInput = (raw: string) => {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const cents = digits.slice(-2);
  const intPart = digits.slice(0, -2) || "0";
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intFormatted},${cents.padStart(2, "0")}`;
};

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  return format(d, "dd/MM/yyyy");
};

const normalizeFluxo = (value?: string | null): "ENTRADA" | "SAIDA" => {
  const raw = String(value || "").trim().toUpperCase();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized === "ENTRADA" || normalized === "CREDITO" || normalized === "CREDITO_COTISTA") return "ENTRADA";
  return "SAIDA";
};

const getDocumentUrls = (observacoes?: string | null) => {
  if (!observacoes) return [];
  return Array.from(new Set(observacoes.match(/https?:\/\/[^\s]+/g) || []));
};

interface GrupoLancamento {
  chave: string;
  despesa_id: string | null;
  fonte_despesa: string | null;
  ids: string[];
  data_emissao: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_recibo: string | null;
  numero_boleto: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  categoria_custo: string | null;
  tipo_rateio: string | null;
  periodicidade: string | null;
  fluxo: string | null;
  pago_por: string | null;
  status: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  valor_total_despesa: number;
  rateiosPorCotista: Map<string, any>;
  abastecimentoAnexos?: { id: string; comanda_url: string | null; nota_url: string | null; boleto_url: string | null; comanda: string | null; nf: string | null; } | null;
}

export function CentroLancamentos({ aeronaveId, cotistas, aeronaveLabel }: CentroLancamentosProps) {
  const qc = useQueryClient();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [busca, setBusca] = useState("");
  const [fluxoFiltro, setFluxoFiltro] = useState<"TODOS" | "ENTRADA" | "SAIDA">("TODOS");
  const [selectedChaves, setSelectedChaves] = useState<string[]>([]);

  // Queries (Mantidas idênticas ao original para não quebrar a lógica de dados)
  const { data: rateios = [], isLoading } = useQuery({
    queryKey: ["centro-lancamentos", aeronaveId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rateio_despesas").select("*").eq("aeronave_id", aeronaveId).order("data_pagamento", { ascending: false });
      if (error) throw error; return data || [];
    },
    enabled: !!aeronaveId,
  });

  const { data: fornecedores = [] } = useQuery({ /* ... query fornecedores omitida para brevidade, mantenha a sua original ... */ queryKey: ["fornecedores-combo"], queryFn: async () => [] });
  const { data: categorias = [] } = useQuery({ /* ... query categorias omitida ... */ queryKey: ["categorias-combo"], queryFn: async () => [] });
  const { data: pagadores = [] } = useQuery({ /* ... query pagadores omitida ... */ queryKey: ["pagadores-combo"], queryFn: async () => [] });

  const grupos = useMemo<GrupoLancamento[]>(() => {
    const map = new Map<string, GrupoLancamento>();
    (rateios as any[]).forEach((r: any) => {
      const chave = r.despesa_id || r.id;
      if (!map.has(chave)) {
        map.set(chave, {
          chave, despesa_id: r.despesa_id || null, fonte_despesa: r.fonte_despesa || null, ids: [],
          data_emissao: r.data_emissao ?? r.data_pagamento ?? r.data_vencimento ?? null,
          data_pagamento: r.data_pagamento, data_vencimento: r.data_vencimento, numero_doc: r.numero_doc,
          numero_nf: r.numero_nf ?? null, numero_recibo: r.numero_recibo ?? null, numero_boleto: r.numero_boleto ?? null,
          fornecedor_nome: r.fornecedor_nome, descricao_despesa: r.descricao_despesa, categoria_custo: r.categoria_custo,
          tipo_rateio: r.tipo_rateio, periodicidade: r.periodicidade, fluxo: normalizeFluxo(r.fluxo),
          pago_por: r.pago_por, status: r.status ?? null, forma_pagamento: r.forma_pagamento ?? null,
          observacoes: r.observacoes ?? null, comprovante_url: r.comprovante_url ?? null, recibo_url: r.recibo_url ?? null,
          nf_url: r.nf_url ?? null, boleto_url: r.boleto_url ?? null, valor_total_despesa: Number(r.valor_total_despesa) || 0,
          rateiosPorCotista: new Map(),
        });
      }
      const g = map.get(chave)!;
      g.ids.push(r.id);
      if (r.cliente_id) g.rateiosPorCotista.set(r.cliente_id, r);
      if (r.socio_id) g.rateiosPorCotista.set(r.socio_id, r);
    });
    return Array.from(map.values());
  }, [rateios]);

  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return grupos.filter((g) => {
      const ref = g.data_emissao || g.data_pagamento || g.data_vencimento;
      if (ref) {
        const d = new Date(ref + "T00:00:00");
        if (d.getMonth() + 1 !== mes || d.getFullYear() !== ano) return false;
      } else return false;
      if (q) {
        const t = [g.descricao_despesa, g.fornecedor_nome, g.numero_doc].filter(Boolean).join(" ").toLowerCase();
        if (!t.includes(q)) return false;
      }
      if (fluxoFiltro !== "TODOS" && normalizeFluxo(g.fluxo) !== fluxoFiltro) return false;
      return true;
    }).sort((a, b) => new Date(b.data_emissao || b.data_vencimento || "").getTime() - new Date(a.data_emissao || a.data_vencimento || "").getTime());
  }, [grupos, mes, ano, busca, fluxoFiltro]);

  // Cálculos do Dashboard
  const calcDashboard = useMemo(() => {
    let entradas = 0; let saidas = 0; let pendencias = 0;
    gruposFiltrados.forEach(g => {
      const isEntrada = normalizeFluxo(g.fluxo) === "ENTRADA";
      if (isEntrada) entradas += g.valor_total_despesa;
      else saidas += g.valor_total_despesa;
      if (g.status?.toLowerCase() === "pendente") pendencias++;
    });
    return { entradas, saidas, resultado: entradas - saidas, saldoGeral: entradas - saidas, lancamentos: gruposFiltrados.length, pendencias };
  }, [gruposFiltrados]);

  const calcCotistas = useMemo(() => {
    return cotistas.map(c => {
      let rateio = 0; let pago = 0;
      gruposFiltrados.forEach(g => {
        const r = g.rateiosPorCotista.get(c.id);
        if (r) {
          rateio += Number(r.valor_rateado || 0);
          pago += Number(r.valor_pago_real || 0);
        }
      });
      return { ...c, rateio, pago, pendente: rateio - pago };
    });
  }, [cotistas, gruposFiltrados]);

  const toggleSelecao = (chave: string) => setSelectedChaves((prev) => (prev.includes(chave) ? prev.filter((item) => item !== chave) : [...prev, chave]));
  const toggleSelecionarVisiveis = () => setSelectedChaves(gruposFiltrados.length === selectedChaves.length ? [] : gruposFiltrados.map(g => g.chave));

  async function updateGrupo(g: GrupoLancamento, patch: Record<string, any>) {
    const { error } = await (supabase as any).from("rateio_despesas").update(patch).in("id", g.ids);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: ["centro-lancamentos", aeronaveId] });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. HEADER & INDICADORES FINANCEIROS */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/80 mb-1">Centro Financeiro</p>
            <h1 className="text-3xl font-black tracking-tight text-foreground">{aeronaveLabel || "Aeronave"}</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> {MESES[mes - 1]} / {ano}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-36 h-10 bg-background border-border shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-28 h-10 bg-background border-border shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid de Cards Animados */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard title="Saldo Geral" value={calcDashboard.saldoGeral} isCurrency icon={<Wallet className="text-blue-500" />} />
          <MetricCard title="Entradas" value={calcDashboard.entradas} isCurrency icon={<ArrowDownCircle className="text-emerald-500" />} />
          <MetricCard title="Saídas" value={calcDashboard.saidas} isCurrency icon={<ArrowUpCircle className="text-rose-500" />} />
          <MetricCard title="Resultado" value={calcDashboard.resultado} isCurrency icon={calcDashboard.resultado >= 0 ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-rose-500" />} color={calcDashboard.resultado >= 0 ? "text-emerald-600" : "text-rose-600"} />
          <MetricCard title="Lançamentos" value={calcDashboard.lancamentos} icon={<Receipt className="text-indigo-500" />} />
          <MetricCard title="Pendências" value={calcDashboard.pendencias} icon={<FileWarning className="text-amber-500" />} color={calcDashboard.pendencias > 0 ? "text-amber-600" : "text-muted-foreground"} />
        </div>
      </div>

      {/* 2. PAINEL DE COTISTAS */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Posição dos Cotistas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {calcCotistas.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all duration-300 hover:scale-[1.01] hover:border-primary/30 group">
              <div className="flex justify-between items-start mb-4 border-b border-border/50 pb-3">
                <h4 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">{c.nome}</h4>
                <Badge variant="secondary" className="bg-primary/10 text-primary">{c.percentual}%</Badge>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Rateio</p>
                  <AnimatedCurrency value={c.rateio} className="font-mono font-medium text-foreground" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Pago</p>
                  <AnimatedCurrency value={c.pago} className="font-mono font-medium text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="col-span-2 bg-muted/40 rounded-lg p-2 flex justify-between items-center mt-1">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Pendente</p>
                  <AnimatedCurrency value={c.pendente} className={cn("font-mono font-bold", c.pendente > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. TABELA SIMPLIFICADA */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lançamento..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 bg-background shadow-sm" />
          </div>
          <Select value={fluxoFiltro} onValueChange={(v: any) => setFluxoFiltro(v)}>
            <SelectTrigger className="w-40 bg-background shadow-sm"><SelectValue placeholder="Filtro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Fluxos</SelectItem>
              <SelectItem value="ENTRADA">Apenas Entradas</SelectItem>
              <SelectItem value="SAIDA">Apenas Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="w-12 px-4 py-3 text-center"><Checkbox checked={selectedChaves.length === gruposFiltrados.length && gruposFiltrados.length > 0} onCheckedChange={toggleSelecionarVisiveis} /></th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Cotistas</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Carregando lançamentos...</td></tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhum lançamento encontrado.</td></tr>
              ) : (
                gruposFiltrados.map((g) => (
                  <LinhaModular 
                    key={g.chave} g={g} 
                    isSelected={selectedChaves.includes(g.chave)} 
                    onToggle={() => toggleSelecao(g.chave)} 
                    onUpdate={(patch) => updateGrupo(g, patch)}
                    cotistas={cotistas}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-componentes Refatorados

function MetricCard({ title, value, isCurrency, icon, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 group cursor-default relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity group-hover:scale-110 duration-500">
        <div className="w-8 h-8">{icon}</div>
      </div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</p>
      <div className={cn("text-2xl font-bold font-mono tracking-tight", color || "text-foreground")}>
        {isCurrency ? <AnimatedCurrency value={value} /> : <AnimatedNumber value={value} />}
      </div>
    </div>
  );
}

function LinhaModular({ g, isSelected, onToggle, onUpdate, cotistas }: any) {
  const [expanded, setExpanded] = useState(false);
  const dataRef = g.data_emissao || g.data_pagamento || g.data_vencimento;
  const isEntrada = normalizeFluxo(g.fluxo) === "ENTRADA";
  const status = (g.status || "pendente").toLowerCase();
  
  // Agrupar cotistas para a coluna resumida
  const envolvidos = Array.from(g.rateiosPorCotista.keys()).length;

  return (
    <Fragment>
      <tr 
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "group cursor-pointer transition-colors hover:bg-muted/40",
          expanded && "bg-muted/20",
          isSelected && "bg-primary/[0.03] border-l-4 border-l-primary"
        )}
      >
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={onToggle} /></td>
        <td className="px-4 py-3 text-foreground font-medium">{fmtDate(dataRef)}</td>
        <td className="px-4 py-3 truncate max-w-[180px]">{g.fornecedor_nome || "—"}</td>
        <td className="px-4 py-3 truncate max-w-[200px] text-muted-foreground">{g.descricao_despesa || "—"}</td>
        <td className={cn("px-4 py-3 text-right font-mono font-bold tabular-nums", isEntrada ? "text-emerald-600" : "text-foreground")}>
          {formatBRL(g.valor_total_despesa)}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant="outline" className="bg-background">{envolvidos} / {cotistas.length}</Badge>
        </td>
        <td className="px-4 py-3 text-center">
          {status === "pago" || status === "recebido" 
            ? <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> {status}</Badge>
            : <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0"><Clock className="w-3 h-3 mr-1"/> Pendente</Badge>
          }
        </td>
      </tr>

      {/* 4. FICHA EXPANDIDA MODULAR */}
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={7} className="p-0 border-b border-border">
            <div className="p-6 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300 ease-out">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Módulo: Informações */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Informações</h4>
                  <div className="space-y-3 text-sm">
                    <div><span className="text-muted-foreground block text-xs">Fornecedor</span> <span className="font-medium">{g.fornecedor_nome || "Não informado"}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Descrição</span> <span>{g.descricao_despesa || "—"}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Categoria</span> <span>{g.categoria_custo || "—"}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Documento</span> <span className="font-mono">{g.numero_doc || "S/N"}</span></div>
                  </div>
                </div>

                {/* Módulo: Pagamento */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Pagamento</h4>
                  <div className="space-y-3 text-sm">
                    <div><span className="text-muted-foreground block text-xs">Forma</span> <span className="capitalize">{g.forma_pagamento?.replace('_', ' ') || "—"}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Data Ref.</span> <span>{fmtDate(g.data_vencimento || g.data_pagamento)}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Status Atual</span> <span className="capitalize font-semibold">{status}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Valor Total</span> <span className="font-mono font-bold text-lg">{formatBRL(g.valor_total_despesa)}</span></div>
                  </div>
                  <Button size="sm" className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all">
                    {status === 'pendente' ? 'Quitar Lançamento' : 'Editar Pagamento'}
                  </Button>
                </div>

                {/* Módulo: Anexos */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2">Anexos</h4>
                  <div className="space-y-2">
                    <AnexoBotao label="Nota Fiscal" numero={g.numero_nf} url={g.nf_url} />
                    <AnexoBotao label="Recibo" numero={g.numero_recibo} url={g.recibo_url} />
                    <AnexoBotao label="Boleto" numero={g.numero_boleto} url={g.boleto_url} />
                    <AnexoBotao label="Comprovante" numero={null} url={g.comprovante_url} />
                  </div>
                </div>

                {/* Módulo: Observações & Ações */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-2 mb-4">Observações</h4>
                    {g.observacoes ? (
                      <p className="text-sm text-muted-foreground italic bg-background p-3 rounded-lg border border-border">{g.observacoes}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">Nenhuma observação registrada.</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 transition-all">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir Registro
                  </Button>
                </div>

              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function AnexoBotao({ label, numero, url }: any) {
  if (!url && !numero) return (
    <div className="flex items-center justify-between p-2 rounded-md border border-dashed border-border bg-background/50 opacity-60 cursor-not-allowed">
      <span className="text-xs text-muted-foreground flex items-center gap-2"><FileText className="w-3 h-3"/> {label}</span>
      <span className="text-[10px] text-muted-foreground/50">Vazio</span>
    </div>
  );

  return (
    <a href={url || "#"} target={url ? "_blank" : "_self"} className={cn("flex items-center justify-between p-2 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors group", !url && "pointer-events-none")}>
      <span className="text-xs font-medium text-foreground flex items-center gap-2"><FileText className="w-3 h-3 text-primary group-hover:scale-110 transition-transform"/> {label}</span>
      <div className="flex items-center gap-2">
        {numero && <span className="text-[10px] font-mono text-muted-foreground">{numero}</span>}
        {url && <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />}
      </div>
    </a>
  );
}
