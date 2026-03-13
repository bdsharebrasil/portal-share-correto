import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Plus, Pencil, Save, X } from "lucide-react";
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
  hasDailyRate?: boolean;
  onAddEntry?: (prefilledDate?: Date) => void;
}

export function LogbookTable({ entries, isLoading, aircraft, isReadOnly = false, hasDailyRate = true, onAddEntry }: LogbookTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LogbookEntry>>({});
  const [isSaving, setIsSaving] = useState(false);

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

  const handleStartEdit = (entry: LogbookEntry) => {
    setEditingId(entry.id);
    setEditData({
      entry_date: entry.entry_date,
      departure_airport: entry.departure_airport,
      arrival_airport: entry.arrival_airport,
      departure_time: entry.departure_time,
      arrival_time: entry.arrival_time,
      flight_time_hours: entry.flight_time_hours,
      flight_time_minutes: entry.flight_time_minutes,
      night_time_hours: entry.night_time_hours,
      night_time_minutes: entry.night_time_minutes,
      ifr_count: entry.ifr_count,
      landings: entry.landings,
      fuel_added: entry.fuel_added,
      fuel_liters: entry.fuel_liters,
      fuel_cell: entry.fuel_cell,
      pc: entry.pc,
      isc: entry.isc,
      daily_rate: entry.daily_rate,
      extras: entry.extras,
      flight_type: entry.flight_type,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setIsSaving(true);
    try {
      // Calculate total_time from flight hours/minutes
      const totalTime = (editData.flight_time_hours || 0) + (editData.flight_time_minutes || 0) / 60;

      const { error } = await supabase
        .from("logbook_entries")
        .update({
          entry_date: editData.entry_date,
          departure_airport: editData.departure_airport?.toUpperCase(),
          arrival_airport: editData.arrival_airport?.toUpperCase(),
          departure_time: editData.departure_time,
          arrival_time: editData.arrival_time,
          flight_time_hours: editData.flight_time_hours,
          flight_time_minutes: editData.flight_time_minutes,
          night_time_hours: editData.night_time_hours,
          night_time_minutes: editData.night_time_minutes,
          total_time: totalTime,
          ifr_count: editData.ifr_count,
          landings: editData.landings,
          fuel_added: editData.fuel_added,
          fuel_liters: editData.fuel_liters,
          fuel_cell: editData.fuel_cell,
          pc: editData.pc,
          isc: editData.isc,
          daily_rate: editData.daily_rate,
          extras: editData.extras,
          flight_type: editData.flight_type,
        })
        .eq("id", editingId);

      if (error) throw error;

      toast({
        title: "Registro atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["logbook-entries"] });
      setEditingId(null);
      setEditData({});
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditField = (field: keyof LogbookEntry, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }));
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

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold w-[80px]">DATA</TableHead>
              <TableHead className="font-bold">DE</TableHead>
              <TableHead className="font-bold">PARA</TableHead>
              <TableHead className="font-bold">AC</TableHead>
              <TableHead className="font-bold">DEP</TableHead>
              <TableHead className="font-bold">POU</TableHead>
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
              {hasDailyRate && <TableHead className="font-bold">DIÁRIAS</TableHead>}
              <TableHead className="font-bold">EXTRAS</TableHead>
              <TableHead className="font-bold">VOO PARA</TableHead>
              <TableHead className="font-bold">CONFERE</TableHead>
              {!isReadOnly && <TableHead className="font-bold w-[80px]">AÇÕES</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <TableRow className={`hover:bg-muted/30 ${isEditing(entry.id) ? "bg-primary/10" : ""}`}>
                  <TableCell className="font-medium">
                    {isEditing(entry.id) ? (
                      <Input
                        type="date"
                        value={editData.entry_date || ""}
                        onChange={(e) => updateEditField("entry_date", e.target.value)}
                        className="h-7 w-24 text-xs"
                      />
                    ) : (
                      <span>{format(new Date(entry.entry_date), "d/M", { locale: pt })}</span>
                    )}
                  </TableCell>
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.departure_airport || ""}
                        onChange={(e) => updateEditField("departure_airport", e.target.value.toUpperCase())}
                        className="h-7 w-16 text-xs uppercase"
                      />
                    ) : (
                      entry.departure_airport
                    )}
                  </TableCell>
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.arrival_airport || ""}
                        onChange={(e) => updateEditField("arrival_airport", e.target.value.toUpperCase())}
                        className="h-7 w-16 text-xs uppercase"
                      />
                    ) : (
                      entry.arrival_airport
                    )}
                  </TableCell>
                  <TableCell className="uppercase">{aircraft?.registration || "-"}</TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="time"
                        value={editData.departure_time || ""}
                        onChange={(e) => updateEditField("departure_time", e.target.value)}
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.departure_time
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="time"
                        value={editData.arrival_time || ""}
                        onChange={(e) => updateEditField("arrival_time", e.target.value)}
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.arrival_time
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <div className="flex gap-1 items-center">
                        <Input
                          type="number"
                          value={editData.flight_time_hours ?? 0}
                          onChange={(e) => updateEditField("flight_time_hours", parseInt(e.target.value) || 0)}
                          className="h-7 w-10 text-xs"
                          min={0}
                        />
                        <span>:</span>
                        <Input
                          type="number"
                          value={editData.flight_time_minutes ?? 0}
                          onChange={(e) => updateEditField("flight_time_minutes", parseInt(e.target.value) || 0)}
                          className="h-7 w-10 text-xs"
                          min={0}
                          max={59}
                        />
                      </div>
                    ) : (
                      `${entry.flight_time_hours}:${entry.flight_time_minutes.toString().padStart(2, "0")}`
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <div className="flex gap-1 items-center">
                        <Input
                          type="number"
                          value={editData.night_time_hours ?? 0}
                          onChange={(e) => updateEditField("night_time_hours", parseInt(e.target.value) || 0)}
                          className="h-7 w-10 text-xs"
                          min={0}
                        />
                        <span>:</span>
                        <Input
                          type="number"
                          value={editData.night_time_minutes ?? 0}
                          onChange={(e) => updateEditField("night_time_minutes", parseInt(e.target.value) || 0)}
                          className="h-7 w-10 text-xs"
                          min={0}
                          max={59}
                        />
                      </div>
                    ) : (
                      `${entry.night_time_hours}:${entry.night_time_minutes.toString().padStart(2, "0")}`
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDecimalHoursToHHMM(isEditing(entry.id) 
                      ? (editData.flight_time_hours || 0) + (editData.flight_time_minutes || 0) / 60 
                      : entry.total_time)}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.ifr_count ?? 0}
                        onChange={(e) => updateEditField("ifr_count", parseInt(e.target.value) || 0)}
                        className="h-7 w-12 text-xs"
                        min={0}
                      />
                    ) : (
                      entry.ifr_count || 0
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.landings ?? 0}
                        onChange={(e) => updateEditField("landings", parseInt(e.target.value) || 0)}
                        className="h-7 w-12 text-xs"
                        min={0}
                      />
                    ) : (
                      entry.landings
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.fuel_added ?? 0}
                        onChange={(e) => updateEditField("fuel_added", parseFloat(e.target.value) || 0)}
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.fuel_added > 0 ? entry.fuel_added : "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.fuel_liters ?? ""}
                        onChange={(e) => updateEditField("fuel_liters", e.target.value ? parseFloat(e.target.value) : null)}
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.fuel_liters || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.fuel_cell ?? ""}
                        onChange={(e) => updateEditField("fuel_cell", e.target.value ? parseFloat(e.target.value) : null)}
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.fuel_cell || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.pc ?? ""}
                        onChange={(e) => updateEditField("pc", e.target.value ? parseFloat(e.target.value) : null)}
                        className="h-7 w-12 text-xs"
                        min={0}
                      />
                    ) : (
                      entry.pc || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.isc ?? ""}
                        onChange={(e) => updateEditField("isc", e.target.value || null)}
                        className="h-7 w-14 text-xs"
                      />
                    ) : (
                      entry.isc || "-"
                    )}
                  </TableCell>
                  {hasDailyRate && (
                    <TableCell>
                      {isEditing(entry.id) ? (
                        <Input
                          type="number"
                          value={editData.daily_rate ?? ""}
                          onChange={(e) => updateEditField("daily_rate", e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-7 w-16 text-xs"
                          min={0}
                          step="0.01"
                        />
                      ) : (
                        entry.daily_rate ? `R$ ${entry.daily_rate.toFixed(2).replace('.', ',')}` : "-"
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.extras ?? ""}
                        onChange={(e) => updateEditField("extras", e.target.value || null)}
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.extras || "-"
                    )}
                  </TableCell>
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.flight_type ?? ""}
                        onChange={(e) => updateEditField("flight_type", e.target.value || null)}
                        className="h-7 w-20 text-xs uppercase"
                      />
                    ) : (
                      entry.flight_type || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={!!entry.verified_by}
                      onCheckedChange={() => handleVerifyToggle(entry.id, !!entry.verified_by)}
                      disabled={!canVerify || isReadOnly || isEditing(entry.id)}
                    />
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      {isEditing(entry.id) ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                          >
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                {!isReadOnly && !isEditing(entry.id) && (
                  <TableRow className="bg-muted/20 hover:bg-muted/40">
                    <TableCell colSpan={22} className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const d = new Date(entry.entry_date);
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
              <TableCell colSpan={8}>TOTAL DO MÊS</TableCell>
              <TableCell>{formatDecimalHoursToHHMM(totalHours)}H</TableCell>
              <TableCell colSpan={1}></TableCell>
              <TableCell>{totalLandings}</TableCell>
              <TableCell>{totalFuelAdded.toFixed(1)}L</TableCell>
              <TableCell colSpan={isReadOnly ? 8 : 9}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
