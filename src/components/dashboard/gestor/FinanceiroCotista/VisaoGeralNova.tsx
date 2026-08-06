// @ts-nocheck
import { useEffect, useMemo, useState, type ComponentType, Fragment } from "react";
import {
  Wallet, Scale, Gauge, CheckCircle2, ChevronDown,
  Plane, ReceiptText, Layers, FileText, ArrowRight, PlaneLanding,
  TrendingUp, Users, AlertCircle, BarChart3, Calculator, Eye,
} from "lucide-react";
import { formatBRL } from "@/lib/format";

// COMPONENTE MODIFICADO AQUI:
function CircularMetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  percentage,
  colorClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  percentage: number;
  colorClass: string;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setProgress(percentage), 80);
    return () => window.clearTimeout(timer);
  }, [percentage]);

  const radius = 48; // Aumentado de 44 para 48 para afastar a linha do número
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    // Removido o quadrado do fundo (borda, fundo, sombra) e mantido apenas o preenchimento
    <div className="p-4">
      <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} className="fill-none stroke-slate-800" strokeWidth="3" /> {/* Espessura reduzida de 8 para 3 */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`fill-none ${colorClass}`}
            strokeWidth="3" // Espessura reduzida de 8 para 3
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>

        <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-100 shadow-xl shadow-cyan-500/10">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
            {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
// FIM DO COMPONENTE MODIFICADO

import {
  type RateioRow, type VooRow,
  MESES, MESES_SHORT, norm, isSaida, formatDate, num,
  resolveCategoria, statusOf, formatHours, monthLabel,
} from "./balancoTypes";
import { useBalancoAeronave, keyOfParticipante } from "@/hooks/useBalancoAeronave";
import { InformacoesCotistasTab } from "./InformacoesCotistasTab";
import { FechamentoBalancoTab } from "./FechamentoBalancoTab";
import { FechamentoBalancoVisualizador } from "./FechamentoBalancoVisualizador";

const CHART = { primary: "#06b6d4", success: "#10b981", amber: "#f59e0b", danger: "#ef4444", sky: "#38bdf8" };
const CHART_COLORS = ["#06b6d4", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6"];

const ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: Plane },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "diario", label: "Diário de Bordo", icon: PlaneLanding },
  { id: "medias", label: "Médias e Cálculos", icon: Calculator },
  { id: "informacoes", label: "Informações dos Cotistas", icon: Users },
  { id: "fechamento-balanco", label: "Fechamento Balanço", icon: CheckCircle2 },
] as const;
type AbaId = typeof ABAS[number]["id"];

interface BalancoCotistaProps {
  aeronaveId: string;
  clienteId: string;
  matricula?: string;
  modelo?: string;
}

