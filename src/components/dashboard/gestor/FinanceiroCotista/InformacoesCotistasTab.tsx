import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Plane,
  MapPin,
  TrendingUp,
  Minus,
  Users,
  Trophy,
  Medal,
  Timer,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Gauge,
  ChevronRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   Tipos
───────────────────────────────────────────────────────────────────────── */
interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface Props {
  aeronaveId: string;
  matricula?: string;
  cotistas: Cotista[];
  ano?: number;
}

interface VooRow {
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  tempo_total: number | null;
  pousos_total: number | null;
  clientes_id: string | null;
  socios_id: string | null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Constantes / helpers
───────────────────────────────────────────────────────────────────────── */
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CORES = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#0ea5e9", "#f97316", "#ec4899",
];

const fmtHoras = (n: number) => {
  if (!n) return "0h00";
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
};

const pctChange = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);

/* ─────────────────────────────────────────────────────────────────────────
   Animação de contagem (usada nos KPIs, como no layout de referência)
───────────────────────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const prevTarget = useRef<number>(0);
  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(start + diff * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevTarget.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ─────────────────────────────────────────────────────────────────────────
   Sub-componentes visuais
───────────────────────────────────────────────────────────────────────── */
function TrendPill({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.5) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground border-border/50 bg-muted/30">
        <Minus className="h-3 w-3" /> estável
      </Badge>
    );
  }
  const up = pct > 0;
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${up ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : "text-rose-500 border-rose-500/30 bg-rose-500/10"}`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </Badge>
  );
}

function KpiCard({
  icon,
  label,
  value,
  formatted,
  sub,
  accent,
  trendPct,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  formatted: (v: number) => string;
  sub: string;
  accent: string;
  trendPct?: number;
}) {
  const animated = useCountUp(value);
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-xl" style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
          {trendPct !== undefined && <TrendPill pct={trendPct} />}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">
          {label}
        </p>
        <h3 className="text-3xl font-bold mt-1 tabular-nums">{formatted(animated)}</h3>
        <p className="text-xs text-muted-foreground mt-2">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CotistaBalancoCard({
  nome,
  cor,
  horas,
  pousos,
  percentualUso,
  cotaOriginal,
  selected,
  onClick,
}: {
  nome: string;
  cor: string;
  horas: number;
  pousos: number;
  percentualUso: number;
  cotaOriginal: number;
  selected: boolean;
  onClick: () => void;
}) {
  const gap = percentualUso - cotaOriginal;
  const status = gap > 2 ? "Over-use" : gap < -2 ? "Under-use" : "Equilibrado";
  const statusClass =
    gap > 2
      ? "text-rose-500 border-rose-500/30 bg-rose-500/10"
      : gap < -2
      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
      : "text-muted-foreground border-border/50 bg-muted/30";

  const [barPct, setBarPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBarPct(Math.min(100, percentualUso)), 80);
    return () => clearTimeout(t);
  }, [percentualUso]);

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card hover:bg-card/80"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cor }} />
            <span className="text-sm font-semibold">{nome}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cota {cotaOriginal}% · {fmtHoras(horas)} · {pousos} pousos
          </p>
        </div>
        <Badge variant="outline" className={statusClass}>{status}</Badge>
      </div>

      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden relative mt-4">
        <div
          className="h-full absolute left-0 top-0 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${barPct}%`, backgroundColor: cor }}
        />
        <div
          className="h-full w-0.5 bg-foreground/50 absolute top-0 z-10"
          style={{ left: `${cotaOriginal}%` }}
          title={`Cota adquirida: ${cotaOriginal}%`}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">Uso real</span>
        <span className="text-[11px] font-semibold">{percentualUso.toFixed(1)}%</span>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────────────────────────────────── */
