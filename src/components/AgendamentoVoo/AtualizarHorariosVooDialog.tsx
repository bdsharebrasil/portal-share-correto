import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Plane, Plus } from "lucide-react";
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
import {
  type PernaVoo,
  type Solicitacao,
  useAgendamentoMutations,
  usePernasVoo,
} from "@/hooks/useAgendamentoVoo";
import { NovaPernaDialog } from "./NovaPernaDialog";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timeValue = (value?: string | null) => value?.slice(0, 5) ?? "";
const isoTimeValue = (value?: string | null) => (value ? new Date(value).toISOString().slice(11, 16) : "");
const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

export function AtualizarHorariosVooDialog({ voo, open, onOpenChange }: Props) {
  const { data: pernas = [] } = usePernasVoo(open ? voo?.id : null);
  const { registrarHorariosPerna, alterarStatusVoo } = useAgendamentoMutations();

  const [novaPernaAberta, setNovaPernaAberta] = useState(false);
  const [perguntando, setPerguntando] = useState(false);

  const [dataPerna, setDataPerna] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");

  const ordenadas = [...pernas].sort((a, b) => a.numero_perna - b.numero_perna);
  const pernaAtiva: PernaVoo | null = ordenadas.find((p) => !p.horario_pouso || !p.horario_corte) ?? null;
  const temProximaPerna = pernaAtiva
    ? ordenadas.some((p) => p.numero_perna > pernaAtiva.numero_perna)
    : false;
  const fase: "iniciar" | "pousar" = pernaAtiva?.horario_decolagem ? "pousar" : "iniciar";

  useEffect(() => {
    if (!open || !voo) return;
    setPerguntando(false);
    setDataPerna(pernaAtiva?.data_perna ?? voo.data_partida ?? voo.data_agendada ?? todayYYYYMMDD());
    setAcionamento(timeValue(pernaAtiva?.horario_acionamento) || (pernaAtiva ? "" : timeValue(voo.horario_acionamento)));
    setDecolagem(timeValue(pernaAtiva?.horario_decolagem) || (pernaAtiva ? "" : timeValue(voo.horario_decolagem)));
    setPouso(timeValue(pernaAtiva?.horario_pouso));
    setCorte(isoTimeValue(pernaAtiva?.horario_corte));
  }, [open, voo, pernaAtiva?.id]);

  if (!voo) return null;

  const salvar = (finalizar?: boolean) => {
    if (!pernaAtiva) return;
    registrarHorariosPerna.mutate(
      {
        solicitacao: voo,
        perna: pernaAtiva,
        fase,
        dataPerna,
        horarioAcionamento: acionamento,
        horarioDecolagem: decolagem,
        horarioPouso: pouso || null,
        horarioCorte: corte || null,
        finalizar,
      },
      {
        onSuccess: () => {
          setPerguntando(false);
          onOpenChange(false);
        },
      },
    );
  };

  const podeSalvar =
    fase === "iniciar"
      ? Boolean(dataPerna && acionamento && decolagem)
      : Boolean(dataPerna && acionamento && decolagem && pouso && corte);

  const registrarPouso = () => {
    if (!podeSalvar) return;
    if (temProximaPerna) salvar(false);
    else setPerguntando(true);
  };

  const encerrarJornada = () => {
    if (pernaAtiva) salvar(true);
    else {
      alterarStatusVoo.mutate(
        { solicitacao: voo, status: "concluido" },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  const salvandoPouso = () => {
    // grava o pouso mantendo o voo como "pousado" e abre o cadastro de nova perna
    salvar(false);
    setNovaPernaAberta(true);
  };

  const titulo =
    fase === "iniciar"
      ? `Iniciar perna ${pernaAtiva?.numero_perna ?? ""}`
      : `Registrar pouso da perna ${pernaAtiva?.numero_perna ?? ""}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          {!pernaAtiva ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Todas as pernas pousadas
                </DialogTitle>
                <DialogDescription>
                  Deseja adicionar uma nova perna de voo ou encerrar a jornada deste agendamento?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setNovaPernaAberta(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Nova perna de voo
                </Button>
                <Button onClick={encerrarJornada} disabled={alterarStatusVoo.isPending}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Encerrar jornada
                </Button>
              </DialogFooter>
            </>
          ) : perguntando ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Pouso registrado
                </DialogTitle>
                <DialogDescription>
                  Não existe outra perna registrada. Deseja adicionar uma nova perna de voo ou encerrar a jornada?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={salvandoPouso} disabled={registrarHorariosPerna.isPending}>
                  <Plus className="mr-1.5 h-4 w-4" /> Nova perna de voo
                </Button>
                <Button onClick={() => salvar(true)} disabled={registrarHorariosPerna.isPending}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Encerrar jornada
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {fase === "pousar" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Plane className="h-5 w-5 text-amber-500" />
                  )}
                  {titulo}
                </DialogTitle>
                <DialogDescription>
                  {pernaAtiva.origem} → {pernaAtiva.destino}.{" "}
                  {fase === "iniciar"
                    ? "Informe AC e DEP para colocar esta perna em rota."
                    : "Informe o pouso (ARR) e o corte (CORT) para encerrar esta perna."}{" "}
                  Todos os horários são em UTC.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="data-etapa">Data da perna</Label>
                  <Input id="data-etapa" type="date" value={dataPerna} onChange={(e) => setDataPerna(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-etapa">Acionamento (AC)</Label>
                  <Input id="ac-etapa" type="time" value={acionamento} onChange={(e) => setAcionamento(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dep-etapa">Decolagem (DEP)</Label>
                  <Input id="dep-etapa" type="time" value={decolagem} onChange={(e) => setDecolagem(e.target.value)} className="font-mono" />
                </div>
                {fase === "pousar" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="arr-etapa">Pouso (ARR)</Label>
                      <Input id="arr-etapa" type="time" value={pouso} onChange={(e) => setPouso(e.target.value)} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cort-etapa">Corte (CORT)</Label>
                      <Input id="cort-etapa" type="time" value={corte} onChange={(e) => setCorte(e.target.value)} className="font-mono" />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  onClick={() => (fase === "iniciar" ? salvar() : registrarPouso())}
                  disabled={!podeSalvar || registrarHorariosPerna.isPending}
                >
                  <Clock3 className="mr-1.5 h-4 w-4" />
                  {registrarHorariosPerna.isPending
                    ? "Salvando..."
                    : fase === "iniciar"
                      ? "Colocar em rota"
                      : "Registrar pouso"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NovaPernaDialog
        voo={voo}
        open={novaPernaAberta}
        onOpenChange={(o) => {
          setNovaPernaAberta(o);
          if (!o) onOpenChange(false);
        }}
      />
    </>
  );
}
