import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CloseMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  month: number;
  year: number;
  totalHours: number;
  totalLandings: number;
  totalFuelAdded: number;
  onSuccess: () => void;
}

export function CloseMonthDialog({
  open,
  onOpenChange,
  aircraftId,
  month,
  year,
  totalHours,
  totalLandings,
  totalFuelAdded,
  onSuccess,
}: CloseMonthDialogProps) {
  const [hasObservations, setHasObservations] = useState<string>("no");
  const [observations, setObservations] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClose = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('monthly_diary_closures')
        .insert({
          aircraft_id: aircraftId,
          month: month + 1,
          year,
          total_hours: totalHours,
          total_landings: totalLandings,
          total_fuel_added: totalFuelAdded,
          closing_observations: hasObservations === "yes" ? observations : null,
          closed_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: "Mês encerrado com sucesso",
        description: "O diário de bordo foi finalizado e não poderá ser mais editado.",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao encerrar mês",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Encerrar Mês</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Deseja incluir alguma observação?</Label>
            <RadioGroup value={hasObservations} onValueChange={setHasObservations}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no" className="font-normal cursor-pointer">Não</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes" className="font-normal cursor-pointer">Sim</Label>
              </div>
            </RadioGroup>
          </div>

          {hasObservations === "yes" && (
            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                placeholder="Digite suas observações sobre este mês..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Resumo do Mês</p>
            <div className="text-sm space-y-1">
              <p>Total de Horas: <span className="font-bold">{totalHours.toFixed(2)}H</span></p>
              <p>Total de Pousos: <span className="font-bold">{totalLandings}</span></p>
              <p>Total de Combustível: <span className="font-bold">{totalFuelAdded.toFixed(1)}L</span></p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encerrar Mês
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
