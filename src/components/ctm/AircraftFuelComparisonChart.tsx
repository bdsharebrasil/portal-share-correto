import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Fuel } from "lucide-react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AircraftFuelComparisonChart() {
  // ── 1. Busca todas as aeronaves ──────────────────────────────────────────
  const { data: aircraftList = [] } = useQuery({
    queryKey: ["all-aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo')
        .order("matricula");
      if (error) throw error;
      return data || [];
    },
  });

  // ── 2. Busca dados de combustível para cada aeronave ─────────────────────
  const { data: fuelDataByAircraft = {} } = useQuery({
    queryKey: ["fuel-data-all-aircraft", aircraftList.map((a: any) => a.id)],
    queryFn: async () => {
      if (aircraftList.length === 0) return {};

      const result: Record<string, any> = {};

      for (const ac of aircraftList) {
        const { data, error } = await supabase
          .from("logbook_entries")
          .select("fuel_added, flight_time_hours, flight_time_minutes")
          .eq("aeronave_id", ac.id);

        if (error) {
          console.error(`Erro ao buscar combustível para ${ac.matricula}:`, error);
          result[ac.id] = { entries: [] };
        } else {
          result[ac.id] = { entries: data || [] };
        }
      }

      return result;
    },
    enabled: aircraftList.length > 0,
  });

  // ── 3. Calcula consumo médio por aeronave ────────────────────────────────
  const chartData = useMemo(() => {
    return aircraftList
      .map((ac: any) => {
        const entries = fuelDataByAircraft[ac.id]?.entries || [];

        if (entries.length === 0) {
          return null;
        }

        // Calcula totais
        const totalFuelAdded = entries.reduce(
          (sum: number, e: any) => sum + (Number(e.fuel_added) || 0),
          0
        );

        const totalFlightHours = entries.reduce((sum: number, e: any) => {
          const h = Number(e.flight_time_hours) || 0;
          const m = Number(e.flight_time_minutes) || 0;
          return sum + h + m / 60;
        }, 0);

        // Consumo médio em L/h
        const avgConsumption =
          totalFlightHours > 0 ? totalFuelAdded / totalFlightHours : 0;

        return {
          registration: ac.matricula,
          model: ac.modelo || "—",
          avgConsumption: parseFloat(avgConsumption.toFixed(2)),
          totalFlights: entries.length,
          totalFuel: parseFloat(totalFuelAdded.toFixed(2)),
          totalHours: parseFloat(totalFlightHours.toFixed(2)),
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => b.avgConsumption - a.avgConsumption);
  }, [aircraftList, fuelDataByAircraft]);

  // ── 4. Render ─────────────────────────────────────────────────────────────
  if (chartData.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Comparação de Consumo de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Nenhuma aeronave com dados de combustível encontrada.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Fuel className="h-5 w-5 text-primary" />
          Comparação de Consumo Médio de Combustível (L/h)
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Consumo médio histórico de cada aeronave baseado em todos os registros de voo
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gráfico de barras */}
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

          {/* Tabela detalhada */}
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
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="px-4 py-2 font-semibold border border-border">
                      {item.registration}
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

          {/* Resumo estatístico */}
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
        </div>
      </CardContent>
    </Card>
  );
}
