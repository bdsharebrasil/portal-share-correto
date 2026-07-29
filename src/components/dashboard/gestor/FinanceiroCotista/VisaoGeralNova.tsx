import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Layers,
  Paperclip,
  Plane,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  Split,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/dashboard-utils";

/* ─────────────────────────── constants & helpers ─────────────────────────── */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const norm = (s?: string | null) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const isSaida = (fluxo?: string | null) => norm(fluxo) !== "entrada";

const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

type CategoriaMap = Record<string, string>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveCategoria(raw: string | null | undefined, map: CategoriaMap): string {
  const v = (raw || "").trim();
  if (!v) return "Sem categoria";
  if (UUID_RE.test(v)) return map[v] || "Sem categoria";
  return v;
}

interface Aeronave {
  id: string;
  matricula: string;
  modelo?: string | null;
  fabricante?: string | null;
  status?: string | null;
  operador?: string | null;
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
  fluxo: string | null;
  periodicidade: string | null;
  tipo_rateio: string | null;
  descricao_despesa: string | null;
  fornecedor_nome: string | null;
  categoria_custo: string | null;
  cliente_id: string | null;
  socio_id: string | null;
  clientes_nome: string | null;
  socios_nome: string | null;
  data_emissao: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  valor_total_despesa: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  numero_nf: string | null;
  numero_doc: string | null;
  numero_recibo?: string | null;
  forma_pagamento: string | null;
  status: string | null;
  observacoes: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
}

interface Movimentacao {
  id: string;
  descricao: string | null;
  fornecedor_nome: string | null;
  valor: number | null;
  tipo_caixa: string | null;
  reembolsavel: boolean | null;
  reembolso_quitado: boolean | null;
  clientes_id: string | null;
  socio_id: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
}

interface VooCotista {
  cliente_id: string;
  aeronave_id: string;
  total_horas: number;
  total_pousos: number;
  voos: { data: string; origem: string; destino: string; tempo_voo: number; pousos: number }[];
}

const cotistaKey = (cid: string | null, sid: string | null) => `${cid || ""}|${sid || ""}`;

