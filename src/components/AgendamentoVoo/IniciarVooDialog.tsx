import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  ClipboardCheck,
  CalendarClock,
  PlaneTakeoff,
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

import { usePreVooChecklist } from "@/hooks/usePreVooChecklist";

// Importe o seu hook de tripulantes de duas tabelas e o seu SearchableCombobox
import { useTripulantes } from "@/hooks/useTripulantes";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox"; // Ajuste o path

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nowHHMM = () => new Date().toISOString().slice(11, 16);
const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10);
const timeValue = (value?: string | null) => value?.slice(0, 5) ?? "";

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

export function IniciarVooDialog({ voo, open, onOpenChange }: Props) {
  const navigate = useNavigate();

  const { iniciarVoo, adicionarPerna } = useAgendamentoMutations();
  const { tripulantes, isLoadingTripulantes } = useTripulantes();

  // Mapeia os tripulantes para o formato que o seu SearchableCombobox espera (ex: { id, label })
  const tripulantesOptions = useMemo(() => {
    return tripulantes.map((t) => ({
      id: t.id,
      label: `${t.nome_completo} ${t.canac ? `(CANAC: ${t.canac})` : ""}`,
    }));
  }, [tripulantes]);

  const { data: pernas = [], isLoading: pernasLoading } = usePernasVoo(
    open ? voo?.id : null,
  );

  const { data: jornadas = [], isLoading: jornadasLoading } = useJornadasVoo(
    open ? voo?.id : null,
  );

  const { data: checklist, isLoading: checklistLoading } = usePreVooChecklist(
    open ? voo?.id : null,
  );

  const [dataPartida, setDataPartida] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [acionamento, setAcionamento] = useState("");
  const [decolagem, setDecolagem] = useState("");
  const [picId, setPicId] = useState("");
  const [sicId, setSicId] = useState("");
  const [passageirosConfirmados, setPassageirosConfirmados] = useState("1");

  const checklistConcluido = checklist?.status === "concluido";

  const pernasOrdenadas = useMemo(
    () => [...pernas].sort((a, b) => a.numero_perna - b.numero_perna),
    [pernas],
  );

  const pernaAtual =
    pernasOrdenadas.find((perna) => !perna.horario_decolagem) ?? null;

  const dataOperacao =
    dataPartida ||
    pernaAtual?.data_perna ||
    voo?.data_partida ||
    voo?.data_agendada ||
    todayYYYYMMDD();

  const jornadaDoDia =
    jornadas.find(
      (j) => j.data_jornada === dataOperacao && j.status === "aberta",
    ) ?? null;

  const jornadaAbertaOutroDia =
    jornadas.find((j) => j.status === "aberta") ?? null;

  const proximaJornadaNumero = jornadas.length + 1;

  useEffect(() => {
    if (!open || !voo) return;

    const pernaInicial = pernas
      .slice()
      .sort((a, b) => a.numero_perna - b.numero_perna)
      .find((p) => !p.horario_decolagem);

    const dataInicial =
      pernaInicial?.data_perna ??
      voo.data_partida ??
      voo.data_agendada ??
      todayYYYYMMDD();

    const jornadaExistente = jornadas.find(
      (j) => j.status === "aberta" && j.data_jornada === dataInicial,
    );

    setDataPartida(dataInicial);

    setApresentacao(
      jornadaExistente
        ? new Date(jornadaExistente.apresentacao_em).toISOString().slice(11, 16)
        : nowHHMM(),
    );

    setAcionamento(
      pernaInicial ? timeValue(pernaInicial.horario_acionamento) : nowHHMM(),
    );

    setDecolagem("");
    setPicId(voo.piloto_id ?? "");
    setSicId(voo.copiloto_id ?? "");
    setPassageirosConfirmados(String(voo.qtd_passageiros ?? 1));
  }, [open, voo, pernas, jornadas]);

  const podeIniciar = Boolean(
    voo &&
      dataPartida &&
      apresentacao &&
      acionamento &&
      decolagem &&
      picId &&
      checklistConcluido,
  );

  const jornadaConflitante =
    jornadaAbertaOutroDia &&
    jornadaAbertaOutroDia.data_jornada !== dataOperacao
      ? jornadaAbertaOutroDia
      : null;

  const handleAcionamentoChange = (val: string) => {
    setAcionamento(val);
    if (val && !jornadaDoDia) {
      setApresentacao(subtrairMinutos(val, 30));
    }
  };

  const chamarIniciarVoo = (pernaParaIniciar: PernaVoo) => {
    iniciarVoo.mutate(
      {
        solicitacao: voo!,
        perna: pernaParaIniciar,
        dataPartida,
        horarioApresentacao: apresentacao,
        horarioAcionamento: acionamento,
        horarioDecolagem: decolagem,
        pilotoId: picId || null,
        copilotoId: sicId || null,
        qtdPassageiros: Number(passageirosConfirmados) || 1,
        minutosPosCorte: 30,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const submit = () => {
    if (!voo || !podeIniciar || iniciarVoo.isPending || adicionarPerna.isPending) return;
    if (jornadaConflitante) return;

    if (!pernaAtual) {
      adicionarPerna.mutate(
        {
          solicitacao: voo,
          dataPerna: dataPartida,
          origem: voo.origem ?? "",
          destino: voo.destino ?? "",
          qtdPassageiros: Number(passageirosConfirmados) || 1,
        },
        {
          onSuccess: (novaPerna) => {
            chamarIniciarVoo(novaPerna);
          },
        }
      );
    } else {
      chamarIniciarVoo(pernaAtual);
    }
  };

  if (!voo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-amber-500" />
            Iniciar perna {pernaAtual ? pernaAtual.numero_perna : "1"}
          </DialogTitle>
          <DialogDescription>
            {voo.aeronave?.matricula ?? "Aeronave"} {" · "}
            {pernaAtual?.origem ?? voo.origem ?? "—"} {" → "}
            {pernaAtual?.destino ?? voo.destino ?? "—"}. Informe os horários em
            Zulu (UTC).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">
                {jornadaDoDia
                  ? `Jornada ${jornadaDoDia.numero_jornada} em andamento`
                  : `Nova jornada ${proximaJornadaNumero}`}
              </p>
              <p className="text-xs text-muted-foreground">{dataOperacao}</p>
            </div>
          </div>
          {jornadaDoDia ? (
            <p className="mt-2 text-xs text-muted-foreground">
              A jornada deste dia já está aberta. A apresentação registrada
              anteriormente será mantida.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Esta apresentação iniciará uma nova jornada de trabalho.
            </p>
          )}
        </div>

        {jornadaConflitante && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold">
              Existe uma jornada aberta em outro dia
            </p>
            <p className="mt-1 text-xs">
              Jornada {jornadaConflitante.numero_jornada} {" • "}
              {jornadaConflitante.data_jornada}
            </p>
            <p className="mt-1 text-xs">
              Encerre a jornada anterior antes de iniciar uma nova jornada.
            </p>
          </div>
        )}

        {!checklistLoading && !checklistConcluido && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Checklist pré-voo pendente
            </p>
            <p className="mt-1 text-xs">
              A perna só pode ser iniciada após a conclusão do checklist pré-voo
              desta solicitação.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/pre-voo/${voo.id}`);
              }}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Abrir pré-voo
            </Button>
          </div>
        )}

        {!pernasLoading && !jornadasLoading && (
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="data-partida">Data da operação</Label>
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
                onChange={(e) => handleAcionamentoChange(e.target.value)}
                className="font-mono"
              />
            </div>

            {!jornadaDoDia && (
              <div className="space-y-1.5">
                <Label htmlFor="apresentacao">Apresentação da tripulação</Label>
                <Input
                  id="apresentacao"
                  type="time"
                  value={apresentacao}
                  onChange={(e) => setApresentacao(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            {jornadaDoDia && (
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Apresentação registrada
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {new Date(jornadaDoDia.apresentacao_em)
                    .toISOString()
                    .slice(11, 16)}{" "}
                  UTC
                </p>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="decolagem">Decolagem (DEP)</Label>
              <Input
                id="decolagem"
                type="time"
                value={decolagem}
                onChange={(e) => setDecolagem(e.target.value)}
                className="font-mono"
              />
            </div>
            
            {/* PIC usando o SearchableCombobox */}
            <div className="space-y-1.5">
              <Label>PIC (Comandante) *</Label>
              <SearchableCombobox
                items={tripulantesOptions}
                value={picId}
                onChange={(id) => setPicId(id)}
                placeholder={isLoadingTripulantes ? "Carregando..." : "Selecione o Comandante"}
                searchPlaceholder="Pesquisar tripulante..."
              />
            </div>

            {/* SIC usando o SearchableCombobox */}
            <div className="space-y-1.5">
              <Label>SIC (Copiloto)</Label>
              <SearchableCombobox
                items={tripulantesOptions.filter((t) => t.id !== picId)}
                value={sicId}
                onChange={(id) => setSicId(id)}
                placeholder={isLoadingTripulantes ? "Carregando..." : "Selecione o Copiloto (Opcional)"}
                searchPlaceholder="Pesquisar tripulante..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
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
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={submit}
            disabled={
              !podeIniciar ||
              !!jornadaConflitante ||
              iniciarVoo.isPending ||
              adicionarPerna.isPending ||
              pernasLoading ||
              jornadasLoading
            }
          >
            {iniciarVoo.isPending || adicionarPerna.isPending
              ? "Iniciando..."
              : `Iniciar perna ${pernaAtual?.numero_perna ?? "1"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}