export default function BalancoAeronaveInterno({ aeronaveId, clienteId, matricula, modelo }: BalancoCotistaProps) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, index) => index + 1)
  );
  const [filtroCotista, setFiltroCotista] = useState("todos");
  const [sortBy, setSortBy] = useState<"data" | "nome">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedDiario, setExpandedDiario] = useState<string | null>(null);
  const [expandedEvol, setExpandedEvol] = useState<string | null>(null);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaId>("visao-geral");
  const [showVisualizador, setShowVisualizador] = useState(false);

  useEffect(() => { setFiltroCotista("todos"); }, [aeronaveId, ano, selectedMonths]);

  const {
    loading, custoFixo, custoVariavel, custoTotal, entradasPeriodo,
    horasPeriodo, custoMedioHora, custoMedioHoraTotal, totalPousos,
    cotistas, catMap, participantes, linhasPeriodo, entradasPorCotista,
    monthlyBreakdown, composicaoPeriodo, diarioPorSocio, evolucaoPorSocio,
    composicaoPorSocio, categoriasPorSocio, voosEnriquecidos, rateiosPeriodo, voosPeriodo,
    resolveSocioName, catNameOf,
    diarioMesMap,
    refresh,
  } = useBalancoAeronave({ aeronaveId, ano, selectedMonths });

  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);
  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 1) return `${MESES[selectedMonths[0] - 1]} ${ano}`;
    if (selectedMonths.length === 12) return `Ano ${ano}`;
    const sorted = [...selectedMonths].sort((a, b) => a - b);
    return `${MESES[sorted[0] - 1].slice(0, 3)}–${MESES[sorted[sorted.length - 1] - 1].slice(0, 3)} ${ano}`;
  }, [selectedMonths, ano]);

  const toggleMonth = (m: number) => setSelectedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  const selectAllMonths = () => setSelectedMonths(Array.from({ length: 12 }, (_, i) => i + 1));
  const clearMonths = () => setSelectedMonths([hoje.getMonth() + 1]);
  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const tabCotistas = linhasPeriodo.map((l) =>
      `<tr><td>${l.nome}</td><td style="text-align:right">${formatHours(l.horas)}</td><td style="text-align:right">${l.pousos}</td><td style="text-align:right">${formatBRL(l.debito)}</td><td style="text-align:right">${formatBRL(l.credito)}</td><td style="text-align:right;color:${l.saldo >= 0 ? '#059669' : '#d97706'}">${formatBRL(l.saldo)}</td><td style="text-align:right">${Math.round(l.pctPago)}%</td></tr>`
    ).join("");
    const monthlyRows = monthlyBreakdown.map((m) =>
      `<tr><td>${MESES[m.mes - 1]}</td><td style="text-align:right">${formatBRL(m.custo)}</td><td style="text-align:right">${formatHours(m.horas)}</td><td style="text-align:right">${m.pousos}</td><td style="text-align:right">${m.voos}</td><td style="text-align:right">${m.custoHora > 0 ? formatBRL(m.custoHora) : '—'}</td></tr>`
    ).join("");
    const diarioRows = diarioPorSocio.map((d) =>
      `<tr><td>${d.nome}</td><td style="text-align:right">${d.voos}</td><td style="text-align:right">${formatHours(d.horas)}</td><td style="text-align:right">${d.pousos}</td><td style="text-align:right">${formatHours(d.noturnas)}</td><td style="text-align:right">${formatHours(d.ifr)}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Balanço ${matricula || ""} - ${periodLabel}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}h1{font-size:20px;margin:0 0 4px}.meta{font-size:11px;color:#64748b;margin-bottom:16px}h2{font-size:14px;margin:20px 0 8px;color:#334155}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:9px;text-transform:uppercase}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.summary{display:flex;gap:16px;margin:12px 0;flex-wrap:wrap}.summary div{flex:1;min-width:120px;padding:12px;border:1px solid #e2e8f0;border-radius:8px}.summary .label{font-size:9px;color:#64748b;text-transform:uppercase}.summary .val{font-size:16px;font-weight:bold;margin-top:4px}</style></head><body>
    <h1>Balanço Financeiro — ${matricula || "Aeronave"} ${modelo || ""}</h1>
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

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
        </div>
        <div className="flex-1" />
        <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200">
          {matricula || "Aeronave"}{modelo ? ` — ${modelo}` : ""}
        </span>
        <select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400">
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Month selector */}
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

      {/* Hero — sempre visível, dá contexto independente da aba */}
      <div className="rounded-2xl border border-slate-800 p-6 sm:p-8" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08), transparent 50%, rgba(2,6,23,0.4))" }}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Relatório · {periodLabel}</div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-100">
              Balanço da <span className="text-cyan-400">{matricula || "Aeronave"}</span>
            </h1>
            {modelo && <span className="text-lg text-slate-500">{modelo}</span>}
          </div>
          <div className="flex items-center gap-6 rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-4">
            <StatMini label="Custo total" value={formatBRL(custoTotal)} tone="primary" />
            <div className="h-8 w-px bg-slate-700" />
            <StatMini label="Horas voadas" value={formatHours(horasPeriodo)} />
            <div className="h-8 w-px bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Navegação por abas */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/40 p-1">
        {ABAS.map((t) => {
          const Icon = t.icon;
          const active = aba === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                active ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
            );
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400">Carregando balanço…</div>
      ) : (
        <>
          {aba === "visao-geral" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Plane className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Horas voadas — por mês</span>
                  </div>
                  <SimpleBarChart data={monthlyBreakdown.map(m => ({ key: `${ano}-${String(m.mes).padStart(2,'0')}`, horas: m.horas }))} dataKey="horas" color="#06b6d4" formatter={(v:number) => `${v.toFixed(1)} h`} heightClass="h-40" />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Composição & evolução dos custos</span>
                  </div>
                  <div className="space-y-3">
                    {composicaoPeriodo.slice(0,4).map((c, i) => <CategoryBar key={c.nome} label={c.nome} value={c.total} total={custoTotal} color={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    <div className="mt-3 text-xs text-slate-400">Evolução mensal exibida na aba Gráficos.</div>
                  </div>
                </div>
              </div>

              {/* Ranking aeroportos */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PlaneLanding className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Aeroportos mais visitados</span>
                </div>
                <AirportRanking voos={voosPeriodo} diarioMesMap={diarioMesMap} selectedMonths={selectedMonths} ano={ano} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <CircularMetricCard
                  icon={Wallet}
                  label="Custo Total"
                  value={formatBRL(custoTotal)}
                  percentage={100}
                  colorClass="stroke-cyan-400"
                />
                <CircularMetricCard
                  icon={Layers}
                  label="Custos Fixos"
                  value={formatBRL(custoFixo)}
                  subtitle={custoTotal ? `${((custoFixo / custoTotal) * 100).toFixed(0)}% do total` : undefined}
                  percentage={custoTotal > 0 ? (custoFixo / custoTotal) * 100 : 0}
                  colorClass="stroke-amber-400"
                />
                <CircularMetricCard
                  icon={Gauge}
                  label="Custos Variáveis"
                  value={formatBRL(custoVariavel)}
                  subtitle={custoTotal ? `${((custoVariavel / custoTotal) * 100).toFixed(0)}% do total` : undefined}
                  percentage={custoTotal > 0 ? (custoVariavel / custoTotal) * 100 : 0}
                  colorClass="stroke-fuchsia-400"
                />
              </div>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  <IndexStat label="Horas Voadas" value={formatHours(horasPeriodo)} />
                  <IndexStat label="Custo/H (Var.)" value={horasPeriodo > 0 ? formatBRL(custoMedioHora) : "—"} />
                  <IndexStat label="Custo/H (Total)" value={horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"} />
                </div>
              </div>

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
            </div>
          )}

          
          {aba === "diario" && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-4 flex items-center gap-2">
                <PlaneLanding className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Espelho do Diário de Bordo — {periodLabel}</span>
              </div>
              {diarioPorSocio.length === 0 ? (
                <div className="text-sm text-slate-400 py-4">Nenhum voo no período selecionado.</div>
              ) : (
                <div className="space-y-3">
                  {diarioPorSocio.map((d) => {
                    const dk = `${d.socio_id || d.cliente_id || d.nome}`;
                    const isOpen = expandedDiario === dk;
                    return (
                      <DiarioSocioRow key={dk} d={d} enriquecidos={voosEnriquecidos} isOpen={isOpen} onToggle={() => setExpandedDiario(isOpen ? null : dk)} />
                    );
                  })}
                  <div className="flex items-center justify-between rounded-xl border-t-2 border-cyan-500/20 bg-slate-800/30 px-4 py-3 font-bold">
                    <span className="text-sm text-slate-100">Total Aeronave</span>
                    <div className="flex items-center gap-6 text-sm tabular-nums">
                      <span className="text-slate-100">{diarioPorSocio.reduce((s, d) => s + d.voos, 0)} voos</span>
                      <span className="text-cyan-400">{formatHours(diarioPorSocio.reduce((s, d) => s + d.horas, 0))}</span>
                      <span className="text-slate-100">{diarioPorSocio.reduce((s, d) => s + d.pousos, 0)} pousos</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {aba === "graficos" && (
            <div>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Evolução Individual por Sócio — {ano}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Clique em um sócio para ver horas voadas e pousos mês a mês.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {evolucaoPorSocio.map((s) => {
                  const isOpen = expandedEvol === s.id;
                  const totalHoras = s.serie.reduce((acc, p) => acc + p.horas, 0);
                  const totalPousosS = s.serie.reduce((acc, p) => acc + p.pousos, 0);
                  const totalVoos = s.serie.reduce((acc, p) => acc + p.voos, 0);
                  return (
                    <SocioEvolutionCard key={s.id} nome={s.nome} serie={s.serie} totalHoras={totalHoras} totalPousos={totalPousosS} totalVoos={totalVoos} isOpen={isOpen} onToggle={() => setExpandedEvol(isOpen ? null : s.id)} />
                  );
                })}
                {evolucaoPorSocio.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                    Nenhum voo registrado no ano.
                  </div>
                )}
              </div>
            </div>
          )}

          {aba === "graficos" && (
            <div className="space-y-8">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Composição de Custos — {periodLabel}</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4">Aeronave — {formatBRL(custoTotal)}</h3>
                  <div className="space-y-4">
                    <CategoryBar label="Custos fixos" value={custoFixo} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.amber} />
                    <CategoryBar label="Custos variáveis" value={custoVariavel} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.danger} />
                    <CategoryBar label="Entradas" value={entradasPeriodo} total={custoFixo + custoVariavel + entradasPeriodo} color={CHART.success} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {composicaoPorSocio.map((c) => {
                    const isOpen = expandedComp === c.id;
                    return <SocioComposicaoCard key={c.id} nome={c.nome} fixo={c.fixo} variavel={c.variavel} extra={c.extra} entradas={c.entradas} total={c.total} isOpen={isOpen} onToggle={() => setExpandedComp(isOpen ? null : c.id)} />;
                  })}
                  {composicaoPorSocio.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">Nenhum sócio com movimentação no período selecionado.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Custos por Categoria — {periodLabel}</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4">Aeronave — {formatBRL(custoTotal)}</h3>
                  {composicaoPeriodo.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sem despesas no período.</div>
                  ) : (
                    <div className="space-y-3">
                      {composicaoPeriodo.map((c, i) => (
                        <CategoryBar key={c.nome} label={c.nome} value={c.total} total={custoTotal} color={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {categoriasPorSocio.map((c) => {
                    const isOpen = expandedCat === c.id;
                    return <SocioCategoriaCard key={c.id} nome={c.nome} categorias={c.categorias} totalDespesas={c.categorias.reduce((s: number, x: any) => s + x.total, 0)} isOpen={isOpen} onToggle={() => setExpandedCat(isOpen ? null : c.id)} />;
                  })}
                  {categoriasPorSocio.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">Nenhum sócio com movimentação no período selecionado.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {aba === "medias" && (() => {
            const numMeses = selectedMonths.length || 1;
            const numVoos = voosPeriodo.length;
            const numCotistas = participantes.length || 1;
            const custoPorVoo = numVoos > 0 ? custoTotal / numVoos : 0;
            const custoPorPouso = totalPousos > 0 ? custoTotal / totalPousos : 0;
            const mediaMensalCusto = custoTotal / numMeses;
            const mediaMensalHoras = horasPeriodo / numMeses;
            const mediaMensalVoos = numVoos / numMeses;
            const mediaHorasCotista = horasPeriodo / numCotistas;
            const mediaCustoCotista = custoTotal / numCotistas;
            const mediaPousosCotista = totalPousos / numCotistas;
            const pctFixo = custoTotal > 0 ? (custoFixo / custoTotal) * 100 : 0;
            const pctVariavel = custoTotal > 0 ? (custoVariavel / custoTotal) * 100 : 0;
            const coberturaEntradas = custoTotal > 0 ? (entradasPeriodo / custoTotal) * 100 : 0;

            const calcRows = [
              { label: "Custo / Hora (Total)", value: horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—", icon: <Gauge className="h-4 w-4" />, tone: "primary" as const },
              { label: "Custo / Hora (Variável)", value: horasPeriodo > 0 ? formatBRL(custoMedioHora) : "—", icon: <Gauge className="h-4 w-4" /> },
              { label: "Custo / Voo", value: numVoos > 0 ? formatBRL(custoPorVoo) : "—", icon: <Plane className="h-4 w-4" /> },
              { label: "Custo / Pouso", value: totalPousos > 0 ? formatBRL(custoPorPouso) : "—", icon: <PlaneLanding className="h-4 w-4" /> },
              { label: "Média Mensal de Custo", value: formatBRL(mediaMensalCusto), icon: <Wallet className="h-4 w-4" /> },
              { label: "Média Mensal de Horas", value: formatHours(mediaMensalHoras), icon: <TrendingUp className="h-4 w-4" /> },
              { label: "Média Mensal de Voos", value: mediaMensalVoos.toFixed(1), icon: <Plane className="h-4 w-4" /> },
              { label: "Horas Médias / Cotista", value: formatHours(mediaHorasCotista), icon: <Users className="h-4 w-4" /> },
              { label: "Custo Médio / Cotista", value: formatBRL(mediaCustoCotista), icon: <Scale className="h-4 w-4" /> },
              { label: "Pousos Médios / Cotista", value: mediaPousosCotista.toFixed(1), icon: <PlaneLanding className="h-4 w-4" /> },
            ];

            const compRows = [
              { label: "Custos Fixos", value: formatBRL(custoFixo), pct: pctFixo, color: CHART.amber },
              { label: "Custos Variáveis", value: formatBRL(custoVariavel), pct: pctVariavel, color: CHART.danger },
              { label: "Entradas / Créditos", value: formatBRL(entradasPeriodo), pct: coberturaEntradas, color: CHART.success },
            ];

            return (
              <div className="space-y-6">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Médias e Cálculos — {periodLabel}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {calcRows.map((r) => (
                      <div key={r.label} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                          <span className={r.tone === "primary" ? "text-cyan-400" : "text-slate-500"}>{r.icon}</span>
                          {r.label}
                        </div>
                        <div className={`mt-2 text-lg font-bold tabular-nums ${r.tone === "primary" ? "text-cyan-400" : "text-slate-100"}`}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Composição Percentual</span>
                  </div>
                  <div className="space-y-4">
                    {compRows.map((r) => (
                      <div key={r.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-300">{r.label}</span>
                          <span className="text-xs tabular-nums text-slate-400">{r.value} · {r.pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, r.pct)}%`, background: r.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {monthlyBreakdown.length > 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Média de Custo/Hora por Mês</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5 text-left">Mês</th>
                            <th className="px-3 py-2.5 text-right">Custo</th>
                            <th className="px-3 py-2.5 text-right">Horas</th>
                            <th className="px-3 py-2.5 text-right">Voos</th>
                            <th className="px-3 py-2.5 text-right">Custo/Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyBreakdown.map((m) => (
                            <tr key={m.mes} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                              <td className="px-3 py-2.5 font-medium text-slate-200">{MESES[m.mes - 1]}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatBRL(m.custo)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{formatHours(m.horas)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{m.voos}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400 font-medium">{m.custoHora > 0 ? formatBRL(m.custoHora) : "—"}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                            <td className="px-3 py-2.5 text-slate-100">Média</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{formatBRL(mediaMensalCusto)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatHours(mediaMensalHoras)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{mediaMensalVoos.toFixed(1)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {linhasPeriodo.length > 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Médias por Cotista</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5 text-left">Cotista</th>
                            <th className="px-3 py-2.5 text-right">Horas</th>
                            <th className="px-3 py-2.5 text-right">Pousos</th>
                            <th className="px-3 py-2.5 text-right">Débito</th>
                            <th className="px-3 py-2.5 text-right">Custo/Hora</th>
                            <th className="px-3 py-2.5 text-right">% do Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasPeriodo.map((l) => {
                            const pctTotal = custoTotal > 0 ? (l.debito / custoTotal) * 100 : 0;
                            return (
                              <tr key={l.id} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                                <td className="px-3 py-2.5 font-medium text-slate-200">{l.nome}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400">{formatHours(l.horas)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{l.pousos}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatBRL(l.debito)}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-amber-400">{l.horas > 0 ? formatBRL(l.debito / l.horas) : "—"}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{pctTotal.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {aba === "informacoes" && (
            <InformacoesCotistasTab
              aeronaveId={aeronaveId}
              matricula={matricula}
              ano={ano}
              cotistas={participantes.map((p) => ({ id: p.id, nome: p.nome, percentual: p.percentual }))}
            />
          )}

          {aba === "fechamento-balanco" && (
            <FechamentoBalancoTab
              rateios={rateiosPeriodo}
              cotistas={cotistas}
              aeronaveId={aeronaveId}
              matricula={matricula}
              ano={ano}
              selectedMonths={selectedMonths}
              catMap={catMap}
              onRefresh={refresh}
              onVerNaTela={() => setShowVisualizador(true)}
              onExportPDF={exportPDF}
            />
          )}
        </>
      )}

      {/* Visualizador de Fechamento de Balanço — somente sob demanda */}
      {showVisualizador && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 print:static print:overflow-visible">
          <FechamentoBalancoVisualizador
            aeronaveId={aeronaveId}
            ano={ano}
            meses={selectedMonths}
            onClose={() => setShowVisualizador(false)}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponentes (inalterados na aparência, só realocados) ─── */

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

function SimpleBarChart({ data, dataKey, color, formatter, heightClass = "h-24" }: { data: any[]; dataKey: string; color: string; formatter: (v: number) => string; heightClass?: string }) {
  const max = Math.max(...data.map((d) => num(d[dataKey])), 1);
  return (
    <div className={`flex items-end gap-1 ${heightClass}`}>
      {data.map((d) => {
        const val = num(d[dataKey]);
        const h = val > 0 ? Math.max((val / max) * 100, 10) : 0;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
            <div className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 whitespace-nowrap bg-slate-800 px-1.5 py-0.5 rounded text-slate-200 z-10">
              {formatter(val)}
            </div>
            <div className="w-full rounded-t transition-all duration-700 ease-out" style={{ height: `${h}%`, background: color, minHeight: val > 0 ? "3px" : "0" }} />
            <span className="text-[8px] text-slate-500">{monthLabel(d.key)}</span>
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

function DiarioSocioRow({ d, enriquecidos, isOpen, onToggle }: any) {
  const [expandedVoo, setExpandedVoo] = useState<string | null>(null);
  return (
    <div className={`rounded-xl border transition-all ${isOpen ? "border-cyan-400/40 bg-cyan-500/[0.04]" : "border-slate-800 bg-slate-900/30"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} />
          <span className="truncate text-sm font-medium text-slate-200">{d.nome}</span>
        </div>
        <div className="flex items-center gap-5 text-sm tabular-nums shrink-0">
          <span className="text-slate-300">{d.voos} voos</span>
          <span className="text-cyan-400 font-medium">{formatHours(d.horas)}</span>
          <span className="text-slate-300">{d.pousos} pousos</span>
        </div>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 space-y-2">
            {d.voosList.map((v: VooRow) => {
              const e = enriquecidos.get(v.id);
              const isVooOpen = expandedVoo === v.id;
              const trecho = v.trecho || `${v.aerodromo_partida || "—"} → ${v.aerodromo_chegada || "—"}`;
              return (
                <div key={v.id} className={`rounded-lg border transition-colors ${isVooOpen ? "border-slate-600 bg-slate-800/40" : "border-slate-800/60 bg-slate-900/30"}`}>
                  <button onClick={() => setExpandedVoo(isVooOpen ? null : v.id)} className="grid w-full items-center gap-2 px-3 py-2.5 text-left" style={{ gridTemplateColumns: "auto 1fr auto auto auto auto auto auto" }}>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${isVooOpen ? "rotate-180 text-slate-400" : ""}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{trecho}</div>
                      <div className="text-[10px] text-slate-500">{formatDate(v.data_registro)}</div>
                    </div>
                    <div className="hidden md:block text-right">
                      <div className="text-[10px] text-slate-500">PIC</div>
                      <div className="text-xs text-slate-300 whitespace-nowrap">{e?.picName ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">H VOO</div>
                      <div className="text-xs text-cyan-400 tabular-nums">{formatHours(e?.horas ?? (num(v.tempo_total) || num(v.tempo_voo)))}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Pousos</div>
                      <div className="text-xs text-slate-300 tabular-nums">{e?.pousos ?? num(v.pousos_total)}</div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <div className="text-[10px] text-slate-500">Dist. NM</div>
                      <div className="text-xs text-slate-300 tabular-nums">{e && e.distanciaNm > 0 ? e.distanciaNm.toFixed(0) : "—"}</div>
                    </div>
                    <div className="hidden sm:block text-right" title="Consumo médio de combustível durante o voo (litros por hora)">
                      <div className="text-[10px] text-slate-500">Consumo</div>
                      <div className="text-xs text-amber-400/80 tabular-nums">{e && e.consumoMedio > 0 ? `${e.consumoMedio.toFixed(1)} L/h` : "—"}</div>
                    </div>
                    <div className="text-right" title="Soma de combustível, tarifas (DECEA/ANAC/Pouso), hangar e relatório de viagem (TER) alocados a este voo">
                      <div className="text-[10px] text-slate-500 flex items-center justify-end gap-0.5">Custo Total</div>
                      <div className="text-xs text-cyan-300 tabular-nums font-semibold">{e && e.totalCost > 0 ? formatBRL(e.totalCost) : "—"}</div>
                    </div>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: isVooOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      {e && (
                        <div className="border-t border-slate-800/60 px-3 py-3 space-y-3">
                          <p className="text-[11px] text-slate-500">
                            O <span className="text-slate-300 font-medium">Custo Total</span> deste voo é a soma dos itens abaixo (combustível, tarifas de navegação/pouso, hangar rateado no mês e relatório de viagem, quando aplicável):
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {e.terNumero ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                                <FileText className="h-3 w-3" />
                                {e.terNumero}
                                <span className={`ml-1 ${e.terPago ? "text-emerald-400" : "text-amber-400"}`}>{e.terPago ? "Pago" : "Pendente"}</span>
                              </span>
                            ) : null}
                            <ExpenseBadge label="DECEA" active={e.hasDecea} paid={e.allPaid} />
                            <ExpenseBadge label="ANAC" active={e.hasAnac} paid={e.allPaid} />
                            <ExpenseBadge label="Pouso" active={e.hasPouso} paid={e.allPaid} />
                            <ExpenseBadge label="Hangar" active={e.hasHangar} paid={e.allPaid} />
                            <ExpenseBadge label="Abastecimento" active={e.hasAbastecimento} paid={!e.hasAbastecimento || e.allPaid} />
                          </div>
                          {e.despesasItems.length > 0 && (
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {e.despesasItems.map((di: any, i: number) => (
                                <div key={i} className="flex items-center justify-between rounded bg-slate-800/40 px-2.5 py-1.5 text-[11px]">
                                  <span className="flex items-center gap-1.5 text-slate-300 truncate">
                                    {di.pago ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" /> : <AlertCircle className="h-3 w-3 shrink-0 text-amber-400" />}
                                    <span className="truncate">{di.label}</span>
                                  </span>
                                  <span className="ml-2 shrink-0 tabular-nums text-slate-300 font-medium">{formatBRL(di.valor)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {e.despesasItems.length === 0 && <p className="text-[11px] text-slate-600 italic">Nenhuma despesa direta encontrada para este voo.</p>}
                          <div className="flex items-center justify-between border-t border-slate-800/40 pt-2">
                            <span className="text-[11px] text-slate-500">{e.consumoMedio > 0 ? `Consumo médio: ${e.consumoMedio.toFixed(1)} L/h` : "Consumo médio não disponível"}</span>
                            <span className="text-[11px] font-semibold text-cyan-300">Total: {formatBRL(e.totalCost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpenseBadge({ label, active, paid }: { label: string; active: boolean; paid: boolean }) {
  if (!active) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${paid ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
      {paid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function SocioEvolutionCard({ nome, serie, totalHoras, totalPousos, totalVoos, isOpen, onToggle }: any) {
  return (
    <div className={`rounded-2xl border bg-slate-900/40 p-5 transition-all duration-300 hover:border-cyan-400/30 ${isOpen ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : "border-slate-800"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-sm font-semibold text-slate-100">{nome}</span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} />
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-800/40 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Voos</div>
          <div className="mt-0.5 text-sm font-bold text-slate-200">{totalVoos}</div>
        </div>
        <div className="rounded-lg bg-slate-800/40 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Horas</div>
          <div className="mt-0.5 text-sm font-bold text-cyan-400">{formatHours(totalHoras)}</div>
        </div>
        <div className="rounded-lg bg-slate-800/40 p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Pousos</div>
          <div className="mt-0.5 text-sm font-bold text-slate-200">{totalPousos}</div>
        </div>
      </div>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Horas / mês</div>
              <SimpleBarChart data={serie} dataKey="horas" color={CHART.success} formatter={(v: number) => `${v.toFixed(1)} h`} heightClass="h-20" />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">Pousos / mês</div>
              <SimpleBarChart data={serie} dataKey="pousos" color={CHART.sky} formatter={(v: number) => `${v} pousos`} heightClass="h-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SocioComposicaoCard({ nome, fixo, variavel, extra, entradas, total, isOpen, onToggle }: any) {
  const totalBar = Math.max(total + entradas, 0.01);
  return (
    <div className={`rounded-2xl border bg-slate-900/40 p-5 transition-all duration-300 hover:border-cyan-400/30 ${isOpen ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : "border-slate-800"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-sm font-semibold text-slate-100">{nome}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold tabular-nums text-cyan-400">{formatBRL(total)}</span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} />
        </div>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="pt-4 space-y-3">
            <CategoryBar label="Custos fixos" value={fixo} total={totalBar} color={CHART.amber} />
            <CategoryBar label="Custos variáveis" value={variavel} total={totalBar} color={CHART.danger} />
            {extra > 0 && <CategoryBar label="Custos extras" value={extra} total={totalBar} color={CHART.primary} />}
            <CategoryBar label="Entradas / créditos" value={entradas} total={totalBar} color={CHART.success} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SocioCategoriaCard({ nome, categorias, totalDespesas, isOpen, onToggle }: any) {
  return (
    <div className={`rounded-2xl border bg-slate-900/40 p-5 transition-all duration-300 hover:border-cyan-400/30 ${isOpen ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : "border-slate-800"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-sm font-semibold text-slate-100">{nome}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold tabular-nums text-cyan-400">{formatBRL(totalDespesas)}</span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-cyan-400" : ""}`} />
        </div>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="pt-4">
            {categorias.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">Sem despesas no período.</div>
            ) : (
              <div className="space-y-3">
                {categorias.map((c: any, i: number) => (
                  <CategoryBar key={c.nome} label={c.nome} value={c.total} total={totalDespesas} color={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AirportRanking({ voos, diarioMesMap, selectedMonths, ano }: { voos: VooRow[]; diarioMesMap: Map<string, string | null> | Record<string, any>; selectedMonths: number[]; ano: number }) {
  const map = new Map<string, { code: string; count: number; lastVisit: string | null; hours: number; pousos: number }>();
  voos.forEach((v) => {
    const dest = (v.aerodromo_chegada || "").trim();
    if (!dest) return;
    const monthKey = v.data_registro ? v.data_registro.slice(0, 7) : null;
    const base = monthKey && (diarioMesMap instanceof Map ? diarioMesMap.get(monthKey) : diarioMesMap[monthKey]);
    if (base && base === dest) return; // exclude base
    const cur = map.get(dest) || { code: dest, count: 0, lastVisit: null, hours: 0, pousos: 0 };
    cur.count += 1;
    const dt = v.data_registro ? new Date(v.data_registro + (v.data_registro.length <= 10 ? 'T00:00:00' : '')) : null;
    if (dt) {
      if (!cur.lastVisit) cur.lastVisit = v.data_registro;
      else if (new Date(cur.lastVisit) < dt) cur.lastVisit = v.data_registro;
    }
    cur.hours += num(v.tempo_total) || num(v.tempo_voo);
    cur.pousos += num(v.pousos_total);
    map.set(dest, cur);
  });
  const arr = Array.from(map.values()).sort((a, b) => b.count - a.count);
  if (arr.length === 0) return <div className="text-sm text-slate-400">Nenhum destino encontrado no período.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2.5 text-left">Aeroporto</th>
            <th className="px-3 py-2.5 text-left">ICAO</th>
            <th className="px-3 py-2.5 text-right">Frequência</th>
            <th className="px-3 py-2.5 text-right">Última Visita</th>
            <th className="px-3 py-2.5 text-right">Total Horas</th>
            <th className="px-3 py-2.5 text-right">Pousos</th>
          </tr>
        </thead>
        <tbody>
          {arr.slice(0, 10).map((r) => (
            <tr key={r.code} className="border-t border-slate-800/60 hover:bg-slate-800/20">
              <td className="px-3 py-2.5 font-medium text-slate-200">{r.code}</td>
              <td className="px-3 py-2.5 text-slate-300">{r.code}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{r.count}x</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{r.lastVisit ? formatDate(r.lastVisit) : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-cyan-400 font-medium">{formatHours(r.hours)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{r.pousos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}