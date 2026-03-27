import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Fuel } from "lucide-react";

interface Props {
  aircraftId: string;
  aircraftRegistration: string;
}

const MONTH_NAMES = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt2 = (v: number) => v.toFixed(2);
const fmtInt = (v: number) => Math.round(v).toString();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CTMAircraftReports({ aircraftId, aircraftRegistration }: Props) {
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);

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
      const { data, error } = await supabase
        .from("client_partners")
        .select("id, name, share_percentage")
        .eq("client_id", clientData!.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientData?.id,
  });

  // ── 3. Monta lista de participantes (proprietário + sócios) ──────────────
  // O proprietário ocupa a fração restante após os sócios.
  const allParticipants: Array<{ id: string; name: string; share: number }> =
    [];

  if (clientData) {
    const partnersTotal = partnersData.reduce(
      (sum, p) => sum + (p.share_percentage ?? 0),
      0
    );
    const ownerShare =
      clientData.share_percentage != null
        ? Number(clientData.share_percentage)
        : 100 - partnersTotal;

    allParticipants.push({
      id: clientData.id,
      name: clientData.proprietario ?? "Proprietário",
      share: ownerShare,
    });

    for (const p of partnersData) {
      allParticipants.push({
        id: p.id,
        name: p.name,
        share: Number(p.share_percentage ?? 0),
      });
    }
  }

  // ── 4. Pousos por mês ────────────────────────────────────────────────────
  const { data: landingsData = [] } = useQuery({
    queryKey: ["ctm-landings", aircraftId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, landings")
        .eq("aircraft_id", aircraftId)
        .gte("entry_date", `${year}-01-01`)
        .lte("entry_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // ── 5. Combustível por mês ───────────────────────────────────────────────
  const { data: fuelData = [] } = useQuery({
    queryKey: ["ctm-fuel", aircraftId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, fuel_added, flight_time_hours, flight_time_minutes")
        .eq("aircraft_id", aircraftId)
        .gte("entry_date", `${year}-01-01`)
        .lte("entry_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // ── 6. Agrega pousos por mês ─────────────────────────────────────────────
  const landingsByMonth = Array.from({ length: 12 }, (_, i) => {
    const entries = landingsData.filter((e: any) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d.getMonth() === i;
    });
    return entries.reduce(
      (sum: number, e: any) => sum + (Number(e.landings) || 0),
      0
    );
  });

  const totalLandings = landingsByMonth.reduce((a, b) => a + b, 0);

  // Pousos por participante por mês (proporcional ao share)
  const landingsByParticipantMonth = allParticipants.map((p) => ({
    ...p,
    monthly: landingsByMonth.map((l) => (l * p.share) / 100),
    total: (totalLandings * p.share) / 100,
  }));

  // ── 7. Agrega combustível por mês ────────────────────────────────────────
  // Tempo de voo em horas decimais = hours + minutes/60
  const fuelByMonth = Array.from({ length: 12 }, (_, i) => {
    const entries = fuelData.filter((e: any) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d.getMonth() === i;
    });

    const totalFuelAdded = entries.reduce(
      (s: number, e: any) => s + (Number(e.fuel_added) || 0),
      0
    );
    const totalFlightHours = entries.reduce((s: number, e: any) => {
      const h = Number(e.flight_time_hours) || 0;
      const m = Number(e.flight_time_minutes) || 0;
      return s + h + m / 60;
    }, 0);

    // Consumo médio = litros / hora de voo
    const avgConsumption =
      totalFlightHours > 0 ? totalFuelAdded / totalFlightHours : 0;

    return { totalFuelAdded, totalFlightHours, avgConsumption };
  });

  const totalFuelYear = fuelByMonth.reduce(
    (acc, m) => ({
      totalFuelAdded: acc.totalFuelAdded + m.totalFuelAdded,
      totalFlightHours: acc.totalFlightHours + m.totalFlightHours,
      avgConsumption: 0,
    }),
    { totalFuelAdded: 0, totalFlightHours: 0, avgConsumption: 0 }
  );
  totalFuelYear.avgConsumption =
    totalFuelYear.totalFlightHours > 0
      ? totalFuelYear.totalFuelAdded / totalFuelYear.totalFlightHours
      : 0;

  // Combustível por participante por mês (proporcional ao share)
  const fuelByParticipantMonth = allParticipants.map((p) => ({
    ...p,
    monthly: fuelByMonth.map((m) => ({
      fuelAdded: (m.totalFuelAdded * p.share) / 100,
      flightHours: (m.totalFlightHours * p.share) / 100,
      // consumo médio é o mesmo para todos (L/h não muda com a proporção)
      avgConsumption: m.avgConsumption,
    })),
    totalFuelAdded: (totalFuelYear.totalFuelAdded * p.share) / 100,
    totalFlightHours: (totalFuelYear.totalFlightHours * p.share) / 100,
    avgConsumption: totalFuelYear.avgConsumption,
  }));

  // ── 8. Render ─────────────────────────────────────────────────────────────
  const hasParticipants = allParticipants.length > 0;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pousos">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pousos" className="gap-2">
            <Plane className="h-4 w-4" /> Pousos
          </TabsTrigger>
          <TabsTrigger value="combustivel" className="gap-2">
            <Fuel className="h-4 w-4" /> Consumo de Combustível
          </TabsTrigger>
        </TabsList>

        {/* ── ABA: POUSOS ─────────────────────────────────────────────────── */}
        <TabsContent value="pousos">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Pousos — {aircraftRegistration} ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                      <th className="px-4 py-2 text-left font-semibold border border-border">
                        Mês
                      </th>
                      <th className="px-4 py-2 text-center font-semibold border border-border">
                        Total
                      </th>
                      {hasParticipants &&
                        allParticipants.map((p) => (
                          <th
                            key={p.id}
                            className="px-4 py-2 text-center font-semibold border border-border whitespace-nowrap"
                          >
                            {p.name}
                            <span className="block text-[10px] font-normal text-muted-foreground">
                              {p.share.toFixed(1)}%
                            </span>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-semibold border border-border">
                          {name}
                        </td>
                        <td className="px-4 py-2 text-center border border-border">
                          {landingsByMonth[i]}
                        </td>
                        {hasParticipants &&
                          landingsByParticipantMonth.map((p) => (
                            <td
                              key={p.id}
                              className="px-4 py-2 text-center border border-border"
                            >
                              {fmt2(p.monthly[i])}
                            </td>
                          ))}
                      </tr>
                    ))}
                    {/* Linha de totais */}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-4 py-2 border border-border">TT</td>
                      <td className="px-4 py-2 text-center border border-border">
                        {totalLandings}
                      </td>
                      {hasParticipants &&
                        landingsByParticipantMonth.map((p) => (
                          <td
                            key={p.id}
                            className="px-4 py-2 text-center border border-border"
                          >
                            {fmt2(p.total)}
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA: COMBUSTÍVEL ─────────────────────────────────────────────── */}
        <TabsContent value="combustivel">
          {/* Tabela geral (total aeronave) */}
          <Card className="border-border bg-card mb-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="h-5 w-5 text-primary" />
                Consumo de Combustível — {aircraftRegistration} ({year}) — Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                      <th className="px-3 py-2 text-left font-semibold border border-border">
                        Mês
                      </th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">
                        H Voo
                      </th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">
                        Abast. (L)
                      </th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">
                        Cons. Méd. (L/h)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => {
                      const f = fuelByMonth[i];
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold border border-border">
                            {name}
                          </td>
                          <td className="px-3 py-2 text-right border border-border">
                            {f.totalFlightHours > 0
                              ? fmt2(f.totalFlightHours)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right border border-border">
                            {f.totalFuelAdded > 0
                              ? fmt2(f.totalFuelAdded)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right border border-border">
                            {f.avgConsumption > 0
                              ? fmt2(f.avgConsumption)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-3 py-2 border border-border">TT</td>
                      <td className="px-3 py-2 text-right border border-border">
                        {fmt2(totalFuelYear.totalFlightHours)}
                      </td>
                      <td className="px-3 py-2 text-right border border-border">
                        {fmt2(totalFuelYear.totalFuelAdded)}
                      </td>
                      <td className="px-3 py-2 text-right border border-border">
                        {totalFuelYear.avgConsumption > 0
                          ? fmt2(totalFuelYear.avgConsumption)
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Tabelas por sócio */}
          {hasParticipants &&
            fuelByParticipantMonth.map((p) => (
              <Card key={p.id} className="border-border bg-card mb-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-primary" />
                    Combustível — {p.name}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({p.share.toFixed(1)}%)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                          <th className="px-3 py-2 text-left font-semibold border border-border">
                            Mês
                          </th>
                          <th className="px-3 py-2 text-right font-semibold border border-border">
                            H Voo
                          </th>
                          <th className="px-3 py-2 text-right font-semibold border border-border">
                            Abast. (L)
                          </th>
                          <th className="px-3 py-2 text-right font-semibold border border-border">
                            Cons. Méd. (L/h)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTH_NAMES.map((name, i) => {
                          const m = p.monthly[i];
                          return (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-semibold border border-border">
                                {name}
                              </td>
                              <td className="px-3 py-2 text-right border border-border">
                                {m.flightHours > 0 ? fmt2(m.flightHours) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right border border-border">
                                {m.fuelAdded > 0 ? fmt2(m.fuelAdded) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right border border-border">
                                {m.avgConsumption > 0
                                  ? fmt2(m.avgConsumption)
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-primary/10 font-bold">
                          <td className="px-3 py-2 border border-border">TT</td>
                          <td className="px-3 py-2 text-right border border-border">
                            {fmt2(p.totalFlightHours)}
                          </td>
                          <td className="px-3 py-2 text-right border border-border">
                            {fmt2(p.totalFuelAdded)}
                          </td>
                          <td className="px-3 py-2 text-right border border-border">
                            {p.avgConsumption > 0
                              ? fmt2(p.avgConsumption)
                              : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
