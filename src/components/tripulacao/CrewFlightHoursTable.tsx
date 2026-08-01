// @ts-nocheck
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plane, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

interface CrewFlightHoursTableProps {
  crewMemberId: string;
}

function formatHours(hours: number | null) {
  if (!hours) return "00:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CrewFlightHoursTable({ crewMemberId }: CrewFlightHoursTableProps) {
  const queryClient = useQueryClient();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedAeronave, setSelectedAircraft] = useState<string>("all");

  // Colunas corretas conforme schema real de lancamentos_diario_bordo:
  //   data_registro  (era entry_date)
  //   tempo_total    (era total_time)
  //   tempo_ifr      (era ifr_time)
  //   horas_noturnas (era night_hours)
  //   aeronave:aeronave_id(id, matricula, modelo)  — alias correto da FK
  const { data: flightHours = [], isLoading, refetch } = useQuery({
    queryKey: ["crew_flight_hours_from_logbook", crewMemberId],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select(`
          id,
          data_registro,
          tempo_total,
          tempo_ifr,
          horas_noturnas,
          pic_canac,
          sic_canac,
          aeronave:aeronave_id(id, matricula, modelo)
        `)
        .or(`pic_canac.eq.${crewMemberId},sic_canac.eq.${crewMemberId}`)
        .order("data_registro", { ascending: false });

      if (error) throw error;

      // Agregar por mês/ano/aeronave
      const aggregated: Record<string, {
        month: number;
        year: number;
        aeronave: { id: string; matricula: string; modelo?: string } | null;
        pic_hours: number;
        sic_hours: number;
        total_hours: number;
        ifr_hours: number;
        not_hours: number;
      }> = {};

      for (const entry of entries || []) {
        const date = new Date(entry.data_registro);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const aircraftId = (entry.aeronave as any)?.id || "unknown";
        const key = `${year}-${month}-${aircraftId}`;

        if (!aggregated[key]) {
          aggregated[key] = {
            month,
            year,
            aeronave: entry.aeronave as any,
            pic_hours: 0,
            sic_hours: 0,
            total_hours: 0,
            ifr_hours: 0,
            not_hours: 0,
          };
        }

        const totalTime = Number(entry.tempo_total || 0);

        if (entry.pic_canac === crewMemberId) {
          aggregated[key].pic_hours += totalTime;
        } else if (entry.sic_canac === crewMemberId) {
          aggregated[key].sic_hours += totalTime;
        }

        aggregated[key].total_hours += totalTime;
        aggregated[key].ifr_hours += Number(entry.tempo_ifr || 0);
        aggregated[key].not_hours += Number(entry.horas_noturnas || 0);
      }

      return Object.values(aggregated)
        .map((item, index) => ({ ...item, id: `${index}` }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
    },
  });

  // Lista única de aeronaves para o filtro
  const aircraftList = useMemo(() => {
    const set = new Set<string>();
    flightHours.forEach((r) => {
      if (r.aeronave?.matricula) set.add(r.aeronave.matricula);
    });
    return Array.from(set).sort();
  }, [flightHours]);

  // Filtros
  const filteredFlightHours = useMemo(() => {
    let filtered = [...flightHours];

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((r) => new Date(r.year, r.month - 1, 1) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter((r) => new Date(r.year, r.month - 1, 1) <= toDate);
    }

    if (selectedAeronave !== "all") {
      filtered = filtered.filter((r) => r.aeronave?.matricula === selectedAeronave);
    }

    // Sem filtros de data: exibe apenas os 3 últimos meses
    if (!dateFrom && !dateTo) {
      filtered = filtered.slice(0, 3);
    }

    return filtered;
  }, [flightHours, dateFrom, dateTo, selectedAeronave]);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const sum = (key: keyof typeof filteredFlightHours[0]) =>
    filteredFlightHours.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedAircraft("all");
  };

  const hasActiveFilters = dateFrom || dateTo || selectedAeronave !== "all";

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await refetch();
      toast.success("Horas de voo atualizadas com sucesso!");
    } catch {
      toast.error("Erro ao atualizar horas de voo");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <Card className="border border-slate-800/70 bg-slate-950/85 shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/70 pb-3 mb-3">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Plane className="h-5 w-5 text-slate-100" />
          Horas de Voo por Aeronave
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="h-9"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : flightHours.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma hora de voo registrada</div>
        ) : (
          <>
            {/* Filtros */}
            <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-100">Filtros de Pesquisa</h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 px-2 text-xs text-slate-300">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpar filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date-from" className="text-xs">Data Inicial</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date-to" className="text-xs">Data Final</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aircraft-select" className="text-xs">Aeronave</Label>
                  <Select value={selectedAeronave} onValueChange={setSelectedAircraft}>
                    <SelectTrigger id="aircraft-select" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as aeronaves</SelectItem>
                      {aircraftList.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Totalizadores */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4">
                <div className="text-xs text-slate-400">PIC (Comandante)</div>
                <div className="text-2xl font-bold text-slate-100">{formatHours(sum("pic_hours"))}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4">
                <div className="text-xs text-slate-400">SIC (2º Piloto)</div>
                <div className="text-2xl font-bold text-slate-100">{formatHours(sum("sic_hours"))}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4">
                <div className="text-xs text-slate-400">Total de Horas</div>
                <div className="text-2xl font-bold text-slate-100">{formatHours(sum("total_hours"))}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4">
                <div className="text-xs text-slate-400">Horas IFR</div>
                <div className="text-2xl font-bold text-slate-100">{formatHours(sum("ifr_hours"))}</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800/70 rounded-2xl p-4">
                <div className="text-xs text-slate-400">Horas Noturnas</div>
                <div className="text-2xl font-bold text-slate-100">{formatHours(sum("not_hours"))}</div>
              </div>
            </div>

            {filteredFlightHours.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhum registro encontrado com os filtros selecionados</p>
              </div>
            ) : (
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Aeronave</TableHead>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead className="text-right">PIC</TableHead>
                    <TableHead className="text-right">SIC</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">IFR</TableHead>
                    <TableHead className="text-right">NOT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlightHours.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.aeronave?.matricula || "N/A"}
                      </TableCell>
                      <TableCell>
                        {monthNames[record.month - 1]} {record.year}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="bg-slate-900/70 text-slate-100 px-2 py-1 rounded text-xs font-semibold">
                          {formatHours(record.pic_hours)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="bg-slate-900/70 text-slate-100 px-2 py-1 rounded text-xs font-semibold">
                          {formatHours(record.sic_hours)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatHours(record.total_hours)}
                      </TableCell>
                      <TableCell className="text-right">{formatHours(record.ifr_hours)}</TableCell>
                      <TableCell className="text-right">{formatHours(record.not_hours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}