function findCotistaKey(
  cotistas: Cotista[],
  rec: { cliente_id?: string | null; socio_id?: string | null; clientes_id?: string | null; socios_id?: string | null },
): string | null {
  const cid = rec.cliente_id ?? rec.clientes_id ?? null;
  const sid = rec.socio_id ?? rec.socios_id ?? null;
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

/* ─────────────────────────── main component ─────────────────────────── */

function VisaoGeralNova() {
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [activeAircraftId, setActiveAircraftId] = useState<string | null>(null);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [catMap, setCatMap] = useState<CategoriaMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState(MESES[new Date().getMonth()]);
  const [search, setSearch] = useState("");
  const [fFluxo, setFFluxo] = useState<"todos" | "entrada" | "saida">("todos");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">("todos");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [voos, setVoos] = useState<VooCotista[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);

  const isLoading = loading;

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
        setAeronaves((data ?? []) as Aeronave[]);
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
        setRateios((data ?? []) as unknown as Rateio[]);
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

  /* ── Fetch voos from lancamentos_diario_bordo for active aircraft ── */
  useEffect(() => {
    if (!activeAircraftId) return;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("lancamentos_diario_bordo")
          .select("clientes_id, aeronave_id, data_registro, aerodromo_partida, aerodromo_chegada, tempo_voo, pousos_total")
          .eq("aeronave_id", activeAircraftId)
          .order("data_registro", { ascending: false });
        if (err) throw err;
        const byCliente = new Map<string, VooCotista>();
        for (const r of (data ?? []) as any[]) {
          const cid = r.clientes_id as string | null;
          if (!cid) continue;
          const cur: VooCotista = byCliente.get(cid) || {
            cliente_id: cid,
            aeronave_id: r.aeronave_id,
            total_horas: 0,
            total_pousos: 0,
            voos: [],
          };
          cur.total_horas += Number(r.tempo_voo) || 0;
          cur.total_pousos += Number(r.pousos_total) || 0;
          cur.voos.push({
            data: (r.data_registro || "").slice(0, 10),
            origem: r.aerodromo_partida || "—",
            destino: r.aerodromo_chegada || "—",
            tempo_voo: Number(r.tempo_voo) || 0,
            pousos: Number(r.pousos_total) || 0,
          });
          byCliente.set(cid, cur);
        }
        setVoos(Array.from(byCliente.values()));
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

  /* ── Movimentacoes lookup by despesa_id (rateio.despesa_id → movimentacao) ── */
  const movByDespesaId = useMemo(() => {
    const map = new Map<string, Movimentacao>();
    for (const m of movimentacoes) {
      if (m.id) map.set(m.id, m);
    }
    return map;
  }, [movimentacoes]);

  /* ── Period filter: current month ── */
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = MESES.indexOf(activeMonth);
  const periodStart = new Date(year, monthIdx, 1).toISOString().slice(0, 10);
  const periodEnd = new Date(year, monthIdx + 1, 0).toISOString().slice(0, 10);

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
    () => uniqueDespesas.filter((r) => inRange(r, periodStart, periodEnd)),
    [uniqueDespesas, periodStart, periodEnd, inRange],
  );

  /* ── Totals ── */
  const totals = useMemo(() => {
    let entradas = 0, saidas = 0, entC = 0, saiC = 0;
    for (const r of curPeriodDespesas) {
      const v = Number(r.valor_total_despesa) || 0;
      if (isSaida(r.fluxo)) { saidas += v; saiC++; } else { entradas += v; entC++; }
    }
    let saldo = 0;
    for (const r of uniqueDespesas) {
      const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 10);
      if (!d || d > periodEnd) continue;
      const v = Number(r.valor_total_despesa) || 0;
      saldo += isSaida(r.fluxo) ? -v : v;
    }
    return { entradas, saidas, entC, saiC, resultado: entradas - saidas, total: curPeriodDespesas.length, saldo };
  }, [curPeriodDespesas, uniqueDespesas, periodEnd]);

  /* ── Monthly evolution (last 6 months) ── */
  const monthly = useMemo(() => {
    const months: { label: string; fixo: number; variavel: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(year, monthIdx - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const label = MESES[dt.getMonth()];
      let fixo = 0, variavel = 0;
      for (const r of uniqueDespesas) {
        const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 7);
        if (d !== key) continue;
        if (!isSaida(r.fluxo)) continue;
        const v = Number(r.valor_total_despesa) || 0;
        const tr = norm(r.tipo_rateio);
        if (tr === "fixo" || tr === "fixo_mensal") fixo += v;
        else variavel += v;
      }
      months.push({ label, fixo, variavel, total: fixo + variavel });
    }
    return months;
  }, [uniqueDespesas, year, monthIdx]);

  /* ── Categories breakdown ── */
  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of curPeriodDespesas) {
      if (!isSaida(r.fluxo)) continue;
      const c = catNameOf(r);
      map.set(c, (map.get(c) || 0) + (Number(r.valor_total_despesa) || 0));
    }
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value);
  }, [curPeriodDespesas, catNameOf]);

  /* ── Cotista stats ── */
  const cotistaColor = useCallback((id: string) => {
    const i = Math.max(0, cotistas.findIndex((c) => c.id === id));
    return PALETTE[i % PALETTE.length];
  }, [cotistas]);

  const cotistaStats = useMemo(() => {
    const perCotista = new Map<string, { debito: number; pago: number; count: number; reembolsoDevido: number; reembolsoQuitado: number }>();
    cotistas.forEach((c) => perCotista.set(c.id, { debito: 0, pago: 0, count: 0, reembolsoDevido: 0, reembolsoQuitado: 0 }));
    for (const r of rateios) {
      if (!inRange(r, periodStart, periodEnd)) continue;
      if (!isSaida(r.fluxo)) continue;
      const k = findCotistaKey(cotistas, r);
      if (!k || !perCotista.has(k)) continue;
      const rateado = Number(r.valor_rateado) || 0;
      const pctu = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pctu > 0 ? total * (pctu / 100) : 0;
      const cur = perCotista.get(k)!;
      cur.debito += base;
      cur.pago += Number(r.valor_pago_real) || 0;
      cur.count += 1;

      const mov = movByDespesaId.get(r.despesa_id);
      if (mov && norm(mov.tipo_caixa) === "share" && mov.reembolsavel === true) {
        cur.reembolsoDevido += base;
        if (mov.reembolso_quitado === true) cur.reembolsoQuitado += base;
      }
    }
    const totalDeb = Array.from(perCotista.values()).reduce((s, v) => s + v.debito, 0);
    return cotistas
      .map((c) => {
        const s = perCotista.get(c.id)!;
        return {
          ...c,
          color: cotistaColor(c.id),
          debito: s.debito,
          pago: s.pago,
          saldo: s.debito - s.pago,
          lancamentos: s.count,
          pct: totalDeb > 0 ? (s.debito / totalDeb) * 100 : 0,
          reembolsoDevido: s.reembolsoDevido,
          reembolsoQuitado: s.reembolsoQuitado,
          reembolsoSaldo: s.reembolsoDevido - s.reembolsoQuitado,
        };
      })
      .sort((a, b) => b.debito - a.debito);
  }, [rateios, cotistas, periodStart, periodEnd, inRange, cotistaColor, movByDespesaId]);

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

  /* ── Aircraft totals ── */
  const aircraftTotals = useMemo(() => {
    let fixo = 0, variavel = 0;
    for (const r of curPeriodDespesas) {
      if (!isSaida(r.fluxo)) continue;
      const v = Number(r.valor_total_despesa) || 0;
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
          valor: Number(r.valor_total_despesa) || 0,
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
        desc: `${r.descricao_despesa || "—"} · ${r.aeronave_registro || ""} · ${formatBRL(Number(r.valor_total_despesa) || 0)}`,
      });
    });
    out.push({
      type: "info",
      title: "Fechamento pendente",
      desc: `${activeMonth} ${year} · prazo em 3 dias`,
    });
    return out.slice(0, 4);
  }, [uniqueDespesas, activeMonth, year]);

  const clearFilters = () => {
    setSearch("");
    setFFluxo("todos");
    setFCategoria("todas");
    setFStatus("todos");
  };

  /* ── Per-cotista monthly fixo/variavel ── */
  const monthlyByCotista = useMemo(() => {
    const map = new Map<string, { label: string; fixo: number; variavel: number; total: number }[]>();
    for (const c of cotistas) {
      const months: { label: string; fixo: number; variavel: number; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(year, monthIdx - i, 1);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        const label = MESES[dt.getMonth()];
        let fixo = 0, variavel = 0;
        for (const r of rateios) {
          if (!isSaida(r.fluxo)) continue;
          const k = findCotistaKey(cotistas, r);
          if (k !== c.id) continue;
          const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 7);
          if (d !== key) continue;
          const rateado = Number(r.valor_rateado) || 0;
          const pctu = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
          const totalDesp = Number(r.valor_total_despesa) || 0;
          const base = rateado > 0 ? rateado : pctu > 0 ? totalDesp * (pctu / 100) : 0;
          const tr = norm(r.tipo_rateio);
          if (tr === "fixo" || tr === "fixo_mensal") fixo += base;
          else variavel += base;
        }
        months.push({ label, fixo, variavel, total: fixo + variavel });
      }
      map.set(c.id, months);
    }
    return map;
  }, [rateios, cotistas, year, monthIdx]);

  /* ── Per-cotista category breakdown ── */
  const cotistaCategoryBreakdown = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rateios) {
      if (!inRange(r, periodStart, periodEnd)) continue;
      if (!isSaida(r.fluxo)) continue;
      const k = findCotistaKey(cotistas, r);
      if (!k) continue;
      const cat = catNameOf(r);
      const rateado = Number(r.valor_rateado) || 0;
      const pctu = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pctu > 0 ? total * (pctu / 100) : 0;
      if (!map.has(k)) map.set(k, new Map());
      const inner = map.get(k)!;
      inner.set(cat, (inner.get(cat) || 0) + base);
    }
    const result = new Map<string, { name: string; value: number; color: string }[]>();
    for (const [cotistaId, cats] of map) {
      const arr = Array.from(cats.entries())
        .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
        .sort((a, b) => b.value - a.value);
      result.set(cotistaId, arr);
    }
    return result;
  }, [rateios, cotistas, periodStart, periodEnd, inRange, catNameOf]);

  /* ── Reembolsos pendentes para a Share ── */
  const reembolsosPendentes = useMemo(() => {
    return movimentacoes
      .filter((m) => m.reembolsavel === true && m.reembolso_quitado !== true && norm(m.tipo_caixa) === "share")
      .map((m) => {
        const cotista = cotistas.find(
          (c) => c.cliente_id === m.clientes_id || c.socio_id === m.socio_id,
        );
        return {
          id: m.id,
          descricao: m.descricao || "—",
          cotista: cotista?.nome || m.fornecedor_nome || "—",
          valor: Number(m.valor) || 0,
          dataVencimento: m.data_vencimento,
          dataPagamento: m.data_pagamento,
          status: m.reembolso_quitado === true ? "Quitado" : "Pendente",
        };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [movimentacoes, cotistas]);

  if (!activeAircraftId) {
    return (
      <AircraftSelectScreen
        aeronaves={aeronaves}
        onSelect={(id) => setActiveAircraftId(id)}
        loading={aeronaves.length === 0}
      />
    );
  }

  return (
    <div className="w-full">
      <Topbar activeMonth={activeMonth} onSelectMonth={setActiveMonth} />
      <div className="w-full">
        <main className="py-5">
          <PageHeader
            aeronaves={aeronaves}
            activeAircraftId={activeAircraftId}
            onSelectAircraft={(id) => setActiveAircraftId(id || null)}
            cotistasCount={cotistas.length}
            activeMonth={activeMonth}
          />

          {error && (
            <div className="mb-4 rounded-card border border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger">
              {error}
            </div>
          )}

 {/* KPIs */}
          <KpiRow
            totalDespesas={totals.saidas}
            custosFixos={aircraftTotals.fixo}
            custosVariaveis={aircraftTotals.variavel}
            saldoCaixa={totals.saldo}
            loading={isLoading}
          />

          {/* Evolução de Custos + Composição de Custos — same row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 items-stretch">
            <AreaChartCard data={monthly} loading={isLoading} />
            <CostCompositionCard
              data={monthly}
              cotistaStats={cotistaStats}
              monthlyByCotista={monthlyByCotista}
              cotistaCategoryBreakdown={cotistaCategoryBreakdown}
              loading={isLoading}
            />
          </div>

          {/* Distribuição de Custos + Rateio de Custos por Cotista — same row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 items-start">
            <DonutCard
              categories={categorias}
              cotistaStats={cotistaStats}
              cotistaCategoryBreakdown={cotistaCategoryBreakdown}
              loading={isLoading}
            />
            <div className="lg:col-span-2">
              <CotistaTable
                cotistaStats={cotistaStats}
                aircraftTotals={aircraftTotals}
                activeAircraft={activeAircraft}
                loading={isLoading}
                voos={voos}
                cotistas={cotistas}
                rateios={rateios}
                catNameOf={catNameOf}
                inRange={inRange}
                periodStart={periodStart}
                periodEnd={periodEnd}
              />
            </div>
          </div>

          {/* Alertas e Pendências — full width */}
          <div className="mb-4">
            <AlertsCard alerts={alerts} pendencias={pendencias} loading={isLoading} />
          </div>

          {/* Reembolsos Pendentes */}
          <ReembolsosSection reembolsos={reembolsosPendentes} loading={isLoading} />

          {/* Transactions */}
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
          />
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

/* ─────────────────────────── Aircraft Select Screen ─────────────────────────── */

function AircraftSelectScreen({
  aeronaves, onSelect, loading,
}: {
  aeronaves: Aeronave[];
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(180deg, #070c18 0%, #0b1120 100%)" }}>
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
              className="card-glow rounded-card p-5 text-left fade-up group hover:scale-[1.02] transition-transform"
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
    <header className="sticky top-0 z-40 glass border-b border-border flex items-center justify-between px-5 lg:px-7" style={{ minHeight: 56 }}>
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Buscar aeronave, cotista, lançamento..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-bg-surface text-ink placeholder:text-ink-faint focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 mx-4">
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
          <span className="mono text-[11px]">{new Date().toLocaleDateString("pt-BR")} · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="w-px h-5 bg-border hidden lg:block" />
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-bg-surface text-ink-muted hover:text-ink transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-ink bg-bg-surface hover:border-primary-accent transition-colors">
          <Download className="h-3.5 w-3.5 text-ink-muted" />
          Exportar
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-light transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Lançamento
        </button>
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
          <ChevronRight className="h-3 w-3 text-ink-faint" />
          <span className="text-xs font-semibold text-ink">Dashboard Financeiro</span>
        </div>
        <h1 className="font-display font-bold text-xl lg:text-2xl leading-tight text-ink-bright">
          Balanço Financeiro da Sociedade
        </h1>
        <p className="text-xs mt-1 text-ink-muted">
          Visão consolidada · {aeronaves.length} aeronave{aeronaves.length === 1 ? "" : "s"} · {cotistasCount} cotista{cotistasCount === 1 ? "" : "s"} ativo{cotistasCount === 1 ? "" : "s"} · {activeMonth} {new Date().getFullYear()}
        </p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 skeleton rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
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
      {/* Saldo em Caixa — featured */}
      <div
        className="rounded-card p-5 fade-up relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0b1120 0%, #1e3a5f 100%)",
          border: "1px solid #2a4070",
          boxShadow: "0 0 20px rgba(59,125,216,0.12), 0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: saldoCaixa >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: saldoCaixa >= 0 ? "#4ade80" : "#f87171" }}>
            <CheckCircle2 className="h-3 w-3" /> {saldoCaixa >= 0 ? "OK" : "Neg"}
          </span>
        </div>
        <CountUp value={saldoCaixa} className="mt-3 number-hero text-2xl text-white" />
        <div className="text-xs font-semibold mt-0.5 text-ink-muted">Saldo em Caixa</div>
        <div className="mt-3 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="text-[11px] mt-2 text-ink-muted">
          Entradas: <span className="text-white font-bold mono">{formatBRL(0)}</span>
        </div>
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
    <div className="card-glow rounded-card p-5 fade-up">
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

/* ─────────────────────────── Area Chart ─────────────────────────── */

function AreaChartCard({ data, loading }: { data: { label: string; fixo: number; variavel: number; total: number }[]; loading: boolean }) {
  if (loading) return <div className="card-glow rounded-card flex-1 h-64 skeleton" style={{ minWidth: 0 }} />;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const chartH = 200;
  const chartW = 600;
  const padL = 60;
  const padB = 30;
  const padT = 10;
  const padR = 20;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const xStep = data.length > 1 ? plotW / (data.length - 1) : 0;
  const yScale = (v: number) => padT + plotH - (v / maxVal) * plotH;
  const xPos = (i: number) => padL + i * xStep;

  const buildPath = (key: "fixo" | "variavel" | "total") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yScale(d[key])}`).join(" ");
  const buildArea = (key: "fixo" | "variavel") =>
    `${buildPath(key)} L ${xPos(data.length - 1)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;

  return (
    <div className="card-glow rounded-card flex-1 overflow-hidden" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div>
          <h2 className="font-display font-semibold text-sm text-ink-bright">Evolução de Custos — {new Date().getFullYear()}</h2>
          <p className="text-[11px] mt-0.5 text-ink-muted">Custos fixos vs. variáveis por mês</p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <LegendDot color="#3b7dd8" label="Fixos" />
          <LegendDot color="#5a9aee" label="Variáveis" />
          <LegendDot color="#ef4444" label="Total" />
        </div>
      </div>
      <div className="p-3">
        {data.every((d) => d.total === 0) ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-ink-faint">Sem dados para o período</div>
        ) : (
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: chartH }} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="gradFixo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b7dd8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b7dd8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradVar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5a9aee" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#5a9aee" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const y = padT + plotH * p;
              const val = maxVal * (1 - p);
              return (
                <g key={p}>
                  <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1a2540" strokeWidth="1" strokeDasharray="2 4" />
                  <text x={padL - 8} y={y + 3} textAnchor="end" fill="#4a6080" fontSize="9" fontFamily="JetBrains Mono">
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <path d={buildArea("fixo")} fill="url(#gradFixo)" />
            <path d={buildArea("variavel")} fill="url(#gradVar)" />
            <path d={buildPath("fixo")} fill="none" stroke="#3b7dd8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={buildPath("variavel")} fill="none" stroke="#5a9aee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={buildPath("total")} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            {data.map((d, i) => (
              <g key={d.label}>
                <circle cx={xPos(i)} cy={yScale(d.total)} r="3" fill="#0f1628" stroke="#ef4444" strokeWidth="1.5" />
                <text x={xPos(i)} y={chartH - 8} textAnchor="middle" fill="#7aaed8" fontSize="10" fontFamily="Inter">{d.label}</text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-1.5 rounded inline-block" style={{ background: color }} />
      <span className="text-ink">{label}</span>
    </div>
  );
}

/* ─────────────────────────── Donut ─────────────────────────── */

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Combustível": "Combustível de aviação (Avgas ou Jet-A) consumido em voos e operações.",
  "Manutenção": "Manutenções preventivas, corretivas e inspeções periódicas da aeronave.",
  "Hangar": "Custos de hangagem, estacionamento e armazenagem da aeronave.",
  "Seguro": "Prêmios de seguro da aeronave (casco, RC e passageiros).",
  "Salários": "Salários e encargos de pilotos, mecânicos e equipe de solo.",
  "Taxas": "Taxas de pouso, uso de espaço aéreo, ANAC e demais órgãos.",
  "Treinamento": "Treinamento de pilotos, check rides e reciclagem periódica.",
  "Administração": "Despesas administrativas: contabilidade, jurídico, software, escritório.",
  "Marketing": "Divulgação, publicidade e captação de clientes.",
  "Depreciação": "Depreciação contábil da aeronave e de equipamentos.",
  "Financiamento": "Parcelas de financiamento ou leasing da aeronave.",
  "Outros": "Despesas não classificadas em nenhuma categoria específica.",
};

function getCategoryDescription(name: string): string {
  return CATEGORY_DESCRIPTIONS[name] || `Despesas classificadas como "${name}".`;
}

function DonutCard({
  categories,
  cotistaStats,
  cotistaCategoryBreakdown,
  loading,
}: {
  categories: { name: string; value: number; color: string }[];
  cotistaStats: any[];
  cotistaCategoryBreakdown: Map<string, { name: string; value: number; color: string }[]>;
  loading: boolean;
}) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  if (loading) return <div className="card-glow rounded-card w-full h-80 skeleton" />;

  const total = categories.reduce((s, c) => s + c.value, 0);
  const size = 150;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const selected = selectedCat ? categories.find((c) => c.name === selectedCat) : null;
  const selectedPct = selected && total > 0 ? (selected.value / total) * 100 : 0;

  return (
    <div className="card-glow rounded-card w-full" style={{ minWidth: 0 }}>
      <div className="px-5 py-3.5 border-b border-border" style={{ background: "#0b1120" }}>
        <h2 className="font-display font-semibold text-sm text-ink-bright">Distribuição de Custos</h2>
        <p className="text-[11px] mt-0.5 text-ink-muted">Clique numa categoria para detalhes</p>
      </div>

      {/* Donut chart */}
      <div className="p-4 flex justify-center">
        {total === 0 ? (
          <div className="h-[150px] flex items-center justify-center text-sm text-ink-faint">Sem dados</div>
        ) : (
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#141d33" strokeWidth={stroke} />
              {categories.map((cat) => {
                const pct = cat.value / total;
                const dash = c * pct;
                const isDim = selectedCat && selectedCat !== cat.name;
                const seg = (
                  <circle
                    key={cat.name}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth={selectedCat === cat.name ? stroke + 4 : stroke}
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    opacity={isDim ? 0.25 : 1}
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
                  />
                );
                offset += dash;
                return seg;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {selected ? (
                <>
                  <div className="number-hero text-sm text-ink-bright">{formatBRL(selected.value)}</div>
                  <div className="text-[9px] uppercase tracking-widest" style={{ color: selected.color }}>{selectedPct.toFixed(1)}%</div>
                </>
              ) : (
                <>
                  <div className="number-hero text-sm text-ink-bright">{formatBRL(total)}</div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">total</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category list — clickable */}
      <div className="px-4 pb-2 flex flex-col gap-1">
        {categories.length === 0 ? (
          <div className="text-xs text-ink-faint text-center py-2">Sem categorias no período</div>
        ) : (
          categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-all text-left ${
                selectedCat === cat.name ? "bg-white/[0.06] ring-1 ring-white/10" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: cat.color }} />
                <span className="text-xs text-ink truncate">{cat.name}</span>
              </div>
              <span className="mono text-xs font-bold text-ink-bright flex-shrink-0 ml-2">{formatBRL(cat.value)}</span>
            </button>
          ))
        )}
      </div>

      {/* Selected category detail panel */}
      {selected && (
        <div className="mx-4 mb-4 mt-2 rounded-lg p-3 border" style={{ background: "rgba(59,125,216,0.06)", borderColor: "rgba(59,125,216,0.15)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: selected.color }} />
            <span className="text-xs font-bold text-ink-bright">{selected.name}</span>
            <span className="text-[10px] text-ink-muted ml-auto">{selectedPct.toFixed(1)}% do total</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed mb-3">{getCategoryDescription(selected.name)}</p>

          {/* Per-cotista breakdown for this category */}
          <div className="border-t border-border/50 pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-1.5">Por Cotista</div>
            <div className="flex flex-col gap-1">
              {cotistaStats.map((cs: any) => {
                const breakdown = cotistaCategoryBreakdown.get(cs.id) || [];
                const catEntry = breakdown.find((b) => b.name === selected.name);
                const val = catEntry?.value || 0;
                const pctOfCat = selected.value > 0 ? (val / selected.value) * 100 : 0;
                return (
                  <div key={cs.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cs.color }} />
                    <span className="text-[11px] text-ink flex-1 truncate">{cs.nome}</span>
                    {val > 0 ? (
                      <>
                        <div className="flex-1 max-w-[60px] h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pctOfCat}%`, background: selected.color }} />
                        </div>
                        <span className="mono text-[10px] font-bold text-ink-bright flex-shrink-0">{formatBRL(val)}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-ink-faint flex-shrink-0">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Cotista Table ─────────────────────────── */

function CotistaTable({
  cotistaStats, aircraftTotals, activeAircraft, loading,
  voos, cotistas, rateios, catNameOf, inRange, periodStart, periodEnd,
}: {
  cotistaStats: any[];
  aircraftTotals: { fixo: number; variavel: number; total: number };
  activeAircraft: Aeronave | null;
  loading: boolean;
  voos: VooCotista[];
  cotistas: Cotista[];
  rateios: Rateio[];
  catNameOf: (r: Rateio) => string;
  inRange: (r: Rateio, s: string, e: string) => boolean;
  periodStart: string;
  periodEnd: string;
}) {
  const [expandedCotista, setExpandedCotista] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  if (loading) return <div className="card-glow rounded-card flex-1 h-96 skeleton" style={{ minWidth: 0 }} />;

  const totalHorasAeronave = voos.reduce((s, v) => s + v.total_horas, 0);

  const lancamentosForCotista = (cotistaId: string) => {
    const c = cotistas.find((x) => x.id === cotistaId);
    if (!c) return [];
    return rateios.filter((r) => {
      if (!inRange(r, periodStart, periodEnd)) return false;
      if (!isSaida(r.fluxo)) return false;
      return findCotistaKey(cotistas, r) === cotistaId;
    });
  };

  const voosForCotista = (cotistaId: string) => {
    const c = cotistas.find((x) => x.id === cotistaId);
    if (!c || !c.cliente_id) return null;
    return voos.find((v) => v.cliente_id === c.cliente_id) ?? null;
  };

  return (
    <div className="card-glow rounded-card flex-1 overflow-hidden w-full" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border" style={{ background: "#0b1120" }}>
        <div className="flex items-center gap-3">
          <Split className="h-4 w-4 text-ink-muted" />
          <div>
            <h2 className="font-display font-semibold text-sm text-ink-bright">Rateio de Custos por Cotista</h2>
            <p className="text-[11px] text-ink-muted">Distribuição proporcional</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors"
            style={{ background: "#141d33", border: "1px solid #243352", color: "#7aaed8" }}
            title="O que significam Débito, Pago e Saldo?"
          >
            ?
          </button>
        </div>
      </div>

      {/* Aircraft total bar */}
      {activeAircraft && (
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="tail-tag">{activeAircraft.matricula}</span>
              <span className="text-xs font-semibold text-ink">{activeAircraft.modelo}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>100%</span>
          </div>
          <div className="flex gap-4 mt-2">
            <div>
              <div className="text-[10px] text-ink-faint">Total</div>
              <div className="mono font-bold text-sm text-ink-bright">{formatBRL(aircraftTotals.total)}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-faint">Fixos</div>
              <div className="mono font-bold text-sm text-ink-bright">{formatBRL(aircraftTotals.fixo)}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-faint">Variáveis</div>
              <div className="mono font-bold text-sm text-ink-bright">{formatBRL(aircraftTotals.variavel)}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-faint">Cotistas</div>
              <div className="mono font-bold text-sm text-ink-bright">{cotistaStats.length}</div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {cotistaStats.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-faint">Nenhum cotista cadastrado para esta aeronave.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-bg-surface">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Cotista</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Cota</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Débito</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Pago</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Saldo</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Lançamentos</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Ação</th>
              </tr>
            </thead>
            <tbody>
              {cotistaStats.map((c) => {
                const tone = c.saldo > 0 ? "status-warning" : "status-success";
                const label = c.saldo > 0 ? "Em aberto" : "Em dia";
                const isOpen = expandedCotista === c.id;
                return (
                  <CotistaRow
                    key={c.id}
                    c={c}
                    isOpen={isOpen}
                    onToggle={() => setExpandedCotista(isOpen ? null : c.id)}
                    lancamentos={lancamentosForCotista(c.id)}
                    voosData={voosForCotista(c.id)}
                    totalHorasAeronave={totalHorasAeronave}
                    catNameOf={catNameOf}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {cotistaStats.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-surface">
          <div className="text-xs font-bold font-display text-ink-bright">TOTAL GERAL</div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] text-ink-faint">Débito</div>
              <div className="mono text-sm font-bold text-ink-bright">{formatBRL(cotistaStats.reduce((s: number, c: any) => s + c.debito, 0))}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-ink-faint">Pago</div>
              <div className="mono text-sm font-bold text-emerald-400">{formatBRL(cotistaStats.reduce((s: number, c: any) => s + c.pago, 0))}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-ink-faint">Saldo</div>
              <div className="mono text-base font-bold text-gold-light">{formatBRL(cotistaStats.reduce((s: number, c: any) => s + c.saldo, 0))}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Cotista Row (expandable) ─────────────────────────── */

function CotistaRow({
  c, isOpen, onToggle, lancamentos, voosData, totalHorasAeronave, catNameOf,
}: {
  c: any;
  isOpen: boolean;
  onToggle: () => void;
  lancamentos: Rateio[];
  voosData: VooCotista | null;
  totalHorasAeronave: number;
  catNameOf: (r: Rateio) => string;
}) {
  const tone = c.saldo > 0 ? "status-warning" : "status-success";
  const label = c.saldo > 0 ? "Em aberto" : "Em dia";
  const horasVoadas = voosData?.total_horas ?? 0;
  const pousos = voosData?.total_pousos ?? 0;
  const pctUsoReal = totalHorasAeronave > 0 ? (horasVoadas / totalHorasAeronave) * 100 : 0;
  const cotaPct = c.percentual ?? 0;
  const diffUso = pctUsoReal - cotaPct;

  return (
    <>
      <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-xs font-semibold text-ink">{c.nome}</span>
            <span className="text-[10px] text-ink-faint">({c.percentual.toFixed(1)}%)</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right"><span className="mono text-xs font-bold text-primary-light">{c.percentual.toFixed(0)}%</span></td>
        <td className="px-3 py-2.5 text-right"><span className="mono text-xs text-ink">{formatBRL(c.debito)}</span></td>
        <td className="px-3 py-2.5 text-right"><span className="mono text-xs text-emerald-400">{formatBRL(c.pago)}</span></td>
        <td className="px-3 py-2.5 text-right"><span className={`mono text-xs font-bold ${c.saldo > 0 ? "text-amber-400" : "text-emerald-400"}`}>{formatBRL(c.saldo)}</span></td>
        <td className="px-3 py-2.5 text-right"><span className="mono text-xs text-ink-muted">{c.lancamentos}</span></td>
        <td className="px-3 py-2.5"><span className={`status-pill ${tone}`}>{label}</span></td>
        <td className="px-3 py-2.5">
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md font-semibold border transition-all ${isOpen ? "border-primary-accent text-primary-light bg-primary-muted" : "border-border text-ink-muted hover:text-ink hover:border-primary-accent"}`}
          >
            <Eye className="h-3 w-3" />
            {isOpen ? "Fechar" : "Ver Lançamentos"}
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={8} className="p-0">
            <CotistaExpandedDetail
              c={c}
              lancamentos={lancamentos}
              voosData={voosData}
              totalHorasAeronave={totalHorasAeronave}
              horasVoadas={horasVoadas}
              pousos={pousos}
              pctUsoReal={pctUsoReal}
              cotaPct={cotaPct}
              diffUso={diffUso}
              catNameOf={catNameOf}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─────────────────────────── Cotista Expanded Detail ─────────────────────────── */

function CotistaExpandedDetail({
  c, lancamentos, voosData, totalHorasAeronave, horasVoadas, pousos,
  pctUsoReal, cotaPct, diffUso, catNameOf,
}: {
  c: any;
  lancamentos: Rateio[];
  voosData: VooCotista | null;
  totalHorasAeronave: number;
  horasVoadas: number;
  pousos: number;
  pctUsoReal: number;
  cotaPct: number;
  diffUso: number;
  catNameOf: (r: Rateio) => string;
}) {
  return (
    <div className="bg-bg-surface fade-up" style={{ borderTop: "1px solid #1a2540" }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left 2/3: Lançamentos table with Débito/Pago/Saldo explanation */}
        <div className="lg:col-span-2 p-4 border-r border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-3.5 w-3.5 text-primary-light" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Lançamentos do Cotista</h4>
          </div>

          {/* Explanation card */}
          <div className="mb-3 p-3 rounded-lg" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#7aaed8" }} />
                  <span className="font-bold text-ink">Débito</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  A cota que este cotista deve pagar — calculada pelo seu percentual na sociedade ou pelo uso real.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#22c55e" }} />
                  <span className="font-bold text-emerald-400">Pago</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  Quanto já foi efetivamente pago por este cotista, com comprovante ou baixa manual.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: "#fbbf24" }} />
                  <span className="font-bold text-amber-400">Saldo</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  Quanto ainda falta pagar — é a diferença entre o Débito e o Pago. Zero significa em dia.
                </p>
              </div>
            </div>
          </div>

          {lancamentos.length === 0 ? (
            <div className="text-center text-xs text-ink-faint py-4">Nenhum lançamento neste período.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Descrição</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Categoria</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Vencimento</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Débito</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Pago</th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Saldo</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-faint py-2 px-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((r) => {
                    const debito = Number(r.valor_rateado) || (Number(r.valor_total_despesa) || 0) * (Number(r.percentual_uso ?? r.percentual_sociedade ?? 0) / 100);
                    const pago = Number(r.valor_pago_real) || 0;
                    const saldo = debito - pago;
                    const st = statusOf(r);
                    return (
                      <tr key={r.id} className="border-b border-border-subtle">
                        <td className="py-2 px-1">
                          <div className="text-[11px] font-semibold text-ink">{r.descricao_despesa || "—"}</div>
                          {r.fornecedor_nome && <div className="text-[10px] text-ink-faint">{r.fornecedor_nome}</div>}
                        </td>
                        <td className="py-2 px-1 text-[10px] text-ink-muted">{catNameOf(r)}</td>
                        <td className="py-2 px-1 text-[10px] text-ink-muted">{formatDate(r.data_vencimento)}</td>
                        <td className="py-2 px-1 text-right mono text-[11px] text-ink">{formatBRL(debito)}</td>
                        <td className="py-2 px-1 text-right mono text-[11px] text-emerald-400">{formatBRL(pago)}</td>
                        <td className="py-2 px-1 text-right mono text-[11px] font-bold" style={{ color: saldo > 0 ? "#fbbf24" : "#4ade80" }}>{formatBRL(saldo)}</td>
                        <td className="py-2 px-1"><span className={`status-pill status-${st.tone}`}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1/3: Flight comparison from diario_bordo */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plane className="h-3.5 w-3.5 text-gold-light" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Comparação de Uso</h4>
          </div>

          {!voosData || voosData.voos.length === 0 ? (
            <div className="text-center text-xs text-ink-faint py-6">Nenhum voo registrado para este cotista.</div>
          ) : (
            <>
              {/* Comparison bar */}
              <div className="p-3 rounded-lg mb-3" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-2">Cota da sociedade vs. uso real</div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-primary-light">Cota ({cotaPct.toFixed(0)}%)</span>
                      <span className="text-ink-muted mono">{formatBRL(c.debito)}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ background: "#3b7dd8", width: `${Math.min(100, cotaPct)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gold-light">Uso real ({pctUsoReal.toFixed(0)}%)</span>
                      <span className="text-ink-muted mono">{horasVoadas.toFixed(1)}h voadas</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ background: "#c9932f", width: `${Math.min(100, pctUsoReal)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[10px] text-ink-faint">Diferença</span>
                  <span className="text-[11px] font-bold mono" style={{ color: diffUso > 5 ? "#fbbf24" : diffUso < -5 ? "#f87171" : "#4ade80" }}>
                    {diffUso > 0 ? "+" : ""}{diffUso.toFixed(1)}%
                  </span>
                </div>
                {diffUso > 5 && (
                  <p className="text-[10px] text-amber-400 mt-1.5 leading-relaxed">
                    Voou mais do que sua cota — o uso real supera o percentual da sociedade.
                  </p>
                )}
                {diffUso < -5 && (
                  <p className="text-[10px] text-emerald-400 mt-1.5 leading-relaxed">
                    Usou menos do que sua cota — pagou por uma fração que não voou.
                  </p>
                )}
                {Math.abs(diffUso) <= 5 && (
                  <p className="text-[10px] text-ink-muted mt-1.5 leading-relaxed">
                    Uso proporcional à cota — voou na mesma proporção da sociedade.
                  </p>
                )}
              </div>

              {/* Flight stats */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 p-2 rounded-lg" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
                  <div className="text-[10px] text-ink-faint">Horas voadas</div>
                  <div className="mono text-sm font-bold text-gold-light">{horasVoadas.toFixed(1)}h</div>
                </div>
                <div className="flex-1 p-2 rounded-lg" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
                  <div className="text-[10px] text-ink-faint">Pousos</div>
                  <div className="mono text-sm font-bold text-ink-bright">{pousos}</div>
                </div>
                <div className="flex-1 p-2 rounded-lg" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
                  <div className="text-[10px] text-ink-faint">Voos</div>
                  <div className="mono text-sm font-bold text-ink-bright">{voosData.voos.length}</div>
                </div>
              </div>

              {/* Recent flights list */}
              <div className="max-h-40 overflow-y-auto">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5">Últimos voos</div>
                {voosData.voos.slice(0, 8).map((v, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border-subtle">
                    <span className="text-[10px] text-ink-faint mono w-16 flex-shrink-0">{formatDate(v.data)}</span>
                    <span className="text-[11px] text-ink flex-1 truncate">{v.origem} → {v.destino}</span>
                    <span className="text-[10px] mono text-gold-light flex-shrink-0">{v.tempo_voo.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
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
  if (loading) return <div className="card-glow rounded-card w-full skeleton h-40" />;

  const totalAtraso = pendencias.reduce((s, p) => s + p.valor, 0);

  return (
    <div className="card-glow rounded-card w-full overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between" style={{ background: "#0b1120" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <h2 className="font-display font-semibold text-sm text-ink-bright">Alertas e Pendências</h2>
        </div>
        {pendencias.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold mono" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
            {pendencias.length} em atraso · {formatBRL(totalAtraso)}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Pendências em Atraso — prominent */}
        {pendencias.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-danger pulse-live" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-danger">Pendências em Atraso</h3>
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

        {/* General alerts */}
        {alerts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-primary-light" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">Outros Alertas</h3>
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

/* ─────────────────────────── Transactions ─────────────────────────── */

/* ─────────────────────────── Reembolsos Section ─────────────────────────── */

function ReembolsosSection({
  reembolsos, loading,
}: {
  reembolsos: { id: string; descricao: string; cotista: string; valor: number; dataVencimento: string | null; dataPagamento: string | null; status: string }[];
  loading: boolean;
}) {
  const totalPendente = reembolsos.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
            <RefreshCw className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-ink-bright">Reembolsos Pendentes — Share</h2>
            <p className="text-[11px] text-ink-muted">Despesas pagas pela Share que aguardam reembolso dos cotistas</p>
          </div>
        </div>
        {!loading && reembolsos.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Total Pendente</div>
            <div className="font-display font-bold text-sm text-amber-400">{formatBRL(totalPendente)}</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card-glow rounded-card p-4">
          <div className="h-8 skeleton rounded mb-2" />
          <div className="h-8 skeleton rounded" />
        </div>
      ) : reembolsos.length === 0 ? (
        <div className="card-glow rounded-card p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <div className="text-sm text-ink-bright font-medium">Nenhum reembolso pendente</div>
          <div className="text-[11px] text-ink-muted mt-1">Todas as despesas pagas pela Share já foram reembolsadas.</div>
        </div>
      ) : (
        <div className="card-glow rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border" style={{ background: "rgba(245,158,11,0.04)" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Descrição</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Cotista</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Vencimento</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Valor</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {reembolsos.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-ink-bright font-medium">{r.descricao}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-ink">{r.cotista}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-ink-muted">{r.dataVencimento ? new Date(r.dataVencimento).toLocaleDateString("pt-BR") : "—"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-display font-bold text-xs text-amber-400">{formatBRL(r.valor)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
                        <Clock className="h-2.5 w-2.5" />
                        Pendente
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


function TransactionsSection({
  transactions, rateios, cotistas, cotistaColor, catNameOf,
  search, setSearch, fFluxo, setFFluxo, fCategoria, setFCategoria, categoriasOpts,
  fStatus, setFStatus, expandedTx, setExpandedTx, clearFilters, totalInPeriod, loading,
}: any) {
  if (loading) return <div className="card-glow rounded-card mb-5 h-96 skeleton" />;

  return (
    <div className="card-glow rounded-card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-semibold text-sm text-ink-bright">Lançamentos Recentes</h2>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold mono border border-border text-ink-muted bg-bg-surface">
            {transactions.length} de {totalInPeriod} registros
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-bg-surface text-ink placeholder:text-ink-faint focus:border-primary transition-colors w-40"
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
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${fFluxo === f.v ? "bg-bg-raised text-ink-bright" : "text-ink-muted hover:text-ink"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={fCategoria}
            onChange={(e) => setFCategoria(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-bg-surface text-xs text-ink-muted py-1.5 pl-3 pr-7 focus:border-primary transition-colors cursor-pointer"
          >
            <option value="todas">Categoria: todas</option>
            {categoriasOpts.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-bg-surface text-xs text-ink-muted py-1.5 pl-3 pr-7 focus:border-primary transition-colors cursor-pointer"
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

      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-faint">Nenhum lançamento encontrado com os filtros aplicados.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-bg-surface">
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted w-8"></th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Data</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Descrição</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Categoria</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Cotista</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Pago Por</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Valor</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Docs</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: Rateio) => {
                const status = statusOf(tx);
                const saida = isSaida(tx.fluxo);
                const val = Number(tx.valor_total_despesa) || 0;
                const catColor = catColors[catNameOf(tx)] || "#3b7dd8";
                const isOpen = expandedTx === tx.id;
                const txId = tx.id.slice(0, 12);
                const date = formatDate(tx.data_pagamento || tx.data_vencimento || tx.data_emissao);
                const docsCount = [tx.nf_url, tx.recibo_url, tx.comprovante_url, tx.boleto_url].filter(Boolean).length;

                return (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    txId={txId}
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

      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg-surface">
        <div className="text-[11px] text-ink-muted">Exibindo {transactions.length} lançamento{transactions.length === 1 ? "" : "s"}</div>
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
    </div>
  );
}

function TxRow({ tx, txId, date, saida, val, catName, catColor, status, docsCount, isOpen, onToggle, rateios, cotistas, cotistaColor }: any) {
  const statusCls = {
    success: "status-success",
    warning: "status-warning",
    danger: "status-danger",
    muted: "status-muted",
  }[status.tone as string] || "status-muted";

  const dotColor = status.tone === "danger" || status.tone === "warning" ? "#f59e0b" : "#22c55e";

  // Related cotistas for expanded view
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

  return (
    <>
      <tr onClick={onToggle} className="border-b border-border-subtle cursor-pointer hover:bg-bg-hover transition-colors">
        <td className="px-4 py-3 text-center">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: dotColor }} />
        </td>
        <td className="px-3 py-3">
          <div className="text-xs font-medium text-ink-bright">{date}</div>
        </td>
        <td className="px-3 py-3" style={{ maxWidth: 200 }}>
          <div className="text-xs font-medium truncate text-ink">{tx.descricao_despesa || "Sem descrição"}</div>
          <div className="text-[11px] text-ink-faint truncate">{tx.fornecedor_nome || "—"}</div>
        </td>
        <td className="px-3 py-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: `${catColor}1a`, color: catColor, border: `1px solid ${catColor}33` }}>
            {catName}
          </span>
        </td>
        <td className="px-3 py-3"><div className="text-xs text-ink">{tx.clientes_nome || tx.socios_nome || "—"}</div></td>
        <td className="px-3 py-3"><div className="text-xs text-ink-muted">{tx.socios_nome || (norm(tx.pago_por) === "share" ? "Share" : tx.pago_por) || "—"}</div></td>
        <td className="px-3 py-3 text-right">
          <div className={`mono text-sm font-bold ${saida ? "text-ink-bright" : "text-emerald-400"}`}>
            {saida ? "" : "+"}{formatBRL(val)}
          </div>
        </td>
        <td className="px-3 py-3"><span className={`status-pill ${statusCls}`}>{status.label}</span></td>
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
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-ink-muted">Informações</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-ink-muted">Fornecedor</span><span className="text-ink">{tx.fornecedor_nome || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">NF</span><span className="mono text-ink">{tx.numero_nf || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Documento</span><span className="mono text-ink">{tx.numero_doc || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Vencimento</span><span className="text-ink">{formatDate(tx.data_vencimento)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Pagamento</span><span className="text-ink">{formatDate(tx.data_pagamento)}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Forma</span><span className="text-ink">{tx.forma_pagamento || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-ink-muted">Periodicidade</span><span className="text-ink">{tx.periodicidade || "—"}</span></div>
                    </div>
                  </div>

                  {/* Cotistas */}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-ink-muted">Rateio por Cotista</div>
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
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-ink-muted">Documentos</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        { url: tx.nf_url, label: "NF", icon: <FileText className="h-3.5 w-3.5 text-danger" /> },
                        { url: tx.recibo_url, label: "Recibo", icon: <Receipt className="h-3.5 w-3.5 text-primary-light" /> },
                        { url: tx.comprovante_url, label: "Comprovante", icon: <FileText className="h-3.5 w-3.5 text-emerald-400" /> },
                        { url: tx.boleto_url, label: "Boleto", icon: <FileText className="h-3.5 w-3.5 text-amber-400" /> },
                      ].filter((d) => d.url).map((d, i) => (
                        <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-border bg-bg-card text-ink hover:border-primary-accent transition-colors">
                          {d.icon} {d.label}
                        </a>
                      ))}
                      {docsCount === 0 && <span className="text-xs text-ink-faint">Sem documentos anexados</span>}
                    </div>
                    {tx.observacoes && (
                      <div className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-ink-muted">Observações</div>
                    )}
                    {tx.observacoes && (
                      <p className="text-xs text-ink-muted rounded-lg bg-bg-card p-2">{tx.observacoes}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

const catColors: Record<string, string> = {
  "Combustível": "#22c55e",
  "Manutenção": "#c9932f",
  "Custos Fixos": "#8b5cf6",
  "Pessoal": "#3b7dd8",
  "Depósito": "#22c55e",
  "Taxas": "#ec4899",
  "Sem categoria": "#64748b",
};

/* ─────────────────────────── Cost Composition ─────────────────────────── */

function CostCompositionCard({
  data,
  cotistaStats,
  monthlyByCotista,
  cotistaCategoryBreakdown,
  loading,
}: {
  data: { label: string; fixo: number; variavel: number; total: number }[];
  cotistaStats: any[];
  monthlyByCotista: Map<string, { label: string; fixo: number; variavel: number; total: number }[]>;
  cotistaCategoryBreakdown: Map<string, { name: string; value: number; color: string }[]>;
  loading: boolean;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [filterCotista, setFilterCotista] = useState<string>("todos");

  if (loading) return <div className="card-glow rounded-card flex-1 h-48 skeleton" />;

  const activeData = filterCotista === "todos" ? data : (monthlyByCotista.get(filterCotista) || []);
  const activeBreakdown = filterCotista === "todos" ? null : (cotistaCategoryBreakdown.get(filterCotista) || []);

  const totalFixos = activeData.reduce((s, d) => s + d.fixo, 0);
  const totalVars = activeData.reduce((s, d) => s + d.variavel, 0);
  const grand = totalFixos + totalVars;
  const topCat = activeBreakdown && activeBreakdown.length > 0 ? activeBreakdown[0] : null;

  return (
    <div className="card-glow rounded-card flex-1" style={{ minWidth: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="font-display font-semibold text-sm text-ink-bright">Composição de Custos</h2>
            <p className="text-[11px] text-ink-muted">Fixos vs. variáveis por mês</p>
          </div>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors"
            style={{ background: "#141d33", border: "1px solid #243352", color: "#7aaed8" }}
            title="O que são custos fixos e variáveis?"
          >
            ?
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Cotista filter */}
          <select
            value={filterCotista}
            onChange={(e) => setFilterCotista(e.target.value)}
            className="text-[11px] rounded-md px-2 py-1 bg-bg-surface border border-border text-ink-bright focus:outline-none focus:border-primary-accent transition-colors"
          >
            <option value="todos">Todos</option>
            {cotistaStats.map((cs: any) => (
              <option key={cs.id} value={cs.id}>{cs.nome}</option>
            ))}
          </select>
          <div className="flex gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: "#3b7dd8" }} />
              <span className="text-ink-muted">Fixos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: "#c9932f" }} />
              <span className="text-ink-muted">Variáveis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation panel */}
      {showInfo && (
        <div className="mx-4 mt-3 p-3 rounded-xl fade-up" style={{ background: "#0b1120", border: "1px solid #1a2540" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: "rgba(59,125,216,0.06)", border: "1px solid rgba(59,125,216,0.18)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#3b7dd8" }} />
                <span className="text-xs font-bold text-primary-light">Custos Fixos</span>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Gastos que ocorrem <strong className="text-ink">independente de a aeronave voar ou não</strong>. Incluem hangaragem,
                seguros, depreciação, salários de equipe fixa e licenciamentos anuais.
              </p>
            </div>
            <div className="p-2.5 rounded-lg" style={{ background: "rgba(201,147,47,0.06)", border: "1px solid rgba(201,147,47,0.18)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#c9932f" }} />
                <span className="text-xs font-bold text-gold-light">Custos Variáveis</span>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Gastos que <strong className="text-ink">variam conforme o uso da aeronave</strong>. Incluem combustível, manutenção
                por hora voo, taxas de pouso e sobrevoo, e diárias de tripulação.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Summary totals */}
        {grand > 0 && (
          <div className="flex gap-2 mb-1">
            <div className="flex-1 p-2 rounded-lg" style={{ background: "rgba(59,125,216,0.06)", border: "1px solid rgba(59,125,216,0.15)" }}>
              <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-0.5">Total Fixos</div>
              <div className="mono text-sm font-bold text-primary-light">{formatBRL(totalFixos)}</div>
            </div>
            <div className="flex-1 p-2 rounded-lg" style={{ background: "rgba(201,147,47,0.06)", border: "1px solid rgba(201,147,47,0.15)" }}>
              <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-0.5">Total Variáveis</div>
              <div className="mono text-sm font-bold text-gold-light">{formatBRL(totalVars)}</div>
            </div>
          </div>
        )}

        {activeData.map((d) => {
          const total = d.fixo + d.variavel || 1;
          const fixoPct = (d.fixo / total) * 100;
          const varPct = (d.variavel / total) * 100;
          return (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-ink-muted w-8 flex-shrink-0">{d.label}</span>
              <div className="flex-1 flex h-6 rounded-md overflow-hidden bg-bg-surface">
                {fixoPct > 0 && <div className="h-full transition-all duration-700" style={{ width: `${fixoPct}%`, background: "#3b7dd8" }} title={`Fixos: ${formatBRL(d.fixo)}`} />}
                {varPct > 0 && <div className="h-full transition-all duration-700" style={{ width: `${varPct}%`, background: "#c9932f" }} title={`Variáveis: ${formatBRL(d.variavel)}`} />}
              </div>
              <span className="text-[10px] text-ink-faint w-16 text-right mono">{formatBRL(d.total)}</span>
            </div>
          );
        })}

        {/* Category breakdown — only when a specific cotista is selected */}
        {activeBreakdown && activeBreakdown.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Categorias do Cotista</div>
              {topCat && (
                <div className="text-[10px] text-ink-muted">
                  Maior gasto: <span className="font-bold" style={{ color: topCat.color }}>{topCat.name}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {activeBreakdown.map((cat) => {
                const pct = grand > 0 ? (cat.value / grand) * 100 : 0;
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: cat.color }} />
                    <span className="text-[11px] text-ink flex-1 truncate">{cat.name}</span>
                    <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                    <span className="mono text-[10px] font-bold text-ink-bright flex-shrink-0 w-14 text-right">{formatBRL(cat.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
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

export default VisaoGeralNova;
