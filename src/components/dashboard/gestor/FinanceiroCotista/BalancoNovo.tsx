import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  HandCoins,
  Layers,
  Paperclip,
  Plane,
  Receipt,
  ReceiptText,
  Scale,
  Sparkles,
  StickyNote,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { formatBRL, formatHours, monthLabel } from "@/lib/dashboard-utils";
import { useAircraft } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/* ─────────────────────────── helpers ─────────────────────────── */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const norm = (s?: string | null) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const isSaida = (fluxo?: string | null) => norm(fluxo) !== "entrada";
const isFixo = (p?: string | null) => norm(p).startsWith("mensal");

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

interface Cotista {
  id: string;         // synthetic id = cliente_id|socio_id
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
  tipo_rateio: string | null;
  descricao_despesa: string | null;
  fornecedor_nome: string | null;
  categoria_custo: string | null;
  cliente_id: string | null;
  socio_id: string | null;
  clientes_nome: string | null;
  socios_nome: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  valor_total_despesa: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  numero_nf: string | null;
  numero_doc: string | null;
  // Campos opcionais — inclua as colunas correspondentes no `.select()` de
  // useRateios assim que confirmar os nomes exatos na sua base (view
  // rateio_despesas). Enquanto não vierem da query, a UI mostra "—"/estado
  // vazio automaticamente, sem quebrar nada.
  forma_pagamento?: string | null;
  status_pagamento?: string | null;
  observacoes?: string | null;
  anexo_nota_fiscal_url?: string | null;
  anexo_recibo_url?: string | null;
  anexo_boleto_url?: string | null;
}

interface Voo {
  id: string;
  data_registro: string;
  tempo_total: number | null;
  tempo_voo: number | null;
  clientes_id: string | null;
  socios_id: string | null;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  pousos_total: number | null;
}

const cotistaKey = (cid: string | null, sid: string | null) =>
  `${cid || ""}|${sid || ""}`;

function findCotistaKey(
  cotistas: Cotista[],
  rec: { cliente_id?: string | null; clientes_id?: string | null; socio_id?: string | null; socios_id?: string | null },
) {
  const cid = rec.cliente_id ?? rec.clientes_id ?? null;
  const sid = rec.socio_id ?? rec.socios_id ?? null;
  // exact match on socio first, else by cliente
  const bySocio = sid ? cotistas.find((c) => c.socio_id === sid) : null;
  if (bySocio) return bySocio.id;
  const byCliente = cid ? cotistas.find((c) => c.cliente_id === cid && !c.socio_id) : null;
  if (byCliente) return byCliente.id;
  // fallback: any cotista with same cliente
  const anyCliente = cid ? cotistas.find((c) => c.cliente_id === cid) : null;
  return anyCliente?.id ?? null;
}

function statusDoPagamento(r: Rateio): { label: string; tone: "success" | "warning" | "danger" } {
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

/* ─────────────────────────── data hooks ─────────────────────────── */

function useCotistas(aeronaveId: string | null) {
  return useQuery({
    enabled: !!aeronaveId,
    queryKey: ["balanco", "cotistas", aeronaveId],
    queryFn: async (): Promise<Cotista[]> => {
      const { data, error } = await supabase
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(razao_social, proprietario), socios(nome)")
        .eq("id_aeronave", aeronaveId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const nome =
          r.socios?.nome ||
          r.clientes?.razao_social ||
          r.clientes?.proprietario ||
          "Cotista";
        return {
          id: cotistaKey(r.id_clientes, r.socios_id),
          cliente_id: r.id_clientes ?? null,
          socio_id: r.socios_id ?? null,
          nome,
          percentual: Number(r.percentual_sociedade) || 0,
        };
      });
    },
    staleTime: 5 * 60_000,
  });
}

