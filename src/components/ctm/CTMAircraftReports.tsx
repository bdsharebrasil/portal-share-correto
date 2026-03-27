import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Fuel, BarChart3 } from "lucide-react";
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
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  aircraftId: string;
  aircraftRegistration: string;
}

const MONTH_NAMES = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const fmt2 = (v: number) => v.toFixed(2);

export function CTMAircraftReports({ aircraftId, aircraftRegistration }: Props) {
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);

  // ── Estado para selecionar qual campo de tempo usar ──────────────────────
  const [timeField, setTimeField] = useState<"time" | "total_time">("total_time");

  // ── 1. Busca o cliente (owner) vinculado à aeronave ──────────────────────
  const { data: clientData } = useQuery({
    queryKey: ["ctm-client", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, proprietario, share_percentage")
        .eq("aircraft", aircraftId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!aircraftId,
  });

  // ── 2. Busca os sócios do cliente ────────────────────────────────────────
  const { data: partnersData = [] } = useQuery({
    queryKey: ["ctm-partners", clientData?.id],
    queryFn: async () => {
      if (!clientData?.id) return [];
      const { data, error } = await supabase
        .from("client_partners")
        .select("id, name, share_percentage")
        .eq("client_id", clientData.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientData?.id,
  });

  // ── 3. Busca os lançamentos de voo (Logbook) ─────────────────────────────
  const { data: logbookEntries = [], isLoading, error } = useQuery({
    queryKey: ["ctm-logbook", aircraftId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, pousos, time, total_time, fuel_added, client_partner_id")
        .eq("aircraft_id", aircraftId)
        .gte("entry_date", `${year}-01-01`)
        .lte("entry_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // ── 4. Busca TODAS as aeronaves para o gráfico comparativo ────────────────
  const { data: allAircraftList = [] } = useQuery({
    queryKey: ["all-aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model")
        .order("registration");
      if (error) throw error;
      return data || [];
    },
  });

  // ── 5. Busca dados de combustível para TODAS as aeronaves ────────────────
  const { data: fuelDataByAircraft = {} } = useQuery({
    queryKey: ["fuel-data-all-aircraft", allAircraftList.map((a: any) => a.id)],
    queryFn: async () => {
      if (allAircraftList.length === 0) return {};

      const result: Record<string, any> = {};

      for (const aircraft of allAircraftList) {
        const { data, error } = await supabase
          .from("logbook_entries")
          .select("fuel_added, time, total_time")
          .eq("aircraft_id", aircraft.id);

        if (error) {
          console.error(`Erro ao buscar combustível para ${aircraft.registration}:`, error);
          result[aircraft.id] = { entries: [] };
        } else {
          result[aircraft.id] = { entries: data || [] };
        }
      }

      return result;
    },
    enabled: allAircraftList.length > 0,
  });

  // ── 6. Monta lista de participantes ──────────────────────────────────────
  const allParticipants = [];
  if (clientData) {
    const partnersTotal = partnersData.reduce((sum, p) => sum + (p.share_percentage ?? 0), 0);
    const ownerShare = clientData.share_percentage != null ? Number(clientData.share_percentage) : Math.max(0, 100 - partnersTotal);

    allParticipants.push({
      id: "owner",
      dbId: clientData.id,
      name: clientData.proprietario ?? "Proprietário",
      share: ownerShare,
    });

    for (const p of partnersData) {
      allParticipants.push({
        id: p.id,
        dbId: p.id,
        name: p.name,
        share: Number(p.share_percentage ?? 0),
      });
    }
  }

  // ── 7. Agregação de Dados por Mês e Participante ─────────────────────────
  const monthlyStats = Array.from({ length: 12 }, (_, monthIdx) => {
    const monthEntries = logbookEntries.filter((e: any) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d.getMonth() === monthIdx;
    });

    const totalPousos = monthEntries.reduce((s, e) => s + (Number(e.pousos) || 0), 0);
    const totalFuel = monthEntries.reduce((s, e) => s + (Number(e.fuel_added) || 0), 0);

    const totalHours = monthEntries.reduce((s, e) => {
      const hours = timeField === "time" ? Number(e.time) || 0 : Number(e.total_time) || 0;
      return s + hours;
    }, 0);

    const avgCons = totalHours > 0 ? totalFuel / totalHours : 0;

    const participantsData = allParticipants.map((p) => {
      const pEntries = monthEntries.filter((e) => {
        if (p.id === "owner") return !e.client_partner_id;
        return e.client_partner_id === p.id;
      });

      const pPousos = pEntries.reduce((s, e) => s + (Number(e.pousos) || 0), 0);
      const pFuel = pEntries.reduce((s, e) => s + (Number(e.fuel_added) || 0), 0);

      const pHours = pEntries.reduce((s, e) => {
        const hours = timeField === "time" ? Number(e.time) || 0 : Number(e.total_time) || 0;
        return s + hours;
      }, 0);

      const pTime = pEntries.reduce((s, e) => s + (Number(e.time) || 0), 0);
      const pTotalTime = pEntries.reduce((s, e) => s + (Number(e.total_time) || 0), 0);

      return {
        id: p.id,
        pousos: pPousos,
        fuel: pFuel,
        hours: pHours,
        time: pTime,
        totalTime: pTotalTime,
      };
    });

    const totalTime = monthEntries.reduce((s, e) => s + (Number(e.time) || 0), 0);
    const totalTotalTime = monthEntries.reduce((s, e) => s + (Number(e.total_time) || 0), 0);

    return {
      totalPousos,
      totalFuel,
      totalHours,
      totalTime,
      totalTotalTime,
      avgCons,
      participants: participantsData,
    };
  });

  // Totais Anuais
  const yearlyTotal = monthlyStats.reduce((acc, m) => ({
    pousos: acc.pousos + m.totalPousos,
    fuel: acc.fuel + m.totalFuel,
    hours: acc.hours + m.totalHours,
    time: acc.time + m.totalTime,
    totalTime: acc.totalTime + m.totalTotalTime,
  }), { pousos: 0, fuel: 0, hours: 0, time: 0, totalTime: 0 });

  const yearlyAvgCons = yearlyTotal.hours > 0 ? yearlyTotal.fuel / yearlyTotal.hours : 0;

  const yearlyParticipants = allParticipants.map((p) => {
    const pStats = monthlyStats.map(m => m.participants.find(part => part.id === p.id));
    return {
      ...p,
      pousos: pStats.reduce((s, ps) => s + (ps?.pousos || 0), 0),
      fuel: pStats.reduce((s, ps) => s + (ps?.fuel || 0), 0),
      hours: pStats.reduce((s, ps) => s + (ps?.hours || 0), 0),
      time: pStats.reduce((s, ps) => s + (ps?.time || 0), 0),
      totalTime: pStats.reduce((s, ps) => s + (ps?.totalTime || 0), 0),
    };
  });

  // ── 8. Dados para o gráfico comparativo de frota ──────────────────────────
  const chartData = useMemo(() => {
    return allAircraftList
      .map((aircraft: any) => {
        const entries = fuelDataByAircraft[aircraft.id]?.entries || [];

        if (entries.length === 0) {
          return null;
        }

        const totalFuelAdded = entries.reduce(
          (sum: number, e: any) => sum + (Number(e.fuel_added) || 0),
          0
        );

        const totalFlightHours = entries.reduce((sum: number, e: any) => {
          const h = Number(e.time) || 0;
          return sum + h;
        }, 0);

        const avgConsumption =
          totalFlightHours > 0 ? totalFuelAdded / totalFlightHours : 0;

        return {
          registration: aircraft.registration,
          model: aircraft.model || "—",
          avgConsumption: parseFloat(avgConsumption.toFixed(2)),
          totalFlights: entries.length,
          totalFuel: parseFloat(totalFuelAdded.toFixed(2)),
          totalHours: parseFloat(totalFlightHours.toFixed(2)),
          isCurrentAircraft: aircraft.id === aircraftId,
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => b.avgConsumption - a.avgConsumption);
  }, [allAircraftList, fuelDataByAircraft, aircraftId]);

  // ── 9. Render ─────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-8 text-center">Carregando dados...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Erro ao carregar dados.</div>;

  const timeFieldLabel = timeField === "time" ? "Tempo de Voo " : "Tempo Total ";

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Seletor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {aircraftRegistration} — {year}
            </CardTitle>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground">
                Base de Cálculo:
              </label>
              <Select value={timeField} onValueChange={(value: any) => setTimeField(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecione o campo de tempo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">
                    Tempo de Voo 
                  </SelectItem>
                  <SelectItem value="total_time">
                    Tempo Total 
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Usando: <strong>{timeFieldLabel}</strong>
          </p>
        </CardHeader>
      </Card>

      {/* Abas */}
      <Tabs defaultValue="pousos">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pousos" className="gap-2">
            <Plane className="h-4 w-4" /> Pousos
          </TabsTrigger>
          <TabsTrigger value="combustivel" className="gap-2">
            <Fuel className="h-4 w-4" /> Consumo
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Comparativo
          </TabsTrigger>
        </TabsList>

        {/* ABA POUSOS */}
        <TabsContent value="pousos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pousos — {aircraftRegistration} ({year})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-xs uppercase">
                      <th className="px-3 py-2 text-left border border-border">Mês</th>
                      <th className="px-3 py-2 text-center border border-border">Pousos</th>
                      <th className="px-3 py-2 text-center border border-border">H Voo</th>
                      <th className="px-3 py-2 text-center border border-border">H Total</th>
                      {allParticipants.map(p => (
                        <th key={p.id} className="px-3 py-2 text-center border border-border" colSpan={3}>
                          <div>{p.name}</div>
                          <div className="text-[10px] font-normal flex justify-center gap-2 mt-1">
                            <span>Pousos</span><span>H Voo</span><span>H Total</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 font-semibold border border-border">{name}</td>
                        <td className="px-3 py-2 text-center border border-border font-bold">{monthlyStats[i].totalPousos}</td>
                        <td className="px-3 py-2 text-center border border-border">{fmt2(monthlyStats[i].totalTime)}</td>
                        <td className="px-3 py-2 text-center border border-border">{fmt2(monthlyStats[i].totalTotalTime)}</td>
                        {monthlyStats[i].participants.map(p => (
                          <React.Fragment key={p.id}>
                            <td className="px-3 py-2 text-center border border-border">{p.pousos}</td>
                            <td className="px-3 py-2 text-center border border-border">{fmt2(p.time)}</td>
                            <td className="px-3 py-2 text-center border border-border">{fmt2(p.totalTime)}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-3 py-2 border border-border">TOTAL</td>
                      <td className="px-3 py-2 text-center border border-border">{yearlyTotal.pousos}</td>
                      <td className="px-3 py-2 text-center border border-border">{fmt2(yearlyTotal.time)}</td>
                      <td className="px-3 py-2 text-center border border-border">{fmt2(yearlyTotal.totalTime)}</td>
                      {yearlyParticipants.map(p => (
                        <React.Fragment key={p.id}>
                          <td className="px-3 py-2 text-center border border-border">{p.pousos}</td>
                          <td className="px-3 py-2 text-center border border-border">{fmt2(p.time)}</td>
                          <td className="px-3 py-2 text-center border border-border">{fmt2(p.totalTime)}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA COMBUSTÍVEL */}
        <TabsContent value="combustivel">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Consumo de Combustível — {aircraftRegistration} ({year})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-2">
                Consumo Médio calculado com: <strong>{timeFieldLabel}</strong>
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-xs uppercase">
                      <th className="px-3 py-2 text-left border border-border">Mês</th>
                      <th className="px-3 py-2 text-right border border-border">{timeField === "time" ? "H Voo" : "H Total"}</th>
                      <th className="px-3 py-2 text-right border border-border">Total (L)</th>
                      <th className="px-3 py-2 text-right border border-border">Cons. Méd (L/h)</th>
                      {allParticipants.map(p => (
                        <th key={p.id} className="px-3 py-2 text-right border border-border">
                          <div>{p.name}</div>
                          <div className="text-[10px] font-normal">(L)</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-3 py-2 font-semibold border border-border">{name}</td>
                        <td className="px-3 py-2 text-right border border-border">{fmt2(monthlyStats[i].totalHours)}</td>
                        <td className="px-3 py-2 text-right border border-border font-bold">{fmt2(monthlyStats[i].totalFuel)}</td>
                        <td className="px-3 py-2 text-right border border-border">{monthlyStats[i].avgCons > 0 ? fmt2(monthlyStats[i].avgCons) : "—"}</td>
                        {monthlyStats[i].participants.map(p => (
                          <td key={p.id} className="px-3 py-2 text-right border border-border">{fmt2(p.fuel)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-3 py-2 border border-border">TOTAL</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt2(yearlyTotal.hours)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt2(yearlyTotal.fuel)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt2(yearlyAvgCons)}</td>
                      {yearlyParticipants.map(p => (
                        <td key={p.id} className="px-3 py-2 text-right border border-border">{fmt2(p.fuel)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA COMPARATIVO DE FROTA */}
        <TabsContent value="comparativo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Comparação de Consumo Médio de Combustível (L/h)
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Consumo médio histórico de cada aeronave baseado em todos os registros de voo
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Gráfico de barras */}
                {chartData.length > 0 ? (
                  <div className="w-full h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis
                          dataKey="registration"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          label={{ value: "L/h", angle: -90, position: "insideLeft" }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                          }}
                          formatter={(value: any) => {
                            if (typeof value === "number") {
                              return value.toFixed(2);
                            }
                            return value;
                          }}
                          labelFormatter={(label) => `Aeronave: ${label}`}
                        />
                        <Legend />
                        <Bar
                          dataKey="avgConsumption"
                          fill="var(--color-primary)"
                          name="Consumo Médio (L/h)"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Nenhuma aeronave com dados de combustível encontrada.
                  </div>
                )}

                {/* Tabela detalhada */}
                {chartData.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                          <th className="px-4 py-2 text-left font-semibold border border-border">
                            Aeronave
                          </th>
                          <th className="px-4 py-2 text-left font-semibold border border-border">
                            Modelo
                          </th>
                          <th className="px-4 py-2 text-right font-semibold border border-border">
                            Consumo Médio (L/h)
                          </th>
                          <th className="px-4 py-2 text-right font-semibold border border-border">
                            Total Combustível (L)
                          </th>
                          <th className="px-4 py-2 text-right font-semibold border border-border">
                            Total Horas
                          </th>
                          <th className="px-4 py-2 text-right font-semibold border border-border">
                            Nº Voos
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            className={item.isCurrentAircraft ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/20"}
                          >
                            <td className="px-4 py-2 font-semibold border border-border">
                              {item.registration}
                              {item.isCurrentAircraft && (
                                <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                  Atual
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 border border-border text-muted-foreground">
                              {item.model}
                            </td>
                            <td className="px-4 py-2 text-right border border-border font-bold text-primary">
                              {item.avgConsumption.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right border border-border">
                              {item.totalFuel.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right border border-border">
                              {item.totalHours.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right border border-border">
                              {item.totalFlights}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Resumo estatístico */}
                {chartData.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        Maior Consumo
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {chartData[0]?.registration} ({chartData[0]?.avgConsumption.toFixed(2)} L/h)
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        Menor Consumo
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {chartData[chartData.length - 1]?.registration} (
                        {chartData[chartData.length - 1]?.avgConsumption.toFixed(2)} L/h)
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">
                        Consumo Médio (Frota)
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {(
                          chartData.reduce((sum: number, a: any) => sum + a.avgConsumption, 0) /
                          chartData.length
                        ).toFixed(2)}{" "}
                        L/h
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
