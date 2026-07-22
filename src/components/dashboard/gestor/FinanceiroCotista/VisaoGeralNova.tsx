import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookmarkPlus,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Image as ImageIcon,
  Layers,
  Minus,
  Paperclip,
  Plane,
  Receipt,
  Scale,
  Search,
  StickyNote,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/dashboard-utils";
import { useAircraft } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ─────────────────────────── types ─────────────────────────── */

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const norm = (s?: string | null) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const isSaida = (fluxo?: string | null) => norm(fluxo) !== "entrada";

const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

interface Cotista {
  id: string;
  cliente_id: string | null;
  socio_id: string | null;
  nome: string;
  percentual: number;
}

interface Rateio {
  id: string;
  despesa_id: string | null;
  fluxo: string | null;
  periodicidade: string | null;
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
  forma_pagamento?: string | null;
  status_pagamento?: string | null;
  observacoes?: string | null;
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
  if (r.status_pagamento) {
    const n = norm(r.status_pagamento);
    if (n.startsWith("pago")) return { label: r.status_pagamento, tone: "success" };
    if (n.startsWith("atras")) return { label: r.status_pagamento, tone: "danger" };
    return { label: r.status_pagamento, tone: "warning" };
  }
  if ((Number(r.valor_pago_real) || 0) > 0 || r.data_pagamento) return { label: "Pago", tone: "success" };
  if (r.data_vencimento && new Date(r.data_vencimento) < new Date()) return { label: "Atrasado", tone: "danger" };
  return { label: "Pendente", tone: "warning" };
}

/* ─────────────────────────── hooks ─────────────────────────── */

