import { useEffect, useState } from "react";
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
import { Solicitacao, useAgendamentoMutations } from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nowHHMM = () => new Date().toISOString().slice(11, 16);

export function ConcluirVooDialog({ voo, open, onOpenChange }: Props) {
  const { concluirVoo } = useAgendamentoMutations();
  const [pouso, setPouso] = useState("");

  useEffect(() => {
    if (open) {
      setPouso(nowHHMM());
    }
  }, [open, voo]);

  const submit = () => {
    if (!voo || !pouso) return;
    concluirVoo.mutate(
      { solicitacao: voo, horarioPouso: pouso },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Concluir voo
          </DialogTitle>
          <DialogDescription>
            Informe o horário de pouso (ARR) para registrar a chegada final do voo. Isso permitirá
            acompanhar o registro real de perna e concluir a solicitação corretamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-2">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!pouso || concluirVoo.isPending}>
            {concluirVoo.isPending ? "Registrando..." : "Concluir voo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
