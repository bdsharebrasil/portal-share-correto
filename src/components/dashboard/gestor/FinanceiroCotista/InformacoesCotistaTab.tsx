import { useMemo, useState } from "react";
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
  Users,
  Calendar as CalendarIcon,
  Trophy,
  Timer,
  Route,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from "lucide-react";

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

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

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

export function InformacoesCotistasTab({
  aeronaveId,
  matricula,
  cotistas,
  ano,
}: Props) {
  const anoAtual = ano ?? new Date().getFullYear();
  const [cotistaSel, setCotistaSel] = useState<string>("todos");
  const [mesInicio, setMesInicio] = useState(0);
  const [mesFim, setMesFim] = useState(new Date().getMonth());

  const { data: voos, isLoading } = useQuery({
    queryKey: ["voos-info-cotistas", aeronaveId, anoAtual],
    queryFn: async () => {
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
    return (voos || []).filter((v: any) => {
      const d = new Date(v.data_registro);
      const m = d.getMonth();
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

    voosFiltrados.forEach((v: any) => {
      const horas = Number(v.tempo_total || 0);
      const pousos = v.pousos_total || 0;
      
      totalPousos += pousos;
      totalHoras += horas;

      // Descobrindo o voo mais longo (Endurance)
      if (horas > vooMaisLongo) {
        vooMaisLongo = horas;
        rotaMaisLonga = `${v.aerodromo_partida || '?'} ➝ ${v.aerodromo_chegada || '?'}`;
      }

      const m = new Date(v.data_registro).getMonth();
      porMes[m] += pousos;
      horasPorMes[m] += horas;

      const dest = v.aerodromo_chegada;
      if (dest) destinos.set(dest, (destinos.get(dest) || 0) + 1);
    });

    const mesMaisVoado = horasPorMes.indexOf(Math.max(...horasPorMes));
    const top5 = Array.from(destinos.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Tendência: Comparando o último mês selecionado com o anterior a ele
    const horasUltimoMes = horasPorMes[mesFim] || 0;
    const horasMesAnterior = mesFim > 0 ? horasPorMes[mesFim - 1] : 0;
    const tendenciaPct = horasMesAnterior > 0 
      ? ((horasUltimoMes - horasMesAnterior) / horasMesAnterior) * 100 
      : 0;

    return {
      totalPousos,
      totalHoras,
      totalVoos: voosFiltrados.length,
      porMes,
      horasPorMes,
      mesMaisVoado,
      top5,
      vooMaisLongo,
      rotaMaisLonga,
      tendenciaPct,
      horasUltimoMes
    };
  }, [voosFiltrados, mesFim]);

  // Comparativo
  const comparativo = useMemo(() => {
    const map = new Map<string, { horas: number; pousos: number }>();
    cotistas.forEach((c) => map.set(c.id, { horas: 0, pousos: 0 }));
    
    (voos || []).forEach((v: any) => {
      const d = new Date(v.data_registro);
      const m = d.getMonth();
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
        const cotaUsage = totalHoras > 0 ? (e.horas / totalHoras) * 100 : 0;
        const gapCota = cotaUsage - c.percentual; // Vê se voou acima ou abaixo da cota que possui

        return {
          id: c.id,
          nome: c.nome,
          horas: Number(e.horas.toFixed(2)),
          pousos: e.pousos,
          percentualUso: cotaUsage,
          cotaOriginal: c.percentual,
          gapCota,
          cor: CORES[idx % CORES.length],
        };
      })
      .sort((a, b) => b.horas - a.horas);
  }, [voos, cotistas, mesInicio, mesFim]);

  const rangeLabel = `${MESES[mesInicio]} a ${MESES[mesFim]}/${anoAtual}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      
      {/* Header & Filtros Modernizados */}
      <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between bg-card/40 p-5 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            {matricula || "Aeronave"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Análise de performance e utilização ({rangeLabel})
          </p>
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
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
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

      {/* Bento Grid - Curiosidades e KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Card Principal: Horas Totais */}
        <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Timer className="h-6 w-6" />
              </div>
              {stats.tendenciaPct !== 0 && (
                <Badge variant="outline" className={`flex gap-1 ${stats.tendenciaPct > 0 ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-500 border-rose-500/30 bg-rose-500/10'}`}>
                  {stats.tendenciaPct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(stats.tendenciaPct).toFixed(1)}% vs mês anterior
                </Badge>
              )}
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tempo em voo</p>
              <h3 className="text-4xl font-bold mt-1 text-foreground">
                {fmtHoras(stats.totalHoras)}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Distribuídos em <strong className="text-foreground">{stats.totalVoos} etapas</strong> e {stats.totalPousos} pousos.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Voo mais longo */}
        <Card className="bg-card hover:bg-card/80 transition-colors border-border/50 group">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                <Flame className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">Endurance (Max)</span>
            </div>
            <p className="text-2xl font-bold">{fmtHoras(stats.vooMaisLongo)}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={stats.rotaMaisLonga}>
              Rota: {stats.rotaMaisLonga || "Sem registro"}
            </p>
          </CardContent>
        </Card>

        {/* Card: Destino Favorito */}
        <Card className="bg-card hover:bg-card/80 transition-colors border-border/50 group">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-lg group-hover:scale-110 transition-transform">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">Segunda Casa</span>
            </div>
            <p className="text-2xl font-bold truncate">{stats.top5[0]?.[0] || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Visitado {stats.top5[0]?.[1] || 0} vezes no período
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Tendência Mensal */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Histórico de Utilização</CardTitle>
              <CardDescription>Horas voadas e pousos ao longo dos meses</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] w-full bg-muted/20 animate-pulse rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={stats.porMes.map((p, i) => ({
                    mes: MESES[i],
                    pousos: p,
                    horas: Number(stats.horasPorMes[i].toFixed(2)),
                    ativo: i >= mesInicio && i <= mesFim,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(v: any, k: string) => k === "horas" ? [fmtHoras(v), "Horas Voadas"] : [v, "Pousos"]}
                  />
                  
                  <Bar yAxisId="left" dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {stats.porMes.map((_, i) => (
                      <Cell key={i} fill={i >= mesInicio && i <= mesFim ? "#3b82f6" : "hsl(var(--muted))"} opacity={i >= mesInicio && i <= mesFim ? 1 : 0.4} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Uso da Cota (Fairness View) */}
        <Card className="border-border/50 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Balanço da Cota
            </CardTitle>
            <CardDescription>Uso real vs Cota adquirida</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {comparativo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum dado de sócio neste período.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {comparativo.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-sm font-semibold">{c.nome}</span>
                        <p className="text-xs text-muted-foreground">
                          {fmtHoras(c.horas)} voou · Tem {c.cotaOriginal}%
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold block">{c.percentualUso.toFixed(1)}%</span>
                        {/* Indicador se está voando além ou abaixo da cota */}
                        <span className={`text-[10px] font-medium ${c.gapCota > 2 ? 'text-rose-500' : c.gapCota < -2 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {c.gapCota > 2 ? 'Over-use' : c.gapCota < -2 ? 'Under-use' : 'Equilibrado'}
                        </span>
                      </div>
                    </div>
                    {/* Barra de progresso dupla (cinza fundo, cor atual) */}
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden relative">
                      <div
                        className="h-full absolute left-0 top-0 transition-all duration-500 ease-in-out rounded-full"
                        style={{ width: `${c.percentualUso}%`, backgroundColor: c.cor }}
                      />
                      {/* Marcador visual da cota original do cara */}
                      <div 
                        className="h-full w-0.5 bg-foreground/50 absolute top-0 z-10"
                        style={{ left: `${c.cotaOriginal}%` }}
                        title={`Cota: ${c.cotaOriginal}%`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
