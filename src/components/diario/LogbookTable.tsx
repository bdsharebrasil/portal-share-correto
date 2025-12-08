import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDecimalHoursToHHMM } from "@/lib/utils";

interface LogbookEntry {
  id: string;
  entry_date: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  flight_time_hours: number;
  flight_time_minutes: number;
  night_time_hours: number;
  night_time_minutes: number;
  total_time: number;
  ifr_count: number;
  landings: number;
  fuel_added: number;
  fuel_liters: number | null;
  fuel_cell: number | null;
  pc: number | null;
  isc: string | null;
  daily_rate: number | null;
  extras: string | null;
  flight_type: string | null;
  remarks: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

interface Aircraft {
  registration: string;
  model: string;
}

interface LogbookTableProps {
  entries: LogbookEntry[];
  isLoading: boolean;
  aircraft?: Aircraft;
  isReadOnly?: boolean;
  onAddEntry?: (prefilledDate?: Date) => void;
}

export function LogbookTable({ entries, isLoading, aircraft, isReadOnly = false, onAddEntry }: LogbookTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();

  const currentUserId = user?.id ?? null;
  const canVerify = roles.includes("admin") || roles.includes("piloto_chefe");

  const handleVerifyToggle = async (entryId: string, currentlyVerified: boolean) => {
    if (!canVerify || isReadOnly || !currentUserId) {
      return;
    }

    try {
      const { error } = await supabase
        .from("logbook_entries")
        .update({
          confirmed_by: currentlyVerified ? null : currentUserId,
          confirmed_at: currentlyVerified ? null : new Date().toISOString(),
          confirmed: !currentlyVerified,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast({
        title: currentlyVerified ? "Verificação removida" : "Registro verificado",
        description: currentlyVerified ? "A verificação foi removida." : "Registro marcado como conferido.",
      });

      queryClient.invalidateQueries({ queryKey: ["logbook-entries"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + entry.total_time, 0);
  const totalLandings = entries.reduce((sum, entry) => sum + entry.landings, 0);
  const totalFuelAdded = entries.reduce((sum, entry) => sum + entry.fuel_added, 0);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando registros...
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum registro encontrado para este período.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold w-[80px]">DATA</TableHead>
              <TableHead className="font-bold">DE</TableHead>
              <TableHead className="font-bold">DE</TableHead>
              <TableHead className="font-bold">PARA</TableHead>
              <TableHead className="font-bold">AC</TableHead>
              <TableHead className="font-bold">DEP</TableHead>
              <TableHead className="font-bold">POU</TableHead>
              <TableHead className="font-bold">COR</TableHead>
              <TableHead className="font-bold">VOO</TableHead>
              <TableHead className="font-bold">NOIT</TableHead>
              <TableHead className="font-bold">TOTAL</TableHead>
              <TableHead className="font-bold">IFR</TableHead>
              <TableHead className="font-bold">POUSO</TableHead>
              <TableHead className="font-bold">ABAST</TableHead>
              <TableHead className="font-bold">FUEL</TableHead>
              <TableHead className="font-bold">CÉLULA</TableHead>
              <TableHead className="font-bold">PC</TableHead>
              <TableHead className="font-bold">ISC</TableHead>
              <TableHead className="font-bold">DIÁRIAS</TableHead>
              <TableHead className="font-bold">EXTRAS</TableHead>
              <TableHead className="font-bold">VOO PARA</TableHead>
              <TableHead className="font-bold">CONFERE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{format(new Date(entry.entry_date), "d/M", { locale: pt })}</span>
                    </div>
                  </TableCell>
                  <TableCell className="uppercase">{entry.departure_airport}</TableCell>
                  <TableCell className="uppercase">{entry.arrival_airport}</TableCell>
                  <TableCell className="uppercase">{aircraft?.registration || "-"}</TableCell>
                  <TableCell>{entry.departure_time}</TableCell>
                  <TableCell>{entry.arrival_time}</TableCell>
                  <TableCell>
                    {entry.flight_time_hours}:{entry.flight_time_minutes.toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    {entry.flight_time_hours}:{entry.flight_time_minutes.toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    {entry.night_time_hours}:{entry.night_time_minutes.toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDecimalHoursToHHMM(entry.total_time)}
                  </TableCell>
                  <TableCell>{entry.ifr_count || 0}</TableCell>
                  <TableCell>{entry.landings}</TableCell>
                  <TableCell>{entry.fuel_added > 0 ? entry.fuel_added : "-"}</TableCell>
                  <TableCell>{entry.fuel_liters || "-"}</TableCell>
                  <TableCell>{entry.fuel_cell || "-"}</TableCell>
                  <TableCell>{entry.pc || "-"}</TableCell>
                  <TableCell>{entry.isc || "-"}</TableCell>
                  <TableCell>{entry.daily_rate || "-"}</TableCell>
                  <TableCell>{entry.extras || "-"}</TableCell>
                  <TableCell className="uppercase">{entry.flight_type || "-"}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={!!entry.verified_by}
                      onCheckedChange={() => handleVerifyToggle(entry.id, !!entry.verified_by)}
                      disabled={!canVerify || isReadOnly}
                    />
                  </TableCell>
                </TableRow>
                {!isReadOnly && (
                  <TableRow className="bg-muted/20 hover:bg-muted/40">
                    <TableCell colSpan={21} className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          // open the AddLogbookEntryDialog in parent by calling onAddEntry with prefilled date
                          const d = new Date(entry.entry_date);
                          // add 1 minute to ensure 'after' semantics
                          d.setMinutes(d.getMinutes() + 1);
                          onAddEntry?.(d);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar registro após {format(new Date(entry.entry_date), "d/M", { locale: pt })}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell colSpan={9}>TOTAL DO MÊS</TableCell>
              <TableCell>{formatDecimalHoursToHHMM(totalHours)}H</TableCell>
              <TableCell colSpan={1}></TableCell>
              <TableCell>{totalLandings}</TableCell>
              <TableCell>{totalFuelAdded.toFixed(1)}L</TableCell>
              <TableCell colSpan={8}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
