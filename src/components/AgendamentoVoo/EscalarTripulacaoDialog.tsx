import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Solicitacao, useAgendamentoMutations, useTripulantes } from "@/hooks/useAgendamentoVoo";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EscalarTripulacaoDialog({ voo, open, onOpenChange }: Props) {
  const { escalarTripulacao } = useAgendamentoMutations();
  const { data: tripulantes = [] } = useTripulantes();
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open) {
      setPilotoId(voo?.piloto_id ?? "");
      setCopilotoId(voo?.copiloto_id ?? "");
      setObservacoes("");
    }
  }, [open, voo]);

  const submit = () => {
    if (!voo || !pilotoId) return;
    escalarTripulacao.mutate(
      { solicitacao: voo, pilotoId, copilotoId: copilotoId || null, observacoes: observacoes || null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> Escalar tripulação
          </DialogTitle>
          <DialogDescription>
            {voo?.numero_voo ? `Voo ${voo.numero_voo} · ` : ""}
            {voo?.aeronave?.matricula ?? "Aeronave"} · {voo?.origem ?? "—"} → {voo?.destino ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="escala-pic">PIC (obrigatório)</Label>
            <Select value={pilotoId} onValueChange={setPilotoId}>
              <SelectTrigger id="escala-pic">
                <SelectValue placeholder="Selecione o comandante" />
              </SelectTrigger>
              <SelectContent>
                {tripulantes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="escala-sic">SIC</Label>
            <Select value={copilotoId} onValueChange={setCopilotoId}>
              <SelectTrigger id="escala-sic">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {tripulantes
                  .filter((t) => t.id !== pilotoId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome_completo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="escala-obs">Observações</Label>
            <Textarea
              id="escala-obs"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções para a tripulação (opcional)"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={submit} disabled={!pilotoId || escalarTripulacao.isPending}>
            {escalarTripulacao.isPending ? "Salvando..." : "Escalar tripulação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