export function InformacoesCotistasTab({ aeronaveId, matricula, cotistas, ano }: Props) {
  const anoAtual = ano ?? new Date().getFullYear();
  const [cotistaSel, setCotistaSel] = useState<string>("todos");
  const [mesInicio, setMesInicio] = useState(0);
  const [mesFim, setMesFim] = useState(new Date().getMonth());

  const { data: voos, isLoading } = useQuery({
    queryKey: ["voos-info-cotistas", aeronaveId, anoAtual],
    queryFn: async (): Promise<VooRow[]> => {
      if (!aeronaveId) return [];
      const { data, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select(
          "data_registro, aerodromo_partida, aerodromo_chegada, tempo_total, pousos_total, clientes_id, socios_id"
        )
        .eq("aeronave_id", aeronaveId)
        .gte("data_registro", `${anoAtual}-01-01`)
        .lte("data_registro", `${anoAtual}-12-31`)
        .order("data_registro", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!aeronaveId,
  });

  const voosFiltrados = useMemo(() => {
    return (voos || []).filter((v) => {
      const m = new Date(v.data_registro).getMonth();
      if (m < mesInicio || m > mesFim) return false;
      if (cotistaSel === "todos") return true;
      const id = v.socios_id || v.clientes_id;
      return id === cotistaSel;
    });
  }, [voos, cotistaSel, mesInicio, mesFim]);

  const stats = useMemo(() => {
    let totalPousos = 0;
    let totalHoras = 0;
    let vooMaisLongo = 0;
    let rotaMaisLonga = "";

    const porMes: number[] = Array(12).fill(0);
    const horasPorMes: number[] = Array(12).fill(0);
    const destinos = new Map<string, number>();

    voosFiltrados.forEach((v) => {
      const horas = Number(v.tempo_total || 0);
      const pousos = v.pousos_total || 0;

      totalPousos += pousos;
      totalHoras += horas;

      if (horas > vooMaisLongo) {
        vooMaisLongo = horas;
        rotaMaisLonga = `${v.aerodromo_partida || "?"} ➝ ${v.aerodromo_chegada || "?"}`;
      }

      const m = new Date(v.data_registro).getMonth();
      porMes[m] += pousos;
      horasPorMes[m] += horas;

      const dest = v.aerodromo_chegada;
      if (dest) destinos.set(dest, (destinos.get(dest) || 0) + 1);
    });

    const top5 = Array.from(destinos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxDestino = top5[0]?.[1] || 1;

    const horasUltimoMes = horasPorMes[mesFim] || 0;
    const horasMesAnterior = mesFim > 0 ? horasPorMes[mesFim - 1] : 0;
    const tendenciaPct = pctChange(horasUltimoMes, horasMesAnterior);

    const pousosUltimoMes = porMes[mesFim] || 0;
    const pousosMesAnterior = mesFim > 0 ? porMes[mesFim - 1] : 0;
    const tendenciaPousos = pctChange(pousosUltimoMes, pousosMesAnterior);

    return {
      totalPousos,
      totalHoras,
      totalVoos: voosFiltrados.length,
      porMes,
      horasPorMes,
      top5,
      maxDestino,
      vooMaisLongo,
      rotaMaisLonga,
      tendenciaPct,
      tendenciaPousos,
    };
  }, [voosFiltrados, mesFim]);

  // Comparativo por cotista (uso real x cota adquirida)
  const comparativo = useMemo(() => {
    const map = new Map<string, { horas: number; pousos: number }>();
    cotistas.forEach((c) => map.set(c.id, { horas: 0, pousos: 0 }));

    (voos || []).forEach((v) => {
      const m = new Date(v.data_registro).getMonth();
      if (m < mesInicio || m > mesFim) return;
      const id = v.socios_id || v.clientes_id;
      if (!id || !map.has(id)) return;
      const entry = map.get(id)!;
      entry.horas += Number(v.tempo_total || 0);
      entry.pousos += v.pousos_total || 0;
    });

    const totalHoras = Array.from(map.values()).reduce((s, x) => s + x.horas, 0);

    return cotistas
      .map((c, idx) => {
        const e = map.get(c.id)!;
        const percentualUso = totalHoras > 0 ? (e.horas / totalHoras) * 100 : 0;
        return {
          id: c.id,
          nome: c.nome,
          horas: Number(e.horas.toFixed(2)),
          pousos: e.pousos,
          percentualUso,
          cotaOriginal: c.percentual,
          cor: CORES[idx % CORES.length],
        };
      })
      .sort((a, b) => b.horas - a.horas);
  }, [voos, cotistas, mesInicio, mesFim]);

  // Cotista que mais voou no período (para o "ano em números")
  const cotistaDestaque = comparativo[0];

  // Previsão simples: extrapola o realizado até hoje para o ano inteiro
  const hoje = new Date();
  const ehAnoCorrente = hoje.getFullYear() === anoAtual;
  const diasDecorridos = ehAnoCorrente
    ? Math.floor((hoje.getTime() - new Date(anoAtual, 0, 1).getTime()) / 86400000) + 1
    : 365;
  const fatorProjecao = ehAnoCorrente ? 365 / Math.max(diasDecorridos, 1) : 1;

  const horasAnoTodo = useMemo(
    () => (voos || []).reduce((s, v) => s + Number(v.tempo_total || 0), 0),
    [voos]
  );
  const pousosAnoTodo = useMemo(
    () => (voos || []).reduce((s, v) => s + (v.pousos_total || 0), 0),
    [voos]
  );

  const rangeLabel = `${MESES[mesInicio]} a ${MESES[mesFim]}/${anoAtual}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">

      {/* ── Cabeçalho executivo ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between bg-card/40 p-5 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{matricula || "Aeronave"}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Análise de performance e utilização · {rangeLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={cotistaSel} onValueChange={setCotistaSel}>
            <SelectTrigger className="h-10 w-[200px] rounded-xl bg-background/50 border-border/50 hover:bg-background/80 transition-colors">
              <SelectValue placeholder="Cotista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sócios</SelectItem>
              {cotistas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} ({c.percentual}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 bg-background/50 rounded-xl p-1 border border-border/50">
            <Select value={String(mesInicio)} onValueChange={(v) => setMesInicio(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] border-0 shadow-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground/50 text-sm">→</span>
            <Select value={String(mesFim)} onValueChange={(v) => setMesFim(Number(v))}>
              <SelectTrigger className="h-8 w-[90px] border-0 shadow-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i)} disabled={i < mesInicio}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
          <Gauge className="h-3.5 w-3.5" /> Indicadores do período
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Timer className="h-5 w-5" />}
            label="Tempo em voo"
            value={stats.totalHoras}
            formatted={fmtHoras}
            accent="#3b82f6"
            sub={`${stats.totalVoos} etapas registradas`}
            trendPct={stats.tendenciaPct}
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Pousos totais"
            value={stats.totalPousos}
            formatted={(v) => `${Math.round(v)}`}
            accent="#10b981"
            sub="No período selecionado"
            trendPct={stats.tendenciaPousos}
          />
          <KpiCard
            icon={<Flame className="h-5 w-5" />}
            label="Voo mais longo"
            value={stats.vooMaisLongo}
            formatted={fmtHoras}
            accent="#f59e0b"
            sub={stats.rotaMaisLonga || "Sem registro"}
          />
          <KpiCard
            icon={<MapPin className="h-5 w-5" />}
            label="Segunda casa"
            value={stats.top5[0]?.[1] || 0}
            formatted={() => stats.top5[0]?.[0] || "—"}
            accent="#8b5cf6"
            sub={`Visitado ${stats.top5[0]?.[1] || 0} vez(es) no período`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Gráfico de utilização mensal ──────────────────────────────── */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Histórico de Utilização</CardTitle>
              <CardDescription>Horas voadas ao longo dos meses · {anoAtual}</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[260px] w-full bg-muted/20 animate-pulse rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stats.porMes.map((p, i) => ({
                    mes: MESES[i],
                    pousos: p,
                    horas: Number(stats.horasPorMes[i].toFixed(2)),
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: 12, border: "1px solid hsl(var(--border))" }}
                    formatter={(v: any, k: string) => (k === "horas" ? [fmtHoras(Number(v)), "Horas voadas"] : [v, "Pousos"])}
                  />
                  <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {stats.porMes.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i >= mesInicio && i <= mesFim ? "#3b82f6" : "hsl(var(--muted))"}
                        opacity={i >= mesInicio && i <= mesFim ? 1 : 0.4}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Destinos mais visitados ────────────────────────────────────── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Destinos mais visitados
            </CardTitle>
            <CardDescription>Top 5 no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top5.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sem voos registrados neste período.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.top5.map(([destino, count], i) => (
                  <div key={destino} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      {i === 0 ? <Medal className="h-3.5 w-3.5 text-amber-500" /> : i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{destino}</span>
                        <span className="text-muted-foreground">{count}x</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / stats.maxDestino) * 100}%`, background: CORES[i % CORES.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Balanço da cota por cotista ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
          <Users className="h-3.5 w-3.5" /> Balanço da cota
        </div>
        {comparativo.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center space-y-2 border border-dashed border-border/50 rounded-2xl">
            <p className="text-sm text-muted-foreground">Nenhum dado de sócio neste período.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparativo.map((c) => (
              <CotistaBalancoCard
                key={c.id}
                nome={c.nome}
                cor={c.cor}
                horas={c.horas}
                pousos={c.pousos}
                percentualUso={c.percentualUso}
                cotaOriginal={c.cotaOriginal}
                selected={cotistaSel === c.id}
                onClick={() => setCotistaSel((prev) => (prev === c.id ? "todos" : c.id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Voos recentes ─────────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-primary" /> Voos no período
          </CardTitle>
          <CardDescription>{voosFiltrados.length} etapa(s) registrada(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium py-2 px-4">Data</th>
                  <th className="text-left font-medium py-2 px-4">Rota</th>
                  <th className="text-right font-medium py-2 px-4">Duração</th>
                  <th className="text-right font-medium py-2 px-4">Pousos</th>
                </tr>
              </thead>
              <tbody>
                {voosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhum voo encontrado.
                    </td>
                  </tr>
                )}
                {[...voosFiltrados]
                  .sort((a, b) => b.data_registro.localeCompare(a.data_registro))
                  .slice(0, 8)
                  .map((v, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {new Date(v.data_registro).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2.5 px-4 font-medium">
                        {v.aerodromo_partida || "?"} ➝ {v.aerodromo_chegada || "?"}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmtHoras(Number(v.tempo_total || 0))}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{v.pousos_total || 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Previsão (só para o ano corrente) ────────────────────────────── */}
      {ehAnoCorrente && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-2">
            
            </div>
            <h3 className="text-lg font-bold mb-1">
              Se o ritmo continuar, {anoAtual} deve fechar com…
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Projeção linear a partir dos {diasDecorridos} dias já registrados.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
              <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Horas voadas</p>
                <p className="text-2xl font-bold">{fmtHoras(horasAnoTodo * fatorProjecao)}</p>
                <p className="text-xs text-muted-foreground mt-1">Hoje: {fmtHoras(horasAnoTodo)}</p>
              </div>
              <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pousos</p>
                <p className="text-2xl font-bold">{Math.round(pousosAnoTodo * fatorProjecao)} pousos</p>
                <p className="text-xs text-muted-foreground mt-1">Hoje: {pousosAnoTodo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ano em números ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
          <Sparkles className="h-3.5 w-3.5" /> {anoAtual} em números
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: "✈️", label: "Voos realizados", value: `${stats.totalVoos}`, sub: "no período selecionado" },
            { emoji: "⏱️", label: "Tempo no ar", value: fmtHoras(stats.totalHoras), sub: "nos céus" },
            { emoji: "🌎", label: "Destino favorito", value: stats.top5[0]?.[0] || "—", sub: `${stats.top5[0]?.[1] || 0} visitas` },
            {
              emoji: "🏆",
              label: "Quem mais voou",
              value: cotistaDestaque?.nome || "—",
              sub: cotistaDestaque ? fmtHoras(cotistaDestaque.horas) : "sem dados",
            },
          ].map((c) => (
            <Card key={c.label} className="border-border/50 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-2">{c.emoji}</div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className="text-base font-bold mt-1 truncate">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
