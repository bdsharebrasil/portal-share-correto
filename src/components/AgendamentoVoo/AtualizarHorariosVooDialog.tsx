import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Plane,
  Plus,
  CalendarDays,
} from "lucide-react";

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
  useJornadasVoo,
  usePernasVoo,
} from "@/hooks/useAgendamentoVoo";

import { NovaPernaDialog } from "./NovaPernaDialog";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const timeValue = (value?: string | null) => value?.slice(0, 5) ?? "";

const isoTimeValue = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(11, 16) : "";

const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);

// Função para subtrair minutos de uma string HH:MM
const subtrairMinutos = (timeStr: string, minutos: number) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "";
  
  const date = new Date();
  date.setHours(h, m - minutos, 0, 0);
  
  const hs = String(date.getHours()).padStart(2, "0");
  const ms = String(date.getMinutes()).padStart(2, "0");
  return `${hs}:${ms}`;
};

export function AtualizarHorariosVooDialog({
  voo,
  open,
  onOpenChange,
}: Props) {
  const { data: pernas = [] } = usePernasVoo(open ? voo?.id : null);
  const { data: jornadas = [] } = useJornadasVoo(open ? voo?.id : null);

  const {
    iniciarVoo,
    registrarPousoPerna,
    encerrarJornada,
  } = useAgendamentoMutations();

  const [novaPernaAberta, setNovaPernaAberta] = useState(false);
  const [etapa, setEtapa] = useState<"voo" | "decisao" | "nova-jornada">("voo");

  const [dataPerna, setDataPerna] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [pouso, setPouso] = useState("");
  const [corte, setCorte] = useState("");

  const ordenadas = useMemo(
    () => [...pernas].sort((a, b) => a.numero_perna - b.numero_perna),
    [pernas],
  );

  const pernaAtiva =
    [...ordenadas]
      .reverse()
      .find((p) => !p.horario_pouso || !p.horario_corte) ??
    ordenadas[ordenadas.length - 1] ??
    null;

  const jornadaAtual =
    jornadas.find(
      (j) =>
        j.status === "aberta" && j.data_jornada === pernaAtiva?.data_perna,
    ) ?? null;

  const fase = pernaAtiva?.horario_decolagem ? "pousar" : "iniciar";

  useEffect(() => {
    if (!open || !voo) return;

    const dataInicial =
      pernaAtiva?.data_perna ??
      voo.data_partida ??
      voo.data_agendada ??
      todayYYYYMMDD();

    setEtapa("voo");
    setDataPerna(dataInicial);

    setApresentacao(
      jornadaAtual
        ? new Date(jornadaAtual.apresentacao_em).toISOString().slice(11, 16)
        : "",
    );

    setAcionamento(timeValue(pernaAtiva?.horario_acionamento));
    setDecolagem(timeValue(pernaAtiva?.horario_decolagem));
    setPouso(timeValue(pernaAtiva?.horario_pouso));
    setCorte(isoTimeValue(pernaAtiva?.horario_corte));
  }, [open, voo, pernaAtiva?.id, jornadaAtual?.id]);

  if (!voo) return null;

  const iniciarDisabled =
    !dataPerna || !apresentacao || !acionamento || !decolagem;

  const pousarDisabled = !dataPerna || !pouso || !corte;

  const abrirNovaPerna = () => {
    setNovaPernaAberta(true);
  };

  const handleAcionamentoChange = (val: string) => {
    setAcionamento(val);
    if (val && fase === "iniciar") {
      setApresentacao(subtrairMinutos(val, 30));
    }
  };

  const iniciarPerna = () => {
    if (!pernaAtiva) return;

    iniciarVoo.mutate(
      {
        solicitacao: voo,
        perna: pernaAtiva,
        dataPartida: dataPerna,
        horarioApresentacao: apresentacao,
        horarioAcionamento: acionamento,
        horarioDecolagem: decolagem,
        minutosPosCorte: 30, 
        pilotoId: voo.piloto_id ?? null,
        copilotoId: voo.copiloto_id ?? null,
        qtdPassageiros: voo.qtd_passageiros ?? 1,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const registrarPouso = () => {
    if (!pernaAtiva) return;

    registrarPousoPerna.mutate(
      {
        solicitacao: voo,
        perna: pernaAtiva,
        dataPerna: dataPerna,
        horarioPouso: pouso,
        horarioCorte: corte,
      },
      {
        onSuccess: () => {
          setEtapa("decisao");
        },
      },
    );
  };

  const finalizarJornada = () => {
    if (!jornadaAtual) {
      setEtapa("nova-jornada");
      return;
    }

    encerrarJornada.mutate(
      {
        solicitacao: voo,
        jornada: jornadaAtual,
        dataPerna: dataPerna,
        horarioCorte: corte,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
          {etapa === "decisao" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Pouso registrado
                </DialogTitle>
                <DialogDescription>
                  A perna foi concluída, mas a jornada ainda não foi encerrada.
                  O que deseja fazer?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-semibold">
                    Perna {pernaAtiva?.numero_perna}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pernaAtiva?.origem} {" → "} {pernaAtiva?.destino}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    ARR {pouso} • CORT {corte}
                  </p>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold">Jornada do dia</p>
                  <p className="text-sm text-muted-foreground">
                    A jornada atual permanece aberta até você decidir encerrá-la.
                  </p>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={abrirNovaPerna}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar nova perna
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={finalizarJornada}
                  disabled={encerrarJornada.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Encerrar jornada
                </Button>
              </DialogFooter>
            </>
          ) : etapa === "nova-jornada" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Nova jornada
                </DialogTitle>
                <DialogDescription>
                  A jornada anterior já foi encerrada. A próxima perna deverá
                  começar com uma nova apresentação.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">Próximo dia de operação</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ao iniciar a próxima perna, informe novamente o horário de
                  apresentação da tripulação.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
                <Button onClick={abrirNovaPerna}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar próxima perna
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {fase === "iniciar" ? (
                    <Plane className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  )}
                  {fase === "iniciar"
                    ? `Iniciar perna ${pernaAtiva?.numero_perna ?? ""}`
                    : `Registrar pouso da perna ${pernaAtiva?.numero_perna ?? ""}`}
                </DialogTitle>
                <DialogDescription>
                  {pernaAtiva?.origem} {" → "} {pernaAtiva?.destino}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Data da perna</Label>
                  <Input
                    type="date"
                    value={dataPerna}
                    onChange={(e) => setDataPerna(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Acionamento (AC)</Label>
                  <Input
                    type="time"
                    value={acionamento}
                    onChange={(e) => handleAcionamentoChange(e.target.value)}
                  />
                </div>

                {fase === "iniciar" && (
                  <div className="space-y-1.5">
                    <Label>Apresentação da tripulação</Label>
                    <Input
                      type="time"
                      value={apresentacao}
                      onChange={(e) => setApresentacao(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Decolagem (DEP)</Label>
                  <Input
                    type="time"
                    value={decolagem}
                    onChange={(e) => setDecolagem(e.target.value)}
                  />
                </div>

                {fase === "pousar" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Pouso (ARR)</Label>
                      <Input
                        type="time"
                        value={pouso}
                        onChange={(e) => setPouso(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Corte (CORT)</Label>
                      <Input
                        type="time"
                        value={corte}
                        onChange={(e) => setCorte(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                {fase === "iniciar" ? (
                  <Button
                    onClick={iniciarPerna}
                    disabled={iniciarDisabled || iniciarVoo.isPending}
                  >
                    <Clock3 className="mr-2 h-4 w-4" />
                    {iniciarVoo.isPending ? "Iniciando..." : "Iniciar perna"}
                  </Button>
                ) : (
                  <Button
                    onClick={registrarPouso}
                    disabled={pousarDisabled || registrarPousoPerna.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {registrarPousoPerna.isPending
                      ? "Registrando..."
                      : "Registrar pouso"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NovaPernaDialog
        voo={voo}
        open={novaPernaAberta}
        onOpenChange={(value) => {
          setNovaPernaAberta(value);
          if (!value) {
            onOpenChange(false);
          }
        }}
      />
    </>
  );
}