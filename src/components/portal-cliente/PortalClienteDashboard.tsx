import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Layers,
  Paperclip,
  Plane,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/* ─────────────────────────── types ─────────────────────────── */

interface Aeronave {
  id: string;
  matricula: string;
  fabricante: string;
  modelo: string;
  status: string;
  operador?: string;
}

interface Cotista {
  id: string;
  cliente_id: string | null;
  socio_id: string | null;
  nome: string;
  aircraft_id: string;
  aircraft_matricula: string;
  aircraft_modelo: string;
  percentual: number;
}

interface Rateio {
  id: string;
  despesa_id: string;
  fonte_despesa: string | null;
  tipo_rateio: string | null;
  fluxo: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_emissao: string | null;
  numero_nf: string | null;
  numero_doc: string | null;
  fornecedor_nome: string | null;
  cliente_id: string | null;
  clientes_nome: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  pago_por: string | null;
  forma_pagamento: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  percentual_sociedade: number | null;
  percentual_uso: number | null;
  descricao_despesa: string | null;
  periodicidade: string | null;
  valor_total_despesa: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  status: string | null;
  observacoes: string | null;
  categoria_custo: string | null;
  subcategoria_1: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
}

interface VooCotista {
  cliente_id: string;
  aeronave_id: string;
  total_horas: number;
  total_pousos: number;
  voos: { data: string; origem: string; destino: string; tempo_voo: number; pousos: number }[];
}

interface Movimentacao {
  id: string;
  descricao: string | null;
  tipo: string | null;
  valor_rateado: string | number | null;
  valor_original: string | number | null;
  valor_pago_real: string | number | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  aeronave_id: string | null;
  clientes_id: string | null;
  socio_id: string | null;
  status: string | null;
  forma_pagamento: string | null;
  fornecedor_nome: string | null;
  reembolsavel: boolean | null;
  reembolso_quitado: boolean | null;
  pago_diretamente: boolean | null;
  tipo_caixa: string | null;
  reference_type: string | null;
  contas_apagar_id: string | null;
  contas_areceber_id: string | null;
  movimentacao_origem_id: string | null;
  movimentacao_pai_id: string | null;
  observacoes: string | null;
  categoria_nome: string | null;
  numero_nf: string | null;
  numero_doc: string | null;
  comprovante_url: string | null;
  nf_url: string | null;
  recibo_url: string | null;
  boleto_url: string | null;
  pago_por: string | null;
}

interface CategoriaMap {
  [id: string]: string;
}

/* ─────────────────────────── helpers ─────────────────────────── */

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const norm = (s?: string | null) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const isSaida = (fluxo?: string | null) => norm(fluxo) !== "entrada";

const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

const formatDateShort = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveCategoria(raw: string | null | undefined, map: CategoriaMap): string {
  const v = (raw || "").trim();
  if (!v) return "Sem categoria";
  if (UUID_RE.test(v)) return map[v] || "Sem categoria";
  return v;
}

const cotistaKey = (cid: string | null, sid: string | null) => `${cid || ""}|${sid || ""}`;

function findCotistaKey(
  cotistas: Cotista[],
  rec: { cliente_id?: string | null; socio_id?: string | null },
) {
  const cid = rec.cliente_id ?? null;
  const sid = rec.socio_id ?? null;
  const bySocio = sid ? cotistas.find((c) => c.socio_id === sid) : null;
  if (bySocio) return bySocio.id;
  const byCliente = cid ? cotistas.find((c) => c.cliente_id === cid && !c.socio_id) : null;
  if (byCliente) return byCliente.id;
  return cid ? cotistas.find((c) => c.cliente_id === cid)?.id ?? null : null;
}

function statusOf(r: Rateio): { label: string; tone: "success" | "warning" | "danger" | "muted" } {
  if (r.status) {
    const n = norm(r.status);
    if (n.startsWith("pago")) return { label: r.status, tone: "success" };
    if (n.startsWith("atras")) return { label: r.status, tone: "danger" };
    if (n.startsWith("pend")) return { label: r.status, tone: "warning" };
    return { label: r.status, tone: "muted" };
  }
  if ((Number(r.valor_pago_real) || 0) > 0 || r.data_pagamento) return { label: "Pago", tone: "success" };
  if (r.data_vencimento && new Date(r.data_vencimento) < new Date()) return { label: "Atrasado", tone: "danger" };
  return { label: "Pendente", tone: "warning" };
}

