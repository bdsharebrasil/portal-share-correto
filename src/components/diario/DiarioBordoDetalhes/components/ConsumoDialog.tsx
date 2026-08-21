import { useMemo } from "react";
import { motion } from "framer-motion";
import { X, Droplets, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { num } from "@/lib/formatters";
import { decimalToHHMM, sumDecimal } from "@/lib/time";

// ─── Tipos locais ────────────────────────────────────────────────────────────

type Lanc = {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  tempo_voo: number | string | null;
  tempo_total: number | string | null;
  litros_combustivel_inicio_voo: number | string | null;
  combustivel_adicionado: number | string | null;
  consumo_combustivel_voo: number | string | null;   // já em L/H, calculado por trigger no banco
  consumo_combustivel_total: number | string | null;  // já em L/H, calculado por trigger no banco
  natureza_voo: string | null;
  clientes_id: string | null;
  socios_id: string | null;
  socios_nome: string | null;
  trecho: string | null;
};

type Cliente = { id: string; razao_social: string | null; proprietario: string | null };
type Socio = { id: string; nome: string; clientes_id: string };
type Aeronave = { matricula: string; modelo: string; consumo_combustivel: number | null };

type MesAnual = {
  mes: number;
  nomeMes: string;
  tVoo: number;
  tTotal: number;
  abast: number;
  lhVoo: number;
  lhTotal: number;
  voosComDado: number;
  voosTotal: number;
};

type ClienteConsumo = {
  label: string;
  tVoo: number;
  tTotal: number;
  abast: number;
  lhVoo: number;
  lhTotal: number;
  voos: number;
  voosComDado: number;
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ConsumoDialogProps {
  aeronave: Aeronave;
  /** Lançamentos do mês atual (já carregados pelo pai) */
  lancamentos: Lanc[];
  /** Todos os lançamentos do ano (para tabela anual) — passe [] se não quiser a tabela */
  lancamentosAno: Lanc[];
  clientes: Cliente[];
  socios: Socio[];
  mes: number;
  ano: number;
  labelVooPara: (l: Lanc) => string;
  onClose: () => void;
  /** Se true, renderiza como painel inline sem modal */
  inline?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Média de L/H ponderada pelas horas de cada voo.
 *
 * IMPORTANTE: `consumo_combustivel_voo` / `consumo_combustivel_total` já vêm
 * calculados pelo banco (função `calcular_consumo_combustivel`), comparando o
 * nível real de combustível no tanque entre voos consecutivos — é a medição
 * mais confiável que existe, pois não depende de "quando" o abastecimento
 * caiu dentro do período analisado.
 *
 * Por isso, NUNCA recalculamos consumo a partir de `combustivel_adicionado ÷
 * horas do período` — esse método distorce o resultado sempre que há voos no
 * período sem abastecimento registrado nele (a aeronave voou com combustível
 * de um abastecimento anterior, fora da janela). Em vez disso, agregamos a
 * taxa L/H que já veio pronta de cada linha, ponderando pelas horas do
 * próprio voo.
 *
 * Voos sem consumo calculado (tipicamente o lançamento mais recente da
 * aeronave, que ainda não tem um "próximo" voo para comparação) são
 * simplesmente ignorados na média — não têm dado, não entram na conta.
 */
function mediaLHPonderada(
  linhas: Lanc[],
  campoConsumo: "consumo_combustivel_voo" | "consumo_combustivel_total",
  campoTempo: "tempo_voo" | "tempo_total"
): { lh: number; voosComDado: number } {
  let litros = 0;
  let horas = 0;
  let voosComDado = 0;

  for (const l of linhas) {
    const taxa = Number(l[campoConsumo] ?? 0);
    const tempo = Number(l[campoTempo] ?? 0);
    if (taxa > 0 && tempo > 0) {
      litros += taxa * tempo;
      horas += tempo;
      voosComDado += 1;
    }
  }

  return { lh: horas > 0 ? litros / horas : 0, voosComDado };
}

/** Variação % em relação ao histórico */
function diffPct(val: number, ref: number): number {
  if (ref <= 0) return 0;
  return ((val - ref) / ref) * 100;
}

/** Classe de cor baseada na variação */
function colorClass(val: number, ref: number): "green" | "amber" | "red" | "neutral" {
  if (val <= 0 || ref <= 0) return "neutral";
  const d = diffPct(val, ref);
  if (d > 8) return "red";
  if (d > 3) return "amber";
  if (d < -5) return "green";
  return "neutral";
}

const COLOR_MAP = {
  green: { text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400", icon: TrendingDown },
  amber: { text: "text-amber-400",   badge: "bg-amber-500/15 text-amber-400",   icon: TrendingUp },
  red:   { text: "text-red-400",     badge: "bg-red-500/15 text-red-400",       icon: TrendingUp },
  neutral:{ text: "text-muted-foreground",  badge: "bg-secondary/50 text-muted-foreground",   icon: Minus },
};

const SERIE_COLORS = [
  "#378ADD", "#3B9A6D", "#BA7517", "#A32D2D",
  "#534AB7", "#0F6E56", "#993C1D", "#993556",
];

// ─── Componentes internos ────────────────────────────────────────────────────

function DiffBadge({ val, ref }: { val: number; ref: number }) {
  const cls = colorClass(val, ref);
  const { badge, icon: Icon } = COLOR_MAP[cls];
  const d = diffPct(val, ref);
  if (val <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  const label = Math.abs(d) < 1 ? "≈ hist." : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function LHCell({ val, ref }: { val: number; ref: number }) {
  const cls = colorClass(val, ref);
  if (val <= 0) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  return (
    <span className={`font-mono text-sm font-semibold ${COLOR_MAP[cls].text}`}>
      {val.toFixed(1)}
    </span>
  );
}

function CoberturaBadge({ comDado, total }: { comDado: number; total: number }) {
  if (total === 0) return null;
  if (comDado === total) return null; // cobertura completa, não precisa avisar
  return (
    <span
      className="inline-flex items-center rounded-full bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground"
      title="Alguns voos ainda não têm consumo calculado (geralmente o lançamento mais recente da aeronave, que aguarda o próximo voo para comparação de tanque)."
    >
      {comDado}/{total} voos com dado
    </span>
  );
}

// Gráfico de linha simples em SVG (sem dependência externa)
function LineChart({
  data,
  historico,
}: {
  data: { label: string; lhVoo: number; lhTotal: number }[];
  historico: number;
}) {
  const W = 620, H = 160, PL = 48, PR = 16, PT = 10, PB = 30;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  const allVals = data.flatMap(d => [d.lhVoo, d.lhTotal]).filter(v => v > 0);
  if (allVals.length === 0) return null;

  const minV = Math.max(0, Math.min(...allVals, historico) - 15);
  const maxV = Math.max(...allVals, historico) + 15;

  const xScale = (i: number) => PL + (i / (data.length - 1 || 1)) * iW;
  const yScale = (v: number) => PT + iH - ((v - minV) / (maxV - minV)) * iH;

  const pathVoo = data
    .filter(d => d.lhVoo > 0)
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(data.indexOf(d))} ${yScale(d.lhVoo)}`)
    .join(" ");

  const pathTotal = data
    .filter(d => d.lhTotal > 0)
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(data.indexOf(d))} ${yScale(d.lhTotal)}`)
    .join(" ");

  const yHist = yScale(historico);
  const yTicks = [minV, (minV + maxV) / 2, maxV].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* grid */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PL} y1={yScale(v)} x2={W - PR} y2={yScale(v)} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
          <text x={PL - 4} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.6)">{v}</text>
        </g>
      ))}

      {/* linha histórico */}
      <line x1={PL} y1={yHist} x2={W - PR} y2={yHist} stroke="rgba(148,163,184,0.4)" strokeWidth="1.5" strokeDasharray="5,4" />
      <text x={W - PR + 2} y={yHist + 4} fontSize="10" fill="rgba(148,163,184,0.6)">hist.</text>

      {/* linha T. total */}
      {pathTotal && (
        <path d={pathTotal} fill="none" stroke="#EF9F27" strokeWidth="2" strokeDasharray="6,3" opacity="0.8" />
      )}

      {/* linha T. voo */}
      {pathVoo && (
        <path d={pathVoo} fill="none" stroke="#378ADD" strokeWidth="2.5" />
      )}

      {/* pontos T. voo */}
      {data.map((d, i) => d.lhVoo > 0 && (
        <circle key={i} cx={xScale(i)} cy={yScale(d.lhVoo)} r="4" fill="#378ADD" />
      ))}

      {/* labels eixo x */}
      {data.map((d, i) => (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="11" fill="rgba(148,163,184,0.7)">{d.label}</text>
      ))}
    </svg>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ConsumoDialog({
  aeronave,
  lancamentos,
  lancamentosAno,
  clientes: _clientes,
  socios: _socios,
  mes,
  ano,
  labelVooPara,
  onClose,
  inline = false,
}: ConsumoDialogProps) {
  const historico = aeronave.consumo_combustivel ?? 0;

  // ── Totais do mês ──
  // L/H calculado como média ponderada das taxas por voo (já vindas do banco),
  // NÃO como "combustível adicionado no mês ÷ horas do mês" — ver mediaLHPonderada().
  const mesTotals = useMemo(() => {
    const tVoo   = sumDecimal(lancamentos.map(l => l.tempo_voo));
    const tTotal = sumDecimal(lancamentos.map(l => l.tempo_total));
    const abast  = sumDecimal(lancamentos.map(l => l.combustivel_adicionado));

    const { lh: lhVoo, voosComDado: comDadoVoo } = mediaLHPonderada(lancamentos, "consumo_combustivel_voo", "tempo_voo");
    const { lh: lhTotal, voosComDado: comDadoTotal } = mediaLHPonderada(lancamentos, "consumo_combustivel_total", "tempo_total");

    return {
      tVoo,
      tTotal,
      abast,
      lhVoo,
      lhTotal,
      voosComDado: Math.min(comDadoVoo, comDadoTotal),
      voosTotal: lancamentos.length,
    };
  }, [lancamentos]);

  // ── Tabela anual (agrupa por mês) ──
  const anuais = useMemo<MesAnual[]>(() => {
    const map = new Map<number, Lanc[]>();

    for (const l of lancamentosAno) {
      const m = new Date(l.data_registro + "T00:00").getMonth() + 1;
      const cur = map.get(m) ?? [];
      cur.push(l);
      map.set(m, cur);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, linhas]) => {
        const tVoo   = sumDecimal(linhas.map(l => l.tempo_voo));
        const tTotal = sumDecimal(linhas.map(l => l.tempo_total));
        const abast  = sumDecimal(linhas.map(l => l.combustivel_adicionado));
        const { lh: lhVoo, voosComDado: comDadoVoo } = mediaLHPonderada(linhas, "consumo_combustivel_voo", "tempo_voo");
        const { lh: lhTotal, voosComDado: comDadoTotal } = mediaLHPonderada(linhas, "consumo_combustivel_total", "tempo_total");

        return {
          mes: m,
          nomeMes: MONTH_NAMES[m - 1],
          tVoo,
          tTotal,
          abast,
          lhVoo,
          lhTotal,
          voosComDado: Math.min(comDadoVoo, comDadoTotal),
          voosTotal: linhas.length,
        };
      });
  }, [lancamentosAno]);

  // ── Totais anuais (também ponderado pelas horas, não pela média simples dos meses) ──
  const anoTotals = useMemo(() => {
    const tVoo   = anuais.reduce((s, r) => s + r.tVoo, 0);
    const tTotal = anuais.reduce((s, r) => s + r.tTotal, 0);
    const abast  = anuais.reduce((s, r) => s + r.abast, 0);
    const { lh: lhVoo, voosComDado: comDadoVoo } = mediaLHPonderada(lancamentosAno, "consumo_combustivel_voo", "tempo_voo");
    const { lh: lhTotal, voosComDado: comDadoTotal } = mediaLHPonderada(lancamentosAno, "consumo_combustivel_total", "tempo_total");
    return {
      tVoo, tTotal, abast, lhVoo, lhTotal,
      voosComDado: Math.min(comDadoVoo, comDadoTotal),
      voosTotal: lancamentosAno.length,
    };
  }, [anuais, lancamentosAno]);

  // ── Por cliente (mês atual) ──
  const porCliente = useMemo<ClienteConsumo[]>(() => {
    const map = new Map<string, Lanc[]>();
    for (const l of lancamentos) {
      const key = labelVooPara(l);
      const cur = map.get(key) ?? [];
      cur.push(l);
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([label, linhas]) => {
        const tVoo   = sumDecimal(linhas.map(l => l.tempo_voo));
        const tTotal = sumDecimal(linhas.map(l => l.tempo_total));
        const abast  = sumDecimal(linhas.map(l => l.combustivel_adicionado));
        const { lh: lhVoo, voosComDado: comDadoVoo } = mediaLHPonderada(linhas, "consumo_combustivel_voo", "tempo_voo");
        const { lh: lhTotal, voosComDado: comDadoTotal } = mediaLHPonderada(linhas, "consumo_combustivel_total", "tempo_total");
        return {
          label, tVoo, tTotal, abast, lhVoo, lhTotal,
          voos: linhas.length,
          voosComDado: Math.min(comDadoVoo, comDadoTotal),
        };
      })
      .sort((a, b) => b.abast - a.abast);
  }, [lancamentos, labelVooPara]);

  // ── Por voo (mês atual) ──
  // consumo_combustivel_voo / consumo_combustivel_total JÁ vêm em L/H, calculados
  // pelo banco a partir do nível real do tanque entre voos consecutivos — usar direto.
  const porVoo = useMemo(() => lancamentos.map(l => ({
    l,
    tVoo:     Number(l.tempo_voo ?? 0),
    tTotal:   Number(l.tempo_total ?? 0),
    abast:    Number(l.combustivel_adicionado ?? 0),
    lhVoo:    Number(l.consumo_combustivel_voo ?? 0),
    lhTotal:  Number(l.consumo_combustivel_total ?? 0),
  })), [lancamentos]);

  const totalAbastClientes = porCliente.reduce((s, c) => s + c.abast, 0);

  // ── Conteúdo comum (todos os blocos) ──
  const contentJSX = (
    <>
      {/* ═══ BLOCO 1 — KPIs do mês ═══ */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          resumo do mês — {MONTH_NAMES[mes - 1]}/{ano}
        </p>

        {/* Explicação */}
        <div className="mb-4 rounded-xl border border-border/40 bg-card-secondary/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            <span className="text-muted-foreground font-medium">Como é calculado: </span>
            o consumo (L/H) de cada voo é medido comparando o nível real de combustível no tanque
            no início deste voo com o início do voo seguinte, somando o que foi abastecido nesse intervalo.
            Os totais do período são a <span className="text-muted-foreground font-medium">média ponderada pelas horas</span> de
            cada voo.{" "}
            <span className="text-blue-400 font-medium">L/H por T. voo</span> considera apenas o tempo de voo efetivo;{" "}
            <span className="text-amber-400 font-medium">L/H por T. total</span> inclui táxi e solo (mais conservador).
          </p>
          <p className="text-muted-foreground border-t border-border/30 pt-2">
            <span className="text-muted-foreground font-medium">Por que pode diferir de planilhas antigas: </span>
            controles anteriores costumavam calcular "combustível abastecido no mês ÷ horas voadas no mês".
            Esse método distorce o resultado sempre que um voo usa combustível de um abastecimento feito
            fora daquele mês (ex.: voo no início do mês voando com sobra do mês anterior) — as horas entram
            na conta, mas os litros correspondentes não. O cálculo aqui evita essa distorção medindo o
            tanque voo a voo, por isso os números podem não bater com relatórios antigos, especialmente
            em meses isolados — a diferença tende a diminuir quando se olha o ano fechado.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* L/H por T. voo */}
          <div className="rounded-xl border border-border/40 bg-card-secondary/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">L/H por T. voo</p>
            <LHCell val={mesTotals.lhVoo} ref={historico} />
            <p className="text-xs text-muted-foreground mt-1">base: horas efetivas</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <DiffBadge val={mesTotals.lhVoo} ref={historico} />
              <CoberturaBadge comDado={mesTotals.voosComDado} total={mesTotals.voosTotal} />
            </div>
          </div>

          {/* L/H por T. total */}
          <div className="rounded-xl border border-border/40 bg-card-secondary/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">L/H por T. total</p>
            <LHCell val={mesTotals.lhTotal} ref={historico} />
            <p className="text-xs text-muted-foreground mt-1">inclui táxi / solo</p>
            <div className="mt-2">
              <DiffBadge val={mesTotals.lhTotal} ref={historico} />
            </div>
          </div>

          {/* Total abastecido */}
          <div className="rounded-xl border border-border/40 bg-card-secondary/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">abastecido no mês</p>
            <p className="text-lg font-bold text-white font-mono">{num(mesTotals.abast, 0)} L</p>
            <p className="text-xs text-muted-foreground mt-1">{lancamentos.length} voos registrados</p>
          </div>

          {/* Horas */}
          <div className="rounded-xl border border-border/40 bg-card-secondary/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">horas de voo</p>
            <p className="text-lg font-bold text-cyan-400 font-mono">{decimalToHHMM(mesTotals.tVoo)}</p>
            <p className="text-xs text-muted-foreground mt-1">T. total: {decimalToHHMM(mesTotals.tTotal)}</p>
          </div>
        </div>
      </section>

      {/* ═══ BLOCO 2 — Tabela anual ═══ */}
      {anuais.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            tabela anual — {ano}
          </p>

          {/* Gráfico de linha */}
          <div className="mb-4 rounded-xl border border-border/30 bg-card-secondary/30 px-4 pt-4 pb-2">
            <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-8 h-0.5 bg-blue-500 rounded" />
                L/H por T. voo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-8 h-px bg-amber-400 rounded border-dashed border-t border-amber-400" />
                L/H por T. total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-8 h-px bg-slate-500 rounded" style={{ borderTop: "2px dashed" }} />
                referência histórica ({num(historico, 1)})
              </span>
            </div>
            <LineChart
              data={anuais.map(r => ({ label: r.nomeMes, lhVoo: r.lhVoo, lhTotal: r.lhTotal }))}
              historico={historico}
            />
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-card-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Mês</th>
                  <th className="px-4 py-2.5 text-right font-medium">T. voo (h)</th>
                  <th className="px-4 py-2.5 text-right font-medium">T. total (h)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Abast. (L)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-blue-400">L/H (voo)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-amber-400">L/H (total)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">vs histórico</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">cobertura</th>
                </tr>
              </thead>
              <tbody>
                {anuais.map((r, idx) => (
                  <tr
                    key={r.mes}
                    className={[
                      "border-t border-border/30 transition-colors hover:bg-card-secondary/40",
                      r.mes === mes ? "bg-amber-500/5 border-l-2 border-l-amber-500/50" : "",
                      idx % 2 === 0 ? "bg-card-secondary/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2.5 font-semibold text-white capitalize">{r.nomeMes}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.tVoo.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.tTotal.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {r.abast.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <LHCell val={r.lhVoo} ref={historico} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <LHCell val={r.lhTotal} ref={historico} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DiffBadge val={r.lhVoo} ref={historico} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground font-mono">
                      {r.voosComDado}/{r.voosTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-500/30 bg-card-secondary/60">
                  <td className="px-4 py-3 font-bold text-amber-400 text-xs uppercase tracking-wide">Total / Média</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">{anoTotals.tVoo.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-muted-foreground">{anoTotals.tTotal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">
                    {anoTotals.abast.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LHCell val={anoTotals.lhVoo} ref={historico} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LHCell val={anoTotals.lhTotal} ref={historico} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DiffBadge val={anoTotals.lhVoo} ref={historico} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                    {anoTotals.voosComDado}/{anoTotals.voosTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ═══ BLOCO 3 — Por cliente / cotista ═══ */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          consumo por cliente / cotista — {MONTH_NAMES[mes - 1]}/{ano}
        </p>

        {porCliente.length === 0 ? (
          <p className="rounded-xl border border-border/40 bg-card-secondary/30 p-6 text-center text-sm text-muted-foreground">
            Nenhum voo com combustível registrado neste período.
          </p>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-card-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Cliente / Cotista</th>
                  <th className="px-4 py-2.5 text-center font-medium">Voos</th>
                  <th className="px-4 py-2.5 text-right font-medium">T. voo</th>
                  <th className="px-4 py-2.5 text-right font-medium">T. total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Abast. (L)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-blue-400">L/H (voo)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-amber-400">L/H (total)</th>
                  <th className="px-4 py-2.5 text-right font-medium">% abast.</th>
                </tr>
              </thead>
              <tbody>
                {porCliente.map((c, idx) => {
                  const pct = totalAbastClientes > 0 ? (c.abast / totalAbastClientes) * 100 : 0;
                  const cor = SERIE_COLORS[idx % SERIE_COLORS.length];
                  return (
                    <tr key={c.label} className="border-t border-border/30 hover:bg-card-secondary/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                          <span className="font-medium text-white truncate max-w-[160px]">{c.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.voos}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{decimalToHHMM(c.tVoo)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{decimalToHHMM(c.tTotal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{num(c.abast, 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <LHCell val={c.lhVoo} ref={historico} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <LHCell val={c.lhTotal} ref={historico} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct.toFixed(0)}%`, background: cor }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ═══ BLOCO 4 — Por voo ═══ */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          detalhe por voo — {MONTH_NAMES[mes - 1]}/{ano}
        </p>

        {porVoo.length === 0 ? (
          <p className="rounded-xl border border-border/40 bg-card-secondary/30 p-6 text-center text-sm text-muted-foreground">
            Nenhum voo no período.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/40 max-h-72 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-card-secondary/95 backdrop-blur z-10">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trecho</th>
                  <th className="px-4 py-2.5 text-left font-medium">Para</th>
                  <th className="px-4 py-2.5 text-right font-medium">Abast. (L)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-blue-400">L/H (voo)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-amber-400">L/H (total)</th>
                </tr>
              </thead>
              <tbody>
                {porVoo.map(({ l, abast, lhVoo, lhTotal }, idx) => (
                  <tr
                    key={l.id}
                    className={[
                      "border-t border-border/30 hover:bg-card-secondary/50 transition-colors",
                      idx % 2 === 0 ? "bg-card-secondary/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">
                      {new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {l.trecho ?? `${l.aerodromo_partida ?? "—"} → ${l.aerodromo_chegada ?? "—"}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">
                      {labelVooPara(l)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {abast > 0 ? num(abast, 0) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <LHCell val={lhVoo} ref={historico} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <LHCell val={lhTotal} ref={historico} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );

  // ── Renderização: inline vs modal ──
  if (inline) {
    return <div className="space-y-8">{contentJSX}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-amber-500/20 bg-card shadow-2xl shadow-amber-500/10"
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              <Droplets className="w-5 h-5 text-amber-400" />
              Consumo de Combustível · {aeronave.matricula}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MONTH_NAMES[mes - 1]}/{ano} · referência histórica:{" "}
              <span className="font-mono text-amber-400">{num(historico, 1)} L/H</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-card-secondary hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {contentJSX}
        </div>
      </motion.div>
    </div>
  );
}