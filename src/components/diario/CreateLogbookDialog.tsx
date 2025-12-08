import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CreateLogbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft: Array<{
    id: string;
    registration: string;
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
  const [loading, setLoading] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<string>(initialAircraftId || "");
  const [selectedYear, setSelectedYear] = useState<string>(initialYear?.toString() || new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth?.toString() || "");
  const [fuelConsumption, setFuelConsumption] = useState<string>("");
  const [cellularHours, setCellularHours] = useState<string>("0");
  const [dailyRate, setDailyRate] = useState<string>("");

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
      const monthData = {
        aircraft_id: selectedAircraft,
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        is_closed: false,
        celula_anterior: parseFloat(cellularHours) || 0,
        celula_atual: parseFloat(cellularHours) || 0,
        fuel_consumption: fuelConsumption,
        daily_rate: dailyRate ? parseFloat(dailyRate) : 0,
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

      if (data && data.length > 0) {
        navigate(`/diario-bordo/${selectedAircraft}?year=${selectedYear}&month=${selectedMonth}`);
      }

      onOpenChange(false);
      setSelectedAircraft("");
      setSelectedYear(currentYear.toString());
      setSelectedMonth("");
      setFuelConsumption("");
      setCellularHours("0");
      setDailyRate("");
    } catch (error: any) {
      console.error("Erro ao criar diário de bordo:", error);
      toast.error(error.message || "Não foi possível criar o diário de bordo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Diário de Bordo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aircraft">Aeronave *</Label>
            <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a aeronave" />
              </SelectTrigger>
              <SelectContent>
                {aircraft.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    {ac.registration} - {ac.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Ano *</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
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
            <Label htmlFor="month">Mês *</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
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

          <div className="space-y-2">
            <Label htmlFor="fuelConsumption">Consumo Médio (L/H) *</Label>
            <Input
              id="fuelConsumption"
              type="number"
              step="0.1"
              placeholder="109.4"
              value={fuelConsumption}
              onChange={(e) => setFuelConsumption(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cellularHours">Horas de Célula Anterior</Label>
            <Input
              id="cellularHours"
              type="number"
              step="0.1"
              placeholder="0"
              value={cellularHours}
              onChange={(e) => setCellularHours(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailyRate">Valor da Diária (R$)</Label>
            <Input
              id="dailyRate"
              type="number"
              step="0.01"
              placeholder="445.00"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              disabled={loading}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco se a aeronave não tem valor de diária definido
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Diário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}