function useCategoriasMap() {
  return useQuery({
    queryKey: ["balanco", "categorias-map"],
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

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function resolveCategoria(raw: string | null | undefined, map: Map<string, string>): string {
  const v = (raw || "").trim();
  if (!v) return "Sem categoria";
  if (_UUID_RE.test(v)) return map.get(v) || "Sem categoria";
  return v;
}

function useRateios(aeronaveId: string | null, ano: number) {
  return useQuery({
    enabled: !!aeronaveId,
    queryKey: ["balanco", "rateios", aeronaveId, ano],
    queryFn: async (): Promise<Rateio[]> => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;
      const { data, error } = await supabase
        .from("rateio_despesas")
        .select(
          "id, despesa_id, fluxo, periodicidade, tipo_rateio, descricao_despesa, fornecedor_nome, categoria_custo, cliente_id, socio_id, clientes_nome, socios_nome, data_pagamento, data_vencimento, valor_total_despesa, valor_rateado, valor_pago_real, percentual_uso, percentual_sociedade, numero_nf, numero_doc",
          // Para popular a seção "ANEXOS/OBSERVAÇÕES" do painel expandido,
          // acrescente aqui: ", forma_pagamento, status_pagamento, observacoes, anexo_nota_fiscal_url, anexo_recibo_url, anexo_boleto_url"
          // assim que confirmar esses nomes de coluna na view rateio_despesas.
        )
        .eq("aeronave_id", aeronaveId!)
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`,
        );
      if (error) throw error;
      return (data ?? []) as Rateio[];
    },
    staleTime: 60_000,
  });
}

function useVoosAno(aeronaveId: string | null, ano: number) {
  return useQuery({
    enabled: !!aeronaveId,
    queryKey: ["balanco", "voos", aeronaveId, ano],
    queryFn: async (): Promise<Voo[]> => {
      const { data, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select("id, data_registro, tempo_total, tempo_voo, clientes_id, socios_id, aerodromo_partida, aerodromo_chegada, pousos_total")
        .eq("aeronave_id", aeronaveId!)
        .gte("data_registro", `${ano}-01-01`)
        .lte("data_registro", `${ano}-12-31`);
      if (error) throw error;
      return (data ?? []) as Voo[];
    },
    staleTime: 60_000,
  });
}

/* ─────────────────────────── page ─────────────────────────── */

function useAircraftIdsDoCliente(clienteId?: string) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["balanco", "aircraft-ids-cliente", clienteId],
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

function BalancoPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [aircraftId, setAircraftId] = useState<string | null>(null);
  const [filtroCotista, setFiltroCotista] = useState<string>("todos");
  const [showEntradas, setShowEntradas] = useState(false);
  const extratoRef = useRef<HTMLDivElement | null>(null);

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

  const cotistasQ = useCotistas(activeId);
  const rateiosQ = useRateios(activeId, ano);
  const voosQ = useVoosAno(activeId, ano);
  const categoriasMapQ = useCategoriasMap();

  const cotistasAll = cotistasQ.data ?? [];
  const cotistas = useMemo(() => {
    if (!clienteId) return cotistasAll;
    const filtered = cotistasAll.filter((c) => c.cliente_id === clienteId);
    return filtered.length > 0 ? filtered : cotistasAll;
  }, [cotistasAll, clienteId]);

  const rateios = rateiosQ.data ?? [];
  const voos = voosQ.data ?? [];
  const categoriasMap = categoriasMapQ.data ?? new Map<string, string>();

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  const usaCustom = Boolean(dataDe && dataAte);
  const inMes = (d?: string | null) => {
    if (!d) return false;
    if (usaCustom) {
      const iso = d.slice(0, 10);
      return iso >= dataDe && iso <= dataAte;
    }
    const dt = new Date(d);
    return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
  };
  const dateOf = (r: Rateio) => r.data_pagamento || r.data_vencimento;

  // ao trocar de aeronave/mês/ano, limpa a seleção de cotista e fecha o painel de entradas
  useEffect(() => {
    setFiltroCotista("todos");
    setShowEntradas(false);
  }, [activeId, ano, mes]);

  const handleSelecionarCotista = (id: string) => {
    setFiltroCotista((prev) => (prev === id ? "todos" : id));
    requestAnimationFrame(() => {
      extratoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* ── despesas do mês (deduplicadas por despesa_id) ── */
  const despesasMes = useMemo(() => {
    const map = new Map<string, Rateio>();
    rateios.forEach((r) => {
      if (!inMes(dateOf(r))) return;
      const k = r.despesa_id || r.id;
      if (!map.has(k)) map.set(k, r);
    });
    return Array.from(map.values());
  }, [rateios, ano, mes]);

  /* ── todos os rateios (não deduplicados) do mês — usado para separar o extrato por sócio ── */
  const rateiosMes = useMemo(
    () => rateios.filter((r) => inMes(dateOf(r))),
    [rateios, ano, mes],
  );

  const { custoFixo, custoVarHora, custoVarVoo, custoExtra, custoVariavel, custoTotal, entradasMes } = useMemo(() => {
    let fx = 0, vh = 0, vv = 0, ex = 0, ent = 0;
    despesasMes.forEach((d) => {
      const val = Number(d.valor_total_despesa) || 0;
      if (!isSaida(d.fluxo)) { ent += val; return; }
      const t = norm(d.tipo_rateio);
      if (t === "fixo") fx += val;
      else if (t === "variavel_por_hora") vh += val;
      else if (t === "variavel_por_voo") vv += val;
      else if (t === "extra") ex += val;
      else if (isFixo(d.periodicidade)) fx += val;
      else vv += val;
    });
    const variavel = vh + vv;
    return { custoFixo: fx, custoVarHora: vh, custoVarVoo: vv, custoExtra: ex, custoVariavel: variavel, custoTotal: fx + variavel + ex, entradasMes: ent };
  }, [despesasMes]);

  const horasMes = useMemo(
    () => voos
      .filter((v) => {
        const d = new Date(v.data_registro);
        return d.getFullYear() === ano && d.getMonth() + 1 === mes;
      })
      .reduce((s, v) => s + (Number(v.tempo_total) || Number(v.tempo_voo) || 0), 0),
    [voos, ano, mes],
  );
  const custoMedioHora = horasMes > 0 ? custoVariavel / horasMes : 0;

  /* ── linhas por cotista no mês ── */
  const linhasMes = useMemo(() => {
    const debito = new Map<string, number>();
    const credito = new Map<string, number>();
    const horas = new Map<string, number>();
    cotistas.forEach((c) => { debito.set(c.id, 0); credito.set(c.id, 0); horas.set(c.id, 0); });

    rateios.forEach((r) => {
      if (!inMes(dateOf(r))) return;
      if (!isSaida(r.fluxo)) return;
      const k = findCotistaKey(cotistas, r);
      if (!k) return;
      const rateado = Number(r.valor_rateado) || 0;
      const pct = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
      debito.set(k, (debito.get(k) || 0) + base);
      const pago = Number(r.valor_pago_real) || 0;
      if (pago > 0) credito.set(k, (credito.get(k) || 0) + pago);
    });
    voos.forEach((v) => {
      const d = new Date(v.data_registro);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) return;
      const k = findCotistaKey(cotistas, v);
      if (!k) return;
      horas.set(k, (horas.get(k) || 0) + (Number(v.tempo_total) || Number(v.tempo_voo) || 0));
    });

    return cotistas.map((c) => {
      const deb = debito.get(c.id) || 0;
      const cre = credito.get(c.id) || 0;
      const saldo = cre - deb;
      const pctPago = deb > 0 ? (cre / deb) * 100 : cre > 0 ? 100 : 0;
      return { ...c, debito: deb, credito: cre, saldo, horas: horas.get(c.id) || 0, pctPago };
    });
  }, [rateios, voos, cotistas, ano, mes]);

  /* ── entradas/créditos do mês, agrupadas por cotista ── */
  const entradasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateiosMes.forEach((r) => {
      if (isSaida(r.fluxo)) return;
      const k = findCotistaKey(cotistas, r);
      if (!k) return;
      const rateado = Number(r.valor_rateado) || 0;
      const pct = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      map.set(k, (map.get(k) || 0) + base);
    });
    return cotistas
      .map((c) => ({ ...c, valor: map.get(c.id) || 0 }))
      .filter((c) => c.valor > 0.005)
      .sort((a, b) => b.valor - a.valor);
  }, [rateiosMes, cotistas]);

  const totalRegularizar = linhasMes.filter((l) => l.saldo > 0.005).reduce((s, l) => s + l.saldo, 0);
  const equilibrado = totalRegularizar <= 0.005;

  /* ── série mensal do ano ── */
  const serieMensal = useMemo(() => {
    const pontos = Array.from({ length: 12 }, (_, i) => ({
      key: `${ano}-${String(i + 1).padStart(2, "0")}`,
      mes: i + 1,
      custo: 0,
      horas: 0,
      voos: 0,
    }));
    const vistos = new Set<string>();
    rateios.forEach((r) => {
      const d = dateOf(r);
      if (!d) return;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano) return;
      if (!isSaida(r.fluxo)) return;
      const k = r.despesa_id || r.id;
      if (vistos.has(k)) return;
      vistos.add(k);
      pontos[dt.getMonth()].custo += Number(r.valor_total_despesa) || 0;
    });
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      pontos[dt.getMonth()].horas += Number(v.tempo_total) || Number(v.tempo_voo) || 0;
      pontos[dt.getMonth()].voos += 1;
    });
    return pontos;
  }, [rateios, voos, ano]);

  const isLoading = aircraftQ.isLoading || cotistasQ.isLoading || rateiosQ.isLoading || voosQ.isLoading;

  return (
    <div className="min-h-screen">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="ml-1 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> Balanço financeiro
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <SelectField value={activeId ?? ""} onChange={(v) => setAircraftId(v)}>
              {aeronavesDoCliente.map((a) => (
                <option key={a.id} value={a.id}>{a.matricula} — {a.modelo || ""}</option>
              ))}
            </SelectField>
            <SelectField value={String(mes)} onChange={(v) => setMes(Number(v))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </SelectField>
            <SelectField value={String(ano)} onChange={(v) => setAno(Number(v))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </SelectField>
            <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-[11px] text-muted-foreground">
              <span className="uppercase tracking-widest">De</span>
              <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none [color-scheme:dark]" />
              <span className="uppercase tracking-widest">Até</span>
              <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none [color-scheme:dark]" />
              {(dataDe || dataAte) && (
                <button onClick={() => { setDataDe(""); setDataAte(""); }} className="ml-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:bg-muted">limpar</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] space-y-12 px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-[oklch(0.22_0.05_255)] via-background to-background p-8 sm:p-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Relatório mensal · {MESES[mes - 1]} {ano}
              </div>
              <h1 className="mt-3 font-display text-3xl sm:text-4xl">
                Balanço da <span className="text-primary">{activeAircraft?.matricula || "Aeronave"}</span>
              </h1>
            </div>
            <div className="flex items-center gap-7 rounded-2xl border border-border/60 bg-card/50 px-6 py-5">
              <StatMini label="Custo total" value={formatBRL(custoTotal)} tone="primary" />
              <div className="h-9 w-px bg-border" />
              <StatMini label="Horas voadas" value={formatHours(horasMes)} />
              <div className="h-9 w-px bg-border" />
              <StatMini label="Custo médio/h" value={horasMes > 0 ? formatBRL(custoMedioHora) : "—"} />
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Carregando balanço…
          </div>
        ) : (
          <>
            {/* ── Executive summary ─────────────────────────── */}
            <div>
              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                <MetricCard icon={<Wallet />} label="Custo total do mês" value={formatBRL(custoTotal)} tone="primary" />
                <MetricCard icon={<Layers />} label="Custos fixos" value={formatBRL(custoFixo)}
                  sub={custoTotal ? `${((custoFixo / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
                <MetricCard icon={<Gauge />} label="Custos variáveis" value={formatBRL(custoVariavel)}
                  sub={custoTotal ? `${((custoVariavel / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
                <MetricCard
                  icon={<HandCoins />}
                  label="Entradas / créditos"
                  value={formatBRL(entradasMes)}
                  tone="success"
                  onClick={() => setShowEntradas((v) => !v)}
                  expanded={showEntradas}
                  hint="Ver por cotista"
                />
              </div>

              {/* painel expansível: entradas detalhadas por cotista */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: showEntradas ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-6">
                    <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-400">
                      <HandCoins className="h-3.5 w-3.5" /> Entradas de {MESES[mes - 1]} por cotista
                    </div>
                    {entradasPorCotista.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhuma entrada registrada neste período.</div>
                    ) : (
                      <div className="space-y-3.5">
                        {entradasPorCotista.map((c) => {
                          const max = entradasPorCotista[0]?.valor || 1;
                          const pct = (c.valor / max) * 100;
                          return (
                            <div key={c.id} className="flex items-center gap-4">
                              <div className="w-32 shrink-0 truncate text-sm sm:w-40">{c.nome}</div>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-400">
                                {formatBRL(c.valor)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Regularização ─────────────────────────── */}
            <div className={cn(
              "flex items-start gap-4 rounded-2xl border p-6 transition-colors",
              equilibrado
                ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                : "border-amber-500/30 bg-amber-500/[0.06]",
            )}>
              {equilibrado
                ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                : <Scale className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />}
              <div className="min-w-0">
                <div className="text-base font-semibold">
                  {equilibrado
                    ? "Caixa positivo — todos os cotistas quitados"
                    : `Caixa negativo: ${formatBRL(totalRegularizar)} ainda a receber dos cotistas`}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {equilibrado
                    ? "Cada cotista pagou exatamente a parte que lhe cabia em " + MESES[mes - 1] + "."
                    : "Clique em um cotista abaixo para ver quem ainda deve e o extrato detalhado."}
                </div>
              </div>
            </div>

            {/* ── Resumo Geral & Projeção de Custo/Hora ─────────── */}
            <ResumoGeralAno rateios={rateios} voos={voos} ano={ano} matricula={activeAircraft?.matricula} />

            {/* ── Evolução mensal ─────────────────────────── */}
            <section className="motion-safe:animate-[fadeUp_0.6s_ease-out_both] rounded-2xl border border-border/60 bg-card/40 p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Evolução do ano</div>
                  <h2 className="mt-1 text-lg font-semibold">Custo mensal — {ano}</h2>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serieMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="key" tickFormatter={monthLabel} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => formatBRL(Number(v))}
                      labelFormatter={(k: any) => monthLabel(String(k))}
                    />
                    <Bar dataKey="custo" fill="var(--primary)" radius={[6, 6, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieMensal}>
                    <defs>
                      <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="key" tickFormatter={monthLabel} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => `${Number(v).toFixed(1)} h`}
                      labelFormatter={(k: any) => monthLabel(String(k))}
                    />
                    <Area type="monotone" dataKey="horas" stroke="var(--chart-2)" fill="url(#hg)" strokeWidth={2} animationDuration={900} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── Cotistas ─────────────────────────── */}
            <section>
              <div className="mb-5">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Balanço por cotista / sócio</div>
                <h2 className="mt-1 text-lg font-semibold">Débito, crédito e saldo do mês</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Débito = parte das despesas que cabe ao cotista · Crédito = valor efetivamente pago · Saldo = diferença.
                  Clique em um cartão para ver o extrato detalhado do cotista, com o percentual de uso de cada lançamento.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {linhasMes.map((l) => (
                  <CotistaCard
                    key={l.id}
                    linha={l}
                    selected={filtroCotista === l.id}
                    onClick={() => handleSelecionarCotista(l.id)}
                  />
                ))}
                {linhasMes.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                    Nenhum cotista cadastrado para esta aeronave.
                  </div>
                )}
              </div>
            </section>

            {/* ── Extrato ─────────────────────────── */}
            <div ref={extratoRef}>
              <CotistaTabsWrap
                filtroCotista={filtroCotista}
                cotistas={cotistas}
                rateios={rateios}
                voos={voos}
                ano={ano}
                mes={mes}
                categoriasMap={categoriasMap}
              >
                <ExtratoMes
                  despesas={despesasMes}
                  rateiosMes={rateiosMes}
                  cotistas={cotistas}
                  filtroCotista={filtroCotista}
                  onFiltroCotistaChange={setFiltroCotista}
                />
              </CotistaTabsWrap>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────── subcomponents ─────────────────────────── */

function SelectField({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-input bg-background px-3.5 text-xs transition-colors duration-150 hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-[0.98]"
    >
      {children}
    </select>
  );
}

/* Paleta compartilhada para gráficos com múltiplas séries — cada categoria
   financeira mantém sempre a mesma cor em qualquer gráfico da página. */
const CHART_COLORS = {
  fixo: "var(--chart-1, #60a5fa)",     // azul
  varHora: "var(--chart-3, #fbbf24)",  // âmbar
  varVoo: "var(--chart-4, #fb7185)",   // rosa
  extra: "var(--chart-5, #a78bfa)",    // violeta
  horas: "var(--chart-2, #34d399)",    // esmeralda
  pago: "var(--chart-2, #34d399)",     // esmeralda
  devido: "var(--chart-1, #60a5fa)",   // azul
};

function ViewToggle<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px] font-medium transition-all",
            value === opt.value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatMini({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-lg tabular-nums", tone === "primary" && "text-primary")}>{value}</div>
    </div>
  );
}

/* Fixed-size icon container: keeps every icon a consistent, contained square that
   always sits above (never overlapping) the label/value stack beneath it. */
function IconBadge({
  icon, tone = "default", size = "md",
}: {
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const toneClass = {
    default: "bg-muted/40 text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/15 text-amber-400",
    danger: "bg-rose-500/15 text-rose-400",
  }[tone];
  const sizeClass = {
    sm: "h-8 w-8 [&>svg]:h-3.5 [&>svg]:w-3.5",
    md: "h-10 w-10 [&>svg]:h-4 [&>svg]:w-4",
    lg: "h-11 w-11 [&>svg]:h-[18px] [&>svg]:w-[18px]",
  }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", toneClass, sizeClass)}>
      {icon}
    </span>
  );
}

function MetricCard({
  icon, label, value, sub, tone, onClick, expanded, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "success";
  onClick?: () => void;
  expanded?: boolean;
  hint?: string;
}) {
  const clickable = Boolean(onClick);
  const badgeTone = tone === "primary" ? "primary" : tone === "success" ? "success" : "default";

  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-2xl border border-border/60 bg-card/50 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.015] hover:border-primary/30 hover:shadow-[0_8px_30px_-12px_var(--primary)]",
        clickable && "cursor-pointer select-none",
        clickable && expanded && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <IconBadge icon={icon} tone={badgeTone} />
        {clickable && (
          <ChevronDown className={cn(
            "mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300",
            expanded && "rotate-180 text-primary",
          )} />
        )}
      </div>

      <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>

      <div className={cn("mt-1.5 font-display text-[1.7rem] leading-tight tabular-nums", tone === "primary" && "text-primary")}>
        {value}
      </div>

      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
      {clickable && hint && !sub && (
        <div className="mt-1.5 text-xs text-muted-foreground/80">{hint}</div>
      )}
    </div>
  );
}

function CotistaCard({
  linha, selected, onClick,
}: { linha: any; selected?: boolean; onClick?: () => void }) {
  const quitado = Math.abs(linha.saldo) <= 0.005;
  const positivo = linha.saldo > 0.005;
  const pctAlvo = Math.max(0, Math.min(100, linha.pctPago));
  const excedente = linha.pctPago > 100;

  // barra de progresso nasce em 0% e anima até o valor real ao montar/atualizar
  const [pctVisivel, setPctVisivel] = useState(0);
  useEffect(() => {
    setPctVisivel(0);
    const t = setTimeout(() => setPctVisivel(pctAlvo), 60);
    return () => clearTimeout(t);
  }, [pctAlvo, linha.id]);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group cursor-pointer select-none rounded-2xl border border-border/60 bg-card/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.015] hover:border-primary/30 hover:shadow-[0_8px_30px_-12px_var(--primary)]",
        selected && "border-primary/50 bg-primary/[0.05] ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{linha.nome}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Cota {linha.percentual}% · {formatHours(linha.horas)} voadas
          </div>
        </div>
        <span className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-transform duration-200 group-hover:scale-105",
          quitado ? "bg-emerald-500/15 text-emerald-400"
            : positivo ? "bg-sky-500/15 text-sky-400"
            : "bg-amber-500/15 text-amber-400",
        )}>
          {quitado ? "Quitado" : positivo ? "A receber" : "A pagar"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 p-3.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Débito</div>
          <div className="mt-1 font-semibold tabular-nums">{formatBRL(linha.debito)}</div>
        </div>
        <div className="rounded-lg bg-muted/30 p-3.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Crédito</div>
          <div className="mt-1 font-semibold tabular-nums">{formatBRL(linha.credito)}</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              excedente ? "bg-sky-500" : "bg-emerald-500",
            )}
            style={{ width: `${pctVisivel}%` }}
          />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          {quitado ? "100% pago" : `${Math.min(999, Math.round(linha.pctPago))}% do devido já foi pago`}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Saldo</div>
        <div className={cn(
          "font-display text-lg tabular-nums",
          quitado ? "text-emerald-400" : positivo ? "text-sky-400" : "text-amber-400",
        )}>
          {quitado ? formatBRL(0) : `${positivo ? "+" : ""}${formatBRL(linha.saldo)}`}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground/70 transition-colors duration-200 group-hover:text-primary">
        {selected ? "Extrato aberto abaixo" : "Ver extrato deste cotista"}
        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}

/* ─────────────────────── Extrato (com separação por sócio + linha expansível) ─────────────────────── */

interface LinhaExtrato {
  id: string;
  raw: Rateio;
  data?: string | null;
  fornecedor?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  documento?: string | null;
  notaFiscal?: string | null;
  entrada: boolean;
  valor: number;
  cotistaNome?: string | null;
  percentualUso?: number | null;
}

function buildLinha(
  r: Rateio,
  opts?: { cotistaNome?: string | null; valor?: number; percentualUso?: number | null },
): LinhaExtrato {
  return {
    id: opts?.cotistaNome ? `${r.id}::${opts.cotistaNome}` : r.id,
    raw: r,
    data: r.data_pagamento || r.data_vencimento,
    fornecedor: r.fornecedor_nome,
    descricao: r.descricao_despesa,
    categoria: r.categoria_custo,
    documento: r.numero_doc,
    notaFiscal: r.numero_nf,
    entrada: !isSaida(r.fluxo),
    valor: opts?.valor ?? (Number(r.valor_total_despesa) || 0),
    cotistaNome: opts?.cotistaNome ?? null,
    percentualUso: opts?.percentualUso ?? null,
  };
}

function ExtratoMes({
  despesas, rateiosMes, cotistas, filtroCotista, onFiltroCotistaChange,
}: {
  despesas: Rateio[];
  rateiosMes: Rateio[];
  cotistas: Cotista[];
  filtroCotista: string;
  onFiltroCotistaChange: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const linhasBase = useMemo<LinhaExtrato[]>(() => {
    if (filtroCotista === "todos") {
      return despesas.map((d) => buildLinha(d));
    }
    const cotista = cotistas.find((c) => c.id === filtroCotista);
    return rateiosMes
      .filter((r) => findCotistaKey(cotistas, r) === filtroCotista)
      .map((r) => {
        const rateado = Number(r.valor_rateado) || 0;
        const pct = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
        const total = Number(r.valor_total_despesa) || 0;
        const valor = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
        return buildLinha(r, { valor, cotistaNome: cotista?.nome, percentualUso: pct || null });
      });
  }, [despesas, rateiosMes, cotistas, filtroCotista]);

  const filtrados = useMemo(() => {
    if (!q.trim()) return linhasBase;
    const n = norm(q);
    return linhasBase.filter((l) =>
      norm([l.fornecedor, l.descricao, l.categoria, l.documento, l.notaFiscal].join(" ")).includes(n),
    );
  }, [linhasBase, q]);

  const totalSaida = filtrados.filter((l) => !l.entrada).reduce((s, l) => s + l.valor, 0);
  const totalEntrada = filtrados.filter((l) => l.entrada).reduce((s, l) => s + l.valor, 0);
  const showCotista = filtroCotista !== "todos";

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Extrato do mês</div>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            <ReceiptText className="h-4 w-4" /> {filtrados.length} lançamento(s)
            {showCotista && (
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-primary">
                {cotistas.find((c) => c.id === filtroCotista)?.nome}
              </span>
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SelectField value={filtroCotista} onChange={onFiltroCotistaChange}>
            <option value="todos">Todos os cotistas</option>
            {cotistas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </SelectField>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descrição, fornecedor, NF…"
            className="h-10 w-64 rounded-lg border border-input bg-background px-3.5 text-xs transition-colors duration-150 hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {showCotista && (
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          Mostrando o valor rateado (parte que cabe a este cotista) e o percentual de uso (percentual_uso) aplicado em cada lançamento, não o valor total da despesa.
        </p>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento no período.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left">Data</th>
                  <th className="px-3 py-2.5 text-left">Fornecedor</th>
                  <th className="px-3 py-2.5 text-left">Descrição</th>
                  <th className="px-3 py-2.5 text-left">Nº doc</th>
                  {showCotista && <th className="px-3 py-2.5 text-left">Cotista</th>}
                  {showCotista && <th className="px-3 py-2.5 text-right">% uso</th>}
                  <th className="px-3 py-2.5 text-left">Fluxo</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const isExpanded = expandedId === l.id;
                  return (
                    <FragmentRow
                      key={l.id}
                      linha={l}
                      expanded={isExpanded}
                      showCotista={showCotista}
                      onToggle={() => setExpandedId(isExpanded ? null : l.id)}
                    />
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 text-xs">
                <tr className="border-t border-border/60">
                  <td colSpan={showCotista ? 8 : 6} className="px-3 py-2.5 text-right uppercase tracking-widest text-muted-foreground">Total saídas</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatBRL(totalSaida)}</td>
                </tr>
                {totalEntrada > 0 && (
                  <tr>
                    <td colSpan={showCotista ? 8 : 6} className="px-3 py-2.5 text-right uppercase tracking-widest text-muted-foreground">Total entradas</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-400">{formatBRL(totalEntrada)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function FragmentRow({
  linha, expanded, showCotista, onToggle,
}: { linha: LinhaExtrato; expanded: boolean; showCotista: boolean; onToggle: () => void }) {
  const colSpan = showCotista ? 9 : 7;
  const status = statusDoPagamento(linha.raw);

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer border-t border-border/40 transition-all duration-200 active:scale-[0.998]",
          expanded
            ? "border-l-2 border-l-primary bg-primary/[0.06]"
            : "hover:bg-muted/20",
        )}
      >
        <td className="px-3 py-3 text-muted-foreground">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180 text-primary")} />
        </td>
        <td className="px-3 py-3 text-muted-foreground">{formatDate(linha.data)}</td>
        <td className="px-3 py-3">{linha.fornecedor || "—"}</td>
        <td className="px-3 py-3 text-muted-foreground">{linha.descricao || "—"}</td>
        <td className="px-3 py-3 text-muted-foreground">{linha.documento || "—"}</td>
        {showCotista && <td className="px-3 py-3 text-muted-foreground">{linha.cotistaNome || "—"}</td>}
        {showCotista && (
          <td className="px-3 py-3 text-right text-muted-foreground">
            {linha.percentualUso != null ? `${linha.percentualUso.toFixed(0)}%` : "—"}
          </td>
        )}
        <td className="px-3 py-3">
          <span className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            linha.entrada ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
          )}>
            {linha.entrada ? "Entrada" : "Saída"}
          </span>
        </td>
        <td className={cn("px-3 py-3 text-right font-medium tabular-nums", linha.entrada ? "text-emerald-400" : "text-foreground")}>
          {formatBRL(linha.valor)}
        </td>
      </tr>

      {/* painel expandido — desliza com a técnica de grid-template-rows (0fr → 1fr) */}
      <tr className="border-t-0">
        <td colSpan={colSpan} className="p-0">
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="border-b border-border/40 bg-muted/10 px-6 py-6">
                <DetalheLancamento linha={linha} status={status} />
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

function SecaoLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 text-primary">{icon}</span>
      {children}
    </div>
  );
}

function Campo({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function AnexoCard({
  label, valor, url,
}: { label: string; valor?: string | null; url?: string | null }) {
  const disponivel = Boolean(url || valor);
  const Wrapper = url ? "a" : "div";
  return (
    <Wrapper
      {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-200",
        disponivel
          ? "border-border/60 bg-card/70 hover:scale-[1.03] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_var(--primary)] active:scale-[0.98] cursor-pointer"
          : "border-dashed border-border/40 bg-muted/10 text-muted-foreground",
      )}
    >
      <IconBadge icon={<FileText />} tone={disponivel ? "primary" : "default"} size="sm" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-xs font-medium">
          {disponivel ? (valor || "Ver anexo") : "Não anexado"}
        </div>
      </div>
    </Wrapper>
  );
}

function DetalheLancamento({
  linha, status,
}: { linha: LinhaExtrato; status: { label: string; tone: "success" | "warning" | "danger" } }) {
  const r = linha.raw;
  return (
    <div className="space-y-6 motion-safe:animate-[fadeUp_0.35s_ease-out_both]">
      {/* INFORMAÇÕES */}
      <div>
        <SecaoLabel icon={<ReceiptText />}>Informações</SecaoLabel>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Campo label="Fornecedor" value={linha.fornecedor} />
          <Campo label="Descrição" value={linha.descricao} />
          <Campo label="Categoria" value={linha.categoria} />
          <Campo label="Documento" value={linha.documento} />
        </div>
      </div>

      <div className="border-t border-dashed border-border/50" />

      {/* PAGAMENTO */}
      <div>
        <SecaoLabel icon={<Banknote />}>Pagamento</SecaoLabel>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Campo label="Forma" value={r.forma_pagamento} />
          <Campo label="Data" value={formatDate(linha.data)} />
          <Campo
            label="Status"
            value={
              <span className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                status.tone === "success" && "bg-emerald-500/15 text-emerald-400",
                status.tone === "warning" && "bg-amber-500/15 text-amber-400",
                status.tone === "danger" && "bg-rose-500/15 text-rose-400",
              )}>
                {status.label}
              </span>
            }
          />
          <Campo label="Valor" value={formatBRL(linha.valor)} />
          {linha.percentualUso != null && (
            <Campo label="% uso" value={`${linha.percentualUso.toFixed(0)}%`} />
          )}
        </div>
      </div>

      <div className="border-t border-dashed border-border/50" />

      {/* ANEXOS */}
      <div>
        <SecaoLabel icon={<Paperclip />}>Anexos</SecaoLabel>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <AnexoCard label="Nota Fiscal" valor={linha.notaFiscal} url={r.anexo_nota_fiscal_url} />
          <AnexoCard label="Recibo" url={r.anexo_recibo_url} />
          <AnexoCard label="Boleto" url={r.anexo_boleto_url} />
        </div>
      </div>

      <div className="border-t border-dashed border-border/50" />

      {/* OBSERVAÇÕES */}
      <div>
        <SecaoLabel icon={<StickyNote />}>Observações</SecaoLabel>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {r.observacoes || "Nenhuma observação registrada para este lançamento."}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── previsão e retrospectiva ─────────────────────────── */

function ForecastCard({
  previsao, ano, matricula,
}: {
  previsao: {
    anoCorrente: boolean;
    custoYtd: number; horasYtd: number; voosYtd: number; pousosYtd: number;
    custoProj: number; horasProj: number; voosProj: number; pousosProj: number;
    diasDecorridos: number;
  };
  ano: number;
  matricula?: string;
}) {
  if (!previsao.anoCorrente) return null;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-card/40 to-background p-8 sm:p-10">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-4 w-4" /> Previsão · baseado no histórico
        </div>
        <h2 className="mt-3 font-display text-2xl sm:text-3xl">
          Se o ritmo continuar, você encerrará {ano} com…
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Projeção linear a partir dos {previsao.diasDecorridos} dias já registrados da {matricula || "aeronave"}.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ForecastItem icon={<Clock />} label="horas voadas" value={`${previsao.horasProj.toFixed(0)} h`} sub={`hoje: ${previsao.horasYtd.toFixed(0)} h`} />
          <ForecastItem icon={<Wallet />} label="em custos" value={formatBRL(previsao.custoProj)} sub={`hoje: ${formatBRL(previsao.custoYtd)}`} />
          <ForecastItem icon={<Plane />} label="voos" value={previsao.voosProj.toFixed(0)} sub={`hoje: ${previsao.voosYtd}`} />
          <ForecastItem icon={<TrendingUp />} label="pousos" value={previsao.pousosProj.toFixed(0)} sub={`hoje: ${previsao.pousosYtd}`} />
        </div>
      </div>
    </section>
  );
}

function ForecastItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-5 backdrop-blur transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 hover:border-primary/40">
      <IconBadge icon={icon} tone="success" size="sm" />
      <div className="mt-3.5 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-2xl tabular-nums text-foreground">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ─────────── Cotista Tabs (Extrato / Estatísticas) ─────────── */

function CotistaTabsWrap({
  filtroCotista,
  cotistas,
  rateios,
  voos,
  ano,
  mes,
  categoriasMap,
  children,
}: {
  filtroCotista: string;
  cotistas: Cotista[];
  rateios: Rateio[];
  voos: Voo[];
  ano: number;
  mes: number;
  categoriasMap: Map<string, string>;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<"extrato" | "stats">("extrato");
  useEffect(() => {
    if (filtroCotista === "todos") setTab("extrato");
  }, [filtroCotista]);

  if (filtroCotista === "todos") return <>{children}</>;
  const cotista = cotistas.find((c) => c.id === filtroCotista) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/40 p-1 w-fit">
        {(
          [
            ["extrato", "Extrato do mês"],
            ["stats", "Estatísticas do cotista"],
          ] as const
        ).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              tab === k
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {lbl}
          </button>
        ))}
      </div>
      {tab === "extrato" ? (
        children
      ) : (
        <EstatisticasCotista
          cotista={cotista}
          cotistas={cotistas}
          rateios={rateios}
          voos={voos}
          ano={ano}
          mes={mes}
          categoriasMap={categoriasMap}
        />
      )}
    </div>
  );
}

function EstatisticasCotista({
  cotista,
  cotistas,
  rateios,
  voos,
  ano,
  mes,
  categoriasMap,
}: {
  cotista: Cotista | null;
  cotistas: Cotista[];
  rateios: Rateio[];
  voos: Voo[];
  ano: number;
  mes: number;
  categoriasMap: Map<string, string>;
}) {
  const [showPend, setShowPend] = useState(false);

  const stats = useMemo(() => {
    if (!cotista) return null;
    const inMonth = (d?: string | null) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
    };
    // rateios do cotista no mês
    const meus = rateios.filter(
      (r) => findCotistaKey(cotistas, r) === cotista.id && inMonth(r.data_pagamento || r.data_vencimento),
    );
    let debito = 0;
    let pago = 0;
    const porCategoria = new Map<string, number>();
    const pendenteItems: { r: Rateio; base: number; pago: number; falta: number }[] = [];
    for (const r of meus) {
      if (isSaida(r.fluxo)) {
        const rateado = Number(r.valor_rateado) || 0;
        const pct = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
        const total = Number(r.valor_total_despesa) || 0;
        const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
        debito += base;
        const cat = resolveCategoria(r.categoria_custo, categoriasMap);
        porCategoria.set(cat, (porCategoria.get(cat) || 0) + base);
        const rowPago = Number(r.valor_pago_real) || 0;
        const falta = base - rowPago;
        if (falta > 0.005) pendenteItems.push({ r, base, pago: rowPago, falta });
      }
      pago += Number(r.valor_pago_real) || 0;
    }
    pendenteItems.sort((a, b) => b.falta - a.falta);
    const pendente = Math.max(0, debito - pago);
    const adimplencia = debito > 0 ? Math.min(100, (pago / debito) * 100) : 100;

    // horas voadas no mês
    const horas = voos
      .filter((v) => {
        const d = new Date(v.data_registro);
        return (
          d.getFullYear() === ano &&
          d.getMonth() + 1 === mes &&
          findCotistaKey(cotistas, v) === cotista.id
        );
      })
      .reduce((s, v) => s + (Number(v.tempo_total) || Number(v.tempo_voo) || 0), 0);

    // evolução mensal (12 meses do ano)
    const evolucao = Array.from({ length: 12 }, (_, i) => ({
      key: `${ano}-${String(i + 1).padStart(2, "0")}`,
      label: MESES[i].slice(0, 3),
      valor: 0,
      pago: 0,
    }));
    for (const r of rateios) {
      if (findCotistaKey(cotistas, r) !== cotista.id) continue;
      if (!isSaida(r.fluxo)) continue;
      const d = r.data_pagamento || r.data_vencimento;
      if (!d) continue;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano) continue;
      const idx = dt.getMonth();
      const rateado = Number(r.valor_rateado) || 0;
      const pct = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const total = Number(r.valor_total_despesa) || 0;
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
      evolucao[idx].valor += base;
      evolucao[idx].pago += Number(r.valor_pago_real) || 0;
    }

    const categorias = Array.from(porCategoria.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
    const maxCat = categorias[0]?.valor || 1;

    return { debito, pago, pendente, adimplencia, horas, evolucao, categorias, maxCat, pendenteItems };
  }, [cotista, cotistas, rateios, voos, ano, mes, categoriasMap]);

  if (!cotista || !stats) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        Selecione um cotista para ver as estatísticas.
      </div>
    );
  }

  const adTone: "success" | "warning" | "danger" =
    stats.adimplencia >= 95 ? "success" : stats.adimplencia >= 60 ? "warning" : "danger";

  return (
    <section className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Estatísticas · {MESES[mes - 1]}/{ano}
        </div>
        <h2 className="mt-1 text-lg font-semibold">{cotista.nome}</h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Clock />} label="Horas utilizadas" value={formatHours(stats.horas)} tone="muted" />
        <StatCard icon={<CheckCircle2 />} label="Valor pago" value={formatBRL(stats.pago)} tone="success" />
        <button
          type="button"
          onClick={() => stats.pendenteItems.length && setShowPend((v) => !v)}
          disabled={!stats.pendenteItems.length}
          className={cn(
            "rounded-xl border border-border/50 bg-background/40 p-5 text-left transition-all",
            stats.pendenteItems.length ? "hover:-translate-y-0.5 hover:shadow-lg cursor-pointer" : "opacity-70 cursor-default",
            showPend && "border-amber-500/50 ring-1 ring-amber-500/30",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <IconBadge icon={<Wallet />} tone={stats.pendente > 0 ? "warning" : "default"} size="sm" />
            {stats.pendenteItems.length > 0 && (
              <ChevronDown className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", showPend && "rotate-180 text-amber-400")} />
            )}
          </div>
          <div className="mt-3.5 text-[11px] uppercase tracking-widest text-muted-foreground">Valor pendente</div>
          <div className={cn("mt-1 text-xl font-semibold tabular-nums", stats.pendente > 0 ? "text-amber-400" : "text-muted-foreground")}>
            {formatBRL(stats.pendente)}
          </div>
          {stats.pendenteItems.length > 0 && (
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {stats.pendenteItems.length} lançamento{stats.pendenteItems.length === 1 ? "" : "s"} — clique para ver
            </div>
          )}
        </button>
        <StatCard
          icon={<Gauge />}
          label="Adimplência"
          value={`${stats.adimplencia.toFixed(0)}%`}
          tone={adTone}
        />
      </div>

      {showPend && stats.pendenteItems.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5">
          <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400">
            <Wallet className="h-3.5 w-3.5" /> Lançamentos pendentes — {MESES[mes - 1]}/{ano}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left">Vencimento</th>
                  <th className="px-3 py-2.5 text-left">Descrição</th>
                  <th className="px-3 py-2.5 text-left">Fornecedor</th>
                  <th className="px-3 py-2.5 text-right">Devido</th>
                  <th className="px-3 py-2.5 text-right">Pago</th>
                  <th className="px-3 py-2.5 text-right text-amber-400">Falta</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendenteItems.map(({ r, base, pago: p, falta }) => (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="px-3 py-2">{formatDate(r.data_vencimento || r.data_pagamento)}</td>
                    <td className="px-3 py-2">{r.descricao_despesa || resolveCategoria(r.categoria_custo, categoriasMap)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.fornecedor_nome || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(base)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBRL(p)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-400">{formatBRL(falta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border/50 p-5">
          <div className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Gastos por categoria</div>
          {stats.categorias.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Sem despesas neste mês.</div>
          ) : (
            <ul className="space-y-3">
              {stats.categorias.map((c, i) => {
                const pct = (c.valor / stats.maxCat) * 100;
                return (
                  <li key={c.nome} className="text-xs">
                    <div className="mb-1.5 flex justify-between gap-2">
                      <span className="truncate">{c.nome}</span>
                      <span className="tabular-nums text-muted-foreground">{formatBRL(c.valor)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: `hsl(${(i * 47) % 360} 60% 55%)`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/50 p-5">
          <div className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
            Evolução mensal em {ano}
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={stats.evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatBRL(Number(v))}
                />
                <Bar dataKey="valor" name="Devido" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pago" name="Pago" fill="var(--success)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "muted",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  const badgeTone = tone === "muted" ? "default" : tone;
  const valueClass = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
    muted: "text-primary",
  }[tone];

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <IconBadge icon={icon} tone={badgeTone} size="sm" />
      <div className="mt-3.5 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", valueClass)}>{value}</div>
    </div>
  );
}

/* ─────────────────────── Resumo Geral & Projeção de Custo/Hora ─────────────────────── */

function ResumoGeralAno({
  rateios, voos, ano, matricula,
}: {
  rateios: Rateio[];
  voos: Voo[];
  ano: number;
  matricula?: string;
}) {
  const [horasSim, setHorasSim] = useState(45);
  const [monthlyView, setMonthlyView] = useState<"tabela" | "grafico">("tabela");
  const [projView, setProjView] = useState<"tabela" | "grafico">("grafico");
  const data = useMemo(() => {
    type Row = { fixo: number; varHora: number; varVoo: number; extra: number; horas: number; pousos: number; voos: number };
    const empty = (): Row => ({ fixo: 0, varHora: 0, varVoo: 0, extra: 0, horas: 0, pousos: 0, voos: 0 });
    const rows: Row[] = Array.from({ length: 12 }, empty);
    const seen = new Set<string>();
    rateios.forEach((r) => {
      const d = r.data_pagamento || r.data_vencimento;
      if (!d) return;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano) return;
      if (!isSaida(r.fluxo)) return;
      const k = r.despesa_id || r.id;
      if (seen.has(k)) return;
      seen.add(k);
      const val = Number(r.valor_total_despesa) || 0;
      const t = norm(r.tipo_rateio);
      const idx = dt.getMonth();
      if (t === "fixo") rows[idx].fixo += val;
      else if (t === "variavel_por_hora") rows[idx].varHora += val;
      else if (t === "variavel_por_voo") rows[idx].varVoo += val;
      else if (t === "extra") rows[idx].extra += val;
      else rows[idx].extra += val;
    });
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      const idx = dt.getMonth();
      rows[idx].horas += Number(v.tempo_total) || Number(v.tempo_voo) || 0;
      rows[idx].pousos += Number(v.pousos_total) || 0;
      rows[idx].voos += 1;
    });
    const total: Row = rows.reduce((s, r) => ({
      fixo: s.fixo + r.fixo, varHora: s.varHora + r.varHora, varVoo: s.varVoo + r.varVoo,
      extra: s.extra + r.extra, horas: s.horas + r.horas, pousos: s.pousos + r.pousos, voos: s.voos + r.voos,
    }), empty());
    const mesesAtivos = rows.filter((r) => (r.fixo + r.varHora + r.varVoo + r.extra) > 0).length || 1;
    const media: Row = {
      fixo: total.fixo / mesesAtivos, varHora: total.varHora / mesesAtivos,
      varVoo: total.varVoo / mesesAtivos, extra: total.extra / mesesAtivos,
      horas: total.horas / mesesAtivos, pousos: total.pousos / mesesAtivos, voos: total.voos / mesesAtivos,
    };
    return { rows, total, media, mesesAtivos };
  }, [rateios, voos, ano]);

  const projecao = useMemo(() => {
    const arr: { h: number; fixo: number; variavel: number; extra: number; total: number }[] = [];
    const horasTot = Math.max(1, data.total.horas);
    const varConst = data.total.varHora / horasTot;
    const extraConst = data.total.extra / horasTot;
    for (let h = 1; h <= horasSim; h++) {
      const fixo = data.total.fixo / h;
      arr.push({ h, fixo, variavel: varConst, extra: extraConst, total: fixo + varConst + extraConst });
    }
    return arr;
  }, [data, horasSim]);

  const vMenor = projecao[projecao.length - 1]?.total || 0;
  const vMaior = projecao[0]?.total || 0;
  const economia = vMaior > 0 ? (1 - vMenor / vMaior) * 100 : 0;
  const totalGeral = data.total.fixo + data.total.varHora + data.total.varVoo + data.total.extra;
  const mediaTotal = data.media.fixo + data.media.varHora + data.media.varVoo + data.media.extra;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
      <header className="mb-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Resumo geral · {matricula || ""} · {ano}</div>
        <h2 className="mt-1 text-lg font-semibold">Custos fixos, variáveis, extras e projeção de custo/hora</h2>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Mês</th>
              <th className="px-3 py-2.5 text-right">Custos Fixos</th>
              <th className="px-3 py-2.5 text-right">Var. Hora</th>
              <th className="px-3 py-2.5 text-right">Var. Voo</th>
              <th className="px-3 py-2.5 text-right">Extras</th>
              <th className="px-3 py-2.5 text-right bg-primary/10 text-primary">Total</th>
              <th className="px-3 py-2.5 text-right">H Voadas</th>
              <th className="px-3 py-2.5 text-right">Pousos</th>
              <th className="px-3 py-2.5 text-right">Custo/H</th>
              <th className="px-3 py-2.5 text-right">Custo/Pouso</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => {
              const tot = r.fixo + r.varHora + r.varVoo + r.extra;
              const cph = r.horas > 0 ? tot / r.horas : 0;
              const cpp = r.pousos > 0 ? tot / r.pousos : 0;
              const empty = tot === 0 && r.horas === 0;
              return (
                <tr key={i} className={cn("border-t border-border/40", empty && "opacity-40")}>
                  <td className="px-3 py-2 font-medium">{MESES[i]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.fixo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.varHora)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.varVoo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.extra)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold bg-primary/[0.06] text-primary">{formatBRL(tot)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.horas.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.pousos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cph ? formatBRL(cph) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cpp ? formatBRL(cpp) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="text-xs">
            <tr className="border-t border-border/60 bg-muted/30 font-semibold">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.total.fixo)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.total.varHora)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.total.varVoo)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.total.extra)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums bg-primary/10 text-primary">{formatBRL(totalGeral)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.total.horas.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.total.pousos}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.total.horas > 0 ? formatBRL(totalGeral / data.total.horas) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.total.pousos > 0 ? formatBRL(totalGeral / data.total.pousos) : "—"}</td>
            </tr>
            <tr className="border-t border-border/60 text-muted-foreground">
              <td className="px-3 py-2.5">Média/mês ({data.mesesAtivos} {data.mesesAtivos > 1 ? "meses" : "mês"})</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.media.fixo)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.media.varHora)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.media.varVoo)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatBRL(data.media.extra)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-primary">{formatBRL(mediaTotal)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.media.horas.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{data.media.pousos.toFixed(1)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-5">
          <div className="text-[10px] uppercase tracking-widest text-primary">V Menor</div>
          <div className="mt-1.5 font-display text-2xl tabular-nums text-primary">{formatBRL(vMenor)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">com {horasSim}h no período</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5">
          <div className="text-[10px] uppercase tracking-widest text-amber-400">V Maior</div>
          <div className="mt-1.5 font-display text-2xl tabular-nums text-amber-400">{formatBRL(vMaior)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">com 1h no período</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400">% Economia</div>
          <div className="mt-1.5 font-display text-2xl tabular-nums text-emerald-400">{economia.toFixed(0)}%</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">diluição do custo fixo</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Tabela de projeção de custo/hora</div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Simular até
            <input
              type="number"
              min={1}
              max={200}
              value={horasSim}
              onChange={(e) => setHorasSim(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs"
            />
            horas
          </label>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={projecao}>
              <defs>
                <linearGradient id="gProjHora" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="h" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => formatBRL(Number(v))}
                labelFormatter={(h: any) => `${h}h voadas`}
              />
              <Area type="monotone" dataKey="total" name="Custo Hora Total" stroke="var(--primary)" fill="url(#gProjHora)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-border/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">H Voadas</th>
                <th className="px-3 py-2.5 text-right">Custo Fixo/H</th>
                <th className="px-3 py-2.5 text-right">Custo Variável/H</th>
                <th className="px-3 py-2.5 text-right">Custo Extra/H</th>
                <th className="px-3 py-2.5 text-right bg-primary/10 text-primary">Custo Hora Total</th>
              </tr>
            </thead>
            <tbody>
              {projecao.map((p) => (
                <tr key={p.h} className="border-t border-border/40">
                  <td className="px-3 py-2 font-medium">{p.h}h</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.fixo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.variavel)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.extra)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary bg-primary/[0.06]">{formatBRL(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default BalancoPage;