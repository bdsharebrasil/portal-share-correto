import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
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

export function IniciarVooDialog({ voo, open, onOpenChange }: Props) {
  const { iniciarVoo } = useAgendamentoMutations();
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");

  useEffect(() => {
    if (open) {
      setAcionamento(nowHHMM());
      setDecolagem("");
    }
  }, [open]);

  const submit = () => {
    if (!voo || !acionamento || !decolagem) return;
    iniciarVoo.mutate(
      { solicitacao: voo, horarioAcionamento: acionamento, horarioDecolagem: decolagem },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-amber-500" /> Iniciar voo
          </DialogTitle>
          <DialogDescription>
            {voo?.aeronave?.matricula ?? "Aeronave"} · {voo?.origem ?? "—"} → {voo?.destino ?? "—"}. Informe os horários
            em Zulu (UTC). O ciclo de voo será criado automaticamente e a aeronave passará para{" "}
            <strong>em rota</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="acionamento">Acionamento (AC)</Label>
            <Input
              id="acionamento"
              type="time"
              value={acionamento}
              onChange={(e) => setAcionamento(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decolagem">Decolagem (DEP)</Label>
            <Input
              id="decolagem"
              type="time"
              value={decolagem}
              onChange={(e) => setDecolagem(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!acionamento || !decolagem || iniciarVoo.isPending}>
            {iniciarVoo.isPending ? "Iniciando..." : "Iniciar voo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
