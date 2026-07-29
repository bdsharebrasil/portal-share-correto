import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Scale, Clock, Gauge, HandCoins, CheckCircle2, ChevronDown,
  Plane, ReceiptText, Layers, FileText, ArrowRight, PlaneLanding,
  TrendingUp, Moon, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  type Aeronave, type Cotista, type RateioRow, type VooRow,
  MESES, MESES_SHORT, norm, isSaida, isFixo, formatDate, num, cotistaKey,
  findCotistaKey, resolveCategoria, statusOf, formatHours, monthLabel,
} from "@/components/dashboard/gestor/FinanceiroCotista/balancoTypes";

const CHART = { primary: "#06b6d4", success: "#10b981", amber: "#f59e0b", danger: "#ef4444", sky: "#38bdf8" };
const CHART_COLORS = ["#06b6d4", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6"];

const decimalToHHMM = (dec: number): string => {
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

export default function BalancoCotistaTab() {
  const hoje = new Date();
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [aircraftId, setAircraftId] = useState<string>("");
  const [ano, setAno] = useState(hoje.getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([hoje.getMonth() + 1]);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [sociosMap, setSociosMap] = useState<Record<string, any>>({});
  const [clientesMap, setClientesMap] = useState<Record<string, any>>({});
  const [rateios, setRateios] = useState<RateioRow[]>([]);
  const [voos, setVoos] = useState<VooRow[]>([]);
  const [catMap, setCatMap] = useState<Map<string, string>>(new Map());
  const [filtroCotista, setFiltroCotista] = useState("todos");
  const [showEntradas, setShowEntradas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"data" | "nome">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showDiario, setShowDiario] = useState(true);

  useEffect(() => {
    supabase.from("aeronave").select("id, matricula, modelo, fabricante").eq("status", "ativa").order("matricula")
      .then(({ data }) => {
        const list = (data || []) as Aeronave[];
        setAeronaves(list);
        if (list.length > 0 && !aircraftId) setAircraftId(list[0].id);
      });
  }, []);

  useEffect(() => {
    supabase.from("expense_configu").select("id, expense_type").then(({ data }) => {
      const m = new Map<string, string>();
      (data || []).forEach((c: any) => m.set(c.id, (c.expense_type || "").trim()));
      setCatMap(m);
    });
  }, []);

  useEffect(() => {
    if (!aircraftId) return;
    setLoading(true);
    const fetchCotistas = async () => {
      const { data: cotData } = await supabase
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(id, razao_social, cnpj, endereco, cidade, uf), socios(id, nome, cpf, endereco, cidade, uf)")
        .eq("id_aeronave", aircraftId);
      const socioIds = Array.from(new Set((cotData || []).map((r: any) => r.socios_id).filter(Boolean)));
      let sm: Record<string, any> = {};
      if (socioIds.length > 0) {
        const { data: sociosData } = await supabase.from("socios").select("id, nome, cpf, endereco, cidade, uf").in("id", socioIds);
        (sociosData || []).forEach((s: any) => { sm[s.id] = s; });
      }
      setSociosMap(sm);
      const { data: cliData } = await supabase.from("clientes").select("id, razao_social, cnpj, endereco, cidade, uf");
      const cm: Record<string, any> = {};
      (cliData || []).forEach((c: any) => { cm[c.id] = c; });
      setClientesMap(cm);
      setCotistas((cotData || []).map((r: any) => {
        const socio = sm[r.socios_id];
        const cliente = r.clientes;
        return {
          id: cotistaKey(r.id_clientes, r.socios_id),
          cliente_id: r.id_clientes ?? null,
          socio_id: r.socios_id ?? null,
          nome: socio?.nome || cliente?.razao_social || "Cotista",
          percentual: num(r.percentual_sociedade),
          documento: socio?.cpf || cliente?.cnpj || "",
        };
      }));
    };
    const fetchRateios = async () => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;
      const { data } = await supabase.from("rateio_despesas").select("*").eq("aeronave_id", aircraftId)
        .or(`and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`);
      setRateios((data || []) as unknown as RateioRow[]);
    };
    const fetchVoos = async () => {
      const { data } = await supabase
        .from("lancamentos_diario_bordo")
        .select("id, data_registro, tempo_total, tempo_voo, horas_diurnas, horas_noturnas, tempo_ifr, clientes_id, socios_id, socios_nome, aerodromo_partida, aerodromo_chegada, trecho, natureza_voo, pousos_total, emprestimo, cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id, pic_canac, sic_canac, sic_name")
        .eq("aeronave_id", aircraftId)
        .gte("data_registro", `${ano}-01-01`)
        .lte("data_registro", `${ano}-12-31`)
        .order("data_registro", { ascending: true });
      setVoos((data || []) as unknown as VooRow[]);
    };
    Promise.all([fetchCotistas(), fetchRateios(), fetchVoos()]).finally(() => setLoading(false));
  }, [aircraftId, ano]);

  useEffect(() => { setFiltroCotista("todos"); setShowEntradas(false); }, [aircraftId, ano, selectedMonths]);

  const activeAircraft = aeronaves.find((a) => a.id === aircraftId);
  const catNameOf = (r: RateioRow) => resolveCategoria(r.categoria_custo, catMap);

  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);
  const inSelected = (d?: string | null) => {
    if (!d) return false;
    const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
    return dt.getFullYear() === ano && selectedSet.has(dt.getMonth() + 1);
  };
  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 1) return `${MESES[selectedMonths[0] - 1]} ${ano}`;
    if (selectedMonths.length === 12) return `Ano ${ano}`;
    const sorted = [...selectedMonths].sort((a, b) => a - b);
    return `${MESES[sorted[0] - 1].slice(0, 3)}–${MESES[sorted[sorted.length - 1] - 1].slice(0, 3)} ${ano}`;
  }, [selectedMonths, ano]);
  const dateOf = (r: RateioRow) => r.data_pagamento || r.data_vencimento || r.data_emissao;

  // Resolve socio name for a rateio row — prefer socio_id → socios table, then socio_id → cotistas, then clientes_nome
  const resolveSocioName = (r: RateioRow): string => {
    if (r.socio_id && sociosMap[r.socio_id]?.nome) return sociosMap[r.socio_id].nome;
    if (r.socios_nome) return r.socios_nome;
    if (r.cliente_id && clientesMap[r.cliente_id]?.razao_social) return clientesMap[r.cliente_id].razao_social;
    return r.clientes_nome || "—";
  };
  // Resolve socio name for a voo row
  const resolveVooSocioName = (v: VooRow): string => {
    if (v.socios_id && sociosMap[v.socios_id]?.nome) return sociosMap[v.socios_id].nome;
    if (v.socios_nome) return v.socios_nome;
    if (v.clientes_id && clientesMap[v.clientes_id]?.razao_social) return clientesMap[v.clientes_id].razao_social;
    return v.natureza_voo || "—";
  };

  const despesasPeriodo = useMemo(() => {
    const map = new Map<string, RateioRow>();
    rateios.forEach((r) => {
      if (!inSelected(dateOf(r))) return;
      const k = r.despesa_id || r.id;
      if (!map.has(k)) map.set(k, r);
    });
    return Array.from(map.values());
  }, [rateios, ano, selectedSet]);

  const rateiosPeriodo = useMemo(() => rateios.filter((r) => inSelected(dateOf(r))), [rateios, ano, selectedSet]);

  const { custoFixo, custoVarHora, custoVarVoo, custoExtra, custoVariavel, custoTotal, entradasPeriodo } = useMemo(() => {
    let fx = 0, vh = 0, vv = 0, ex = 0, ent = 0;
    despesasPeriodo.forEach((d) => {
      const val = num(d.valor_total_despesa);
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
    return { custoFixo: fx, custoVarHora: vh, custoVarVoo: vv, custoExtra: ex, custoVariavel: variavel, custoTotal: fx + variavel + ex, entradasPeriodo: ent };
  }, [despesasPeriodo]);

  const voosPeriodo = useMemo(() => voos.filter((v) => inSelected(v.data_registro)), [voos, ano, selectedSet]);

  const horasPeriodo = useMemo(() => voosPeriodo.reduce((s, v) => s + (num(v.tempo_total) || num(v.tempo_voo)), 0), [voosPeriodo]);
  const custoMedioHora = horasPeriodo > 0 ? custoVariavel / horasPeriodo : 0;
  const custoMedioHoraTotal = horasPeriodo > 0 ? custoTotal / horasPeriodo : 0;
  const totalPousos = useMemo(() => voosPeriodo.reduce((s, v) => s + num(v.pousos_total), 0), [voosPeriodo]);

  // Linhas por cotista — usa socio name quando disponível
  const linhasPeriodo = useMemo(() => {
    const debito = new Map<string, number>();
    const credito = new Map<string, number>();
    const horas = new Map<string, number>();
    const pousos = new Map<string, number>();
    cotistas.forEach((c) => { debito.set(c.id, 0); credito.set(c.id, 0); horas.set(c.id, 0); pousos.set(c.id, 0); });
    rateios.forEach((r) => {
      if (!inSelected(dateOf(r))) return;
      if (!isSaida(r.fluxo)) return;
      const k = findCotistaKey(cotistas, r);
      if (!k) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
      debito.set(k, (debito.get(k) || 0) + base);
      const pago = num(r.valor_pago_real);
      if (pago > 0) credito.set(k, (credito.get(k) || 0) + pago);
    });
    voosPeriodo.forEach((v) => {
      const k = findCotistaKey(cotistas, v);
      if (!k) return;
      horas.set(k, (horas.get(k) || 0) + (num(v.tempo_total) || num(v.tempo_voo)));
      pousos.set(k, (pousos.get(k) || 0) + num(v.pousos_total));
    });
    return cotistas.map((c) => {
      const deb = debito.get(c.id) || 0;
      const cre = credito.get(c.id) || 0;
      const saldo = cre - deb;
      const pctPago = deb > 0 ? (cre / deb) * 100 : cre > 0 ? 100 : 0;
      return { ...c, debito: deb, credito: cre, saldo, horas: horas.get(c.id) || 0, pousos: pousos.get(c.id) || 0, pctPago };
    });
  }, [rateios, voosPeriodo, cotistas, ano, selectedSet]);

  const entradasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateiosPeriodo.forEach((r) => {
      if (isSaida(r.fluxo)) return;
      const k = findCotistaKey(cotistas, r);
      if (!k) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      map.set(k, (map.get(k) || 0) + base);
    });
    return cotistas.map((c) => ({ ...c, valor: map.get(c.id) || 0 })).filter((c) => c.valor > 0.005).sort((a, b) => b.valor - a.valor);
  }, [rateiosPeriodo, cotistas]);

  const totalRegularizar = linhasPeriodo.filter((l) => l.saldo > 0.005).reduce((s, l) => s + l.saldo, 0);
  const equilibrado = totalRegularizar <= 0.005;

  // Per-month breakdown for multi-month view
  const monthlyBreakdown = useMemo(() => {
    return [...selectedMonths].sort((a, b) => a - b).map((m) => {
      const inM = (d?: string | null) => {
        if (!d) return false;
        const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
        return dt.getFullYear() === ano && dt.getMonth() + 1 === m;
      };
      const vistos = new Set<string>();
      let custo = 0, horas = 0, pousos = 0, voosCount = 0;
      rateios.forEach((r) => {
        if (!inM(dateOf(r)) || !isSaida(r.fluxo)) return;
        const k = r.despesa_id || r.id;
        if (vistos.has(k)) return;
        vistos.add(k);
        custo += num(r.valor_total_despesa);
      });
      voos.forEach((v) => {
        if (!inM(v.data_registro)) return;
        horas += num(v.tempo_total) || num(v.tempo_voo);
        pousos += num(v.pousos_total);
        voosCount++;
      });
      return { mes: m, label: MESES[m - 1].slice(0, 3), custo, horas, pousos, voos: voosCount, custoHora: horas > 0 ? custo / horas : 0 };
    });
  }, [rateios, voos, ano, selectedMonths]);

  const serieMensal = useMemo(() => {
    const pontos = Array.from({ length: 12 }, (_, i) => ({ key: `${ano}-${String(i + 1).padStart(2, "0")}`, custo: 0, horas: 0, voos: 0, pousos: 0 }));
    const vistos = new Set<string>();
    rateios.forEach((r) => {
      const d = dateOf(r);
      if (!d) return;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano || !isSaida(r.fluxo)) return;
      const k = r.despesa_id || r.id;
      if (vistos.has(k)) return;
      vistos.add(k);
      pontos[dt.getMonth()].custo += num(r.valor_total_despesa);
    });
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      pontos[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
      pontos[dt.getMonth()].voos += 1;
      pontos[dt.getMonth()].pousos += num(v.pousos_total);
    });
    return pontos;
  }, [rateios, voos, ano]);

  const composicaoPeriodo = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    despesasPeriodo.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      const nome = catNameOf(r);
      const cur = map.get(nome) || { total: 0, count: 0 };
      cur.total += num(r.valor_total_despesa);
      cur.count += 1;
      map.set(nome, cur);
    });
    return Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
  }, [despesasPeriodo, catMap]);

  // Diario de bordo mirror per socio
  const diarioPorSocio = useMemo(() => {
    const map = new Map<string, { nome: string; socio_id: string | null; cliente_id: string | null; horas: number; pousos: number; voos: number; noturnas: number; ifr: number }>();
    voosPeriodo.forEach((v) => {
      const nome = resolveVooSocioName(v);
      const sid = v.socios_id || null;
      const cid = v.clientes_id || null;
      const key = `${sid || cid || nome}`;
      const cur = map.get(key) || { nome, socio_id: sid, cliente_id: cid, horas: 0, pousos: 0, voos: 0, noturnas: 0, ifr: 0 };
      cur.horas += num(v.tempo_total) || num(v.tempo_voo);
      cur.pousos += num(v.pousos_total);
      cur.voos += 1;
      cur.noturnas += num(v.horas_noturnas);
      cur.ifr += num(v.tempo_ifr);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.horas - a.horas);
  }, [voosPeriodo, sociosMap, clientesMap]);

  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };
  const selectAllMonths = () => setSelectedMonths(Array.from({ length: 12 }, (_, i) => i + 1));
  const clearMonths = () => setSelectedMonths([hoje.getMonth() + 1]);

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const tabCotistas = linhasPeriodo.map((l) =>
      `<tr><td>${l.nome}</td><td style="text-align:right">${formatHours(l.horas)}</td><td style="text-align:right">${l.pousos}</td><td style="text-align:right">${formatBRL(l.debito)}</td><td style="text-align:right">${formatBRL(l.credito)}</td><td style="text-align:right;color:${l.saldo >= 0 ? '#059669' : '#d97706'}">${formatBRL(l.saldo)}</td><td style="text-align:right">${Math.round(l.pctPago)}%</td></tr>`
    ).join("");
    const monthlyRows = monthlyBreakdown.map((m) =>
      `<tr><td>${m.label}</td><td style="text-align:right">${formatBRL(m.custo)}</td><td style="text-align:right">${formatHours(m.horas)}</td><td style="text-align:right">${m.pousos}</td><td style="text-align:right">${m.voos}</td><td style="text-align:right">${m.custoHora > 0 ? formatBRL(m.custoHora) : '—'}</td></tr>`
    ).join("");
    const diarioRows = diarioPorSocio.map((d) =>
      `<tr><td>${d.nome}</td><td style="text-align:right">${d.voos}</td><td style="text-align:right">${formatHours(d.horas)}</td><td style="text-align:right">${d.pousos}</td><td style="text-align:right">${formatHours(d.noturnas)}</td><td style="text-align:right">${formatHours(d.ifr)}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Balanço ${activeAircraft?.matricula || ""} - ${periodLabel}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}h1{font-size:20px;margin:0 0 4px}.meta{font-size:11px;color:#64748b;margin-bottom:16px}h2{font-size:14px;margin:20px 0 8px;color:#334155}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:9px;text-transform:uppercase}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.summary{display:flex;gap:16px;margin:12px 0;flex-wrap:wrap}.summary div{flex:1;min-width:120px;padding:12px;border:1px solid #e2e8f0;border-radius:8px}.summary .label{font-size:9px;color:#64748b;text-transform:uppercase}.summary .val{font-size:16px;font-weight:bold;margin-top:4px}</style></head><body>
    <h1>Balanço Financeiro — ${activeAircraft?.matricula || "Aeronave"} ${activeAircraft?.modelo || ""}</h1>
    <div class="meta">${periodLabel} · Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
    <div class="summary">
      <div><div class="label">Custo Total</div><div class="val">${formatBRL(custoTotal)}</div></div>
      <div><div class="label">Custos Fixos</div><div class="val">${formatBRL(custoFixo)}</div></div>
      <div><div class="label">Custos Variáveis</div><div class="val">${formatBRL(custoVariavel)}</div></div>
      <div><div class="label">Horas Voadas</div><div class="val">${formatHours(horasPeriodo)}</div></div>
      <div><div class="label">Custo/Hora (Total)</div><div class="val">${horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"}</div></div>
      <div><div class="label">Pousos</div><div class="val">${totalPousos}</div></div>
    </div>
    <h2>Balanço por Cotista / Sócio</h2>
    <table><thead><tr><th>Cotista</th><th style="text-align:right">Horas</th><th style="text-align:right">Pousos</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th><th style="text-align:right">Saldo</th><th style="text-align:right">% Pago</th></tr></thead><tbody>${tabCotistas}</tbody></table>
    <h2>Evolução Mensal</h2>
    <table><thead><tr><th>Mês</th><th style="text-align:right">Custo</th><th style="text-align:right">Horas</th><th style="text-align:right">Pousos</th><th style="text-align:right">Voos</th><th style="text-align:right">Custo/H</th></tr></thead><tbody>${monthlyRows}</tbody></table>
    <h2>Espelho do Diário de Bordo por Sócio</h2>
    <table><thead><tr><th>Sócio</th><th style="text-align:right">Voos</th><th style="text-align:right">Horas</th><th style="text-align:right">Pousos</th><th style="text-align:right">Noturnas</th><th style="text-align:right">IFR</th></tr></thead><tbody>${diarioRows}</tbody></table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-bold text-slate-100">Balanço Cotista</span>
        </div>
        <div className="flex-1" />
        <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400">
          {aeronaves.map((a) => <option key={a.id} value={a.id}>{a.matricula} — {a.modelo || ""}</option>)}
        </select>
        <select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400">
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
          <FileText className="h-3.5 w-3.5" /> Exportar PDF
        </button>
      </div>

      {/* Month selector — multi-select chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Meses:</span>
        {MESES_SHORT.map((m, i) => (
          <button key={i} onClick={() => toggleMonth(i + 1)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${selectedSet.has(i + 1) ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            {m}
          </button>
        ))}
        <button onClick={selectAllMonths} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all">Todos</button>
        <button onClick={clearMonths} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all">Limpar</button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400">Carregando balanço…</div>
      ) : (
        <>
          {/* Hero */}
          <div className="rounded-2xl border border-slate-800 p-6 sm:p-8" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08), transparent 50%, rgba(2,6,23,0.4))" }}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Relatório · {periodLabel}</div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-100">
                  Balanço da <span className="text-cyan-400">{activeAircraft?.matricula || "Aeronave"}</span>
                </h1>
                {activeAircraft?.modelo && <span className="text-lg text-slate-500">{activeAircraft.modelo}</span>}
              </div>
              <div className="flex items-center gap-6 rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-4">
                <StatMini label="Custo total" value={formatBRL(custoTotal)} tone="primary" />
                <div className="h-8 w-px bg-slate-700" />
                <StatMini label="Horas voadas" value={formatHours(horasPeriodo)} />
                <div className="h-8 w-px bg-slate-700" />
                <StatMini label="Custo/h total" value={horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"} />
              </div>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard icon={<Wallet className="h-4 w-4" />} label="Custo total" value={formatBRL(custoTotal)} tone="primary" />
            <MetricCard icon={<Layers className="h-4 w-4" />} label="Custos fixos" value={formatBRL(custoFixo)} sub={custoTotal ? `${((custoFixo / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
            <MetricCard icon={<Gauge className="h-4 w-4" />} label="Custos variáveis" value={formatBRL(custoVariavel)} sub={custoTotal ? `${((custoVariavel / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
            <MetricCard icon={<HandCoins className="h-4 w-4" />} label="Entradas / créditos" value={formatBRL(entradasPeriodo)} tone="success" onClick={() => setShowEntradas((v) => !v)} expanded={showEntradas} hint="Ver por cotista" />
          </div>

          {/* Aircraft overall index */}
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plane className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Índice Geral da Aeronave — {periodLabel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <IndexStat label="Custo Total" value={formatBRL(custoTotal)} />
              <IndexStat label="Custo Variável" value={formatBRL(custoVariavel)} />
              <IndexStat label="Custo Fixo" value={formatBRL(custoFixo)} />
              <IndexStat label="Horas Voadas" value={formatHours(horasPeriodo)} />
              <IndexStat label="Custo/H (Var.)" value={horasPeriodo > 0 ? formatBRL(custoMedioHora) : "—"} />
              <IndexStat label="Custo/H (Total)" value={horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"} />
              <IndexStat label="Total Pousos" value={String(totalPousos)} />
              <IndexStat label="Total Voos" value={String(voosPeriodo.length)} />
              <IndexStat label="Mês(s) selecionado(s)" value={String(selectedMonths.length)} />
            </div>
          </div>

          {/* Entradas expandable */}
          <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: showEntradas ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-400">
                  <HandCoins className="h-3.5 w-3.5" /> Entradas por cotista — {periodLabel}
                </div>
                {entradasPorCotista.length === 0 ? (
                  <div className="text-sm text-slate-400">Nenhuma entrada registrada neste período.</div>
                ) : (
                  <div className="space-y-3">
                    {entradasPorCotista.map((c) => {
                      const max = entradasPorCotista[0]?.valor || 1;
                      const pct = (c.valor / max) * 100;
                      return (
                        <div key={c.id} className="flex items-center gap-4">
                          <div className="w-32 shrink-0 truncate text-sm text-slate-300 sm:w-40">{c.nome}</div>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-emerald-400">{formatBRL(c.valor)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Regularização status */}
          <div className={`flex items-start gap-4 rounded-2xl border p-5 ${equilibrado ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]"}`}>
            {equilibrado ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <Scale className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />}
            <div>
              <div className="text-sm font-semibold text-slate-100">
                {equilibrado ? "Caixa positivo — todos os cotistas quitados" : `Caixa negativo: ${formatBRL(totalRegularizar)} ainda a receber dos cotistas`}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {equilibrado ? `Cada cotista pagou a parte que lhe cabia em ${periodLabel}.` : "Clique em um cotista abaixo para ver o extrato detalhado."}
              </div>
            </div>
          </div>

          {/* Multi-month breakdown table */}
          {selectedMonths.length > 1 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Comparativo mensal — {ano}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Mês</th>
                      <th className="px-3 py-2.5 text-right">Custo</th>
                      <th className="px-3 py-2.5 text-right">Horas</th>
                      <th className="px-3 py-2.5 text-right">Pousos</th>
                      <th className="px-3 py-2.5 text-right">Voos</th>
                      <th className="px-3 py-2.5 text-right">Custo/H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdown.map((m) => (
                      <tr key={m.mes} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                        <td className="px-3 py-2.5 font-medium text-slate-200">{MESES[m.mes - 1]}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatBRL(m.custo)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatHours(m.horas)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{m.pousos}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{m.voos}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400 font-medium">{m.custoHora > 0 ? formatBRL(m.custoHora) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                      <td className="px-3 py-2.5 text-slate-100">Total</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{formatBRL(monthlyBreakdown.reduce((s, m) => s + m.custo, 0))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatHours(monthlyBreakdown.reduce((s, m) => s + m.horas, 0))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{monthlyBreakdown.reduce((s, m) => s + m.pousos, 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{monthlyBreakdown.reduce((s, m) => s + m.voos, 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{horasPeriodo > 0 ? formatBRL(custoTotal / horasPeriodo) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cotista cards — per sócio indices */}
          <div>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Balanço por cotista / sócio</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">Débito, crédito, horas e pousos — {periodLabel}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {linhasPeriodo.map((l) => (
                <CotistaCard key={l.id} linha={l} selected={filtroCotista === l.id} onClick={() => setFiltroCotista((prev) => prev === l.id ? "todos" : l.id)} />
              ))}
              {linhasPeriodo.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                  Nenhum cotista cadastrado para esta aeronave.
                </div>
              )}
            </div>
          </div>

          {/* Extrato */}
          {filtroCotista !== "todos" && (
            <ExtratoCotista
              cotista={cotistas.find((c) => c.id === filtroCotista)}
              cotistas={cotistas}
              rateios={rateios}
              despesasPeriodo={despesasPeriodo}
              rateiosPeriodo={rateiosPeriodo}
              catMap={catMap}
              resolveSocioName={resolveSocioName}
              sortBy={sortBy}
              sortDir={sortDir}
              setSortBy={setSortBy}
              setSortDir={setSortDir}
            />
          )}

          {/* Diario de bordo mirror */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlaneLanding className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Espelho do Diário de Bordo — {periodLabel}</span>
              </div>
              <button onClick={() => setShowDiario(!showDiario)} className="text-xs text-slate-500 hover:text-slate-300">
                {showDiario ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {showDiario && (
              <>
                {diarioPorSocio.length === 0 ? (
                  <div className="text-sm text-slate-400 py-4">Nenhum voo no período selecionado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Sócio / Cliente</th>
                          <th className="px-3 py-2.5 text-right">Voos</th>
                          <th className="px-3 py-2.5 text-right">Horas</th>
                          <th className="px-3 py-2.5 text-right">Pousos</th>
                          <th className="px-3 py-2.5 text-right">Noturnas</th>
                          <th className="px-3 py-2.5 text-right">IFR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diarioPorSocio.map((d) => (
                          <tr key={`${d.socio_id || d.cliente_id || d.nome}`} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                            <td className="px-3 py-2.5 font-medium text-slate-200">{d.nome}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{d.voos}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400 font-medium">{formatHours(d.horas)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{d.pousos}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-violet-400">{formatHours(d.noturnas)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-400">{formatHours(d.ifr)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-800/30 font-bold">
                        <tr className="border-t-2 border-cyan-500/20">
                          <td className="px-3 py-2.5 text-slate-100">Total Aeronave</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{diarioPorSocio.reduce((s, d) => s + d.voos, 0)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{formatHours(diarioPorSocio.reduce((s, d) => s + d.horas, 0))}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{diarioPorSocio.reduce((s, d) => s + d.pousos, 0)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-violet-400">{formatHours(diarioPorSocio.reduce((s, d) => s + d.noturnas, 0))}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-amber-400">{formatHours(diarioPorSocio.reduce((s, d) => s + d.ifr, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Evolução do ano</div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Custo mensal — {ano}</h3>
              <SimpleBarChart data={serieMensal} dataKey="custo" color={CHART.primary} formatter={(v: number) => formatBRL(v)} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Horas voadas</div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Evolução mensal — {ano}</h3>
              <SimpleBarChart data={serieMensal} dataKey="horas" color={CHART.success} formatter={(v: number) => `${v.toFixed(1)} h`} />
            </div>
          </div>

          {/* Pousos chart + composition */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Pousos por mês</div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Total de pousos — {ano}</h3>
              <SimpleBarChart data={serieMensal} dataKey="pousos" color={CHART.sky} formatter={(v: number) => `${v} pousos`} />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Composição de custos</div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">{periodLabel} — {formatBRL(custoTotal)}</h3>
              <div className="space-y-4">
                <CategoryBar label="Custos fixos" value={custoFixo} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.amber} />
                <CategoryBar label="Custos variáveis" value={custoVariavel} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.danger} />
                <CategoryBar label="Entradas" value={entradasPeriodo} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.success} />
              </div>
            </div>
          </div>

          {/* Costs by category */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">Custos por categoria — {periodLabel}</div>
            {composicaoPeriodo.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">Sem despesas no período.</div>
            ) : (
              <div className="space-y-3">
                {composicaoPeriodo.map((c, i) => (
                  <CategoryBar key={c.nome} label={c.nome} value={c.total} total={custoTotal} color={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatMini({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-semibold tabular-nums ${tone === "primary" ? "text-cyan-400" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function IndexStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/40 p-3 border border-slate-700/40">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, tone, onClick, expanded, hint }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "primary" | "success"; onClick?: () => void; expanded?: boolean; hint?: string }) {
  const clickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={`rounded-2xl border bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30 ${clickable ? "cursor-pointer select-none" : ""} ${expanded ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : "border-slate-800"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "primary" ? "bg-cyan-500/15 text-cyan-400" : tone === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>{icon}</span>
        {clickable && <ChevronDown className={`mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? "rotate-180 text-cyan-400" : ""}`} />}
      </div>
      <div className="mt-4 text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${tone === "primary" ? "text-cyan-400" : "text-slate-100"}`}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
      {clickable && hint && !sub && <div className="mt-1.5 text-xs text-slate-400/80">{hint}</div>}
    </div>
  );
}

function CotistaCard({ linha, selected, onClick }: { linha: any; selected?: boolean; onClick?: () => void }) {
  const quitado = Math.abs(linha.saldo) <= 0.005;
  const positivo = linha.saldo > 0.005;
  const pctAlvo = Math.max(0, Math.min(100, linha.pctPago));
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
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      className={`group cursor-pointer select-none rounded-2xl border bg-slate-900/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30 ${selected ? "border-cyan-400/50 bg-cyan-500/[0.05] ring-1 ring-cyan-400/30" : "border-slate-800"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">{linha.nome}</div>
          <div className="mt-1 text-xs text-slate-500">Cota {linha.percentual}% · {formatHours(linha.horas)} · {linha.pousos} pousos</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${quitado ? "bg-emerald-500/15 text-emerald-400" : positivo ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}>
          {quitado ? "Quitado" : positivo ? "A receber" : "A pagar"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-800/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Débito</div>
          <div className="mt-1 font-semibold tabular-nums text-slate-100">{formatBRL(linha.debito)}</div>
        </div>
        <div className="rounded-lg bg-slate-800/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Crédito</div>
          <div className="mt-1 font-semibold tabular-nums text-slate-100">{formatBRL(linha.credito)}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-800/30 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Horas</div>
          <div className="mt-0.5 text-xs font-bold text-cyan-400">{formatHours(linha.horas)}</div>
        </div>
        <div className="rounded-lg bg-slate-800/30 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Pousos</div>
          <div className="mt-0.5 text-xs font-bold text-slate-200">{linha.pousos}</div>
        </div>
        <div className="rounded-lg bg-slate-800/30 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Custo/H</div>
          <div className="mt-0.5 text-xs font-bold text-amber-400">{linha.horas > 0 ? formatBRL(linha.debito / linha.horas) : "—"}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${linha.pctPago > 100 ? "bg-sky-500" : "bg-emerald-500"}`} style={{ width: `${pctVisivel}%` }} />
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500">{quitado ? "100% pago" : `${Math.min(999, Math.round(linha.pctPago))}% do devido já foi pago`}</div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
        <div className="text-xs uppercase tracking-widest text-slate-500">Saldo</div>
        <div className={`text-lg font-bold tabular-nums ${quitado ? "text-emerald-400" : positivo ? "text-sky-400" : "text-amber-400"}`}>
          {quitado ? formatBRL(0) : `${positivo ? "+" : ""}${formatBRL(linha.saldo)}`}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-slate-500 transition-colors group-hover:text-cyan-400">
        {selected ? "Extrato aberto abaixo" : "Ver extrato deste sócio"}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}

function ExtratoCotista({ cotista, cotistas, rateios, despesasPeriodo, rateiosPeriodo, catMap, resolveSocioName, sortBy, sortDir, setSortBy, setSortDir }: any) {
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const linhas = useMemo(() => {
    if (!cotista) return [];
    return rateiosPeriodo
      .filter((r: RateioRow) => findCotistaKey(cotistas, r) === cotista.id)
      .map((r: RateioRow) => {
        const rateado = num(r.valor_rateado);
        const pct = num(r.percentual_uso ?? r.percentual_sociedade);
        const total = num(r.valor_total_despesa);
        const valor = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
        return { r, valor, pct, socioNome: resolveSocioName(r) };
      })
      .sort((a: any, b: any) => {
        let cmp = 0;
        if (sortBy === "data") {
          const da = a.r.data_pagamento || a.r.data_vencimento || a.r.data_emissao || "";
          const db = b.r.data_pagamento || b.r.data_vencimento || b.r.data_emissao || "";
          cmp = da.localeCompare(db);
        } else {
          cmp = norm(a.socioNome).localeCompare(norm(b.socioNome));
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [cotista, rateiosPeriodo, cotistas, sortBy, sortDir, resolveSocioName]);

  const filtrados = useMemo(() => {
    if (!q.trim()) return linhas;
    const n = norm(q);
    return linhas.filter((l: any) => norm([l.r.fornecedor_nome, l.r.descricao_despesa, resolveCategoria(l.r.categoria_custo, catMap), l.r.numero_doc, l.socioNome].join(" ")).includes(n));
  }, [linhas, q, catMap]);

  const totalSaida = filtrados.filter((l: any) => isSaida(l.r.fluxo)).reduce((s: number, l: any) => s + l.valor, 0);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-8 w-1 rounded-full bg-cyan-400" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">Extrato do sócio</div>
            <h2 className="mt-0.5 flex items-center gap-2 text-lg font-bold text-slate-100">
              <ReceiptText className="h-5 w-5" /> {cotista?.nome}
            </h2>
            <div className="mt-1 text-xs text-slate-500">{filtrados.length} lançamento(s) · Total: {formatBRL(totalSaida)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-400">
            <option value="data">Ordenar por Data</option>
            <option value="nome">Ordenar por Nome</option>
          </select>
          <button onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
            {sortDir === "asc" ? "↑ Crescente" : "↓ Decrescente"}
          </button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-48 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400" />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Nenhum lançamento no período.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left">Data</th>
                  <th className="px-3 py-2.5 text-left">Sócio</th>
                  <th className="px-3 py-2.5 text-left">Fornecedor</th>
                  <th className="px-3 py-2.5 text-left">Descrição</th>
                  <th className="px-3 py-2.5 text-left">Categoria</th>
                  <th className="px-3 py-2.5 text-right">% uso</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l: any) => {
                  const isExpanded = expandedId === l.r.id;
                  const status = statusOf(l.r);
                  const catName = resolveCategoria(l.r.categoria_custo, catMap);
                  return <FragmentRow key={l.r.id} linha={l} expanded={isExpanded} onToggle={() => setExpandedId(isExpanded ? null : l.r.id)} status={status} catName={catName} />;
                })}
              </tbody>
              <tfoot className="bg-slate-900/40 text-xs">
                <tr className="border-t border-slate-800">
                  <td colSpan={7} className="px-3 py-2.5 text-right uppercase tracking-widest text-slate-500">Total</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-100">{formatBRL(totalSaida)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function FragmentRow({ linha, expanded, onToggle, status, catName }: any) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-t border-slate-800/60 transition-all ${expanded ? "border-l-2 border-l-cyan-400 bg-cyan-500/[0.06]" : "hover:bg-slate-800/30"}`}>
        <td className="px-3 py-3 text-slate-500"><ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180 text-cyan-400" : ""}`} /></td>
        <td className="px-3 py-3 text-slate-400">{formatDate(linha.r.data_pagamento || linha.r.data_vencimento || linha.r.data_emissao)}</td>
        <td className="px-3 py-3 font-medium text-slate-200">{linha.socioNome}</td>
        <td className="px-3 py-3 text-slate-200">{linha.r.fornecedor_nome || "—"}</td>
        <td className="px-3 py-3 text-slate-400">{linha.r.descricao_despesa || "—"}</td>
        <td className="px-3 py-3 text-slate-400">{catName}</td>
        <td className="px-3 py-3 text-right text-slate-400">{linha.pct > 0 ? `${linha.pct.toFixed(0)}%` : "—"}</td>
        <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-100">{formatBRL(linha.valor)}</td>
      </tr>
      <tr className="border-t-0">
        <td colSpan={8} className="p-0">
          <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <div className="border-b border-slate-800/60 bg-slate-900/20 px-6 py-5">
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <Campo label="Sócio" value={linha.socioNome} />
                  <Campo label="Fornecedor" value={linha.r.fornecedor_nome} />
                  <Campo label="Descrição" value={linha.r.descricao_despesa} />
                  <Campo label="Documento" value={linha.r.numero_doc || linha.r.numero_nf} />
                  <Campo label="Categoria" value={catName} />
                  <Campo label="Forma" value={linha.r.forma_pagamento} />
                  <Campo label="Data" value={formatDate(linha.r.data_pagamento || linha.r.data_vencimento)} />
                  <Campo label="Status" value={<span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone === "success" ? "bg-emerald-500/15 text-emerald-400" : status.tone === "warning" ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>{status.label}</span>} />
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <AnexoCard label="Nota Fiscal" url={linha.r.nf_url} />
                  <AnexoCard label="Recibo" url={linha.r.recibo_url} />
                  <AnexoCard label="Boleto" url={linha.r.boleto_url} />
                </div>
                <div className="mt-4 border-t border-slate-800/40 pt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Observações</div>
                  <p className="text-xs leading-relaxed text-slate-400">{linha.r.observacoes || "Nenhuma observação registrada."}</p>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

function Campo({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums text-slate-200">{value ?? "—"}</div>
    </div>
  );
}

function AnexoCard({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${url ? "border-slate-700 bg-slate-800/40 hover:border-cyan-400/40" : "border-dashed border-slate-800 bg-slate-900/20 opacity-60"}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-md ${url ? "bg-cyan-500/15 text-cyan-400" : "bg-slate-800 text-slate-600"}`}><FileText className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
        <div className="mt-0.5 text-xs font-medium text-slate-300">{url ? "Anexo disponível" : "Não anexado"}</div>
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-cyan-400 hover:underline">Abrir</a>}
    </div>
  );
}

function SimpleBarChart({ data, dataKey, color, formatter }: { data: any[]; dataKey: string; color: string; formatter: (v: number) => string }) {
  const max = Math.max(...data.map((d) => num(d[dataKey])), 1);
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d) => {
        const val = num(d[dataKey]);
        const h = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap bg-slate-800 px-1.5 py-0.5 rounded text-slate-200 z-10">
              {formatter(val)}
            </div>
            <div className="w-full rounded-t transition-all duration-700 ease-out" style={{ height: `${h}%`, background: color, minHeight: val > 0 ? "2px" : "0" }} />
            <span className="text-[9px] text-slate-500">{monthLabel(d.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs truncate text-slate-300">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">{formatBRL(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500 text-right">{pct.toFixed(1)}%</div>
    </div>
  );
}
