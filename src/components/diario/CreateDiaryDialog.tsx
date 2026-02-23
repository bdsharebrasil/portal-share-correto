import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateDiaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (opts: { aircraftId: string; month: number; year: number }) => void;
}

export function CreateDiaryDialog({ open, onOpenChange, onCreate }: CreateDiaryDialogProps) {
  const { data: aircraft } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aircraft')
        .select('id, registration, model')
        .order('registration');
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const [aircraftId, setAircraftId] = useState<string>("");
  const [month] = useState<string>(now.getMonth().toString());
  const [year, setYear] = useState<string>(now.getFullYear().toString());

  useEffect(() => {
    if (!aircraftId && aircraft && aircraft.length > 0) {
      setAircraftId(aircraft[0].id);
    }
  }, [aircraftId, aircraft]);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const handleCreate = () => {
    if (!aircraftId) return;
    onCreate({ aircraftId, month: parseInt(month), year: parseInt(year) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Criar Diário</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Aeronave</Label>
            <Select value={aircraftId} onValueChange={setAircraftId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a aeronave" />
              </SelectTrigger>
              <SelectContent>
                {aircraft?.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    {ac.registration} • {ac.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!aircraftId}>Criar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
