import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, ShieldAlert, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePreVooChecklist } from "@/hooks/usePreVooChecklist";


interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nowHHMM = () => new Date().toISOString().slice(11, 16);
const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

export function IniciarVooDialog({ voo, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { iniciarVoo } = useAgendamentoMutations();
  const { data: tripulantes = [] } = useTripulantes();
  const { data: checklist, isLoading: checklistLoading } = usePreVooChecklist(open ? voo?.id : null);
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [dataPartida, setDataPartida] = useState("");
  const [picId, setPicId] = useState("");
  const [sicId, setSicId] = useState("");
  const [passageirosConfirmados, setPassageirosConfirmados] = useState("1");

  const checklistConcluido = checklist?.status === "concluido";

  useEffect(() => {
    if (open) {
      setAcionamento(nowHHMM());
      setDecolagem("");
      setDataPartida(voo?.data_partida ?? voo?.data_agendada ?? todayYYYYMMDD());
      setPicId(voo?.piloto_id ?? "");
      setSicId(voo?.copiloto_id ?? "");
      setPassageirosConfirmados(String(voo?.qtd_passageiros ?? 1));
    }
  }, [open, voo]);

  const submit = () => {
    if (!voo || !acionamento || !decolagem || !dataPartida || !checklistConcluido) return;
    iniciarVoo.mutate(
      {
        solicitacao: voo,
        dataPartida,
        horarioAcionamento: acionamento,
        horarioDecolagem: decolagem,
        pilotoId: picId || null,
        copilotoId: sicId || null,
        qtdPassageiros: Number(passageirosConfirmados) || 1,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
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

        {!checklistLoading && !checklistConcluido && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" /> Checklist pré-voo pendente
            </p>
            <p className="mt-1 text-xs">
              O voo só pode ser iniciado após a conclusão do checklist pré-voo desta solicitação.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={() => {
                if (voo) {
                  onOpenChange(false);
                  navigate(`/pre-voo/${voo.id}`);
                }
              }}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Abrir pré-voo
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">

          <div className="space-y-1.5">
            <Label htmlFor="data-partida">Data de partida real</Label>
            <Input
              id="data-partida"
              type="date"
              value={dataPartida}
              onChange={(e) => setDataPartida(e.target.value)}
              className="font-mono"
            />
          </div>
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

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pic">PIC</Label>
            <Select value={picId} onValueChange={setPicId}>
              <SelectTrigger id="pic">
                <SelectValue placeholder="Selecione o comandante" />
              </SelectTrigger>
              <SelectContent>
                {tripulantes.map((tripulante) => (
                  <SelectItem key={tripulante.id} value={tripulante.id}>
                    {tripulante.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sic">SIC</Label>
            <Select value={sicId} onValueChange={setSicId}>
              <SelectTrigger id="sic">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {tripulantes
                  .filter((tripulante) => tripulante.id !== picId)
                  .map((tripulante) => (
                    <SelectItem key={tripulante.id} value={tripulante.id}>
                      {tripulante.nome_completo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="passageiros">Passageiros confirmados</Label>
            <Input
              id="passageiros"
              type="number"
              min="1"
              value={passageirosConfirmados}
              onChange={(e) => setPassageirosConfirmados(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={submit}
            disabled={!acionamento || !decolagem || !checklistConcluido || iniciarVoo.isPending}
          >
            {iniciarVoo.isPending ? "Iniciando..." : "Iniciar voo"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
