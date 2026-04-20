import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plane, Plus, Calendar, Gauge, Clock, Moon, BookOpenCheck, Cloud,
  Fuel, Users, X, Save, Droplets, Wrench, CloudLightning, PlaneLanding,
  Pencil, Trash2, Activity, ArrowUpDown, ArrowUp, ArrowDown, Search, CheckCircle2,
  Eye, EyeOff, ChevronRight, AlertTriangle, Lock, LayoutList, Map as MapIcon
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/formatters";
import {
  decimalToHHMM, diffDecimalHours, hhmmToMinutes, minutesToHHMM,
  pgTimeToHHMM, subtractMinutesHHMM, sumDecimal,
} from "@/lib/time";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Aeronave = {
  id: string; matricula: string; modelo: string;
  ano?: string | null;
  base?: string | null;
  consumo_combustivel: number | null;
};
type Lanc = {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  tripulacao_checkin_hora: string | null;
  tempo_ac: string | null;
  tempo_dep: string | null;
  tempo_pou: string | null;
  tempo_cor: string | null;
  tempo_voo: number | string | null;
  tempo_total: number | string | null;
  horas_diurnas: number | string | null;
  horas_noturnas: number | string | null;
  tempo_ifr: number | string | null;
  pousos_total: number | null;
  litros_combustivel_inicio_voo: number | string | null;
  combustivel_adicionado: number | string | null;
  consumo_combustivel: number | string | null;
  consumo_combustivel_voo: number | string | null;
  consumo_combustivel_total: number | string | null;
  celula: number | string | null;
  celula_tvoo: number | string | null;
  pic_canac: string | null;
  sic_canac: string | null;
  pic?: { id: string; canac: string; nome_completo: string } | null;
  sic?: { id: string; canac: string; nome_completo: string } | null;
  sic_name: string | null;
  natureza_voo: string | null;
  tarifa_diaria: string | null;
  clientes_id: string | null;
  socios_cliente_id: string | null;
  socios_nome: string | null;
  emprestimo: boolean | null;
  cliente_tomador_emprestimo_id: string | null;
  socio_tomador_emprestimo_id: string | null;
  confirmado: boolean | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  trecho: string | null;
};
type Tripulante = { id: string; nome_completo: string | null; canac: string | null; status: string | null };
type DiarioMesRow = {
  id: string;
  celula_anterior_ttotal: number | null;
  celula_atual_ttotal: number | null;
  celula_prox_revisao_ttotal: number | null;
  celula_disponivel_ttotal: number | null;
  celula_atual_tvoo: number | null;
  celula_disponivel_tvoo: number | null;
  horimetro_inicio: number | null;
  horimetro_final: number | null;
  horimetro_ativo: number | null;
  tem_tarifa_diaria: boolean | null;
  tarifa_diaria: number | null;
};
type Cliente = { id: string; razao_social: string | null; proprietario: string | null };
type Socio = { id: string; nome: string; cliente_id: string };
type Abastecimento = { id: string; data: string; local: string | null; litros: number | null; valor_total: number | null; tipo_combustivel: string | null; logbook_entry_id: string };

