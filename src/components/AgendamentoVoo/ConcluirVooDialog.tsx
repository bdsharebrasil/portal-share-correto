import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { type Solicitacao } from "@/hooks/useAgendamentoVoo";
import { toast } from "sonner";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nowHHMM = () => new Date().toISOString().slice(11, 16);
const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

export function ConcluirVooDialog({ voo, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [dataPerna, setDataPerna] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDataPerna(voo?.data_partida ?? voo?.data_agendada ?? todayYYYYMMDD());
      setPouso(nowHHMM());
      setCorte(nowHHMM());
    }
  }, [open, voo]);

  const submit = async () => {
    if (!voo || !dataPerna || !pouso || !corte) return;

    setIsSaving(true);
    try {
      const horarioCorte = new Date(`${dataPerna}T${corte}:00Z`).toISOString();
      const { error } = await supabase
        .from("solicitacoes_reserva_voo")
        .update({
          status: "concluido",
          data_partida: dataPerna,
          horario_pouso: `${pouso}:00`,
          horario_corte: horarioCorte,
        })
        .eq("id", voo.id);

      if (error) throw error;

      toast.success("Voo concluído com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["agv"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao concluir voo");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Concluir voo
          </DialogTitle>
          <DialogDescription>
            Informe a data da perna, o pouso (ARR) e o corte para registrar a chegada final do voo
            corretamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="data-perna">Data da perna</Label>
            <Input
              id="data-perna"
              type="date"
              value={dataPerna}
              onChange={(e) => setDataPerna(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pouso">Pouso (ARR)</Label>
            <Input
              id="pouso"
              type="time"
              value={pouso}
              onChange={(e) => setPouso(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="corte">Corte</Label>
            <Input
              id="corte"
              type="time"
              value={corte}
              onChange={(e) => setCorte(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!dataPerna || !pouso || !corte || isSaving}>
            {isSaving ? "Registrando..." : "Concluir voo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
