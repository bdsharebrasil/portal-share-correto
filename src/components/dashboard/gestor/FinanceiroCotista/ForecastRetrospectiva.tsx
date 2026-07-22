import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plane,
  Sparkles,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

import { formatBRL } from "@/lib/dashboard-utils";

/* ─────────────────────────── types ─────────────────────────── */

// Resumo mínimo de cotista necessário para o ranking da retrospectiva —
// deliberadamente desacoplado do tipo `Cotista` de cada página (Dashboard,
// Balanço, etc.) para este arquivo não depender de nenhuma delas.
export interface CotistaResumo {
  id: string;
  nome: string;
}

export interface Previsao {
  anoCorrente: boolean;
  custoYtd: number;
  horasYtd: number;
  voosYtd: number;
  pousosYtd: number;
  custoProj: number;
  horasProj: number;
  voosProj: number;
  pousosProj: number;
  diasDecorridos: number;
}

export interface YearReview {
  totalHoras: number;
  totalVoos: number;
  totalPousos: number;
  destinoFav?: [string, number];
  ranking: { cotista: CotistaResumo; horas: number }[];
}

/* ─────────────────────────── previsão ─────────────────────────── */

export function ForecastCard({
  previsao, ano, matricula,
}: {
  previsao: Previsao;
  ano: number;
  matricula?: string;
}) {
  if (!previsao.anoCorrente) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-card/40 to-background p-6 sm:p-8">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-4 w-4" /> Previsão · baseado no histórico
        </div>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl">
          Se o ritmo continuar, você encerrará {ano} com…
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Projeção linear a partir dos {previsao.diasDecorridos} dias já registrados da {matricula || "aeronave"}.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 backdrop-blur transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {label}
      </div>
      <div className="mt-2 font-display text-2xl text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────── retrospectiva ─────────────────────────── */

export function YearInReview({
  ano, review, matricula,
}: {
  ano: number;
  matricula?: string;
  review: YearReview;
}) {
  const [cotistaIdx, setCotistaIdx] = useState(0);
  const cotista = review.ranking[cotistaIdx]?.cotista;
  const posicao = cotistaIdx + 1;
  const totalCotistas = review.ranking.length;
  const horasCotista = review.ranking[cotistaIdx]?.horas ?? 0;

  return (
    <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-[oklch(0.18_0.06_265)] via-[oklch(0.14_0.05_255)] to-background p-6 sm:p-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-primary">
            <Calendar className="mr-1 inline h-3.5 w-3.5" /> Retrospectiva
          </div>
          <h2 className="mt-1 font-display text-4xl sm:text-5xl">
            <span className="text-primary">{ano}</span> — seu ano na {matricula || "aeronave"}
          </h2>
        </div>
        {review.ranking.length > 0 && (
          <MiniSelect value={String(cotistaIdx)} onChange={(v) => setCotistaIdx(Number(v))}>
            {review.ranking.map((r, i) => (
              <option key={r.cotista.id} value={i}>{r.cotista.nome}</option>
            ))}
          </MiniSelect>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReviewCard
          emoji="👏"
          eyebrow="Você realizou"
          highlight={review.totalVoos.toString()}
          suffix={review.totalVoos === 1 ? "voo" : "voos"}
          delay={0}
        />
        <ReviewCard
          emoji="✈️"
          eyebrow="Você passou"
          highlight={`${review.totalHoras.toFixed(0)} h`}
          suffix="nos céus"
          delay={0.1}
        />
        <ReviewCard
          emoji="🌎"
          eyebrow="Destino favorito"
          highlight={review.destinoFav?.[0] || "—"}
          suffix={review.destinoFav ? `${review.destinoFav[1]} visitas` : "sem dados"}
          delay={0.2}
        />
        <ReviewCard
          emoji={posicao === 1 ? "🏆" : "⭐️"}
          eyebrow={cotista ? `${cotista.nome.split(" ")[0]} ficou em` : "Ranking"}
          highlight={cotista ? `${posicao}º de ${totalCotistas}` : "—"}
          suffix={cotista ? `com ${horasCotista.toFixed(0)} h` : "cotistas ativos"}
          delay={0.3}
        />
      </div>

      {review.ranking.length > 1 && (
        <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Ranking de utilização em {ano}
          </div>
          <div className="space-y-3">
            {review.ranking.map((r, i) => {
              const max = review.ranking[0]?.horas || 1;
              const pct = (r.horas / max) * 100;
              return (
                <div key={r.cotista.id} className="flex items-center gap-3">
                  <div className="w-6 text-sm font-semibold text-muted-foreground">{i + 1}º</div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="truncate text-sm">{r.cotista.nome}</div>
                      <div className="text-xs text-muted-foreground">{r.horas.toFixed(1)} h</div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  emoji, eyebrow, highlight, suffix, delay,
}: { emoji: string; eyebrow: string; highlight: string; suffix: string; delay: number }) {
  return (
    <div
      className="group relative overflow-hidden rounded-3xl border border-border/50 bg-background/40 p-6 transition-all duration-500 hover:border-primary/40 hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_var(--primary)] motion-safe:animate-[fadeUp_0.7s_ease-out_both]"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="text-4xl transition-transform group-hover:scale-110">{emoji}</div>
      <div className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">{eyebrow}</div>
      <div className="mt-2 font-display text-3xl leading-tight text-foreground">{highlight}</div>
      <div className="mt-1 text-sm text-muted-foreground">{suffix}</div>
    </div>
  );
}

/* ─────────────────────────── util local ─────────────────────────── */

// Select minimalista só para o seletor de cotista dentro do card de
// retrospectiva — deliberadamente local para este arquivo não depender do
// `SelectField` de nenhuma página específica.
function MiniSelect({
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