function useCotistas(aeronaveId: string | null) {
  return useQuery({
    enabled: !!aeronaveId,
    queryKey: ["dash", "cotistas", aeronaveId],
    queryFn: async (): Promise<Cotista[]> => {
      const { data, error } = await supabase
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(razao_social, proprietario), socios(nome)")
        .eq("id_aeronave", aeronaveId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: cotistaKey(r.id_clientes, r.socios_id),
        cliente_id: r.id_clientes ?? null,
        socio_id: r.socios_id ?? null,
        nome: r.socios?.nome || r.clientes?.razao_social || r.clientes?.proprietario || "Cotista",
        percentual: Number(r.percentual_sociedade) || 0,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

function useRateiosPeriodo(aeronaveId: string | null, start: string, end: string) {
  return useQuery({
    enabled: !!aeronaveId,
    queryKey: ["dash", "rateios", aeronaveId, start, end],
    queryFn: async (): Promise<Rateio[]> => {
      const { data, error } = await supabase
        .from("rateio_despesas")
        .select(
          "id, despesa_id, fluxo, periodicidade, descricao_despesa, fornecedor_nome, categoria_custo, cliente_id, socio_id, clientes_nome, socios_nome, data_emissao, data_pagamento, data_vencimento, valor_total_despesa, valor_rateado, valor_pago_real, percentual_uso, percentual_sociedade, numero_nf, numero_doc",
        )
        .eq("aeronave_id", aeronaveId!)
        .or(
          `and(data_pagamento.gte.${start},data_pagamento.lte.${end}),and(data_pagamento.is.null,data_vencimento.gte.${start},data_vencimento.lte.${end})`,
        );
      if (error) throw error;
      return (data ?? []) as Rateio[];
    },
    staleTime: 60_000,
  });
}

function useCategoriasMap() {
  return useQuery({
    queryKey: ["dash", "categorias-map"],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("expense_configu")
        .select("id, expense_type");
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((c: any) => m.set(c.id, (c.expense_type || "").trim()));
      return m;
    },
    staleTime: 10 * 60_000,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function resolveCategoria(raw: string | null | undefined, map: Map<string, string>): string {
  const v = (raw || "").trim();
  if (!v) return "Sem categoria";
  if (UUID_RE.test(v)) return map.get(v) || "Sem categoria";
  return v;
}

/* ─────────────────────────── page ─────────────────────────── */

type PeriodPreset = "mes-atual" | "mes-passado" | "3m" | "6m" | "ytd" | "12m";

function useAircraftIdsDoCliente(clienteId?: string) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["dash", "aircraft-ids-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotistas_aeronave")
        .select("id_aeronave")
        .eq("id_clientes", clienteId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.id_aeronave).filter(Boolean) as string[];
    },
    staleTime: 5 * 60_000,
  });
}

function DashboardPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const hoje = new Date();
  const [aircraftId, setAircraftId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>("mes-atual");
  const [search, setSearch] = useState("");
  const [fFluxo, setFFluxo] = useState<"todos" | "entrada" | "saida">("todos");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fFornecedor, setFFornecedor] = useState("todos");
  const [fStatus, setFStatus] = useState<"todos" | "pago" | "pendente" | "atrasado">("todos");
  const [fTipoRateio, setFTipoRateio] = useState<"todos" | "uso" | "sociedade">("todos");
  const [fForma, setFForma] = useState("todas");
  const [fCotista, setFCotista] = useState("todos");
  const [ordem, setOrdem] = useState<"data-desc" | "data-asc" | "valor-desc" | "valor-asc">("data-desc");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const detailsRef = useRef<HTMLDivElement | null>(null);

  const aircraftQ = useAircraft();
  const clienteAircraftIdsQ = useAircraftIdsDoCliente(clienteId);
  const aeronavesDoCliente = useMemo(() => {
    const all = aircraftQ.data ?? [];
    if (!clienteId) return all;
    const allow = new Set(clienteAircraftIdsQ.data ?? []);
    return all.filter((a) => allow.has(a.id));
  }, [aircraftQ.data, clienteAircraftIdsQ.data, clienteId]);
  const activeId = aircraftId ?? aeronavesDoCliente[0]?.id ?? null;
  const activeAircraft = aeronavesDoCliente.find((a) => a.id === activeId) ?? null;

  const { start, end, prevStart, prevEnd, label } = useMemo(() => {
    const d = new Date();
    let s = new Date(d);
    let e = new Date(d);
    let l = "";
    if (preset === "mes-atual") {
      s = new Date(d.getFullYear(), d.getMonth(), 1);
      e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      l = `${MESES[d.getMonth()]}/${d.getFullYear()}`;
    } else if (preset === "mes-passado") {
      s = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      e = new Date(d.getFullYear(), d.getMonth(), 0);
      l = `${MESES[s.getMonth()]}/${s.getFullYear()}`;
    } else if (preset === "3m") {
      s = new Date(d.getFullYear(), d.getMonth() - 2, 1);
      e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      l = "Últimos 3 meses";
    } else if (preset === "6m") {
      s = new Date(d.getFullYear(), d.getMonth() - 5, 1);
      e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      l = "Últimos 6 meses";
    } else if (preset === "ytd") {
      s = new Date(d.getFullYear(), 0, 1);
      e = d;
      l = `Ano de ${d.getFullYear()}`;
    } else {
      s = new Date(d.getFullYear(), d.getMonth() - 11, 1);
      e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      l = "Últimos 12 meses";
    }
    const spanMs = e.getTime() - s.getTime();
    const ps = new Date(s.getTime() - spanMs - 86_400_000);
    const pe = new Date(s.getTime() - 86_400_000);
    const fmt = (dd: Date) => dd.toISOString().slice(0, 10);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe), label: l };
  }, [preset]);

  // fetch a wide window (last 24 months) so we can render trends + period comparison
  const wideStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 23, 1).toISOString().slice(0, 10);
  }, []);
  const wideEnd = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, []);

  const cotistasQ = useCotistas(activeId);
  const rateiosQ = useRateiosPeriodo(activeId, wideStart, wideEnd);
  const categoriasMapQ = useCategoriasMap();

  const cotistas = cotistasQ.data ?? [];
  const rateios = rateiosQ.data ?? [];
  const catMap = categoriasMapQ.data ?? new Map<string, string>();
  const catNameOf = (r: Rateio) => resolveCategoria(r.categoria_custo, catMap);

  // dedupe by despesa_id for aggregate calculations
  const uniqueDespesas = useMemo(() => {
    const map = new Map<string, Rateio>();
    for (const r of rateios) {
      const k = r.despesa_id || r.id;
      if (!map.has(k)) map.set(k, r);
    }
    return Array.from(map.values());
  }, [rateios]);

  const inRange = (r: Rateio, s: string, e: string) => {
    const d = r.data_pagamento || r.data_vencimento || r.data_emissao;
    if (!d) return false;
    const iso = d.slice(0, 10);
    return iso >= s && iso <= e;
  };

  const curPeriodDespesas = useMemo(
    () => uniqueDespesas.filter((r) => inRange(r, start, end)),
    [uniqueDespesas, start, end],
  );
  const prevPeriodDespesas = useMemo(
    () => uniqueDespesas.filter((r) => inRange(r, prevStart, prevEnd)),
    [uniqueDespesas, prevStart, prevEnd],
  );

  const totals = useMemo(() => {
    const acc = (arr: Rateio[]) => {
      let ent = 0, sai = 0, entC = 0, saiC = 0;
      for (const r of arr) {
        const v = Number(r.valor_total_despesa) || 0;
        if (isSaida(r.fluxo)) { sai += v; saiC++; } else { ent += v; entC++; }
      }
      return { entradas: ent, saidas: sai, entC, saiC, resultado: ent - sai, total: arr.length };
    };
    const cur = acc(curPeriodDespesas);
    const prev = acc(prevPeriodDespesas);
    // saldo geral = acumulado até `end` (todos os despesas <= end)
    const saldoAte = (limit: string) => {
      let s = 0;
      for (const r of uniqueDespesas) {
        const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 10);
        if (!d || d > limit) continue;
        const v = Number(r.valor_total_despesa) || 0;
        s += isSaida(r.fluxo) ? -v : v;
      }
      return s;
    };
    return {
      cur,
      prev,
      saldoAtual: saldoAte(end),
      saldoAnterior: saldoAte(prevEnd),
    };
  }, [curPeriodDespesas, prevPeriodDespesas, uniqueDespesas, end, prevEnd]);

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  // Monthly series (last 12 months of window)
  const monthly = useMemo(() => {
    const months: { key: string; label: string; entradas: number; saidas: number }[] = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push({
        key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
        label: `${MESES[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`,
        entradas: 0,
        saidas: 0,
      });
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const r of uniqueDespesas) {
      const d0 = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 7);
      const i = idx.get(d0);
      if (i === undefined) continue;
      const v = Number(r.valor_total_despesa) || 0;
      if (isSaida(r.fluxo)) months[i].saidas += v;
      else months[i].entradas += v;
    }
    return months;
  }, [uniqueDespesas]);

  // Category distribution for period
  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of curPeriodDespesas) {
      if (!isSaida(r.fluxo)) continue;
      const c = catNameOf(r);
      map.set(c, (map.get(c) || 0) + (Number(r.valor_total_despesa) || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curPeriodDespesas, catMap]);

  // Aircraft cost buckets for the current month (independent of `preset`)
  const custoAeronaveMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const buckets = [
      { key: "combustivel", label: "Combustível", icon: "⛽", color: "#e8b939", match: /(COMBUST|AVGAS|JET\s?A|QAV)/i, total: 0, count: 0 },
      { key: "manutencao", label: "Manutenção", icon: "🔧", color: "#e07a5f", match: /(MANUT|PEÇAS|PECAS|REVIS|OFICINA|MOTOR|HÉLICE|HELICE)/i, total: 0, count: 0 },
      { key: "hangaragem", label: "Hangaragem", icon: "🏠", color: "#4c9be8", match: /(HANGAR)/i, total: 0, count: 0 },
      { key: "taxas", label: "Taxas aeroportuárias", icon: "🛫", color: "#c67ad4", match: /(INFRAERO|DECEA|TARIFA|TAXA|NAV)/i, total: 0, count: 0 },
      { key: "adm-share", label: "ADM e Trip ", icon: "🏢", color: "#5c7d3a", match: /^ADM SHARE(?! - RECIBO)/i, total: 0, count: 0 },
    ];
    for (const r of uniqueDespesas) {
      if (!isSaida(r.fluxo)) continue;
      const d = (r.data_pagamento || r.data_vencimento || r.data_emissao || "").slice(0, 7);
      if (d !== ym) continue;
      const nome = catNameOf(r);
      const b = buckets.find((x) => x.match.test(nome));
      if (!b) continue;
      b.total += Number(r.valor_total_despesa) || 0;
      b.count += 1;
    }
    const totalGeral = buckets.reduce((s, b) => s + b.total, 0);
    return { buckets, totalGeral, ym };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueDespesas, catMap]);

  // Cotistas participation
  const cotistaColors = ["#e8b939", "#5c7d3a", "#4c9be8", "#c67ad4", "#e07a5f", "#3fa998"];
  const cotistaColor = (id: string) => {
    const i = Math.max(0, cotistas.findIndex((c) => c.id === id));
    return cotistaColors[i % cotistaColors.length];
  };

  const cotistaStats = useMemo(() => {
    const perCotista = new Map<string, { debito: number; count: number }>();
    cotistas.forEach((c) => perCotista.set(c.id, { debito: 0, count: 0 }));
    for (const r of rateios) {
      if (!inRange(r, start, end)) continue;
      if (!isSaida(r.fluxo)) continue;
      const k = findCotistaKey(cotistas, r);
      if (!k) continue;
      const rateado = Number(r.valor_rateado) || 0;
      const pctu = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pctu > 0 ? total * (pctu / 100) : 0;
      const cur = perCotista.get(k)!;
      cur.debito += base;
      cur.count += 1;
    }
    const totalDeb = Array.from(perCotista.values()).reduce((s, v) => s + v.debito, 0);
    return cotistas
      .map((c) => {
        const s = perCotista.get(c.id)!;
        return {
          ...c,
          color: cotistaColor(c.id),
          debito: s.debito,
          lancamentos: s.count,
          pct: totalDeb > 0 ? (s.debito / totalDeb) * 100 : 0,
        };
      })
      .sort((a, b) => b.debito - a.debito);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateios, cotistas, start, end]);

  // Filters — apply to rateios in current period
  const categoriasOpts = useMemo(
    () => Array.from(new Set(rateios.map((r) => catNameOf(r)).filter((x) => x && x !== "Sem categoria"))).sort() as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rateios, catMap],
  );
  const fornecedoresOpts = useMemo(
    () => Array.from(new Set(rateios.map((r) => r.fornecedor_nome).filter(Boolean))) as string[],
    [rateios],
  );
  const formasOpts = useMemo(
    () => Array.from(new Set(rateios.map((r) => r.forma_pagamento).filter(Boolean))) as string[],
    [rateios],
  );

  const filtered = useMemo(() => {
    // Show unique despesas in current period, then apply filters
    let list = curPeriodDespesas.slice();
    if (fFluxo !== "todos") {
      list = list.filter((r) => (fFluxo === "entrada" ? !isSaida(r.fluxo) : isSaida(r.fluxo)));
    }
    if (fCategoria !== "todas") list = list.filter((r) => catNameOf(r) === fCategoria);
    if (fFornecedor !== "todos") list = list.filter((r) => r.fornecedor_nome === fFornecedor);
    if (fStatus !== "todos") list = list.filter((r) => norm(statusOf(r).label).startsWith(fStatus));
    if (fTipoRateio === "uso") list = list.filter((r) => (Number(r.percentual_uso) || 0) > 0);
    if (fTipoRateio === "sociedade")
      list = list.filter((r) => !(Number(r.percentual_uso) || 0) && (Number(r.percentual_sociedade) || 0) > 0);
    if (fForma !== "todas") list = list.filter((r) => r.forma_pagamento === fForma);
    if (fCotista !== "todos") {
      // find all despesa_ids where any rateio row matches cotista
      const ids = new Set(
        rateios.filter((r) => findCotistaKey(cotistas, r) === fCotista).map((r) => r.despesa_id || r.id),
      );
      list = list.filter((r) => ids.has(r.despesa_id || r.id));
    }
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
    list.sort((a, b) => {
      const da = (a.data_pagamento || a.data_vencimento || "") as string;
      const db = (b.data_pagamento || b.data_vencimento || "") as string;
      const va = Number(a.valor_total_despesa) || 0;
      const vb = Number(b.valor_total_despesa) || 0;
      if (ordem === "data-desc") return db.localeCompare(da);
      if (ordem === "data-asc") return da.localeCompare(db);
      if (ordem === "valor-desc") return vb - va;
      return va - vb;
    });
    return list;
  }, [curPeriodDespesas, fFluxo, fCategoria, fFornecedor, fStatus, fTipoRateio, fForma, fCotista, search, ordem, rateios, cotistas]);

  const clearFilters = () => {
    setSearch("");
    setFFluxo("todos");
    setFCategoria("todas");
    setFFornecedor("todos");
    setFStatus("todos");
    setFTipoRateio("todos");
    setFForma("todas");
    setFCotista("todos");
    setOrdem("data-desc");
    setSavedName(null);
  };

  const isLoading = aircraftQ.isLoading || cotistasQ.isLoading || rateiosQ.isLoading;

  return (
    <div className="min-h-screen">
      {/* ── Top nav ── */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Painel Financeiro
          </div>
         
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SelectField value={activeId ?? ""} onChange={(v) => setAircraftId(v)}>
              {aeronavesDoCliente.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.matricula} — {a.modelo || ""}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] space-y-8 px-4 pb-24 pt-8 sm:px-6 lg:px-8">
    {/* ── 1. Cabeçalho Executivo ── */}
        <section
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[oklch(0.24_0.05_255)] via-background to-background p-6 shadow-md sm:p-10"
          style={{ animation: "fadeUp 0.5s ease-out" }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Visão executiva · {label}
              </div>
              <h1 className="mt-2 truncate font-display text-3xl sm:text-4xl">
                Financeiro{" "}
                <span className="text-primary">{activeAircraft?.matricula || "—"}</span>
              </h1>
          
            </div>
            
            {/* Filtro de Período Customizado */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-background/50 p-2 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="pl-2 text-xs font-medium text-muted-foreground">Mês inicial:</span>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="cursor-pointer appearance-none rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary"
                />
              </div>
              <span className="text-xs text-muted-foreground">até</span>
              <div className="flex items-center gap-2 pr-2">
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="cursor-pointer appearance-none rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Indicadores Financeiros ── */}
        <section>
          <SectionTitle icon={<Wallet className="h-4 w-4" />} title="Indicadores financeiros" />
          {isLoading ? (
            <KpiSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                icon={<Scale className="h-4 w-4" />}
                title="Saldo geral"
                value={totals.saldoAtual}
                previous={totals.saldoAnterior}
                format="brl"
                accent="primary"
                signed
              />
              <KpiCard
                icon={<ArrowDownRight className="h-4 w-4" />}
                title="Entradas"
                value={totals.cur.entradas}
                previous={totals.prev.entradas}
                format="brl"
                accent="success"
                sub={`${totals.cur.entC} recebimento${totals.cur.entC === 1 ? "" : "s"}`}
                positiveIsGood
              />
              <KpiCard
                icon={<ArrowUpRight className="h-4 w-4" />}
                title="Saídas"
                value={totals.cur.saidas}
                previous={totals.prev.saidas}
                format="brl"
                accent="danger"
                sub={`${totals.cur.saiC} despesa${totals.cur.saiC === 1 ? "" : "s"}`}
                positiveIsGood={false}
              />
              <KpiCard
                icon={<Activity className="h-4 w-4" />}
                title="Resultado"
                value={totals.cur.resultado}
                previous={totals.prev.resultado}
                format="brl"
                accent={totals.cur.resultado >= 0 ? "success" : "danger"}
                signed
              />
              <KpiCard
                icon={<Layers className="h-4 w-4" />}
                title="Total de lançamentos"
                value={totals.cur.total}
                previous={totals.prev.total}
                format="int"
                accent="brand"
                sub={`${totals.cur.entC} entradas · ${totals.cur.saiC} saídas`}
              />
            </div>
          )}
        </section>

        {/* ── 3. Gráficos ── */}
        <section>
          <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Movimentação" />
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Entradas × Saídas — últimos 12 meses" className="xl:col-span-2">
              <div className="h-72" style={{ animation: "fadeUp 0.6s ease-out" }}>
                <ResponsiveContainer>
                  <AreaChart data={monthly}>
                    <defs>
                      <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis dataKey="label" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}k`} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} />
                    <Area type="monotone" dataKey="entradas" name="Entradas" stroke="var(--success)" fill="url(#gEnt)" strokeWidth={2} />
                    <Area type="monotone" dataKey="saidas" name="Saídas" stroke="var(--destructive)" fill="url(#gSai)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Distribuição por categoria">
              <div className="h-56" style={{ animation: "fadeUp 0.7s ease-out" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categorias} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2} stroke="none">
                      {categorias.map((c, i) => (
                        <Cell key={c.name} fill={cotistaColors[i % cotistaColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {categorias.slice(0, 6).map((c, i) => {
                  const total = categorias.reduce((s, x) => s + x.value, 0);
                  const p = total ? (c.value / total) * 100 : 0;
                  return (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: cotistaColors[i % cotistaColors.length] }} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{p.toFixed(0)}%</span>
                    </li>
                  );
                })}
                {categorias.length === 0 && (
                  <li className="text-muted-foreground">Sem despesas no período.</li>
                )}
              </ul>
            </ChartCard>
          </div>
        </section>

        {/* ── 4. Quanto essa aeronave custou este mês ── */}
        <section>
          <SectionTitle
            icon={<Plane className="h-4 w-4" />}
            title="Quanto essa aeronave custou este mês"
            subtitle={(() => {
              const [y, m] = custoAeronaveMes.ym.split("-");
              return `${MESES[Number(m) - 1]}/${y} · total ${formatBRL(custoAeronaveMes.totalGeral)}`;
            })()}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {custoAeronaveMes.buckets.map((b) => {
              const share = custoAeronaveMes.totalGeral > 0 ? (b.total / custoAeronaveMes.totalGeral) * 100 : 0;
              return (
                <div
                  key={b.key}
                  className="group card-glow relative overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: b.color }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{b.label}</div>
                      <div className="mt-2 number-hero text-xl">
                        <CountUp value={b.total} format="brl" />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {b.count} lançamento{b.count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base transition-transform group-hover:scale-110"
                      style={{ background: `${b.color}22`, color: b.color }}
                    >
                      {b.icon}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${share}%`, background: b.color }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Participação no custo</span>
                    <span className="tabular-nums">{share.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        {/* ── 5. Toolbar de filtros ── */}
        <section ref={detailsRef}>
          <SectionTitle icon={<Filter className="h-4 w-4" />} title="Filtros" />
          <div className="card-glow rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar descrição, fornecedor, NF..."
                  className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
              <ToolbarSelect value={preset} onChange={(v) => setPreset(v as PeriodPreset)} icon={<Calendar className="h-3 w-3" />}>
                <option value="mes-atual">Mês atual</option>
                <option value="mes-passado">Mês passado</option>
                <option value="3m">3 meses</option>
                <option value="6m">6 meses</option>
                <option value="ytd">Ano</option>
                <option value="12m">12 meses</option>
              </ToolbarSelect>
              <ToolbarSelect value={fFluxo} onChange={(v) => setFFluxo(v as any)} icon={<TrendingUp className="h-3 w-3" />}>
                <option value="todos">Fluxo: todos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </ToolbarSelect>
              <ToolbarSelect value={fCategoria} onChange={setFCategoria} icon={<Tag className="h-3 w-3" />}>
                <option value="todas">Categoria: todas</option>
                {categoriasOpts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </ToolbarSelect>
              <ToolbarSelect value={fFornecedor} onChange={setFFornecedor} icon={<Truck className="h-3 w-3" />}>
                <option value="todos">Fornecedor: todos</option>
                {fornecedoresOpts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </ToolbarSelect>
              <ToolbarSelect value={fStatus} onChange={(v) => setFStatus(v as any)} icon={<Activity className="h-3 w-3" />}>
                <option value="todos">Status: todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
              </ToolbarSelect>
              <ToolbarSelect value={fTipoRateio} onChange={(v) => setFTipoRateio(v as any)} icon={<Scale className="h-3 w-3" />}>
                <option value="todos">Rateio: todos</option>
                <option value="uso">Por uso</option>
                <option value="sociedade">Por sociedade</option>
              </ToolbarSelect>
              <ToolbarSelect value={fForma} onChange={setFForma} icon={<Banknote className="h-3 w-3" />}>
                <option value="todas">Pagamento: todos</option>
                {formasOpts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </ToolbarSelect>
              <ToolbarSelect value={fCotista} onChange={setFCotista} icon={<User className="h-3 w-3" />}>
                <option value="todos">Cotista: todos</option>
                {cotistas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </ToolbarSelect>
              <ToolbarSelect value={ordem} onChange={(v) => setOrdem(v as any)} icon={<ChevronDown className="h-3 w-3" />}>
                <option value="data-desc">Data ↓</option>
                <option value="data-asc">Data ↑</option>
                <option value="valor-desc">Valor ↓</option>
                <option value="valor-asc">Valor ↑</option>
              </ToolbarSelect>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-destructive/50 hover:text-destructive"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
              <button
                onClick={() => {
                  const name = window.prompt("Nome do filtro favorito:", savedName || "Meu filtro");
                  if (name) setSavedName(name);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all",
                  savedName
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/50 hover:text-primary",
                )}
              >
                <BookmarkPlus className="h-3 w-3" /> {savedName || "Salvar filtro"}
              </button>
            </div>
          </div>
        </section>

        {/* ── 6. Painel de Detalhes ── */}
        <section>
          <SectionTitle
            icon={<ClipboardList className="h-4 w-4" />}
            title="Detalhes dos lançamentos"
            subtitle={`${filtered.length} de ${curPeriodDespesas.length} no período`}
          />
          <div className="card-glow overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-3 border-b border-border/50 px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
              <div>Descrição / Fornecedor</div>
              <div>Categoria</div>
              <div>Vencimento / Pagamento</div>
              <div className="text-right">Valor</div>
              <div>Status</div>
              <div />
            </div>
            {isLoading ? (
              <RowSkeleton />
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum lançamento encontrado com os filtros aplicados.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((r) => (
                  <LancamentoRow
                    key={r.despesa_id || r.id}
                    r={r}
                    rateios={rateios}
                    cotistas={cotistas}
                    cotistaColor={cotistaColor}
                    categoriaNome={catNameOf(r)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ─────────────────────────── UI parts ─────────────────────────── */

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {title}
      </div>
      {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border/60 bg-card/50 py-1.5 pl-3 pr-8 text-xs outline-none transition-colors hover:border-primary/50 focus:border-primary"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function ToolbarSelect({
  value,
  onChange,
  icon,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border/60 bg-background/60 py-2 pl-7 pr-7 text-xs outline-none transition-colors hover:border-primary/50 focus:border-primary"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type Accent = "primary" | "success" | "danger" | "brand";
const accentClass: Record<Accent, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-emerald-500/15 text-emerald-400",
  danger: "bg-rose-500/15 text-rose-400",
  brand: "bg-sky-500/15 text-sky-400",
};

function KpiCard({
  icon,
  title,
  value,
  previous,
  format,
  accent,
  sub,
  signed,
  positiveIsGood = true,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  previous: number;
  format: "brl" | "int";
  accent: Accent;
  sub?: string;
  signed?: boolean;
  positiveIsGood?: boolean;
}) {
  const delta = (() => {
    if (previous === 0) return value === 0 ? 0 : 100;
    return ((value - previous) / Math.abs(previous)) * 100;
  })();
  const trendUp = delta > 0.5;
  const trendDown = delta < -0.5;
  const isGood = (trendUp && positiveIsGood) || (trendDown && !positiveIsGood);
  const trendTone = trendUp || trendDown ? (isGood ? "text-emerald-400" : "text-rose-400") : "text-muted-foreground";
  const displayColor =
    signed && value < 0 ? "text-rose-400" : signed && value > 0 ? "text-emerald-400" : "";

  return (
    <div
      className="group card-glow relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-2xl"
      style={{ animation: "fadeUp 0.5s ease-out" }}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg transition-transform group-hover:scale-110", accentClass[accent])}>
          {icon}
        </span>
      </div>
      <div className={cn("number-hero mt-3 text-3xl", displayColor)}>
        <CountUp value={value} format={format} signed={signed} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className={cn("inline-flex items-center gap-0.5 font-medium", trendTone)}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : trendDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {delta === 0 ? "0%" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
        </span>
        <span className="text-muted-foreground">vs período anterior</span>
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function CountUp({ value, format, signed }: { value: number; format: "brl" | "int"; signed?: boolean }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    const duration = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const fmt = (v: number) => {
    if (format === "brl") {
      const s = formatBRL(Math.abs(v));
      return signed && v < 0 ? `- ${s}` : signed && v > 0 ? `+ ${s}` : s;
    }
    return Math.round(v).toLocaleString("pt-BR");
  };
  return <>{fmt(display)}</>;
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-glow rounded-2xl p-5", className)} style={{ animation: "fadeUp 0.5s ease-out" }}>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="tabular-nums">{typeof p.value === "number" ? formatBRL(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-card/50" />
      ))}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />
      ))}
    </div>
  );
}

/* ─────────────────────────── Row + Expanded panel ─────────────────────────── */

function LancamentoRow({
  r,
  rateios,
  cotistas,
  cotistaColor,
  categoriaNome,
}: {
  r: Rateio;
  rateios: Rateio[];
  cotistas: Cotista[];
  cotistaColor: (id: string) => string;
  categoriaNome: string;
}) {
  const [open, setOpen] = useState(false);
  const status = statusOf(r);
  const saida = isSaida(r.fluxo);
  const val = Number(r.valor_total_despesa) || 0;

  return (
    <li className="transition-colors hover:bg-muted/20">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_36px]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-md",
                saida ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400",
              )}
            >
              {saida ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            </span>
            <span className="truncate text-sm font-medium">{r.descricao_despesa || "Sem descrição"}</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {r.fornecedor_nome || "—"} · {r.numero_nf ? `NF ${r.numero_nf}` : r.numero_doc ? `Doc ${r.numero_doc}` : "sem documento"}
          </div>
        </div>
        <div className="hidden truncate text-xs text-muted-foreground md:block">
          {categoriaNome || "—"}
        </div>
        <div className="hidden text-xs text-muted-foreground md:block">
          <div>Venc: {formatDate(r.data_vencimento)}</div>
          <div className="text-[11px]">Pgto: {formatDate(r.data_pagamento)}</div>
        </div>
        <div className={cn("tabular-nums text-right text-sm font-semibold", saida ? "text-rose-400" : "text-emerald-400")}>
          {saida ? "- " : "+ "}{formatBRL(val)}
        </div>
        <div className="hidden md:block">
          <StatusPill status={status} />
        </div>
        <div className="grid place-items-center">
          <ChevronRight
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90 text-primary")}
          />
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {open && <ExpandedFicha r={r} rateios={rateios} cotistas={cotistas} cotistaColor={cotistaColor} categoriaNome={categoriaNome} />}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof statusOf> }) {
  const tone: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    muted: "bg-muted/40 text-muted-foreground border-border/60",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", tone[status.tone])}>
      {status.label}
    </span>
  );
}

function ExpandedFicha({
  r,
  rateios,
  cotistas,
  cotistaColor,
  categoriaNome,
}: {
  r: Rateio;
  rateios: Rateio[];
  cotistas: Cotista[];
  cotistaColor: (id: string) => string;
  categoriaNome?: string;
}) {
  const status = statusOf(r);
  const relacionados = rateios.filter((x) => (x.despesa_id || x.id) === (r.despesa_id || r.id));
  const linhasCot = relacionados
    .map((row) => {
      const key = findCotistaKey(cotistas, row);
      const c = key ? cotistas.find((x) => x.id === key) : null;
      const valor = Number(row.valor_rateado) || 0;
      const pago = Number(row.valor_pago_real) || 0;
      const pct = Number(row.percentual_uso ?? row.percentual_sociedade ?? 0);
      return {
        nome: c?.nome || row.socios_nome || row.clientes_nome || "—",
        color: c ? cotistaColor(c.id) : "#888",
        valor,
        pago,
        pct,
        saldo: valor - pago,
      };
    })
    .filter((l) => l.valor > 0 || l.pago > 0);

  const anexos = [
    { icon: <FileText className="h-4 w-4" />, name: "Nota Fiscal", key: "anexo_nota_fiscal_url" },
    { icon: <Receipt className="h-4 w-4" />, name: "Recibo", key: "anexo_recibo_url" },
    { icon: <FileText className="h-4 w-4" />, name: "Boleto", key: "anexo_boleto_url" },
  ] as const;

  return (
    <div
      className="border-t border-border/40 bg-background/30 p-5"
      style={{ animation: "fadeUp 0.25s ease-out" }}
    >
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {/* Informações Gerais */}
        <FichaModule icon={<StickyNote className="h-4 w-4" />} title="Informações gerais">
          <Field label="Fornecedor" value={r.fornecedor_nome} />
          <Field label="Descrição" value={r.descricao_despesa} />
          <Field label="Documento" value={r.numero_nf || r.numero_doc} />
          <Field label="Categoria" value={categoriaNome || r.categoria_custo} />
          <Field
            label="Tipo de rateio"
            value={
              (Number(r.percentual_uso) || 0) > 0
                ? "Por uso"
                : (Number(r.percentual_sociedade) || 0) > 0
                  ? "Por sociedade"
                  : "—"
            }
          />
          <Field label="Periodicidade" value={r.periodicidade} />
        </FichaModule>

        {/* Financeiro */}
        <FichaModule icon={<Wallet className="h-4 w-4" />} title="Financeiro">
          <Field label="Valor total" value={formatBRL(Number(r.valor_total_despesa) || 0)} strong />
          <Field label="Data de emissão" value={formatDate(r.data_emissao)} />
          <Field label="Data de vencimento" value={formatDate(r.data_vencimento)} />
          <Field label="Data de pagamento" value={formatDate(r.data_pagamento)} />
          <Field label="Forma de pagamento" value={r.forma_pagamento} />
          <div className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">Status</span>
            <StatusPill status={status} />
          </div>
        </FichaModule>

        {/* Cotistas */}
        <FichaModule icon={<User className="h-4 w-4" />} title="Cotistas envolvidos">
          {linhasCot.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem rateio por cotista.</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Cotista</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Pago</span>
                <span className="text-right">Saldo</span>
              </div>
              {linhasCot.map((l, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg bg-muted/20 px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
                    <span className="truncate">{l.nome}</span>
                    {l.pct > 0 && <span className="text-[10px] text-muted-foreground">({l.pct.toFixed(1)}%)</span>}
                  </div>
                  <div className="text-right tabular-nums">{formatBRL(l.valor)}</div>
                  <div className="text-right tabular-nums text-emerald-400">{formatBRL(l.pago)}</div>
                  <div className={cn("text-right tabular-nums", l.saldo > 0 ? "text-amber-400" : "text-muted-foreground")}>
                    {formatBRL(l.saldo)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FichaModule>

        {/* Documentos */}
        <FichaModule icon={<Paperclip className="h-4 w-4" />} title="Documentos">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {anexos.map((a) => {
              const url = (r as any)[a.key] as string | undefined;
              return (
                <div
                  key={a.key}
                  className={cn(
                    "group rounded-lg border p-3 transition-all",
                    url
                      ? "border-border/60 bg-card/40 hover:-translate-y-0.5 hover:border-primary/40"
                      : "border-dashed border-border/40 bg-transparent opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className={cn("grid h-7 w-7 place-items-center rounded-md", url ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      {a.icon}
                    </span>
                    {a.name}
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {url ? "Anexo disponível" : "Sem arquivo"}
                  </div>
                  {url && (
                    <div className="mt-2 flex gap-1.5">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary/15 py-1 text-[11px] text-primary transition-colors hover:bg-primary/25"
                      >
                        <Eye className="h-3 w-3" /> Ver
                      </a>
                      <a
                        href={url}
                        download
                        className="flex items-center justify-center rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="rounded-lg border border-dashed border-border/40 p-3 opacity-60">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </span>
                Outros
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">Nenhum outro anexo</div>
            </div>
          </div>
        </FichaModule>

        {/* Observações */}
        <FichaModule icon={<StickyNote className="h-4 w-4" />} title="Observações">
          <p className="whitespace-pre-line rounded-lg bg-muted/20 p-3 text-xs leading-relaxed">
            {r.observacoes || "Nenhuma observação registrada para este lançamento."}
          </p>
        </FichaModule>

        {/* Histórico */}
        <FichaModule icon={<History className="h-4 w-4" />} title="Histórico">
          <ul className="space-y-2 text-xs">
            {r.data_emissao && (
              <HistItem when={r.data_emissao} who="Sistema" what="Lançamento criado" />
            )}
            {r.data_vencimento && (
              <HistItem when={r.data_vencimento} who="Financeiro" what="Vencimento definido" />
            )}
            {r.data_pagamento && (
              <HistItem when={r.data_pagamento} who="Financeiro" what={`Pagamento registrado — ${formatBRL(Number(r.valor_pago_real) || Number(r.valor_total_despesa) || 0)}`} />
            )}
            {!r.data_emissao && !r.data_vencimento && !r.data_pagamento && (
              <li className="text-muted-foreground">Sem registro de alterações.</li>
            )}
          </ul>
        </FichaModule>
      </div>
    </div>
  );
}

function FichaModule({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/20 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", strong && "font-semibold text-primary")}>
        {value || "—"}
      </span>
    </div>
  );
}

function HistItem({ when, who, what }: { when: string; who: string; what: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{what}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatDate(when)} · {who}
        </div>
      </div>
    </li>
  );
}


export default DashboardPage;