const NATUREZAS = ["Privado", "Teste", "Translado", "Cheque"];
const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function DiarioBordoDetalhes() {
  const { aircraftId } = useParams<{ aircraftId?: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canEditConfirmed = roles.includes("admin") || roles.includes("gestor_master");

  const today = new Date();
  const [mes, setMes] = useState<number>(today.getMonth() + 1);
  const [ano, setAno] = useState<number>(today.getFullYear());
  const [modoCelula, setModoCelula] = useState<"tvoo" | "tempo_total">("tempo_total");

  const [aeronave, setAeronave] = useState<Aeronave | null>(null);
  const [diarioMes, setDiarioMes] = useState<DiarioMesRow | null>(null);
  const [lancamentos, setLancamentos] = useState<Lanc[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [tripulantes, setTripulantes] = useState<Tripulante[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConsumo, setShowConsumo] = useState(false);
  const [editingLanc, setEditingLanc] = useState<Lanc | null>(null);

  // Filtro cotista
  const [cotistaFiltro, setCotistaFiltro] = useState<string | null>(null);

  // Inline edit do diario_mes
  const [editCelulaAnt, setEditCelulaAnt] = useState(false);
  const [editProxRev, setEditProxRev] = useState(false);
  const [editHorIni, setEditHorIni] = useState(false);
  const [editHorFim, setEditHorFim] = useState(false);
  const [editHorAtv, setEditHorAtv] = useState(false);

  // Table controls
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [modoTabela, setModoTabela] = useState<"completo" | "resumo">("completo");

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const reload = async () => {
    if (!aircraftId) return;
    setLoading(true);
    const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fimDate = new Date(ano, mes, 0);
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

    const [aRes, dmRes, lRes, cRes, sRes, tRes, abRes] = await Promise.all([
      supabase.from("aeronave").select("id,matricula,modelo,ano,base,consumo_combustivel").eq("id", aircraftId).maybeSingle(),
      supabase.from("diario_mes").select("*").eq("aeronave_id", aircraftId).eq("ano", ano).eq("mes", mes).maybeSingle(),
      supabase.from("lancamentos_diario_bordo").select(`*`).eq("aeronave_id", aircraftId)
        .gte("data_registro", ini).lte("data_registro", fim)
        .order("data_registro", { ascending: true }),
      supabase.from("clientes").select("id,razao_social,proprietario").order("razao_social"),
      (supabase as any).from("socios_cliente").select("id,nome,id_clientes").order("nome"),
      supabase.from("membros_tripulacao").select("id,nome_completo,canac,status"),
      supabase.from("abastecimentos").select("id,data,local,litros,valor_total,tipo_combustivel,logbook_entry_id")
        .eq("aeronave_id", aircraftId)
        .gte("data", ini).lte("data", fim)
        .not("logbook_entry_id", "is", null),
    ]);
    setAeronave(aRes.data as Aeronave | null);
    setDiarioMes((dmRes.data ?? null) as DiarioMesRow | null);
    setLancamentos((lRes.data ?? []) as unknown as Lanc[]);
    setClientes((cRes.data ?? []) as Cliente[]);
    setSocios(((sRes.data ?? []) as any[]).map((s) => ({ id: s.id, nome: s.nome, cliente_id: s.id_clientes })));
    setTripulantes((tRes.data ?? []) as Tripulante[]);
    setAbastecimentos((abRes.data ?? []) as unknown as Abastecimento[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [aircraftId, mes, ano]);

  const totals = useMemo(() => {
    const tVoo = sumDecimal(lancamentos.map((l) => l.tempo_voo));
    const tTotal = sumDecimal(lancamentos.map((l) => l.tempo_total));
    const tDia = sumDecimal(lancamentos.map((l) => l.horas_diurnas));
    const tNoit = sumDecimal(lancamentos.map((l) => l.horas_noturnas));
    const ifr = sumDecimal(lancamentos.map((l) => l.tempo_ifr));
    const pousos = lancamentos.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0);
    const abast = sumDecimal(lancamentos.map((l) => l.combustivel_adicionado));
    const fuel = sumDecimal(lancamentos.map((l) => l.litros_combustivel_inicio_voo));
    const totalDiarias = lancamentos.reduce((s, l) => s + Number(l.tarifa_diaria ?? 0), 0);
    return { tVoo, tTotal, tDia, tNoit, ifr, pousos, abast, fuel, totalDiarias };
  }, [lancamentos]);

  const tripById = useMemo(() => {
    const m = new Map<string, Tripulante>();
    tripulantes.forEach((t) => m.set(t.id, t));
    return m;
  }, [tripulantes]);

  const naturezasRateio = ["Translado", "Cheque", "Voo de Teste", "Teste"];
  const labelVooPara = useCallback((l: Lanc): string => {
    const nat = (l.natureza_voo ?? "").trim();
    if (naturezasRateio.some((n) => nat.toLowerCase() === n.toLowerCase())) {
      return nat.toUpperCase();
    }
    if (l.socios_cliente_id) {
      const s = socios.find((x) => x.id === l.socios_cliente_id);
      return s?.nome ?? l.socios_nome ?? "Sócio";
    }
    if (l.clientes_id) {
      const c = clientes.find((x) => x.id === l.clientes_id);
      return c?.razao_social ?? c?.proprietario ?? "Cliente";
    }
    return nat || "—";
  }, [socios, clientes]);

  const porCotista = useMemo(() => {
    const map = new Map<string, { label: string; horas: number }>();
    for (const l of lancamentos) {
      const horas = Number((modoCelula === "tvoo" ? l.tempo_voo : l.tempo_total) ?? 0);
      const label = labelVooPara(l);
      const key = label;
      const cur = map.get(key) ?? { label, horas: 0 };
      cur.horas += horas;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.horas - a.horas);
  }, [lancamentos, modoCelula, labelVooPara]);

  // Mapa de abastecimentos por logbook_entry_id
  const abastByLanc = useMemo(() => {
    const m = new Map<string, Abastecimento[]>();
    for (const a of abastecimentos) {
      if (!a.logbook_entry_id) continue;
      const arr = m.get(a.logbook_entry_id) ?? [];
      arr.push(a);
      m.set(a.logbook_entry_id, arr);
    }
    return m;
  }, [abastecimentos]);

  // Filtered + sorted lancamentos (com filtro de cotista)
  const displayLancamentos = useMemo(() => {
    let list = [...lancamentos];
    if (cotistaFiltro) list = list.filter((l) => labelVooPara(l) === cotistaFiltro);
    if (sortDir === "desc") list = list.reverse();
    if (!searchQuery.trim()) return list.map(l => ({ l, match: false }));
    const q = searchQuery.toLowerCase();
    return list.map(l => {
      const blob = [
        l.data_registro, l.aerodromo_partida, l.aerodromo_chegada,
        l.natureza_voo, labelVooPara(l), l.socios_nome,
        tripById.get(l.pic_canac ?? "")?.nome_completo,
        l.sic_name, l.trecho,
      ].filter(Boolean).join(" ").toLowerCase();
      return { l, match: blob.includes(q) };
    });
  }, [lancamentos, sortDir, searchQuery, tripById, labelVooPara, cotistaFiltro]);

  // Column resize handlers
  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col] ?? 80;
    resizingRef.current = { col, startX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: Math.max(40, resizingRef.current!.startW + diff) }));
    };
    const onUp = () => { resizingRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleConfirmar = async (l: Lanc) => {
    if (l.confirmado) return;
    const { error } = await supabase.from("lancamentos_diario_bordo")
      .update({ confirmado: true, confirmado_em: new Date().toISOString() })
      .eq("id", l.id);
    if (!error) await reload();
  };

  const temDiaria = diarioMes?.tem_tarifa_diaria === true;
  const valorDiaria = Number(diarioMes?.tarifa_diaria ?? 0);
  const totalDiariaReais = totals.totalDiarias * valorDiaria;

  if (loading || !aircraftId) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-800 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-slate-400">Carregando diário...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!aeronave) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-800 p-8 flex items-center justify-center">
          <p className="text-slate-400">Aeronave não encontrada</p>
        </div>
      </Layout>
    );
  }

  // --- RENDER ---
  const ResizeHandle = ({ col }: { col: string }) => (
    <span
      onMouseDown={(e) => startResize(col, e)}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/50 transition-colors select-none z-10"
    />
  );

  return (
    <Layout>
      <div className="min-h-screen bg-slate-800 p-4 md:p-6">
        <div className="max-w-[1800px] mx-auto space-y-5">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <button
              onClick={() => navigate('/diario-bordo')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/25 rounded-xl">
                <Plane className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide uppercase">
                  Diário {monthNames[mes - 1]} {ano} — {aeronave.matricula}
                </h1>
                <p className="text-slate-400 text-sm">{aeronave.modelo}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold gap-2 inline-flex items-center rounded-xl px-5 py-2.5 text-sm transition-transform hover:scale-105 shrink-0 shadow-lg shadow-cyan-500/10">
              <Plus className="w-4 h-4" /> Novo Voo
            </button>
          </div>

          {/* Info row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Aeronave info */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Informações da Aeronave</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={<Plane className="w-3 h-3" />} label="Matrícula" value={aeronave?.matricula ?? "—"} />
                <Stat icon={<Gauge className="w-3 h-3" />} label="Modelo" value={aeronave?.modelo ?? "—"} />
                <button
                  onClick={() => setShowConsumo(true)}
                  className="relative group bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/40 hover:border-amber-400/70 rounded-xl p-3 text-left transition-all hover:shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02]"
                  title="Clique para ver detalhamento completo de consumo">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Droplets className="w-3 h-3 text-amber-400 group-hover:text-amber-300" />
                    <span className="text-amber-400/80 text-xs font-medium">Consumo · clique ↗</span>
                  </div>
                  <p className="text-white font-bold text-sm group-hover:text-amber-300 transition-colors">
                    {num(aeronave?.consumo_combustivel ?? 0, 1)} L/H
                  </p>
                  <p className="text-amber-400/60 text-xs mt-0.5">histórico · ver mês →</p>
                </button>
                <Stat icon={<Clock className="w-3 h-3" />} label="Horas Atuais" value={`${num(diarioMes?.celula_atual_ttotal ?? 0, 1)}h`} />
              </div>
            </div>

            {/* Período */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Período</p>
                <div className="flex gap-2">
                  <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none">
                    {monthNames.map((m, i) => (<option key={i} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>))}
                  </select>
                  <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const y = today.getFullYear() - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat icon={<Clock className="w-3 h-3" />}
                  label={modoCelula === "tvoo" ? "T. Voo" : "Tempo Total"}
                  value={decimalToHHMM(modoCelula === "tvoo" ? totals.tVoo : totals.tTotal)}
                  accent="primary" />
                <Stat icon={<PlaneLanding className="w-3 h-3" />} label="Pousos" value={String(totals.pousos)} accent="success" />
                <Stat icon={<Fuel className="w-3 h-3" />} label="Abast+" value={`${num(totals.abast, 0)}L`} accent="warning" />
              </div>
            </div>
          </div>

          {/* Toggle célula */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-white">Total de horas em célula</p>
            <div className="flex rounded-xl border border-slate-700 bg-slate-800 p-1">
              <button onClick={() => setModoCelula("tvoo")}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${modoCelula === "tvoo" ? "bg-cyan-500 text-slate-900" : "text-slate-400 hover:text-white"}`}>
                T. Voo · {decimalToHHMM(totals.tVoo)}
              </button>
              <button onClick={() => setModoCelula("tempo_total")}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${modoCelula === "tempo_total" ? "bg-cyan-500 text-slate-900" : "text-slate-400 hover:text-white"}`}>
                Tempo Total · {decimalToHHMM(totals.tTotal)}
              </button>
            </div>
          </div>

          {/* Tabela toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightedId(null); }}
                placeholder="Filtrar por qualquer campo..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              Data {sortDir === "asc" ? "↑ Crescente" : "↓ Decrescente"}
            </button>

            {/* Modo tabela */}
            <button
              onClick={() => setModoTabela(m => m === "completo" ? "resumo" : "completo")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              title={modoTabela === "completo" ? "Modo resumo (trecho + tempos)" : "Modo completo"}>
              {modoTabela === "completo" ? <MapIcon className="w-4 h-4 text-cyan-400" /> : <LayoutList className="w-4 h-4 text-cyan-400" />}
              {modoTabela === "completo" ? "Ver Resumo" : "Ver Completo"}
            </button>
          </div>

          {/* Tabela registros */}
          <section className="bg-slate-900 border border-slate-700/50 rounded-[7px] overflow-hidden">
            <div className="border-b border-slate-700/50 px-5 py-3.5 flex items-center justify-between bg-slate-800/30">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Plane className="w-4 h-4 text-cyan-400" />
                Registros de Voo
              </h2>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
                {lancamentos.length} voos
              </span>
            </div>

            <div className="overflow-x-auto">
              {modoTabela === "completo" ? (
                /* ===== MODO COMPLETO ===== */
                <table className="w-full border-collapse text-sm [&_td]:border-r [&_td]:border-slate-700/50 [&_th]:border-r [&_th]:border-slate-700/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0" style={{ tableLayout: "fixed" }}>
                  <thead className="border-b border-slate-700/50 bg-slate-800/50">
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["#"] ?? 36 }}>#<ResizeHandle col="#" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["data"] ?? 60 }}>Data<ResizeHandle col="data" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["de"] ?? 60 }}>De<ResizeHandle col="de" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["para"] ?? 60 }}>Para<ResizeHandle col="para" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["ac"] ?? 60 }}>AC<ResizeHandle col="ac" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["dep"] ?? 60 }}>DEP<ResizeHandle col="dep" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["pou"] ?? 60 }}>POU<ResizeHandle col="pou" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["cor"] ?? 60 }}>COR<ResizeHandle col="cor" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tvoo"] ?? 70, color: "rgb(43, 122, 216)" }}>T VOO<ResizeHandle col="tvoo" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tdia"] ?? 65, color: "rgb(106, 226, 231)" }}>T DIA<ResizeHandle col="tdia" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["tnoit"] ?? 65, color: "rgb(144, 19, 254)" }}>T NOIT<ResizeHandle col="tnoit" /></th>
                      <th className="px-3 py-2 text-left text-amber-400 relative" style={{ width: colWidths["ifr"] ?? 55 }}>IFR<ResizeHandle col="ifr" /></th>
                      <th className="px-3 py-2 text-center text-emerald-400 relative" style={{ width: colWidths["pousos"] ?? 60 }}>POUSOS<ResizeHandle col="pousos" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["abast"] ?? 65, color: "rgb(205, 132, 10)" }}>ABAST+<ResizeHandle col="abast" /></th>
                      <th className="px-3 py-2 text-left text-amber-400 relative" style={{ width: colWidths["fuel"] ?? 55 }}>FUEL<ResizeHandle col="fuel" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["celula"] ?? 70 }}>CÉLULA<ResizeHandle col="celula" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["pic"] ?? 110 }}>PIC<ResizeHandle col="pic" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["sic"] ?? 110 }}>SIC<ResizeHandle col="sic" /></th>
                      <th className="px-3 py-2 text-left relative" style={{ width: colWidths["voopara"] ?? 120 }}>VOO PARA<ResizeHandle col="voopara" /></th>
                      {temDiaria && <th className="px-3 py-2 text-left text-violet-400 relative" style={{ width: colWidths["diarias"] ?? 70 }}>DIÁRIAS<ResizeHandle col="diarias" /></th>}
                      <th className="px-3 py-2 text-center text-emerald-400 relative" style={{ width: colWidths["conf"] ?? 90 }}>CONFIRM.<ResizeHandle col="conf" /></th>
                      <th className="px-3 py-2 text-center relative" style={{ width: colWidths["acao"] ?? 70 }}>AÇÕES<ResizeHandle col="acao" /></th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {displayLancamentos.length === 0 ? (
                      <tr><td colSpan={22} className="p-12 text-center text-slate-500">Nenhum voo registrado neste período.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const picT = l.pic_canac ? tripById.get(l.pic_canac) : null;
                      const sicT = l.sic_canac ? tripById.get(l.sic_canac) : null;
                      const isHighlight = searchQuery && match;
                      const isConfirmado = l.confirmado === true;
                      return (
                        <tr key={l.id}
                          id={`row-${l.id}`}
                          className={[
                            "border-b border-slate-700/50 transition-colors",
                            isHighlight ? "bg-cyan-500/10 outline outline-1 outline-cyan-500/40" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/60",
                            isConfirmado ? "opacity-80" : "",
                          ].join(" ")}>
                          <Td className="text-center font-mono text-xs text-slate-500">{idx + 1}</Td>
                          <Td>{new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</Td>
                          <Td className="font-mono">{l.aerodromo_partida ?? "—"}</Td>
                          <Td className="font-mono">{l.aerodromo_chegada ?? "—"}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_ac)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_dep)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_pou)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_cor)}</Td>
                          <Td className="font-mono font-semibold" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(Number(l.tempo_voo ?? 0))}</Td>
                          <Td className="font-mono" style={{ color: "rgb(106, 226, 231)" }}>{decimalToHHMM(Number(l.horas_diurnas ?? 0))}</Td>
                          <Td className="font-mono" style={{ color: "rgb(144, 19, 254)" }}>{decimalToHHMM(Number(l.horas_noturnas ?? 0))}</Td>
                          <Td className="font-mono text-amber-400">{decimalToHHMM(Number(l.tempo_ifr ?? 0))}</Td>
                          <Td className="text-center text-emerald-400">{l.pousos_total ?? 0}</Td>
                          <Td className="text-amber-400">{num(l.combustivel_adicionado, 0)}</Td>
                          <Td className="text-amber-400">{num(l.litros_combustivel_inicio_voo, 0)}</Td>
                          <Td className="font-mono">{num(l.celula, 1)}</Td>
                          <Td className="text-xs truncate">{picT?.nome_completo ?? l.pic_canac ?? "—"}</Td>
                          <Td className="text-xs truncate">{sicT?.nome_completo ?? l.sic_name ?? l.sic_canac ?? "—"}</Td>
                          <Td className="text-xs font-medium text-white truncate">{labelVooPara(l)}</Td>
                          {temDiaria && (
                            <Td className="text-center text-violet-400 font-semibold">
                              {Number(l.tarifa_diaria ?? 0) > 0 ? Number(l.tarifa_diaria) : "—"}
                            </Td>
                          )}
                          <Td className="text-center">
                            {isConfirmado ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <Lock className="w-3 h-3" />
                                <span className="hidden sm:inline">Conf.</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConfirmar(l)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                title="Marcar como confirmado (bloqueia edição)">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </button>
                            )}
                          </Td>
                          <Td className="text-center">
                            {!isConfirmado && (
                              <button
                                onClick={() => setEditingLanc(l)}
                                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                title="Editar lançamento">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lancamentos.length > 0 && (
                    <tfoot className="border-t-2 border-cyan-500/30 bg-slate-800/90">
                      <tr>
                        <td colSpan={8} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-widest text-cyan-400">
                          TOTAIS DO PERÍODO
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(totals.tVoo)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(106, 226, 231)" }}>{decimalToHHMM(totals.tDia)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-sm" style={{ color: "rgb(144, 19, 254)" }}>{decimalToHHMM(totals.tNoit)}</td>
                        <td className="px-3 py-3 font-mono font-bold text-amber-400 text-sm">{decimalToHHMM(totals.ifr)}</td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-400 text-sm">{totals.pousos}</td>
                        <td className="px-3 py-3 font-bold text-amber-400 text-sm">{num(totals.abast, 0)}</td>
                        <td className="px-3 py-3 font-bold text-amber-400 text-sm">{num(totals.fuel, 0)}</td>
                        <td className="px-3 py-3 text-slate-500">—</td>
                        <td colSpan={3} className="px-3 py-3 text-slate-500">—</td>
                        {temDiaria && (
                          <td className="px-3 py-3 font-bold text-violet-400 text-sm text-center">
                            {totals.totalDiarias}d
                            <span className="block text-xs text-violet-300/70">R${num(totalDiariaReais, 0)}</span>
                          </td>
                        )}
                        <td colSpan={2} className="px-3 py-3 text-slate-500">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                /* ===== MODO RESUMO ===== */
                <table className="w-full border-collapse text-sm [&_td]:border-r [&_td]:border-slate-700/50 [&_th]:border-r [&_th]:border-slate-700/50 [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
                  <thead className="border-b border-slate-700/50 bg-slate-800/50">
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <Th className="text-center">#</Th>
                      <Th>Data</Th>
                      <Th>Trecho</Th>
                      <Th>DEP</Th>
                      <Th>POU</Th>
                      <Th style={{ color: "rgb(43, 122, 216)" }}>T VOO</Th>
                      <Th>VOO PARA</Th>
                      {temDiaria && <Th className="text-violet-400">DIÁRIAS</Th>}
                      <Th className="text-center">AÇÕES</Th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {displayLancamentos.length === 0 ? (
                      <tr><td colSpan={10} className="p-12 text-center text-slate-500">Nenhum voo registrado.</td></tr>
                    ) : displayLancamentos.map(({ l, match }, idx) => {
                      const isHighlight = searchQuery && match;
                      const isConfirmado = l.confirmado === true;
                      const trecho = l.trecho ?? `${l.aerodromo_partida ?? "—"} → ${l.aerodromo_chegada ?? "—"}`;
                      return (
                        <tr key={l.id}
                          className={[
                            "border-b border-slate-700/50 transition-colors",
                            isHighlight ? "bg-cyan-500/10 outline outline-1 outline-cyan-500/40" : idx % 2 === 0 ? "bg-slate-800/20" : "",
                            "hover:bg-slate-800/60",
                          ].join(" ")}>
                          <Td className="text-center font-mono text-xs text-slate-500">{idx + 1}</Td>
                          <Td>{new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</Td>
                          <Td className="font-mono font-medium text-white">{trecho}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_dep)}</Td>
                          <Td className="font-mono text-slate-400">{pgTimeToHHMM(l.tempo_pou)}</Td>
                          <Td className="font-mono font-bold" style={{ color: "rgb(43, 122, 216)" }}>{decimalToHHMM(Number(l.tempo_voo ?? 0))}</Td>
                          <Td className="font-medium text-white">{labelVooPara(l)}</Td>
                          {temDiaria && (
                            <Td className="text-center text-violet-400 font-semibold">
                              {Number(l.tarifa_diaria ?? 0) > 0 ? Number(l.tarifa_diaria) : "—"}
                            </Td>
                          )}
                          <Td className="text-center">
                            {!isConfirmado && (
                              <button onClick={() => setEditingLanc(l)}
                                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Resumo por cotista e Célula Row */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Horas por cotista */}
            <section className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Horas por Cotista</h2>
                <span className="ml-2 text-xs text-slate-500">
                  ({modoCelula === "tvoo" ? "T. Voo" : "T. Total"})
                </span>
              </div>
              {porCotista.length === 0 ? (
                <p className="py-6 text-center text-slate-500">Sem registros.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {porCotista.map((c, idx) => {
                    const tot = porCotista.reduce((s, x) => s + x.horas, 0);
                    const pct = tot > 0 ? (c.horas / tot) * 100 : 0;
                    const colors = ["from-cyan-500 to-blue-500", "from-violet-500 to-purple-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={`${c.label}-${idx}`} className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-3 flex flex-col gap-2">
                        <span className="truncate text-xs font-medium text-slate-300 leading-tight" title={c.label}>{c.label}</span>
                        <span className={`font-mono text-lg font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                          {decimalToHHMM(c.horas)}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-900">
                            <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-slate-500 text-xs shrink-0">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {diarioMes && (
              <section className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-white">Célula & Manutenção</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Atual (T. Total)" value={`${num(diarioMes.celula_atual_ttotal, 1)}h`} accent="primary" />
                  <Stat label="Atual (T. Voo)" value={`${num(diarioMes.celula_atual_tvoo, 1)}h`} accent="primary" />
                </div>
                {temDiaria && (
                  <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
                    <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-2">Diárias do período</p>
                    <div className="flex items-end gap-3">
                      <div>
                        <p className="text-2xl font-bold text-violet-400">{totals.totalDiarias}</p>
                        <p className="text-xs text-slate-500">diárias</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">R$ {num(totalDiariaReais, 2)}</p>
                        <p className="text-xs text-slate-500">@ R${num(valorDiaria, 2)}/diária</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showForm && aeronave && (
          <NovoVooDialog
            aeronave={aeronave}
            mes={mes} ano={ano}
            clientes={clientes} socios={socios} tripulantes={tripulantes}
            ultimaCelula={diarioMes?.celula_atual_ttotal ?? 0}
            ultimaCelulaTvoo={diarioMes?.celula_atual_tvoo ?? 0}
            temDiaria={temDiaria}
            onClose={() => setShowForm(false)}
            onSaved={async () => { setShowForm(false); await new Promise(r => setTimeout(r, 500)); await reload(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingLanc && aeronave && (
          <EditarVooDialog
            lanc={editingLanc}
            aeronave={aeronave}
            clientes={clientes} socios={socios} tripulantes={tripulantes}
            temDiaria={temDiaria}
            onClose={() => setEditingLanc(null)}
            onSaved={async () => { setEditingLanc(null); await reload(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConsumo && aeronave && (
          <ConsumoDialog
            aeronave={aeronave}
            lancamentos={lancamentos}
            clientes={clientes} socios={socios}
            mes={mes} ano={ano}
            labelVooPara={labelVooPara}
            onClose={() => setShowConsumo(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

/* ---------- Componentes Auxiliares ---------- */

function Th({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <th style={style} className={`px-3 py-2 text-left font-semibold align-middle whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan, style }: { children: React.ReactNode; className?: string; colSpan?: number; style?: React.CSSProperties }) {
  return <td colSpan={colSpan} style={style} className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function Stat({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: string; accent?: "primary" | "success" | "warning" }) {
  const color = accent === "primary" ? "text-cyan-400" : accent === "success" ? "text-emerald-400" : accent === "warning" ? "text-amber-400" : "text-white";
  return (
    <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/40">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-cyan-400 flex items-center">{icon}</span>}
        <span className="text-slate-500 text-xs">{label}</span>
      </div>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  );
}

/* ---------- Novo Voo Dialog ---------- */

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none transition-colors placeholder:text-slate-600";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NovoVooDialog({
  aeronave, mes, ano, clientes, socios, tripulantes, ultimaCelula, ultimaCelulaTvoo, temDiaria, onClose, onSaved,
}: {
  aeronave: Aeronave; mes: number; ano: number;
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  ultimaCelula: number; ultimaCelulaTvoo: number;
  temDiaria: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const today = new Date();
  const defaultDate = today.getMonth() + 1 === mes && today.getFullYear() === ano
    ? today.toISOString().slice(0, 10)
    : `${ano}-${String(mes).padStart(2, "0")}-01`;

  const [data, setData] = useState(defaultDate);
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");
  const [noturno, setNoturno] = useState("0:00");
  const [ifr, setIfr] = useState("0:00");
  const [pousos, setPousos] = useState(1);
  const [fuelInicio, setFuelInicio] = useState(0);
  const [abast, setAbast] = useState(0);
  const [natureza, setNatureza] = useState("Privado");
  const [picId, setPicId] = useState<string>("");
  const [sicId, setSicId] = useState<string>("");
  const [sicNome, setSicNome] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [socioId, setSocioId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [emprestimo, setEmprestimo] = useState(false);
  const [qtdDiarias, setQtdDiarias] = useState(0);
  const [saving, setSaving] = useState(false);

  const apresentacao = useMemo(() => subtractMinutesHHMM(acionamento, 30), [acionamento]);
  const tVoo = useMemo(() => diffDecimalHours(decolagem, pouso), [decolagem, pouso]);
  const tTotal = useMemo(() => diffDecimalHours(acionamento, corte), [acionamento, corte]);
  const noturnoDec = useMemo(() => Number(((hhmmToMinutes(noturno) ?? 0) / 60).toFixed(2)), [noturno]);
  const ifrDec = useMemo(() => Number(((hhmmToMinutes(ifr) ?? 0) / 60).toFixed(2)), [ifr]);
  const diurno = useMemo(() => Number((Math.max(0, tVoo - noturnoDec)).toFixed(2)), [tVoo, noturnoDec]);

  const sugCelula = useMemo(() => Number(((Number(ultimaCelula) || 0) + tTotal).toFixed(2)), [ultimaCelula, tTotal]);
  const sugCelulaTvoo = useMemo(() => Number(((Number(ultimaCelulaTvoo) || 0) + tVoo).toFixed(2)), [ultimaCelulaTvoo, tVoo]);
  const [celula, setCelula] = useState<number>(sugCelula);
  const [celulaTvoo, setCelulaTvoo] = useState<number>(sugCelulaTvoo);
  const [celulaTouched, setCelulaTouched] = useState(false);
  const [celulaTvooTouched, setCelulaTvooTouched] = useState(false);
  useEffect(() => { if (!celulaTouched) setCelula(sugCelula); }, [sugCelula, celulaTouched]);
  useEffect(() => { if (!celulaTvooTouched) setCelulaTvoo(sugCelulaTvoo); }, [sugCelulaTvoo, celulaTvooTouched]);

  const sociosDoCliente = useMemo(() => socios.filter((s) => s.cliente_id === clienteId), [socios, clienteId]);
  const tripOptions = useMemo(() =>
    tripulantes.filter((t) => (t.status ?? "").toLowerCase().startsWith("ativ"))
      .slice().sort((a, b) => (a.nome_completo ?? "").localeCompare(b.nome_completo ?? "")),
    [tripulantes]);

  const submit = async () => {
    if (!origem || !destino || !decolagem || !pouso) { alert("Preencha origem, destino, decolagem e pouso."); return; }
    if (!picId) { alert("Selecione o PIC."); return; }
    setSaving(true);
    try {
      const dmRes = await supabase.from("diario_mes").select("id,celula_atual_ttotal").eq("aeronave_id", aeronave.id).eq("ano", ano).eq("mes", mes).maybeSingle();
      let dmId = dmRes.data?.id as string | undefined;
      if (!dmId) {
        const inserted = await supabase.from("diario_mes").insert({ aeronave_id: aeronave.id, ano, mes, celula_anterior_ttotal: ultimaCelula, celula_atual_ttotal: ultimaCelula }).select("id").single();
        if (inserted.error) throw inserted.error;
        dmId = inserted.data.id as string;
      }
      const socio = socioId ? socios.find((s) => s.id === socioId) : null;
      const sicTrip = sicId ? tripulantes.find((t) => t.id === sicId) : null;
      const payload = {
        diario_mes: dmId, aeronave_id: aeronave.id, data_registro: data,
        aerodromo_partida: origem.toUpperCase(), aerodromo_chegada: destino.toUpperCase(),
        tripulacao_checkin_hora: apresentacao ? `${apresentacao}:00` : null,
        tempo_ac: acionamento ? `${acionamento}:00` : null,
        tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null,
        tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno,
        horas_noturnas: noturnoDec, tempo_ifr: ifrDec, pousos_total: pousos,
        litros_combustivel_inicio_voo: fuelInicio, combustivel_adicionado: abast,
        celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null,
        sic_name: sicNome || sicTrip?.nome_completo || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null,
        socios_nome: socio?.nome ?? null,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioId || null) : null,
        ocorrencias: obs || null,
      };
      const ins = await supabase.from("lancamentos_diario_bordo").insert(payload as never);
      if (ins.error) throw ins.error;
      await supabase.from("diario_mes").update({ celula_atual_ttotal: celula, celula_atual_tvoo: celulaTvoo }).eq("id", dmId);
      onSaved();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-white">Novo Voo · {aeronave.matricula}</h3>
            <p className="text-xs text-slate-400">Horários em Zulu (UTC)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-6 p-5">
          <Section title="Identificação">
            <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} /></Field>
            <Field label="Natureza do voo">
              <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
                {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Origem (ICAO)"><input value={origem} onChange={(e) => setOrigem(e.target.value.toUpperCase())} maxLength={4} className={`${inputCls} font-mono uppercase`} placeholder="SBSP" /></Field>
            <Field label="Destino (ICAO)"><input value={destino} onChange={(e) => setDestino(e.target.value.toUpperCase())} maxLength={4} className={`${inputCls} font-mono uppercase`} placeholder="SBRJ" /></Field>
          </Section>
          <Section title="Horários (Zulu) — apresentação auto 30min">
            <Field label="Apresentação (auto)"><input value={apresentacao || "--:--"} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
            <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          </Section>
          <Section title="Tempos calculados">
            <Field label="T. Voo (POU - DEP)"><input value={`${decimalToHHMM(tVoo)}  (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Tempo Total (COR - AC)"><input value={`${decimalToHHMM(tTotal)}  (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
            <Field label="Noturno"><input type="time" value={noturno} onChange={(e) => setNoturno(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="IFR"><input type="time" value={ifr} onChange={(e) => setIfr(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pousos"><input type="number" min={0} value={pousos} onChange={(e) => setPousos(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="ABAST+ (L)"><input type="number" min={0} value={abast} onChange={(e) => setAbast(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="FUEL (L)"><input type="number" min={0} value={fuelInicio} onChange={(e) => setFuelInicio(Number(e.target.value))} className={inputCls} /></Field>
            <Field label={`Célula T.Total (sug. ${num(sugCelula, 1)}h)`}>
              <input type="number" step="0.1" min={0} value={celula} onChange={(e) => { setCelula(Number(e.target.value)); setCelulaTouched(true); }} className={`${inputCls} font-mono text-amber-400`} />
            </Field>
            <Field label={`Célula T.Voo (sug. ${num(sugCelulaTvoo, 1)}h)`}>
              <input type="number" step="0.1" min={0} value={celulaTvoo} onChange={(e) => { setCelulaTvoo(Number(e.target.value)); setCelulaTvooTouched(true); }} className={`${inputCls} font-mono text-amber-400`} />
            </Field>
          </Section>
          <Section title="Tripulação & Cotista">
            <Field label="PIC (Tripulante)">
              <select value={picId} onChange={(e) => setPicId(e.target.value)} className={inputCls}>
                <option value="">— selecionar —</option>
                {tripOptions.map((t) => <option key={t.id} value={t.id}>{t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}{t.canac ? ` (${t.canac})` : ""}</option>)}
              </select>
            </Field>
            <Field label="SIC (Tripulante)">
              <select value={sicId} onChange={(e) => { setSicId(e.target.value); setSicNome(""); }} className={inputCls}>
                <option value="">— selecionar —</option>
                {tripOptions.map((t) => <option key={t.id} value={t.id}>{t.nome_completo ?? t.canac ?? t.id.slice(0, 6)}{t.canac ? ` (${t.canac})` : ""}</option>)}
              </select>
            </Field>
            <Field label="SIC (nome livre)"><input value={sicNome} onChange={(e) => setSicNome(e.target.value)} disabled={!!sicId} className={inputCls} placeholder="Se não estiver na lista" /></Field>
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setSocioId(""); }} className={inputCls}>
                <option value="">— sem cotista —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social ?? c.proprietario ?? c.id.slice(0, 6)}</option>)}
              </select>
            </Field>
            <Field label="Sócio (opcional)">
              <select value={socioId} onChange={(e) => setSocioId(e.target.value)} disabled={!clienteId || sociosDoCliente.length === 0} className={inputCls}>
                <option value="">— nenhum —</option>
                {sociosDoCliente.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Field>
            <Field label="Voo emprestado?">
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={emprestimo} onChange={(e) => setEmprestimo(e.target.checked)} disabled={!clienteId}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50" />
                <span className={emprestimo ? "font-semibold text-amber-400" : "text-slate-400"}>{emprestimo ? "SIM — marcará tomador" : "Não"}</span>
              </label>
            </Field>
          </Section>
          {temDiaria && (
            <Section title="Diárias">
              <Field label="Qtd. de Diárias neste voo">
                <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
              </Field>
            </Section>
          )}
          <Field label="Ocorrências / Observações">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inputCls} placeholder="Detalhes opcionais do voo..." />
          </Field>
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-600 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar voo"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Editar Voo Dialog ---------- */

function EditarVooDialog({
  lanc, aeronave, clientes, socios, tripulantes, temDiaria, onClose, onSaved,
}: {
  lanc: Lanc; aeronave: Aeronave;
  clientes: Cliente[]; socios: Socio[]; tripulantes: Tripulante[];
  temDiaria: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const fmtTime = (v: string | null) => v ? v.slice(0, 5) : "";

  const [data, setData] = useState(lanc.data_registro);
  const [origem, setOrigem] = useState(lanc.aerodromo_partida ?? "");
  const [destino, setDestino] = useState(lanc.aerodromo_chegada ?? "");
  const [acionamento, setAcionamento] = useState(fmtTime(lanc.tempo_ac));
  const [decolagem, setDecolagem] = useState(fmtTime(lanc.tempo_dep));
  const [pouso, setPouso] = useState(fmtTime(lanc.tempo_pou));
  const [corte, setCorte] = useState(fmtTime(lanc.tempo_cor));
  const [noturno, setNoturno] = useState(decimalToHHMM(Number(lanc.horas_noturnas ?? 0)));
  const [ifr, setIfr] = useState(decimalToHHMM(Number(lanc.tempo_ifr ?? 0)));
  const [pousos, setPousos] = useState(lanc.pousos_total ?? 1);
  const [fuelInicio, setFuelInicio] = useState(Number(lanc.litros_combustivel_inicio_voo ?? 0));
  const [abast, setAbast] = useState(Number(lanc.combustivel_adicionado ?? 0));
  const [natureza, setNatureza] = useState(lanc.natureza_voo ?? "Privado");
  const [picId, setPicId] = useState(lanc.pic_canac ?? "");
  const [sicId, setSicId] = useState(lanc.sic_canac ?? "");
  const [sicNome, setSicNome] = useState(lanc.sic_name ?? "");
  const [clienteId, setClienteId] = useState(lanc.clientes_id ?? "");
  const [socioId, setSocioId] = useState(lanc.socios_cliente_id ?? "");
  const [emprestimo, setEmprestimo] = useState(lanc.emprestimo ?? false);
  const [qtdDiarias, setQtdDiarias] = useState(Number(lanc.tarifa_diaria ?? 0));
  const [celula, setCelula] = useState(Number(lanc.celula ?? 0));
  const [celulaTvoo, setCelulaTvoo] = useState(Number(lanc.celula_tvoo ?? 0));
  const [saving, setSaving] = useState(false);

  const tVoo = useMemo(() => diffDecimalHours(decolagem, pouso), [decolagem, pouso]);
  const tTotal = useMemo(() => diffDecimalHours(acionamento, corte), [acionamento, corte]);
  const noturnoDec = useMemo(() => Number(((hhmmToMinutes(noturno) ?? 0) / 60).toFixed(2)), [noturno]);
  const ifrDec = useMemo(() => Number(((hhmmToMinutes(ifr) ?? 0) / 60).toFixed(2)), [ifr]);
  const diurno = useMemo(() => Number((Math.max(0, tVoo - noturnoDec)).toFixed(2)), [tVoo, noturnoDec]);

  const sociosDoCliente = useMemo(() => socios.filter((s) => s.cliente_id === clienteId), [socios, clienteId]);
  const tripOptions = useMemo(() =>
    tripulantes.filter((t) => (t.status ?? "").toLowerCase().startsWith("ativ"))
      .slice().sort((a, b) => (a.nome_completo ?? "").localeCompare(b.nome_completo ?? "")),
    [tripulantes]);

  const submit = async () => {
    setSaving(true);
    try {
      const socio = socioId ? socios.find((s) => s.id === socioId) : null;
      const { error } = await supabase.from("lancamentos_diario_bordo").update({
        data_registro: data,
        aerodromo_partida: origem.toUpperCase(), aerodromo_chegada: destino.toUpperCase(),
        tempo_ac: acionamento ? `${acionamento}:00` : null,
        tempo_dep: decolagem ? `${decolagem}:00` : null,
        tempo_pou: pouso ? `${pouso}:00` : null,
        tempo_cor: corte ? `${corte}:00` : null,
        tempo_voo: tVoo, tempo_total: tTotal, horas_diurnas: diurno,
        horas_noturnas: noturnoDec, tempo_ifr: ifrDec, pousos_total: pousos,
        litros_combustivel_inicio_voo: fuelInicio, combustivel_adicionado: abast,
        celula, celula_tvoo: celulaTvoo,
        pic_canac: picId || null, sic_canac: sicId || null, sic_name: sicNome || null,
        natureza_voo: natureza, tarifa_diaria: temDiaria ? String(qtdDiarias) : null,
        clientes_id: clienteId || null, socios_cliente_id: socioId || null,
        socios_nome: socio?.nome ?? null,
        emprestimo, cliente_tomador_emprestimo_id: emprestimo ? (clienteId || null) : null,
        socio_tomador_emprestimo_id: emprestimo ? (socioId || null) : null,
      } as never).eq("id", lanc.id);
      if (error) throw error;
      onSaved();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert("Erro ao salvar: " + msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900 shadow-2xl shadow-amber-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Pencil className="w-5 h-5 text-amber-400" /> Editar Voo · {aeronave.matricula}</h3>
            <p className="text-xs text-amber-400/60">Editando lançamento de {new Date(lanc.data_registro + "T00:00").toLocaleDateString("pt-BR")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-6 p-5">
          <Section title="Identificação">
            <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} /></Field>
            <Field label="Natureza do voo">
              <select value={natureza} onChange={(e) => setNatureza(e.target.value)} className={inputCls}>
                {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Origem (ICAO)"><input value={origem} onChange={(e) => setOrigem(e.target.value.toUpperCase())} maxLength={4} className={`${inputCls} font-mono uppercase`} /></Field>
            <Field label="Destino (ICAO)"><input value={destino} onChange={(e) => setDestino(e.target.value.toUpperCase())} maxLength={4} className={`${inputCls} font-mono uppercase`} /></Field>
          </Section>
          <Section title="Horários (Zulu)">
            <Field label="Acionamento (AC)"><input type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Decolagem (DEP)"><input type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pouso (POU)"><input type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Corte (COR)"><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className={`${inputCls} font-mono`} /></Field>
          </Section>
          <Section title="Tempos">
            <Field label="T. Voo"><input value={`${decimalToHHMM(tVoo)} (${num(tVoo, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Tempo Total"><input value={`${decimalToHHMM(tTotal)} (${num(tTotal, 2)}h)`} disabled className={`${inputCls} font-mono text-cyan-400 border-cyan-500/30 bg-cyan-500/5`} /></Field>
            <Field label="Diurno (auto)"><input value={decimalToHHMM(diurno)} disabled className={`${inputCls} font-mono opacity-70 cursor-not-allowed`} /></Field>
            <Field label="Noturno"><input type="time" value={noturno} onChange={(e) => setNoturno(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="IFR"><input type="time" value={ifr} onChange={(e) => setIfr(e.target.value)} className={`${inputCls} font-mono`} /></Field>
            <Field label="Pousos"><input type="number" min={0} value={pousos} onChange={(e) => setPousos(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="ABAST+ (L)"><input type="number" min={0} value={abast} onChange={(e) => setAbast(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="FUEL (L)"><input type="number" min={0} value={fuelInicio} onChange={(e) => setFuelInicio(Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Célula T.Total">
              <input type="number" step="0.1" min={0} value={celula} onChange={(e) => setCelula(Number(e.target.value))} className={`${inputCls} font-mono text-amber-400`} />
            </Field>
            <Field label="Célula T.Voo">
              <input type="number" step="0.1" min={0} value={celulaTvoo} onChange={(e) => setCelulaTvoo(Number(e.target.value))} className={`${inputCls} font-mono text-amber-400`} />
            </Field>
          </Section>
          <Section title="Tripulação & Cotista">
            <Field label="PIC">
              <select value={picId} onChange={(e) => setPicId(e.target.value)} className={inputCls}>
                <option value="">— selecionar —</option>
                {tripOptions.map((t) => <option key={t.id} value={t.id}>{t.nome_completo ?? t.canac}</option>)}
              </select>
            </Field>
            <Field label="SIC">
              <select value={sicId} onChange={(e) => { setSicId(e.target.value); setSicNome(""); }} className={inputCls}>
                <option value="">— selecionar —</option>
                {tripOptions.map((t) => <option key={t.id} value={t.id}>{t.nome_completo ?? t.canac}</option>)}
              </select>
            </Field>
            <Field label="SIC (nome livre)"><input value={sicNome} onChange={(e) => setSicNome(e.target.value)} disabled={!!sicId} className={inputCls} /></Field>
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setSocioId(""); }} className={inputCls}>
                <option value="">— sem cotista —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social ?? c.proprietario}</option>)}
              </select>
            </Field>
            <Field label="Sócio">
              <select value={socioId} onChange={(e) => setSocioId(e.target.value)} disabled={!clienteId || sociosDoCliente.length === 0} className={inputCls}>
                <option value="">— nenhum —</option>
                {sociosDoCliente.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Field>
            <Field label="Voo emprestado?">
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={emprestimo} onChange={(e) => setEmprestimo(e.target.checked)} disabled={!clienteId}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500" />
                <span className={emprestimo ? "font-semibold text-amber-400" : "text-slate-400"}>{emprestimo ? "SIM" : "Não"}</span>
              </label>
            </Field>
          </Section>
          {temDiaria && (
            <Section title="Diárias">
              <Field label="Qtd. de Diárias neste voo">
                <input type="number" min={0} value={qtdDiarias} onChange={(e) => setQtdDiarias(Number(e.target.value))} className={`${inputCls} text-violet-400 font-mono`} />
              </Field>
            </Section>
          )}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <button onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar edição"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Consumo Dialog ---------- */

function ConsumoDialog({
  aeronave, lancamentos, clientes, socios, mes, ano, labelVooPara, onClose,
}: {
  aeronave: Aeronave; lancamentos: Lanc[]; clientes: Cliente[]; socios: Socio[];
  mes: number; ano: number; labelVooPara: (l: Lanc) => string; onClose: () => void;
}) {
  const porVoo = lancamentos.map((l) => {
    const tv = Number(l.tempo_voo ?? 0);
    const consumoVoo = Number(l.consumo_combustivel_voo ?? 0);
    const consumoTotal = Number(l.consumo_combustivel_total ?? 0);
    return { l, tv, consumoVoo, consumoTotal };
  });

  const porCliente = new Map<string, { label: string; consumoVoo: number; consumoTotal: number; count: number }>();
  for (const { l, consumoVoo, consumoTotal } of porVoo) {
    const key = labelVooPara(l);
    const cur = porCliente.get(key) ?? { label: key, consumoVoo: 0, consumoTotal: 0, count: 0 };
    cur.consumoVoo += consumoVoo;
    cur.consumoTotal += consumoTotal;
    cur.count += 1;
    porCliente.set(key, cur);
  }

  const avgConsumoVoo = porVoo.length > 0 ? porVoo.reduce((s, x) => s + x.consumoVoo, 0) / porVoo.length : 0;
  const avgConsumoTotal = porVoo.length > 0 ? porVoo.reduce((s, x) => s + x.consumoTotal, 0) / porVoo.length : 0;
  const lhHistorico = aeronave.consumo_combustivel ?? 0;
  const diffPct = lhHistorico > 0 ? ((avgConsumoVoo - lhHistorico) / lhHistorico) * 100 : 0;

  void clientes; void socios;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900 shadow-2xl shadow-amber-500/10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/95 p-5 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Droplets className="w-5 h-5 text-amber-400" /> Consumo · {aeronave.matricula}
            </h3>
            <p className="text-xs text-slate-400">{monthNames[mes - 1]}/{ano} — histórico: {num(lhHistorico, 1)} L/H</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-6 p-5">
          {/* KPIs */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-600/5 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4">Total da aeronave no mês</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Consumo médio (voo)" value={`${num(avgConsumoVoo, 1)} L/h`} accent="warning" />
              <Stat label="Consumo médio (total)" value={`${num(avgConsumoTotal, 1)} L/h`} accent="warning" />
              <Stat label="Voos no período" value={String(porVoo.length)} accent="primary" />
            </div>
            {/* Comparativo histórico vs mês */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-3 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Histórico cadastrado</p>
                <p className="text-lg font-bold text-slate-300">{num(lhHistorico, 1)} L/h</p>
              </div>
              <div className="text-2xl text-slate-600">→</div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Este mês (consumo voo)</p>
                <p className="text-lg font-bold text-white">{num(avgConsumoVoo, 1)} L/h</p>
              </div>
              <div className={`rounded-lg px-3 py-2 text-sm font-bold ${diffPct > 5 ? "bg-red-500/20 text-red-400" : diffPct < -5 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700/50 text-slate-300"}`}>
                {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Por cliente com L/h e barra */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Por cliente / cotista</p>
            {porCliente.size === 0 ? (
              <p className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-center text-sm text-slate-500">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(porCliente.values()).sort((a, b) => b.consumoVoo - a.consumoVoo).map((r) => {
                  const avgConsumoVooCliente = r.count > 0 ? r.consumoVoo / r.count : 0;
                  const avgConsumoTotalCliente = r.count > 0 ? r.consumoTotal / r.count : 0;
                  const pctVoo = avgConsumoVoo > 0 ? (avgConsumoVooCliente / avgConsumoVoo) * 100 : 0;
                  return (
                    <div key={r.label} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-semibold text-white text-sm truncate">{r.label}</span>
                        <span className="font-mono text-xs text-slate-400">{r.count} voo{r.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                        <span>Consumo voo: <span className={`font-bold font-mono ${avgConsumoVooCliente > lhHistorico * 1.1 ? "text-red-400" : avgConsumoVooCliente < lhHistorico * 0.9 ? "text-emerald-400" : "text-cyan-400"}`}>{num(avgConsumoVooCliente, 1)} L/h</span></span>
                        <span>Consumo total: <span className={`font-bold font-mono ${avgConsumoTotalCliente > lhHistorico * 1.1 ? "text-red-400" : avgConsumoTotalCliente < lhHistorico * 0.9 ? "text-emerald-400" : "text-cyan-400"}`}>{num(avgConsumoTotalCliente, 1)} L/h</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${pctVoo}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Por voo */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Por voo</p>
            {porVoo.length === 0 ? (
              <p className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-center text-sm text-slate-500">Sem voos no período.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Trecho</th>
                      <th className="px-3 py-2 text-left">Para</th>
                      <th className="px-3 py-2 text-right">T. Voo</th>
                      <th className="px-3 py-2 text-right">L/h (voo)</th>
                      <th className="px-3 py-2 text-right">L/h (total)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-900 text-slate-300">
                    {porVoo.map(({ l, tv, consumoVoo, consumoTotal }) => (
                      <tr key={l.id} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                        <td className="px-3 py-2">{new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                        <td className="px-3 py-2 font-mono text-xs">{l.aerodromo_partida ?? "—"} → {l.aerodromo_chegada ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{labelVooPara(l)}</td>
                        <td className="px-3 py-2 text-right font-mono">{decimalToHHMM(tv)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${consumoVoo > lhHistorico * 1.1 ? "text-red-400" : consumoVoo < lhHistorico * 0.9 ? "text-emerald-400" : "text-cyan-400"}`}>
                          {consumoVoo > 0 ? num(consumoVoo, 1) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${consumoTotal > lhHistorico * 1.1 ? "text-red-400" : consumoTotal < lhHistorico * 0.9 ? "text-emerald-400" : "text-cyan-400"}`}>
                          {consumoTotal > 0 ? num(consumoTotal, 1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default DiarioBordoDetalhes;