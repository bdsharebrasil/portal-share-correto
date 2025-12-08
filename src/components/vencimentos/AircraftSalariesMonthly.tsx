import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Save, X, Loader2 } from "lucide-react";

interface MonthlyRate {
  id: string;
  aircraft_id: string;
  hourly_rate: number;
  effective_date: string;
  created_at: string | null;
}

interface AircraftData {
  id: string;
  registration: string;
  model: string;
  status: string;
}

export function AircraftSalariesMonthly() {
  const { isAdmin, isFinanceiroMaster, isGestorMaster, isLoading: isRolesLoading } = useUserRole();
  const queryClient = useQueryClient();
  const isAllowed = isAdmin || isFinanceiroMaster || isGestorMaster;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogValue, setDialogValue] = useState<string>("");

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const years = useMemo(() => {
    const years = [];
    for (let i = currentDate.getFullYear() - 2; i <= currentDate.getFullYear() + 1; i++) {
      years.push(i);
    }
    return years;
  }, []);

  const { data: activeAircraft = [], isLoading: aircraftLoading } = useQuery({
    queryKey: ["active_aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, status")
        .eq("status", "Ativa")
        .order("registration", { ascending: true });
      if (error) throw error;
      return data as AircraftData[];
    },
  });

  const { data: allRates = [] } = useQuery({
    queryKey: ["aircraft_monthly_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft_hourly_rates")
        .select("*")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data as MonthlyRate[];
    },
  });

  const getMonthYearFromDate = (dateString: string): { month: number; year: number } => {
    const date = new Date(dateString);
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  };

  const aircraftWithRates = useMemo(() => {
    return activeAircraft.map((aircraft) => {
      const currentMonthRate = allRates.find((r) => {
        if (r.aircraft_id !== aircraft.id) return false;
        const { month, year } = getMonthYearFromDate(r.effective_date);
        return month === selectedMonth && year === selectedYear;
      });

      let displayRate = currentMonthRate?.hourly_rate || 0;
      let currentRateId = currentMonthRate?.id || null;

      if (!currentMonthRate) {
        const mostRecentRate = allRates.find((r) => {
          if (r.aircraft_id !== aircraft.id) return false;
          const { month, year } = getMonthYearFromDate(r.effective_date);
          const rateDate = new Date(year, month - 1);
          const selectedDate = new Date(selectedYear, selectedMonth - 1);
          return rateDate <= selectedDate;
        });
        if (mostRecentRate) {
          displayRate = mostRecentRate.hourly_rate;
        }
      }

      return {
        ...aircraft,
        hourly_rate: displayRate,
        current_rate_id: currentRateId,
      };
    });
  }, [activeAircraft, allRates, selectedMonth, selectedYear]);

  const saveRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const rateData = {
        aircraft_id: data.aircraft_id,
        hourly_rate: parseFloat(data.hourly_rate),
        effective_date: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
      };

      if (data.rate_id) {
        const { error } = await supabase
          .from("aircraft_hourly_rates")
          .update(rateData)
          .eq("id", data.rate_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("aircraft_hourly_rates").insert(rateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aircraft_monthly_rates"] });
      toast.success("Valor salvo com sucesso!");
      setEditingId(null);
      setEditingValue("");
      setIsDialogOpen(false);
      setSelectedAircraft(null);
      setDialogValue("");
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar valor: ${error.message}`);
    },
  });

  const handleEditClick = (aircraft: any) => {
    if (!isAllowed) return;
    setSelectedAircraft(aircraft);
    setDialogValue(aircraft.hourly_rate.toString());
    setIsDialogOpen(true);
  };

  const handleSaveDialog = () => {
    if (!selectedAircraft) return;
    if (!dialogValue || isNaN(parseFloat(dialogValue))) {
      toast.error("Digite um valor válido");
      return;
    }

    saveRateMutation.mutate({
      aircraft_id: selectedAircraft.id,
      rate_id: (selectedAircraft as any).current_rate_id,
      hourly_rate: dialogValue,
    });
  };

  const handleInlineEdit = (aircraft: any) => {
    if (!isAllowed) return;
    setEditingId(aircraft.id);
    setEditingValue(aircraft.hourly_rate.toString());
  };

  const handleInlineSave = (aircraft: any) => {
    if (!editingValue || isNaN(parseFloat(editingValue))) {
      toast.error("Digite um valor válido");
      return;
    }

    const aircraftData = activeAircraft.find((a) => a.id === aircraft.id);
    if (aircraftData) {
      saveRateMutation.mutate({
        aircraft_id: aircraftData.id,
        rate_id: aircraft.current_rate_id,
        hourly_rate: editingValue,
      });
    }
  };

  if (isRolesLoading || aircraftLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tabela de Valores Mensais por Aeronave</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div>
              <Label htmlFor="month-select">Mês</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger id="month-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year-select">Ano</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger id="year-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor/Hora (R$)</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aircraftWithRates.map((aircraft) => (
                  <TableRow key={aircraft.id}>
                    <TableCell className="font-semibold">{aircraft.registration}</TableCell>
                    <TableCell>{aircraft.model}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ativa
                      </span>
                    </TableCell>
                    <TableCell>
                      {editingId === aircraft.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            placeholder="0.00"
                            className="w-32"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleInlineSave(aircraft)}
                            disabled={saveRateMutation.isPending}
                            className="bg-cyan-500 hover:bg-cyan-600"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditingValue("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-green-600 font-bold">R$ {aircraft.hourly_rate.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId !== aircraft.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(aircraft)}
                          title="Editar valor/hora"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {aircraftWithRates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma aeronave ativa encontrada.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Valor/Hora - {selectedAircraft?.registration}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dialog-value">Valor por Hora (R$)</Label>
              <Input
                id="dialog-value"
                type="number"
                step="0.01"
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
                placeholder="0.00"
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Mês: {months.find((m) => m.value === selectedMonth)?.label} de {selectedYear}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setSelectedAircraft(null);
                setDialogValue("");
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSaveDialog}
              disabled={saveRateMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-600 text-gray-900"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveRateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
