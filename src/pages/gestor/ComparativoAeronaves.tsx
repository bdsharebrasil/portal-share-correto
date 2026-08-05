// @ts-nocheck — colunas legadas fora dos types gerados
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plane, RefreshCw, Loader2, TrendingDown, Search, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAircraftValuation, useUsMarketEstimate } from "@/hooks/useAircraftValuation";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);

export default function ComparativoAeronaves() {
  const navigate = useNavigate();
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
        .select("aircraft_id, matricula, make_model, estimated_market_value, total_hours, confidence_score, created_at")
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
      <div className="w-full max-w-full min-w-0 space-y-6 pb-8 overflow-x-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><Plane className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Comparativo & Depreciação</h1>
              <p className="text-sm text-muted-foreground truncate">Valor de mercado estimado via catálogo FAA (Windsock)</p>
            </div>
          </div>
        </div>

        {/* Estimativa livre pelo catálogo FAA */}
        <Card>
          <CardHeader><CardTitle className="text-base">Estimar valor de mercado (catálogo FAA)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input placeholder="Modelo (ex: King Air 350)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <Input placeholder="Matrícula N-number" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
              <Input placeholder="Ano" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              <Input placeholder="Horas de célula" inputMode="numeric" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              <Button
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
            {estimateError && <p className="text-sm text-destructive">{estimateError}</p>}
            {estimate && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Valor estimado</p>
                    <p className="text-2xl font-bold text-primary">{usd(estimate.estimated_market_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Confiança</p>
                    <p className="font-semibold">
                      {estimate.confidence != null ? `${Math.round(Number(estimate.confidence))}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Modo</p>
                    <p className="font-semibold">{estimate.valuation_mode || "—"}</p>
                  </div>
                  {estimate.as_of && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Data base</p>
                      <p className="font-semibold">{estimate.as_of}</p>
                    </div>
                  )}
                </div>

                {/* Explicação da avaliação */}
                {estimate.explanation_summary && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{estimate.explanation_summary}</p>
                  </div>
                )}

                {/* Principais fatores */}
                {Array.isArray(estimate.key_drivers) && estimate.key_drivers.length > 0 && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="mb-3 text-xs uppercase text-muted-foreground">Principais fatores</p>
                    <div className="space-y-2">
                      {estimate.key_drivers.map((driver: any) => (
                        <div key={driver.category} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">{driver.category}</span>
                          <span className={`font-semibold ${driver.direction === "negative" ? "text-destructive" : "text-emerald-600"}`}>
                            {driver.contribution >= 0 ? "+" : ""}{usd(driver.contribution)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Frota */}
        <Card>
          <CardHeader><CardTitle className="text-base">Frota Share Brasil</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-3">Matrícula</th>
                      <th className="px-3 py-3">Modelo</th>
                      <th className="px-3 py-3">Ano</th>
                      <th className="px-3 py-3">Horas</th>
                      <th className="px-3 py-3 text-right">Valor estimado</th>
                      <th className="px-3 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aeronaves.map((a) => {
                      const last = ultimaAvaliacao.get(a.id);
                      return (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="px-3 py-3 font-medium">{a.matricula}</td>
                          <td className="px-3 py-3 text-muted-foreground">{[a.fabricante, a.modelo].filter(Boolean).join(" ") || "—"}</td>
                          <td className="px-3 py-3">{a.ano || "—"}</td>
                          <td className="px-3 py-3">{a.horas_celula_atual ?? "—"}</td>
                          <td className="px-3 py-3 text-right font-semibold text-primary">
                            {last?.estimated_market_value ? usd(Number(last.estimated_market_value)) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button size="sm" variant="outline" disabled={loadingId === a.id} onClick={() => handleValuate(a)}>
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" /> Comparativo de valor por aeronave</CardTitle></CardHeader>
            <CardContent className="min-w-0">
              {comparativo.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Avalie ao menos uma aeronave para ver o comparativo.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comparativo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="matricula" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => usd(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4" /> Curva de depreciação</CardTitle></CardHeader>
            <CardContent className="min-w-0">
              {serieDepreciacao.length < 2 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">A curva aparece após duas ou mais avaliações registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={serieDepreciacao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => usd(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                    {matriculas.map((m, i) => (
                      <Line key={m} type="monotone" dataKey={m} stroke={`hsl(${(i * 67) % 360} 70% 55%)`} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}