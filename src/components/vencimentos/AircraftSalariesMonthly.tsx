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
  aeronave_id: string;
  hourly_rate: number;
  effective_date: string;
  created_at: string | null;
}

interface AircraftData {
  id: string;
  registration: string;
  model: string;
  matricula: string;
  modelo: string;
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
  const [selectedAeronave, setSelectedAircraft] = useState<AircraftData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogValue, setDialogValue] = useState<string>("");
  const [selectedAircraftsToShow, setSelectedAircraftsToShow] = useState<string[]>([]);
  const [selectedAircraftToAdd, setSelectedAircraftToAdd] = useState<string>("");

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
    const startYear = Math.min(currentDate.getFullYear() - 2, 2024);
    const endYear = Math.max(currentDate.getFullYear() + 1, 2024);
    for (let i = startYear; i <= endYear; i++) {
      years.push(i);
    }
    return years.sort((a, b) => b - a);
  }, []);

  const { data: activeAircraft = [], isLoading: aircraftLoading } = useQuery({
    queryKey: ["active_aircraft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo, status')
        .eq("status", "ativa")
        .order('matricula', { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        registration: a.matricula,
        model: a.modelo,
        matricula: a.matricula,
        modelo: a.modelo,
        status: a.status,
      })) as AircraftData[];
    },
  });

  const { data: allRates = [] } = useQuery({
    queryKey: ["aircraft_monthly_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_hora_aeronave')
        .select("*")
        .order("data_vigencia", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        aeronave_id: r.aeronave_id,
        hourly_rate: r.taxa_hora,
        effective_date: r.data_vigencia,
        created_at: r.criado_em,
      })) as MonthlyRate[];
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
        if (r.aeronave_id !== aircraft.id) return false;
        const { month, year } = getMonthYearFromDate(r.effective_date);
        return month === selectedMonth && year === selectedYear;
      });

      let displayRate = currentMonthRate?.hourly_rate || 0;
      let currentRateId = currentMonthRate?.id || null;

      if (!currentMonthRate) {
        const mostRecentRate = allRates.find((r) => {
          if (r.aeronave_id !== aircraft.id) return false;
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

  const aircraftWithPrice = useMemo(() => {
    return aircraftWithRates.filter((a) => a.hourly_rate > 0);
  }, [aircraftWithRates]);

  const displayedAircraft = useMemo(() => {
    return aircraftWithRates.filter((a) => selectedAircraftsToShow.includes(a.id));
  }, [aircraftWithRates, selectedAircraftsToShow]);

  const availableAircraftToAdd = useMemo(() => {
    return aircraftWithRates.filter((a) => !selectedAircraftsToShow.includes(a.id));
  }, [aircraftWithRates, selectedAircraftsToShow]);

  const handleAddAircraft = () => {
    if (selectedAircraftToAdd) {
      setSelectedAircraftsToShow([...selectedAircraftsToShow, selectedAircraftToAdd]);
      setSelectedAircraftToAdd("");
    }
  };

  const handleRemoveAircraft = (aircraftId: string) => {
    setSelectedAircraftsToShow(selectedAircraftsToShow.filter((id) => id !== aircraftId));
  };

  const saveRateMutation = useMutation({
    mutationFn: async (data: any) => {
      const rateData = {
        aeronave_id: data.aeronave_id,
        taxa_hora: parseFloat(data.hourly_rate),
        data_vigencia: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
      };

      if (data.rate_id) {
        const { error } = await supabase
          .from('taxas_hora_aeronave')
          .update(rateData)
          .eq("id", data.rate_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('taxas_hora_aeronave').insert([rateData]);
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
    if (!selectedAeronave) return;
    if (!dialogValue || isNaN(parseFloat(dialogValue))) {
      toast.error("Digite um valor válido");
      return;
    }

    saveRateMutation.mutate({
      aeronave_id: selectedAeronave.id,
      rate_id: (selectedAeronave as any).current_rate_id,
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
        aeronave_id: aircraftData.id,
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
          <div className="grid grid-cols-2 gap-4 max-w-sm mb-6">
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

          <div className="bg-slate-950 border border-blue-400/30 rounded-lg p-4 mb-6">
            <Label className="text-sm font-semibold mb-2 block text-slate-200 bg-slate-900 px-2 py-1 rounded inline-block">Adicionar Aeronave</Label>
            <div className="flex gap-2 text-slate-400">
              <Select value={selectedAircraftToAdd} onValueChange={setSelectedAircraftToAdd}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {availableAircraftToAdd.map((aircraft) => (
                    <SelectItem key={aircraft.id} value={aircraft.id}>
                      {aircraft.matricula} - {aircraft.modelo} (R$ {aircraft.hourly_rate.toFixed(2)}/hora)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddAircraft}
                disabled={!selectedAircraftToAdd}
                className="bg-cyan-500/75 hover:bg-cyan-600/75 text-white"
              >
                Adicionar
              </Button>
            </div>
            {availableAircraftToAdd.length === 0 && (
              <p className="text-xs text-cyan-400 mt-2">
                Todas as aeronaves ativas já foram adicionadas à tabela.
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor/Hora (R$)</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAircraft.map((aircraft) => (
                  <TableRow key={aircraft.id}>
                    <TableCell className="font-semibold">{aircraft.matricula}</TableCell>
                    <TableCell>{aircraft.modelo}</TableCell>
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
                      <div className="flex gap-1">
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
                        {selectedAircraftsToShow.includes(aircraft.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAircraft(aircraft.id)}
                            title="Remover da tabela"
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {displayedAircraft.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma aeronave selecionada. Adicione uma usando o seletor acima.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Valor/Hora - {selectedAeronave?.registration}</DialogTitle>
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
