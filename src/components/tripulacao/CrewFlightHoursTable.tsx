import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plane } from "lucide-react";

interface CrewFlightHoursTableProps {
  crewMemberId: string;
}

function formatHours(hours: number | null) {
  if (!hours) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function CrewFlightHoursTable({ crewMemberId }: CrewFlightHoursTableProps) {
  const { data: flightHours = [], isLoading } = useQuery({
    queryKey: ["crew_flight_hours", crewMemberId],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_flight_hours")
        .select(`
          id,
          month,
          year,
          total_hours,
          ifr_hours,
          not_hours,
          aircraft:aircraft_id(id, registration)
        `)
        .eq("crew_member_id", crewMemberId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getTotalHours = () => {
    return flightHours.reduce((sum, record: any) => sum + (record.total_hours || 0), 0);
  };

  const getTotalIfrHours = () => {
    return flightHours.reduce((sum, record: any) => sum + (record.ifr_hours || 0), 0);
  };

  const getTotalNightHours = () => {
    return flightHours.reduce((sum, record: any) => sum + (record.not_hours || 0), 0);
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          Horas de Voo por Aeronave
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : flightHours.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma hora de voo registrada</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">Total de Horas</div>
                <div className="text-2xl font-bold text-primary">{formatHours(getTotalHours())}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">Horas IFR</div>
                <div className="text-2xl font-bold text-blue-600">{formatHours(getTotalIfrHours())}</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">Horas Noturnas</div>
                <div className="text-2xl font-bold text-purple-600">{formatHours(getTotalNightHours())}</div>
              </div>
            </div>

            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Aeronave</TableHead>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">IFR</TableHead>
                  <TableHead className="text-right">NOT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flightHours.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.aircraft?.registration || "N/A"}
                    </TableCell>
                    <TableCell>
                      {monthNames[record.month - 1]} {record.year}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatHours(record.total_hours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(record.ifr_hours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(record.not_hours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