const PALETTE = ["#3b7dd8", "#c9932f", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

const catColors: Record<string, string> = {
  "Combustível": "#22c55e",
  "Manutenção": "#c9932f",
  "Custos Fixos": "#8b5cf6",
  "Pessoal": "#3b7dd8",
  "Depósito": "#22c55e",
  "Taxas": "#ec4899",
  "Sem categoria": "#64748b",
};

/* ─────────────────────────── main component ─────────────────────────── */

function PortalClienteDashboard() {
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [activeAircraftId, setActiveAircraftId] = useState<string | null>(null);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [catMap, setCatMap] = useState<CategoriaMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeMonth, setActiveMonth] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [fFluxo, setFFluxo] = useState<"todos" | "entrada" | "saida">("todos");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">("todos");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);

  /* ── Fetch aeronaves ── */
  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("aeronave")
          .select("id, matricula, fabricante, modelo, status")
          .eq("status", "ativa")
          .order("matricula");
        if (err) throw err;
        setAeronaves(data ?? []);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  /* ── Fetch categorias ── */
  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("expense_configu")
          .select("id, expense_type");
        if (err) throw err;
        const m: CategoriaMap = {};
        (data ?? []).forEach((c: any) => { m[c.id] = (c.expense_type || "").trim(); });
        setCatMap(m);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  /* ── Fetch cotistas for active aircraft ── */
  useEffect(() => {
    if (!activeAircraftId) return;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("cotistas_aeronave")
          .select(`
            id,
            id_clientes,
            id_aeronave,
            socios_id,
            percentual_sociedade,
            modelo_aeronave,
            clientes(razao_social, proprietario),
            socios(nome)
          `)
          .eq("id_aeronave", activeAircraftId);
        if (err) throw err;
        const mapped: Cotista[] = (data ?? []).map((r: any) => ({
          id: cotistaKey(r.id_clientes, r.socios_id),
          cliente_id: r.id_clientes ?? null,
          socio_id: r.socios_id ?? null,
          nome: r.socios?.nome || r.clientes?.razao_social || r.clientes?.proprietario || "Cotista",
          aircraft_id: r.id_aeronave,
          aircraft_matricula: "",
          aircraft_modelo: r.modelo_aeronave || "",
          percentual: Number(r.percentual_sociedade) || 0,
        }));
        setCotistas(mapped);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [activeAircraftId]);

  /* ── Fetch rateio_despesas for active aircraft ── */
  useEffect(() => {
    if (!activeAircraftId) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("rateio_despesas")
          .select("*")
          .eq("aeronave_id", activeAircraftId)
          .order("data_pagamento", { ascending: false, nullsFirst: false });
        if (err) throw err;
        setRateios(((data ?? []) as any[]).map((r) => ({ ...r, valor_total_despesa: r.valor_total_despesa ?? r.valor_total ?? null })) as Rateio[]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeAircraftId]);

  /* ── Fetch movimentacoes for active aircraft ── */
  useEffect(() => {
    if (!activeAircraftId) return;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("movimentacoes")
          .select("*")
          .eq("aeronave_id", activeAircraftId)
          .order("data_vencimento", { ascending: false, nullsFirst: false });
        if (err) throw err;
        setMovimentacoes((data ?? []) as unknown as Movimentacao[]);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [activeAircraftId]);

  // Auto-select first aircraft
  useEffect(() => {
    if (aeronaves.length > 0 && !activeAircraftId) {
      setActiveAircraftId(aeronaves[0].id);
    }
  }, [aeronaves, activeAircraftId]);

  const activeAircraft = aeronaves.find((a) => a.id === activeAircraftId) ?? null;
  const catNameOf = useCallback((r: Rateio) => resolveCategoria(r.categoria_custo, catMap), [catMap]);

  /* ── Unique despesas (dedupe by despesa_id) ── */
  const uniqueDespesas = useMemo(() => {
    const map = new Map<string, Rateio>();
    for (const r of rateios) {
      const k = r.despesa_id || r.id;
      if (!map.has(k)) map.set(k, r);
    }
    return Array.from(map.values());
  }, [rateios]);

  /* ── Movimentacoes lookup by despesa_id ── */
  const movByDespesaId = useMemo(() => {
    const map = new Map<string, Movimentacao>();
    for (const m of movimentacoes) {
      if (m.id) map.set(m.id, m);
    }
    return map;
  }, [movimentacoes]);

  /* ── Period filter: month or all ── */
  const now = new Date();
  const year = now.getFullYear();
  const isAllMonths = activeMonth === "todos";
  const monthIdx = isAllMonths ? -1 : MESES.indexOf(activeMonth);
  const periodStart = isAllMonths ? "0000-01-01" : new Date(year, monthIdx, 1).toISOString().slice(0, 10);
  const periodEnd = isAllMonths ? "9999-12-31" : new Date(year, monthIdx + 1, 0).toISOString().slice(0, 10);

  const inRange = useCallback(
    (r: Rateio, s: string, e: string) => {
      const d = r.data_pagamento || r.data_vencimento || r.data_emissao;
      if (!d) return false;
      const iso = d.slice(0, 10);
      return iso >= s && iso <= e;
    },
    [],
  );

  const curPeriodDespesas = useMemo(
    () => isAllMonths ? uniqueDespesas : uniqueDespesas.filter((r) => inRange(r, periodStart, periodEnd)),
    [uniqueDespesas, isAllMonths, periodStart, periodEnd, inRange],
  );

  /* ── Totals ── */
  const totals = useMemo(() => {
    let entradas = 0, saidas = 0, entC = 0, saiC = 0;
    for (const r of curPeriodDespesas) {
      const v = Number(r.valor_rateado) || 0;
      if (isSaida(r.fluxo)) { saidas += v; saiC++; } else { entradas += v; entC++; }
    }
    let saldo = 0;
    for (const r of uniqueDespesas) {
      const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 10);
      if (!d || d > periodEnd) continue;
      const v = Number(r.valor_rateado) || 0;
      saldo += isSaida(r.fluxo) ? -v : v;
    }
    return { entradas, saidas, entC, saiC, resultado: entradas - saidas, total: curPeriodDespesas.length, saldo };
  }, [curPeriodDespesas, uniqueDespesas, periodEnd]);

  /* ── Aircraft totals ── */
  const aircraftTotals = useMemo(() => {
    let fixo = 0, variavel = 0;
    for (const r of curPeriodDespesas) {
      if (!isSaida(r.fluxo)) continue;
      const v = Number(r.valor_rateado) || 0;
      const tr = norm(r.tipo_rateio);
      if (tr === "fixo" || tr === "fixo_mensal") fixo += v;
      else variavel += v;
    }
    return { fixo, variavel, total: fixo + variavel };
  }, [curPeriodDespesas]);

  /* ── Alerts ── */
  const pendencias = useMemo(() => {
    const today = new Date();
    return uniqueDespesas
      .filter((r) => {
        const s = statusOf(r);
        return s.tone === "danger" && isSaida(r.fluxo) && r.data_vencimento;
      })
      .map((r) => {
        const venc = new Date(r.data_vencimento as string);
        const dias = Math.floor((today.getTime() - venc.getTime()) / 86400000);
        return {
          nome: r.clientes_nome || r.socios_nome || "—",
          descricao: r.descricao_despesa || "—",
          aeronave: r.aeronave_registro || "—",
          valor: Number(r.valor_rateado) || 0,
          vencimento: r.data_vencimento as string,
          dias,
        };
      })
      .sort((a, b) => b.dias - a.dias);
  }, [uniqueDespesas]);

  const alerts = useMemo(() => {
    const out: { type: "danger" | "warning" | "info"; title: string; desc: string }[] = [];
    const pending = uniqueDespesas.filter((r) => {
      const s = statusOf(r);
      return s.tone === "warning" && isSaida(r.fluxo);
    });
    pending.slice(0, 2).forEach((r) => {
      out.push({
        type: "warning",
        title: "Custo não alocado",
        desc: `${r.descricao_despesa || "—"} · ${r.aeronave_registro || ""} · ${formatBRL(Number(r.valor_rateado) || 0)}`,
      });
    });
    out.push({
      type: "info",
      title: "Fechamento pendente",
      desc: `${activeMonth} ${year} · prazo em 3 dias`,
    });
    return out.slice(0, 4);
  }, [uniqueDespesas, activeMonth, year, isAllMonths]);

  const clearFilters = () => {
    setSearch("");
    setFFluxo("todos");
    setFCategoria("todas");
    setFStatus("todos");
  };

  /* ── Cotista color helper ── */
  const cotistaColor = useCallback((id: string) => {
    const i = Math.max(0, cotistas.findIndex((c) => c.id === id));
    return PALETTE[i % PALETTE.length];
  }, [cotistas]);

  /* ── Reembolsos pendentes para a Share ── */
  const reembolsosPendentes = useMemo(() => {
    return movimentacoes
      .filter((m) => m.reembolsavel === true && m.reembolso_quitado !== true)
      .map((m) => {
        const cotista = cotistas.find(
          (c) => c.cliente_id === m.clientes_id || c.socio_id === m.socio_id,
        );
        return {
          id: m.id,
          descricao: m.descricao || "—",
          cotista: cotista?.nome || m.fornecedor_nome || "—",
          valor: Number(m.valor_rateado) || Number(m.valor_original) || 0,
          dataVencimento: m.data_vencimento,
          dataPagamento: m.data_pagamento,
          status: m.reembolso_quitado === true ? "Quitado" : "Pendente",
        };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [movimentacoes, cotistas]);

  /* ── Filter options ── */
  const categoriasOpts = useMemo(
    () => Array.from(new Set(rateios.map((r) => catNameOf(r)).filter((x) => x && x !== "Sem categoria"))).sort(),
    [rateios, catNameOf],
  );

  /* ── Filtered transactions ── */
  const filteredTx = useMemo(() => {
    let list = curPeriodDespesas.slice();
    if (fFluxo !== "todos") list = list.filter((r) => (fFluxo === "entrada" ? !isSaida(r.fluxo) : isSaida(r.fluxo)));
    if (fCategoria !== "todas") list = list.filter((r) => catNameOf(r) === fCategoria);
    if (fStatus !== "todos") list = list.filter((r) => norm(statusOf(r).label).startsWith(fStatus));
    if (search.trim()) {
      const q = norm(search);
      list = list.filter(
        (r) =>
          norm(r.descricao_despesa).includes(q) ||
          norm(r.fornecedor_nome).includes(q) ||
          norm(r.numero_nf).includes(q) ||
          norm(r.numero_doc).includes(q),
      );
    }
    return list;
  }, [curPeriodDespesas, fFluxo, fCategoria, fStatus, search, catNameOf]);

  const isLoading = loading && rateios.length === 0;

  if (!activeAircraftId) {
    return <AircraftSelectScreen aeronaves={aeronaves} onSelect={setActiveAircraftId} loading={aeronaves.length === 0} />;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] bg-bg-base text-ink">
      <div className="flex-1 flex flex-col">
        <Topbar activeMonth={activeMonth} onSelectMonth={setActiveMonth} />

        <main className="flex-1 p-5 lg:p-7 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
              Erro ao carregar dados: {error}
            </div>
          )}

          <PageHeader
            aeronaves={aeronaves}
            activeAircraftId={activeAircraftId}
            onSelectAircraft={setActiveAircraftId}
            cotistasCount={cotistas.length}
            activeMonth={activeMonth}
          />

          {/* KPIs */}
          <KpiRow
            totalDespesas={totals.saidas}
            custosFixos={aircraftTotals.fixo}
            custosVariaveis={aircraftTotals.variavel}
            saldoCaixa={totals.saldo}
            loading={isLoading}
          />

          {/* Alertas e Pendências */}
          <div className="mb-4">
            <AlertsCard alerts={alerts} pendencias={pendencias} loading={isLoading} />
          </div>

          {/* Transactions + Reembolsos em tabs */}
          <TransactionsSection
            transactions={filteredTx}
            rateios={rateios}
            cotistas={cotistas}
            cotistaColor={cotistaColor}
            catNameOf={catNameOf}
            search={search}
            setSearch={setSearch}
            fFluxo={fFluxo}
            setFFluxo={setFFluxo}
            fCategoria={fCategoria}
            setFCategoria={setFCategoria}
            categoriasOpts={categoriasOpts}
            fStatus={fStatus}
            setFStatus={setFStatus}
            expandedTx={expandedTx}
            setExpandedTx={setExpandedTx}
            clearFilters={clearFilters}
            totalInPeriod={curPeriodDespesas.length}
            loading={isLoading}
            reembolsos={reembolsosPendentes}
          />
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────── Aircraft Select Screen ─────────────────────────── */

function AircraftSelectScreen({
  aeronaves, onSelect, loading,
}: {
  aeronaves: Aeronave[];
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(180deg, #070c18 0%, #0b1120 100%)" }}>
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b7dd8, #1e3a5f)" }}>
          <Plane className="h-6 w-6 text-white" style={{ transform: "rotate(-25deg)" }} />
        </div>
        <div>
          <div className="font-display font-bold text-white text-lg leading-tight tracking-wide">Share Brasil</div>
          <div className="font-display font-bold text-[11px] leading-tight tracking-widest text-ink-muted">GESTÃO DE SOCIEDADES</div>
        </div>
      </div>

      <h1 className="font-display font-bold text-xl lg:text-2xl text-ink-bright mb-2">Selecione uma Aeronave</h1>
      <p className="text-xs text-ink-muted mb-8 text-center max-w-md">
        Escolha a aeronave para visualizar o dashboard financeiro da sociedade.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 skeleton rounded-card" />
          ))}
        </div>
      ) : aeronaves.length === 0 ? (
        <div className="text-center text-sm text-ink-faint py-8">Nenhuma aeronave cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
          {aeronaves.map((a, i) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className="portal-card p-5 text-left fade-up group hover:scale-[1.02] transition-transform"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="tail-tag text-sm">{a.matricula}</span>
                <Plane className="h-5 w-5 text-ink-muted group-hover:text-primary-light transition-colors" style={{ transform: "rotate(-25deg)" }} />
              </div>
              <div className="font-display font-bold text-sm text-ink-bright mb-1">{a.modelo}</div>
              {a.operador && <div className="text-[11px] text-ink-muted">{a.operador}</div>}
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-primary-light font-semibold">
                Acessar dashboard
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Topbar ─────────────────────────── */

function Topbar({ activeMonth, onSelectMonth }: { activeMonth: string; onSelectMonth: (m: string) => void }) {
  return (
    <header className="sticky top-0 z-40 glass border-b border-border flex items-center justify-between rounded-[8px] overflow-hidden px-5 lg:px-7" style={{ minHeight: 56 }}>
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Buscar aeronave, cotista, lançamento..."
            className="portal-input pl-[49px] pr-[49px] w-full"
            style={{ marginLeft: "-3px", marginRight: "-3px", paddingLeft: "49px", paddingRight: "49px" }}
          />
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 mx-4">
        <button
          onClick={() => onSelectMonth("todos")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
            "todos" === activeMonth ? "bg-primary-dim text-white" : "text-ink-muted hover:bg-bg-hover hover:text-ink"
          }`}
        >
          Todos
        </button>
        {MESES.map((m) => (
          <button
            key={m}
            onClick={() => onSelectMonth(m)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              m === activeMonth ? "bg-primary-dim text-white" : "text-ink-muted hover:bg-bg-hover hover:text-ink"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <span className="w-2 h-2 rounded-full pulse-live bg-success inline-block" />
          <span className="mono text-[11px]">{new Date().toLocaleDateString("pt-BR")} </span>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────── Page Header ─────────────────────────── */

function PageHeader({
  aeronaves, activeAircraftId, onSelectAircraft, cotistasCount, activeMonth,
}: {
  aeronaves: Aeronave[];
  activeAircraftId: string | null;
  onSelectAircraft: (id: string) => void;
  cotistasCount: number;
  activeMonth: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => onSelectAircraft("")}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-primary-light transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Aeronaves
          </button>
      
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border bg-bg-card">
        <Layers className="h-3.5 w-3.5 text-primary-light" />
        <select
          value={activeAircraftId ?? ""}
          onChange={(e) => onSelectAircraft(e.target.value)}
          className="appearance-none bg-transparent text-xs font-semibold text-ink outline-none cursor-pointer pr-6"
          style={{ background: "#0f1628" }}
        >
          {aeronaves.map((a) => (
            <option key={a.id} value={a.id}>
              {a.matricula} — {a.modelo}
            </option>
          ))}
        </select>
        <ChevronDown className="h-3 w-3 text-ink-faint -ml-5 pointer-events-none" />
      </div>
    </div>
  );
}

/* ─────────────────────────── KPI Row ─────────────────────────── */

function KpiRow({
  totalDespesas, custosFixos, custosVariaveis, saldoCaixa, loading,
}: {
  totalDespesas: number;
  custosFixos: number;
  custosVariaveis: number;
  saldoCaixa: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5 justify-items-center">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 skeleton rounded-card w-full max-w-[320px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full max-w-6xl">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="rgba(239,68,68,0.15)"
          iconColor="#f87171"
          badge={{ text: "Saídas", tone: "danger" }}
          value={totalDespesas}
          title="Despesas Totais"
          progress={totalDespesas > 0 ? Math.min(100, (totalDespesas / (custosFixos + custosVariaveis || 1)) * 100) : 0}
          progressColor="#ef4444"
          progressLabel="Total do período"
        />
        <KpiCard
          icon={<Scale className="h-4 w-4" />}
          iconBg="rgba(59,125,216,0.15)"
          iconColor="#5a9aee"
          badge={{ text: "Fixo", tone: "info" }}
          value={custosFixos}
          title="Custos Fixos"
          progress={totalDespesas > 0 ? (custosFixos / totalDespesas) * 100 : 0}
          progressColor="#3b7dd8"
          progressLabel={`${totalDespesas > 0 ? ((custosFixos / totalDespesas) * 100).toFixed(0) : 0}% do total`}
        />
        <KpiCard
          icon={<Zap className="h-4 w-4" />}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="#fbbf24"
          badge={{ text: "Variável", tone: "warning" }}
          value={custosVariaveis}
          title="Custos Variáveis"
          progress={totalDespesas > 0 ? (custosVariaveis / totalDespesas) * 100 : 0}
          progressColor="#f59e0b"
          progressLabel={`${totalDespesas > 0 ? ((custosVariaveis / totalDespesas) * 100).toFixed(0) : 0}% do total`}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon, iconBg, iconColor, badge, value, title, progress, progressColor, progressLabel,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  badge: { text: string; tone: "danger" | "info" | "warning" | "success" };
  value: number;
  title: string;
  progress: number;
  progressColor: string;
  progressLabel: string;
}) {
  const badgeColors: Record<string, { bg: string; color: string }> = {
    danger:  { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
    info:    { bg: "rgba(59,130,246,0.12)",   color: "#60a5fa" },
    warning: { bg: "rgba(245,158,11,0.12)",   color: "#fbbf24" },
    success: { bg: "rgba(34,197,94,0.12)",    color: "#4ade80" },
  };
  const bc = badgeColors[badge.tone];

  return (
    <div className="portal-kpi p-5 fade-up">
      <div className="flex items-start justify-between mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: bc.bg, color: bc.color }}>
          {badge.text}
        </span>
      </div>
      <CountUp value={value} className="mt-3 number-hero text-2xl text-ink-bright" />
      <div className="text-xs font-semibold mt-0.5 text-ink-muted">{title}</div>
      <div className="progress-track mt-3">
        <div className="progress-fill" style={{ background: progressColor, width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="text-[11px] mt-1.5 text-ink-faint">{progressLabel}</div>
    </div>
  );
}

/* ─────────────────────────── Alerts Card ─────────────────────────── */

function AlertsCard({
  alerts,
  pendencias,
  loading,
}: {
  alerts: { type: "danger" | "warning" | "info"; title: string; desc: string }[];
  pendencias: { nome: string; descricao: string; aeronave: string; valor: number; vencimento: string; dias: number }[];
  loading: boolean;
}) {
  if (loading) return <div className="portal-card rounded-card w-full skeleton h-40" />;

  const totalAtraso = pendencias.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="portal-card rounded-card w-full overflow-hidden">
      <div className="portal-card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <h2 className="font-display font-semibold text-sm text-ink-bright">Alertas e Pendências</h2>
        </div>
        {pendencias.length > 0 && (
          <span className="portal-pill portal-pill-danger">
            {pendencias.length} em atraso · {formatBRL(totalAtraso)}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {pendencias.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-danger pulse-live" />
              <h3 className="portal-section-label text-danger">Pendências em Atraso</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              {pendencias.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ink-bright truncate">{p.nome}</div>
                    <div className="text-[11px] text-ink-muted truncate">{p.descricao} · {p.aeronave}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="mono text-xs font-bold text-danger">{formatBRL(p.valor)}</div>
                    <div className="text-[10px] text-danger" style={{ opacity: 0.8 }}>{p.dias} {p.dias === 1 ? "dia" : "dias"} de atraso</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-primary-light" />
              <h3 className="portal-section-label">Outros Alertas</h3>
            </div>
            <div className="flex flex-col gap-1.5">
              {alerts.map((a, i) => {
                const styles: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
                  danger:  { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   color: "#f87171", icon: <X className="h-3.5 w-3.5" /> },
                  warning: { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  color: "#fbbf24", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
                  info:    { bg: "rgba(59,130,246,0.08)",   border: "rgba(59,130,246,0.25)",   color: "#60a5fa", icon: <Activity className="h-3.5 w-3.5" /> },
                };
                const s = styles[a.type];
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: s.color }}>{s.icon}</span>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: s.color }}>{a.title}</div>
                      <div className="text-[11px]" style={{ color: s.color, opacity: 0.8 }}>{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pendencias.length === 0 && alerts.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-ink-faint">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Nenhuma pendência.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Transactions + Reembolsos (Tabs) ─────────────────────────── */

type TabKey = "lancamentos" | "reembolsos";

function TransactionsSection({
  transactions, rateios, cotistas, cotistaColor, catNameOf,
  search, setSearch, fFluxo, setFFluxo, fCategoria, setFCategoria, categoriasOpts,
  fStatus, setFStatus, expandedTx, setExpandedTx, clearFilters, totalInPeriod, loading,
  reembolsos,
}: any) {
  const [activeTab, setActiveTab] = useState<TabKey>("lancamentos");
  const reembolsosCount = reembolsos.length;

  if (loading) return <div className="portal-card rounded-card mb-5 h-96 skeleton" />;

  return (
    <div className="portal-card rounded-card mb-5 overflow-hidden">
      {/* Tabs header */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
        <button
          onClick={() => setActiveTab("lancamentos")}
          className={`portal-tab ${activeTab === "lancamentos" ? "portal-tab-active" : ""}`}
        >
          Lançamentos Recentes
          <span className="portal-tab-badge" style={{ background: "rgba(94,234,212,0.12)", color: "#5eead4" }}>
            {totalInPeriod}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("reembolsos")}
          className={`portal-tab ${activeTab === "reembolsos" ? "portal-tab-active" : ""}`}
        >
          Reembolsos Pendentes — Share
          {reembolsosCount > 0 && (
            <span className="portal-tab-badge" style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>
              {reembolsosCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "lancamentos" ? (
        <LancamentosTabContent
          transactions={transactions}
          rateios={rateios}
          cotistas={cotistas}
          cotistaColor={cotistaColor}
          catNameOf={catNameOf}
          search={search}
          setSearch={setSearch}
          fFluxo={fFluxo}
          setFFluxo={setFFluxo}
          fCategoria={fCategoria}
          setFCategoria={setFCategoria}
          categoriasOpts={categoriasOpts}
          fStatus={fStatus}
          setFStatus={setFStatus}
          expandedTx={expandedTx}
          setExpandedTx={setExpandedTx}
          clearFilters={clearFilters}
          totalInPeriod={totalInPeriod}
        />
      ) : (
        <ReembolsosTabContent reembolsos={reembolsos} />
      )}
    </div>
  );
}

/* ─────────────────────────── Lançamentos Tab ─────────────────────────── */

function LancamentosTabContent({
  transactions, rateios, cotistas, cotistaColor, catNameOf,
  search, setSearch, fFluxo, setFFluxo, fCategoria, setFCategoria, categoriasOpts,
  fStatus, setFStatus, expandedTx, setExpandedTx, clearFilters, totalInPeriod,
}: any) {
  return (
    <>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="portal-section-label">Filtros</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="portal-input pl-8 w-40"
            />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border bg-bg-surface">
            {[
              { v: "todos", label: "Todos" },
              { v: "saida", label: "Saídas" },
              { v: "entrada", label: "Entradas" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFFluxo(f.v)}
                className={`portal-btn-toggle ${fFluxo === f.v ? "portal-btn-toggle-active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={fCategoria}
            onChange={(e) => setFCategoria(e.target.value)}
            className="portal-select"
          >
            <option value="todas">Categoria: todas</option>
            {categoriasOpts.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="portal-select"
          >
            <option value="todos">Status: todos</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-ink-muted hover:text-ink hover:border-primary-accent transition-colors">
            <X className="h-3 w-3" /> Limpar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-faint">Nenhum lançamento encontrado com os filtros aplicados.</div>
        ) : (
          <table className="portal-table w-full">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Cotista</th>
                <th>Pago Por</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th className="text-center">Docs</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: Rateio) => {
                const status = statusOf(tx);
                const saida = isSaida(tx.fluxo);
                const isPago = status.tone === "success";
                const val = isPago
                  ? (Number(tx.valor_pago_real) || Number(tx.valor_rateado) || 0)
                  : (Number(tx.valor_rateado) || 0);
                const catColor = catColors[catNameOf(tx)] || "#3b7dd8";
                const isOpen = expandedTx === tx.id;
                const date = formatDateShort(tx.data_pagamento || tx.data_vencimento || tx.data_emissao);
                const docsCount = [tx.nf_url, tx.recibo_url, tx.comprovante_url, tx.boleto_url].filter(Boolean).length;

                return (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    date={date}
                    saida={saida}
                    val={val}
                    catName={catNameOf(tx)}
                    catColor={catColor}
                    status={status}
                    docsCount={docsCount}
                    isOpen={isOpen}
                    onToggle={() => setExpandedTx(isOpen ? null : tx.id)}
                    rateios={rateios}
                    cotistas={cotistas}
                    cotistaColor={cotistaColor}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-surface">
        <div className="text-[11px] text-ink-muted">
          Exibindo <span className="font-semibold text-ink">{transactions.length}</span> de <span className="font-semibold text-ink">{totalInPeriod}</span> lançamentos
        </div>
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 flex items-center justify-center rounded border border-border text-xs text-ink-muted hover:text-ink hover:border-primary-accent transition-colors">
            <ChevronRight className="h-3 w-3 rotate-180" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold bg-primary text-white">1</button>
          <button className="w-7 h-7 flex items-center justify-center rounded border border-border text-xs text-ink-muted hover:text-ink hover:border-primary-accent transition-colors">2</button>
          <button className="w-7 h-7 flex items-center justify-center rounded border border-border text-xs text-ink-muted hover:text-ink hover:border-primary-accent transition-colors">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Reembolsos Tab ─────────────────────────── */

function ReembolsosTabContent({
  reembolsos,
}: {
  reembolsos: { id: string; descricao: string; cotista: string; valor: number; dataVencimento: string | null; dataPagamento: string | null; status: string }[];
}) {
  const totalPendente = reembolsos.reduce((s, r) => s + r.valor, 0);

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border" style={{ background: "rgba(245,158,11,0.03)" }}>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-ink-bright">Despesas pagas pela Share que aguardam reembolso dos cotistas</span>
        </div>
        {reembolsos.length > 0 && (
          <div className="text-right">
            <span className="portal-section-label mr-2">Total Pendente</span>
            <span className="portal-value-mono text-sm text-amber-400">{formatBRL(totalPendente)}</span>
          </div>
        )}
      </div>

      {reembolsos.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <div className="text-sm text-ink-bright font-medium">Nenhum reembolso pendente</div>
          <div className="text-[11px] text-ink-muted mt-1">Todas as despesas pagas pela Share já foram reembolsadas.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="portal-table w-full">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Cotista</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th className="text-right">Valor</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {reembolsos.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="text-xs text-ink-bright font-medium">{r.descricao}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-ink">{r.cotista}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-ink-muted">{formatDateShort(r.dataVencimento)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-ink-muted">{formatDateShort(r.dataPagamento)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="portal-value-mono text-xs text-amber-400">{formatBRL(r.valor)}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="portal-pill portal-pill-warning">
                      <Clock className="h-2.5 w-2.5" />
                      Pendente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Transaction Row ─────────────────────────── */

function TxRow({ tx, date, saida, val, catName, catColor, status, docsCount, isOpen, onToggle, rateios, cotistas, cotistaColor }: any) {
  const statusCls: Record<string, string> = {
    success: "portal-pill-success",
    warning: "portal-pill-warning",
    danger: "portal-pill-danger",
    muted: "portal-pill-muted",
  };
  const pillCls = statusCls[status.tone as string] || "portal-pill-muted";

  const [viewer, setViewer] = useState<{ url: string; label: string } | null>(null);
  const isImage = (u: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u);

  const dotColor = status.tone === "danger" || status.tone === "warning" ? "#f59e0b" : "#22c55e";

  const relacionados = rateios.filter((x: Rateio) => (x.despesa_id || x.id) === (tx.despesa_id || tx.id));
  const linhasCot = relacionados
    .map((row: Rateio) => {
      const key = findCotistaKey(cotistas, row);
      const c = key ? cotistas.find((x: Cotista) => x.id === key) : null;
      return {
        nome: c?.nome || row.socios_nome || row.clientes_nome || "—",
        color: c ? cotistaColor(c.id) : "#888",
        valor: Number(row.valor_rateado) || 0,
        pct: Number(row.percentual_uso ?? row.percentual_sociedade ?? 0),
      };
    })
    .filter((l: any) => l.valor > 0);

  const valorTotalDespesa = Number(tx.valor_total_despesa) || 0;
  const valorRateado = Number(tx.valor_rateado) || 0;
  const valorPagoReal = tx.valor_pago_real != null ? Number(tx.valor_pago_real) : null;

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer">
        <td className="px-4 py-3 text-center">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: dotColor }} />
        </td>
        <td className="px-3 py-3">
          <div className="text-xs font-medium text-ink-bright whitespace-nowrap">{date}</div>
        </td>
        <td className="px-3 py-3" style={{ maxWidth: 220 }}>
          <div className="text-xs font-medium truncate text-ink">{tx.descricao_despesa || "Sem descrição"}</div>
          <div className="text-[11px] text-ink-faint truncate">{tx.fornecedor_nome || "—"}</div>
        </td>
        <td className="px-3 py-3">
          <span className="portal-pill" style={{ background: `${catColor}1a`, color: catColor, border: `1px solid ${catColor}33` }}>
            {catName}
          </span>
        </td>
        <td className="px-3 py-3"><div className="text-xs text-ink">{tx.clientes_nome || tx.socios_nome || "—"}</div></td>
        <td className="px-3 py-3"><div className="text-xs text-ink-muted">{tx.socios_nome || (norm(tx.pago_por) === "share" ? "Share" : tx.pago_por) || "—"}</div></td>
        <td className="px-3 py-3 text-right">
          <div className={`portal-value-mono text-sm ${saida ? "text-ink-bright" : "text-emerald-400"}`}>
            {saida ? "" : "+"}{formatBRL(val)}
          </div>
        </td>
        <td className="px-3 py-3"><span className={`portal-pill ${pillCls}`}>{status.label}</span></td>
        <td className="px-3 py-3 text-center">
          <span className="mono text-xs font-semibold text-ink-muted">{docsCount > 0 ? docsCount : 0} <Paperclip className="h-3 w-3 inline" /></span>
        </td>
        <td className="px-3 py-3 text-center">
          <ChevronRight className={`h-3.5 w-3.5 text-ink-faint transition-transform mx-auto ${isOpen ? "rotate-90" : ""}`} />
        </td>
      </tr>
      <tr>
        <td colSpan={10} className="p-0">
          <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}>
            {isOpen && (
              <div className="px-6 py-4 border-b border-border bg-bg-surface">
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* Info */}
                  <div>
                    <div className="portal-section-label mb-2">Informações</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-ink-muted">Fornecedor</span><span className="text-ink">{tx.fornecedor_nome || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">NF</span><span className="mono text-ink">{tx.numero_nf || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Documento</span><span className="mono text-ink">{tx.numero_doc || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Vencimento</span><span className="text-ink">{formatDate(tx.data_vencimento)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Pagamento</span><span className="text-ink">{formatDate(tx.data_pagamento)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Forma</span><span className="text-ink">{tx.forma_pagamento || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Periodicidade</span><span className="text-ink">{tx.periodicidade || "—"}</span></div>
                    </div>

                    <div className="portal-section-label mb-2 mt-3">Valores</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Valor Total da Despesa</span>
                        <span className="mono text-ink">{tx.valor_total_despesa != null ? formatBRL(valorTotalDespesa) : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Valor Rateado</span>
                        <span className="mono text-ink">{formatBRL(valorRateado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Valor Pago (real)</span>
                        <span className="mono text-ink">{valorPagoReal != null ? formatBRL(valorPagoReal) : "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cotistas */}
                  <div>
                    <div className="portal-section-label mb-2">Rateio por Cotista</div>
                    {linhasCot.length === 0 ? (
                      <div className="text-xs text-ink-faint">Sem rateio por cotista.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {linhasCot.map((l: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-bg-card px-2 py-1.5 text-xs">
                            <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: l.color }} />
                            <span className="truncate flex-1">{l.nome}</span>
                            {l.pct > 0 && <span className="text-[10px] text-ink-faint">({l.pct.toFixed(1)}%)</span>}
                            <span className="mono font-semibold text-ink">{formatBRL(l.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Docs + actions */}
                  <div>
                    <div className="portal-section-label mb-2">Documentos</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        { url: tx.nf_url, label: "NF", icon: <FileText className="h-3.5 w-3.5 text-danger" /> },
                        { url: tx.recibo_url, label: "Recibo", icon: <Receipt className="h-3.5 w-3.5 text-primary-light" /> },
                        { url: tx.comprovante_url, label: "Comprovante", icon: <FileText className="h-3.5 w-3.5 text-emerald-400" /> },
                        { url: tx.boleto_url, label: "Boleto", icon: <FileText className="h-3.5 w-3.5 text-amber-400" /> },
                      ].filter((d) => d.url).map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setViewer({ url: d.url as string, label: d.label }); }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-border bg-bg-card text-ink hover:border-primary-accent transition-colors"
                        >
                          {d.icon} {d.label}
                        </button>
                      ))}
                      {docsCount === 0 && <span className="text-xs text-ink-faint">Sem documentos anexados</span>}
                    </div>
                    {tx.observacoes && (
                      <>
                        <div className="portal-section-label mb-1">Observações</div>
                        <p className="text-xs text-ink-muted rounded-lg bg-bg-card p-2">{tx.observacoes}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
      {viewer && (
        <tr>
          <td colSpan={10} className="p-0">
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setViewer(null)}
            >
              <div
                className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl border border-border bg-bg-surface overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-card">
                  <div className="text-sm font-semibold text-ink">{viewer.label}</div>
                  <div className="flex items-center gap-2">
                    <a
                      href={viewer.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border text-ink-muted hover:text-ink hover:border-primary-accent transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar
                    </a>
                    <button
                      type="button"
                      onClick={() => setViewer(null)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-ink-muted hover:text-ink hover:border-primary-accent transition-colors"
                      aria-label="Fechar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center">
                  {isImage(viewer.url) ? (
                    <img src={viewer.url} alt={viewer.label} className="max-w-full max-h-[80vh] object-contain" />
                  ) : (
                    <iframe src={viewer.url} title={viewer.label} className="w-full h-[80vh] bg-white" />
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─────────────────────────── CountUp ─────────────────────────── */

function CountUp({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    const duration = 800;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{formatBRL(Math.round(display))}</span>;
}

export default PortalClienteDashboard;
