import { useEffect, useMemo, useState } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Scale, Gauge, HandCoins, CheckCircle2, ChevronDown,
  Plane, ReceiptText, Layers, FileText, ArrowRight, PlaneLanding,
  TrendingUp, Users, AlertCircle, BarChart3, Calculator,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  type RateioRow, type VooRow,
  MESES, MESES_SHORT, norm, isSaida, formatDate, num,
  resolveCategoria, statusOf, formatHours, monthLabel,
} from "./balancoTypes";
import { useBalancoAeronave, keyOfParticipante } from "@/hooks/useBalancoAeronave";

const CHART = { primary: "#06b6d4", success: "#10b981", amber: "#f59e0b", danger: "#ef4444", sky: "#38bdf8" };
const CHART_COLORS = ["#06b6d4", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6"];

const ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: Plane },
  { id: "cotistas", label: "Cotistas / Sócios", icon: Users },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "diario", label: "Diário de Bordo", icon: PlaneLanding },
  { id: "medias", label: "Médias e Cálculos", icon: Calculator },
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
  const [showEntradas, setShowEntradas] = useState(false);
  const [sortBy, setSortBy] = useState<"data" | "nome">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedDiario, setExpandedDiario] = useState<string | null>(null);
  const [expandedEvol, setExpandedEvol] = useState<string | null>(null);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaId>("visao-geral");

  useEffect(() => { setFiltroCotista("todos"); setShowEntradas(false); }, [aeronaveId, ano, selectedMonths]);

  const {
    loading, custoFixo, custoVariavel, custoTotal, entradasPeriodo,
    horasPeriodo, custoMedioHora, custoMedioHoraTotal, totalPousos,
    participantes, linhasPeriodo, entradasPorCotista,
    monthlyBreakdown, composicaoPeriodo, diarioPorSocio, evolucaoPorSocio,
    composicaoPorSocio, categoriasPorSocio, voosEnriquecidos, rateiosPeriodo, voosPeriodo,
    resolveSocioName, catNameOf,
  } = useBalancoAeronave({ aeronaveId, ano, selectedMonths, participanteFiltro: { cliente_id: clienteId } });

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
          <Scale className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-bold text-slate-100">Balanço Cotista</span>
        </div>
        <div className="flex-1" />
        <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200">
          {matricula || "Aeronave"}{modelo ? ` — ${modelo}` : ""}
        </span>
        <select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400">
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
          <FileText className="h-3.5 w-3.5" /> Exportar PDF
        </button>
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
            <StatMini label="Custo/h total" value={horasPeriodo > 0 ? formatBRL(custoMedioHoraTotal) : "—"} />
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
                <MetricCard icon={<Wallet className="h-4 w-4" />} label="Custo total" value={formatBRL(custoTotal)} tone="primary" />
                <MetricCard icon={<Layers className="h-4 w-4" />} label="Custos fixos" value={formatBRL(custoFixo)} sub={custoTotal ? `${((custoFixo / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
                <MetricCard icon={<Gauge className="h-4 w-4" />} label="Custos variáveis" value={formatBRL(custoVariavel)} sub={custoTotal ? `${((custoVariavel / custoTotal) * 100).toFixed(0)}% do total` : undefined} />
                <MetricCard icon={<HandCoins className="h-4 w-4" />} label="Entradas / créditos" value={formatBRL(entradasPeriodo)} tone="success" onClick={() => setShowEntradas((v) => !v)} expanded={showEntradas} hint="Ver por cotista" />
              </div>

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

          {aba === "cotistas" && (
            <div className="space-y-6">
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
                      Nenhum sócio com movimentação no período selecionado.
                    </div>
                  )}
                </div>
              </div>

              {filtroCotista !== "todos" && (
                <ExtratoCotista
                  cotista={participantes.find((c) => c.id === filtroCotista)}
                  rateiosPeriodo={rateiosPeriodo}
                  catMap={new Map()}
                  resolveSocioName={resolveSocioName}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  setSortBy={setSortBy}
                  setSortDir={setSortDir}
                  catNameOf={catNameOf}
                />
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
        </>
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

function ExtratoCotista({ cotista, rateiosPeriodo, resolveSocioName, sortBy, sortDir, setSortBy, setSortDir, catNameOf }: any) {
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const linhas = useMemo(() => {
    if (!cotista) return [];
    return rateiosPeriodo
      .filter((r: RateioRow) => keyOfParticipante(r.socio_id || null, r.cliente_id || null, resolveSocioName(r)) === cotista.id)
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
  }, [cotista, rateiosPeriodo, sortBy, sortDir, resolveSocioName]);

  const filtrados = useMemo(() => {
    if (!q.trim()) return linhas;
    const n = norm(q);
    return linhas.filter((l: any) => norm([l.r.fornecedor_nome, l.r.descricao_despesa, catNameOf(l.r), l.r.numero_doc, l.socioNome].join(" ")).includes(n));
  }, [linhas, q, catNameOf]);

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
                  const catName = catNameOf(l.r);
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

export function SimpleBarChart({ data, dataKey, color, formatter, heightClass = "h-24" }: { data: any[]; dataKey: string; color: string; formatter: (v: number) => string; heightClass?: string }) {
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

export function CategoryBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
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

export function DiarioSocioRow({ d, enriquecidos, isOpen, onToggle }: any) {
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
          <span className="text-violet-400 hidden sm:inline">{formatHours(d.noturnas)} not.</span>
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
