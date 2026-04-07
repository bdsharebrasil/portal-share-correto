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

  // Busca horas diretamente do lancamentos_diario_bordo (fonte primária)
  const { data: flightHours = [], isLoading, refetch } = useQuery({
    queryKey: ["crew_flight_hours_from_logbook", crewMemberId],
    enabled: !!crewMemberId,
    queryFn: async () => {
      // Buscar todas as entradas onde o tripulante é PIC ou SIC
      const { data: entries, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select(`
          id,
          entry_date,
          total_time,
          ifr_time,
          night_hours,
          pic_canac,
          sic_canac,
          aircraft:aeronave_id(id, registration, model)
        `)
        .or(`pic_canac.eq.${crewMemberId},sic_canac.eq.${crewMemberId}`)
        .order("entry_date", { ascending: false });

      if (error) throw error;

      // Agregar por mês/ano/aeronave
      const aggregated: Record<string, {
        month: number;
        year: number;
        aircraft: { id: string; registration: string } | null;
        pic_hours: number;
        sic_hours: number;
        total_hours: number;
        ifr_hours: number;
        not_hours: number;
      }> = {};

      for (const entry of entries || []) {
        const date = new Date(entry.entry_date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const aircraftId = (entry.aeronave as any)?.id || 'unknown';
        const key = `${year}-${month}-${aircraftId}`;

        if (!aggregated[key]) {
          aggregated[key] = {
            month,
            year,
            aircraft: entry.aeronave as any,
            pic_hours: 0,
            sic_hours: 0,
            total_hours: 0,
            ifr_hours: 0,
            not_hours: 0,
          };
        }

        const totalTime = Number(entry.total_time || 0);

        // Separar horas de PIC e SIC
        if (entry.pic_canac === crewMemberId) {
          aggregated[key].pic_hours += totalTime;
        } else if (entry.sic_canac === crewMemberId) {
          aggregated[key].sic_hours += totalTime;
        }

        aggregated[key].total_hours += totalTime;
        aggregated[key].ifr_hours += Number(entry.ifr_time || 0);
        aggregated[key].not_hours += Number(entry.night_hours || 0);
      }

      // Converter para array e ordenar
      return Object.values(aggregated)
        .map((item, index) => ({ ...item, id: `${index}` }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
    },
  });

  // Obter lista única de aeronaves
  const aircraftList = useMemo(() => {
    const aircraftSet = new Set<string>();
    flightHours.forEach((record) => {
      if (record.aeronave?.matricula) {
        aircraftSet.add(record.aeronave.matricula);
      }
    });
    return Array.from(aircraftSet).sort();
  }, [flightHours]);

  // Filtrar dados baseado nos critérios
  const filteredFlightHours = useMemo(() => {
    let filtered = [...flightHours];

    // Filtrar por data (se fornecida)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((record) => {
        const recordDate = new Date(record.year, record.month - 1, 1);
        return recordDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter((record) => {
        const recordDate = new Date(record.year, record.month - 1, 1);
        return recordDate <= toDate;
      });
    }

    // Filtrar por aeronave
    if (selectedAeronave !== "all") {
      filtered = filtered.filter(
        (record) => record.aeronave?.matricula === selectedAeronave
      );
    }

    // Se nenhum filtro de data foi aplicado, mostrar apenas os 3 últimos meses
    if (!dateFrom && !dateTo) {
      filtered = filtered.slice(0, 3);
    }

    return filtered;
  }, [flightHours, dateFrom, dateTo, selectedAeronave]);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getTotalPicHours = () => {
    return filteredFlightHours.reduce((sum, record) => sum + (record.pic_hours || 0), 0);
  };

  const getTotalSicHours = () => {
    return filteredFlightHours.reduce((sum, record) => sum + (record.sic_hours || 0), 0);
  };

  const getTotalHours = () => {
    return filteredFlightHours.reduce((sum, record) => sum + (record.total_hours || 0), 0);
  };

  const getTotalIfrHours = () => {
    return filteredFlightHours.reduce((sum, record) => sum + (record.ifr_hours || 0), 0);
  };

  const getTotalNightHours = () => {
    return filteredFlightHours.reduce((sum, record) => sum + (record.not_hours || 0), 0);
  };

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
    } catch (error) {
      toast.error("Erro ao atualizar horas de voo");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          Horas de Voo por Aeronave
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRecalculate}
          disabled={isRecalculating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
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
            <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Filtros de Pesquisa</h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-8 px-2 text-xs"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpar filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date-from" className="text-xs">
                    Data Inicial
                  </Label>
                  <Input
                    id="date-from"
                    type="data"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date-to" className="text-xs">
                    Data Final
                  </Label>
                  <Input
                    id="date-to"
                    type="data"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aircraft-select" className="text-xs">
                    Aeronave
                  </Label>
                  <Select value={selectedAeronave} onValueChange={setSelectedAircraft}>
                    <SelectTrigger id="aircraft-select" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as aeronaves</SelectItem>
                      {aircraftList.map((aircraft) => (
                        <SelectItem key={aircraft} value={aircraft}>
                          {aircraft}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">PIC (Comandante)</div>
                <div className="text-2xl font-bold text-emerald-600">{formatHours(getTotalPicHours())}</div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground">SIC (2º Piloto)</div>
                <div className="text-2xl font-bold text-cyan-600">{formatHours(getTotalSicHours())}</div>
              </div>
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
                        <span className="bg-emerald-500/20 text-emerald-600 px-2 py-1 rounded text-xs font-semibold">
                          {formatHours(record.pic_hours)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="bg-cyan-500/20 text-cyan-600 px-2 py-1 rounded text-xs font-semibold">
                          {formatHours(record.sic_hours)}
                        </span>
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
