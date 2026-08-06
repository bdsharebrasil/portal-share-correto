// @ts-nocheck — colunas legadas fora dos types gerados
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plane, RefreshCw, Loader2, TrendingDown, Search, DollarSign, Layers, Gauge,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAircraftValuation, useUsMarketEstimate } from "@/hooks/useAircraftValuation";
import {
  GlassCard, PageHeader, SectionCard, StatTile, EmptyState, compact, tabsListClass, tabTriggerClass,
} from "@/components/dashboard/gestor/master/ui/Premium";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  },
};

export default function ComparativoAeronaves() {
  const queryClient = useQueryClient();
  const { errors, loadingId, valuate } = useAircraftValuation();
  const { data: estimate, error: estimateError, loading: estimating, estimate: runEstimate } = useUsMarketEstimate();

  const [form, setForm] = useState({ model: "", year: "", hours: "", registration: "" });

  const { data: aeronaves = [], isLoading } = useQuery({
    queryKey: ["valuation-aeronaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo, fabricante, ano, numero_serie, horas_celula_atual, url_imagem, status")
        .order("matricula");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["valuation-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft_valuation_history")
        .select("aircraft_id, matricula, make_model, estimated_market_value, total_hours, confidence_score, depreciation_rate, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const ultimaAvaliacao = useMemo(() => {
    const map = new Map<string, any>();
    historico.forEach((h) => h.aircraft_id && map.set(h.aircraft_id, h));
    return map;
  }, [historico]);

  const comparativo = useMemo(
    () =>
      aeronaves
        .map((a) => ({
          matricula: a.matricula || "—",
          valor: Number(ultimaAvaliacao.get(a.id)?.estimated_market_value || 0),
        }))
        .filter((a) => a.valor > 0)
        .sort((a, b) => b.valor - a.valor),
    [aeronaves, ultimaAvaliacao]
  );

  const totais = useMemo(() => {
    const avaliadas = comparativo.length;
    const valorFrota = comparativo.reduce((t, a) => t + a.valor, 0);
    const depreciacoes = historico
      .map((h) => Number(h.depreciation_rate))
      .filter((n) => Number.isFinite(n) && n !== 0);
    const mediaDep = depreciacoes.length
      ? depreciacoes.reduce((t, n) => t + n, 0) / depreciacoes.length
      : 0;
    return {
      avaliadas,
      valorFrota,
      medio: avaliadas ? valorFrota / avaliadas : 0,
      mediaDep,
    };
  }, [comparativo, historico]);

  const serieDepreciacao = useMemo(() => {
    const byDate = new Map<string, any>();
    historico.forEach((h) => {
      const dia = String(h.created_at).slice(0, 10);
      const row = byDate.get(dia) || { data: dia };
      row[h.matricula || "N/D"] = Number(h.estimated_market_value || 0);
      byDate.set(dia, row);
    });
    return Array.from(byDate.values());
  }, [historico]);

  const matriculas = useMemo(
    () => Array.from(new Set(historico.map((h) => h.matricula || "N/D"))),
    [historico]
  );

  const handleValuate = async (a: any) => {
    const result = await valuate({
      id: a.id,
      registration: a.matricula,
      serial_number: a.numero_serie,
      model: [a.fabricante, a.modelo].filter(Boolean).join(" "),
      year: a.ano ? Number(a.ano) : undefined,
      cell_hours_current: a.horas_celula_atual ? Number(a.horas_celula_atual) : undefined,
    });

    if (!result) {
      toast.error(errors[a.id] || "Não foi possível avaliar esta aeronave.");
      return;
    }

    const anterior = ultimaAvaliacao.get(a.id)?.estimated_market_value;
    const depreciacao = anterior
      ? ((Number(anterior) - result.estimated_market_value) / Number(anterior)) * 100
      : null;

    await supabase.from("aircraft_valuation_history").insert({
      aircraft_id: a.id,
      matricula: a.matricula,
      make_model: [a.fabricante, a.modelo].filter(Boolean).join(" "),
      estimated_market_value: result.estimated_market_value,
      confidence_score: result.confidence ?? null,
      total_hours: a.horas_celula_atual ?? null,
      depreciation_rate: depreciacao,
      raw_response: result as any,
    });

    queryClient.invalidateQueries({ queryKey: ["valuation-history"] });
    toast.success(`Valor estimado para ${a.matricula}: ${usd(result.estimated_market_value)}`);
  };

  return (
    <Layout>
      <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden pb-10">
        <PageHeader
          back
          icon={Plane}
          title="Aeronaves & Depreciação"
          subtitle="Valor de mercado estimado via catálogo FAA (Windsock)"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Aeronaves na frota" value={String(aeronaves.length)} icon={Plane} tone="primary" />
          <StatTile label="Aeronaves avaliadas" value={String(totais.avaliadas)} icon={Gauge} tone="neutral" delay={60} />
          <StatTile label="Valor total estimado" value={usd(totais.valorFrota)} hint="Soma das últimas avaliações" icon={DollarSign} tone="success" delay={120} />
          <StatTile
            label="Depreciação média"
            value={`${totais.mediaDep.toFixed(1)}%`}
            hint="Entre avaliações consecutivas"
            icon={TrendingDown}
            tone={totais.mediaDep > 0 ? "warning" : "neutral"}
            delay={180}
          />
        </div>

        <Tabs defaultValue="frota" className="w-full min-w-0 space-y-4">
          <TabsList className={tabsListClass}>
            <TabsTrigger value="frota" className={tabTriggerClass}><Plane className="h-4 w-4" /> Frota</TabsTrigger>
            <TabsTrigger value="comparativo" className={tabTriggerClass}><Layers className="h-4 w-4" /> Comparativo</TabsTrigger>
            <TabsTrigger value="depreciacao" className={tabTriggerClass}><TrendingDown className="h-4 w-4" /> Depreciação</TabsTrigger>
            <TabsTrigger value="estimar" className={tabTriggerClass}><Search className="h-4 w-4" /> Estimar (FAA)</TabsTrigger>
          </TabsList>

          <TabsContent value="frota" className="focus-visible:outline-none">
            <SectionCard title="Frota Share Brasil" subtitle="Clique em avaliar para consultar o valor atual" icon={Plane} bodyClassName="p-0">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Matrícula</th>
                        <th className="px-4 py-3">Modelo</th>
                        <th className="px-4 py-3">Ano</th>
                        <th className="px-4 py-3">Horas</th>
                        <th className="px-4 py-3 text-right">Valor estimado</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aeronaves.map((a) => {
                        const last = ultimaAvaliacao.get(a.id);
                        return (
                          <tr key={a.id} className="border-b border-border/40 transition-colors hover:bg-primary/5">
                            <td className="px-4 py-3 font-medium text-foreground">{a.matricula}</td>
                            <td className="px-4 py-3 text-muted-foreground">{[a.fabricante, a.modelo].filter(Boolean).join(" ") || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.ano || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.horas_celula_atual ?? "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary">
                              {last?.estimated_market_value ? usd(Number(last.estimated_market_value)) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="outline" className="rounded-lg" disabled={loadingId === a.id} onClick={() => handleValuate(a)}>
                                {loadingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                <span className="ml-2 hidden sm:inline">Avaliar</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="comparativo" className="focus-visible:outline-none">
            <SectionCard title="Valor por aeronave" subtitle="Última avaliação registrada de cada matrícula" icon={DollarSign}>
              {comparativo.length === 0 ? (
                <EmptyState message="Avalie ao menos uma aeronave para ver o comparativo." />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={comparativo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="matricula" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => usd(v)} />
                    <Bar dataKey="valor" name="Valor" radius={[8, 8, 0, 0]} animationDuration={800}>
                      {comparativo.map((c, i) => (
                        <Cell key={c.matricula} fill={`hsl(${210 + i * 14} 75% ${58 - i * 2}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="depreciacao" className="focus-visible:outline-none">
            <SectionCard title="Curva de depreciação" subtitle="Evolução do valor estimado ao longo das avaliações" icon={TrendingDown}>
              {serieDepreciacao.length < 2 ? (
                <EmptyState message="A curva aparece após duas ou mais avaliações registradas." />
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={serieDepreciacao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => usd(v)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    {matriculas.map((m, i) => (
                      <Line key={m} type="monotone" dataKey={m} stroke={`hsl(${(i * 67) % 360} 70% 55%)`} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={900} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="estimar" className="focus-visible:outline-none">
            <SectionCard title="Estimar valor de mercado" subtitle="Consulta livre no catálogo FAA / Windsock" icon={Search}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Input placeholder="Modelo (ex: King Air 350)" className="rounded-lg" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                <Input placeholder="Matrícula N-number" className="rounded-lg" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
                <Input placeholder="Ano" inputMode="numeric" className="rounded-lg" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                <Input placeholder="Horas de célula" inputMode="numeric" className="rounded-lg" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                <Button
                  className="rounded-lg"
                  disabled={estimating || (!form.model.trim() && !form.registration.trim())}
                  onClick={() =>
                    runEstimate({
                      model: form.model.trim() || undefined,
                      registration: form.registration.trim() || undefined,
                      year: form.year ? Number(form.year) : undefined,
                      hours: form.hours ? Number(form.hours) : undefined,
                    })
                  }
                >
                  {estimating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Estimar
                </Button>
              </div>

              {estimateError && <p className="mt-4 text-sm text-destructive">{estimateError}</p>}

              {estimate && (
                <GlassCard className="mt-4 border-primary/30 bg-primary/5 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor estimado</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{usd(estimate.estimated_market_value)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Confiança</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {estimate.confidence != null ? `${Math.round(Number(estimate.confidence) * 100)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Modo</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{estimate.valuation_mode || "—"}</p>
                    </div>
                  </div>
                </GlassCard>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
