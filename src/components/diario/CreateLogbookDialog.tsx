// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ensureRevisionMaintenance } from "@/services/manutencoes";

interface CreateLogbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft: Array<{
    id: string;
    matricula: string;
    model: string;
    fuel_consumption?: number;
  }>;
  initialAircraftId?: string;
  initialYear?: number;
  initialMonth?: number;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function CreateLogbookDialog({
  open,
  onOpenChange,
  aircraft,
  initialAircraftId,
  initialYear,
  initialMonth
}: CreateLogbookDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<string>(initialAircraftId || "");
  const [selectedYear, setSelectedYear] = useState<string>(initialYear?.toString() || new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth?.toString() || "");
  const [fuelConsumption, setFuelConsumption] = useState<string>("");
  const [cellularHours, setCellularHours] = useState<string>("0");
  const [dailyRate, setDailyRate] = useState<string>("");
  const [hasDailyRate, setHasDailyRate] = useState<boolean>(true);
  const [baseAerodrome, setBaseAerodrome] = useState<string>("");
  const [horimetroInicio, setHorimetroInicio] = useState<string>("");
  const [celulaProxRevisao, setCelulaProxRevisao] = useState<string>("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const selectedAircraftData = aircraft.find(a => a.id === selectedAircraft);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAircraft || !selectedYear || !selectedMonth) {
      toast.error("Selecione a aeronave, ano e mês");
      return;
    }

    if (!fuelConsumption || parseFloat(fuelConsumption) <= 0) {
      toast.error("Informe o consumo médio da aeronave");
      return;
    }

    setLoading(true);

    try {
      const celulaValue = parseFloat(cellularHours) || 0;
      const monthData = {
        aircraft_id: selectedAircraft,
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        is_closed: false,
        celula_anterior: celulaValue,
        celula_atual: celulaValue,  // Será atualizada dinamicamente conforme voos são adicionados
        fuel_consumption: fuelConsumption,
        daily_rate: hasDailyRate && dailyRate ? parseFloat(dailyRate) : 0,
        has_daily_rate: hasDailyRate,
        base_aerodrome: baseAerodrome || null,
        horimetro_inicio: horimetroInicio ? parseFloat(horimetroInicio) : null,
        celula_prox_revisao: celulaProxRevisao ? parseFloat(celulaProxRevisao) : null,
      };

      const { error, data } = await supabase
        .from('logbook_months')
        .insert([monthData])
        .select();

      if (error) {
        if (error.code === '23505') {
          toast.error("Diário de bordo já existe para este mês, ano e aeronave");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Diário de bordo criado com sucesso!");

      // Se foi preenchida a próxima revisão em horas, criar/atualizar manutenção automaticamente
      if (celulaProxRevisao && parseFloat(celulaProxRevisao) > 0) {
        try {
          const revisaoHoras = parseFloat(celulaProxRevisao);
          await ensureRevisionMaintenance(
            selectedAircraft,
            parseInt(selectedMonth),
            parseInt(selectedYear),
            revisaoHoras,
            MONTHS
          );
          console.log("✅ Manutenção de revisão criada/atualizada automaticamente");
        } catch (maintenanceError) {
          console.error("Erro ao criar manutenção automática:", maintenanceError);
          // Não falha o fluxo se a manutenção não for criada
        }
      }

      if (data && data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['logbook-month', selectedAircraft, selectedYear, selectedMonth] });

        setTimeout(() => {
          navigate(`/diario-bordo/${selectedAircraft}?year=${selectedYear}&month=${selectedMonth}`, { replace: true });
        }, 300);
      }

      onOpenChange(false);
      setSelectedAircraft("");
      setSelectedYear(currentYear.toString());
      setSelectedMonth("");
      setFuelConsumption("");
      setCellularHours("0");
      setDailyRate("");
      setHasDailyRate(true);
      setBaseAerodrome("");
      setHorimetroInicio("");
      setCelulaProxRevisao("");
    } catch (error: any) {
      console.error("Erro ao criar diário de bordo:", error);
      toast.error(error.message || "Não foi possível criar o diário de bordo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 pb-2">
          <DialogTitle>Criar Diário de Bordo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aircraft" className="text-sm font-semibold">Aeronave *</Label>
            <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
              <SelectTrigger className="h-10 text-base">
                <SelectValue placeholder="Selecione a aeronave" />
              </SelectTrigger>
              <SelectContent>
                {aircraft.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    {ac.matricula} - {ac.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-semibold">Ano *</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-10 text-base">
                  <SelectValue placeholder="Ano" />
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

            <div className="space-y-2">
              <Label htmlFor="month" className="text-sm font-semibold">Mês *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-10 text-base">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuelConsumption" className="text-sm font-semibold">Consumo Médio (L/H) *</Label>
            <Input
              id="fuelConsumption"
              type="number"
              step="0.1"
              placeholder="109.4"
              value={fuelConsumption}
              onChange={(e) => setFuelConsumption(e.target.value)}
              disabled={loading}
              className="h-10 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cellularHours" className="text-sm font-semibold">Horas de Célula Anterior</Label>
            <Input
              id="cellularHours"
              type="number"
              step="0.1"
              placeholder="0"
              value={cellularHours}
              onChange={(e) => setCellularHours(e.target.value)}
              disabled={loading}
              className="h-10 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseAerodrome" className="text-sm font-semibold">Base Aeródromo</Label>
            <Input
              id="baseAerodrome"
              type="text"
              placeholder="Ex: Brasília"
              value={baseAerodrome}
              onChange={(e) => setBaseAerodrome(e.target.value)}
              disabled={loading}
              className="h-10 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="horimetroInicio" className="text-sm font-semibold">Horimetro Início</Label>
            <Input
              id="horimetroInicio"
              type="number"
              step="0.1"
              placeholder="0.0"
              value={horimetroInicio}
              onChange={(e) => setHorimetroInicio(e.target.value)}
              disabled={loading}
              className="h-10 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="celulaProxRevisao" className="text-sm font-semibold">Valor da Célula da Próxima Revisão</Label>
            <Input
              id="celulaProxRevisao"
              type="number"
              step="0.1"
              placeholder="0.0"
              value={celulaProxRevisao}
              onChange={(e) => setCelulaProxRevisao(e.target.value)}
              disabled={loading}
              className="h-10 text-base"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="hasDailyRate"
                checked={!hasDailyRate}
                onCheckedChange={(checked) => {
                  setHasDailyRate(!checked);
                  if (checked) {
                    setDailyRate("");
                  }
                }}
                disabled={loading}
              />
              <Label 
                htmlFor="hasDailyRate" 
                className="text-sm font-medium cursor-pointer text-muted-foreground"
              >
                Aeronave não possui diária
              </Label>
            </div>

            {hasDailyRate && (
              <div className="space-y-2">
                <Label htmlFor="dailyRate" className="text-sm font-semibold">Valor da Diária (R$)</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  step="0.01"
                  placeholder="445.00"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  disabled={loading}
                  className="h-10 text-base"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 py-4 sm:py-0 sm:-mx-0 sm:px-0 sm:bg-transparent sm:border-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loading ? 'Criando...' : 'Criar Diário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
