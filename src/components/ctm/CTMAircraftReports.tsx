import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, Fuel, Settings } from "lucide-react";
import { CTMItensNaoControlados } from "./CTMItensNaoControlados";

interface Props {
  aircraftId: string;
  aircraftRegistration: string;
}

const MONTH_NAMES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function CTMAircraftReports({ aircraftId, aircraftRegistration }: Props) {
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);

  // Pousos por mês
  const { data: landingsData = [] } = useQuery({
    queryKey: ["ctm-landings", aircraftId, year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, pousos")
        .eq("aircraft_id", aircraftId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // Consumo de combustível por mês
  const { data: fuelData = [] } = useQuery({
    queryKey: ["ctm-fuel", aircraftId, year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, fuel_added, flight_time, total_time")
        .eq("aircraft_id", aircraftId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  // Aggregate landings by month
  const landingsByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthEntries = landingsData.filter((e: any) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d.getMonth() === i;
    });
    return monthEntries.reduce((sum: number, e: any) => sum + (e.pousos || 0), 0);
  });

  // Aggregate fuel consumption by month
  const fuelByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthEntries = fuelData.filter((e: any) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d.getMonth() === i;
    });
    const tVoo = monthEntries.reduce((s: number, e: any) => s + (e.flight_time || 0), 0);
    const tTotal = monthEntries.reduce((s: number, e: any) => s + (e.total_time || 0), 0);
    const abast = monthEntries.reduce((s: number, e: any) => s + (e.fuel_added || 0), 0);
    const medVoo = tVoo > 0 ? abast / tVoo : 0;
    const medTT = tTotal > 0 ? abast / tTotal : 0;
    const medEst = (medVoo + medTT) / 2;
    return { tVoo, tTotal, abast, medVoo, medTT, medEst };
  });

  const totalLandings = landingsByMonth.reduce((a, b) => a + b, 0);
  const totalFuel = fuelByMonth.reduce((a, b) => ({ tVoo: a.tVoo + b.tVoo, tTotal: a.tTotal + b.tTotal, abast: a.abast + b.abast, medVoo: 0, medTT: 0, medEst: 0 }), { tVoo: 0, tTotal: 0, abast: 0, medVoo: 0, medTT: 0, medEst: 0 });
  totalFuel.medVoo = totalFuel.tVoo > 0 ? totalFuel.abast / totalFuel.tVoo : 0;
  totalFuel.medTT = totalFuel.tTotal > 0 ? totalFuel.abast / totalFuel.tTotal : 0;
  totalFuel.medEst = (totalFuel.medVoo + totalFuel.medTT) / 2;

  const fmt = (v: number) => v.toFixed(2);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pousos">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pousos" className="gap-2">
            <Plane className="h-4 w-4" /> Pousos
          </TabsTrigger>
          <TabsTrigger value="combustivel" className="gap-2">
            <Fuel className="h-4 w-4" /> Consumo de Combustível
          </TabsTrigger>
          <TabsTrigger value="itens" className="gap-2">
            <Settings className="h-4 w-4" /> Itens Não Controlados
          </TabsTrigger>
        </TabsList>

        {/* POUSOS */}
        <TabsContent value="pousos">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Pousos - {aircraftRegistration} ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                      <th className="px-4 py-2 text-left font-semibold border border-border">Mês</th>
                      <th className="px-4 py-2 text-center font-semibold border border-border">Total Pousos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-2 font-semibold border border-border">{name}</td>
                        <td className="px-4 py-2 text-center border border-border">{landingsByMonth[i]}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-4 py-2 border border-border">TT</td>
                      <td className="px-4 py-2 text-center border border-border">{totalLandings}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONSUMO DE COMBUSTÍVEL */}
        <TabsContent value="combustivel">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="h-5 w-5 text-primary" />
                Consumo de Combustível - {aircraftRegistration} ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground text-xs uppercase">
                      <th className="px-3 py-2 text-left font-semibold border border-border">Mês</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">T Voo</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">T Total</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">Abast.</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">Med Voo</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">Med TT</th>
                      <th className="px-3 py-2 text-right font-semibold border border-border">Med Est</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((name, i) => {
                      const f = fuelByMonth[i];
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold border border-border">{name}</td>
                          <td className="px-3 py-2 text-right border border-border">{fmt(f.tVoo)}</td>
                          <td className="px-3 py-2 text-right border border-border">{fmt(f.tTotal)}</td>
                          <td className="px-3 py-2 text-right border border-border">{fmt(f.abast)}</td>
                          <td className="px-3 py-2 text-right border border-border">{f.tVoo > 0 ? fmt(f.medVoo) : ""}</td>
                          <td className="px-3 py-2 text-right border border-border">{f.tTotal > 0 ? fmt(f.medTT) : ""}</td>
                          <td className="px-3 py-2 text-right border border-border">{f.tVoo > 0 || f.tTotal > 0 ? fmt(f.medEst) : ""}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/10 font-bold">
                      <td className="px-3 py-2 border border-border">TT</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.tVoo)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.tTotal)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.abast)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.medVoo)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.medTT)}</td>
                      <td className="px-3 py-2 text-right border border-border">{fmt(totalFuel.medEst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ITENS NÃO CONTROLADOS */}
        <TabsContent value="itens">
          <CTMItensNaoControlados aircraftId={aircraftId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
