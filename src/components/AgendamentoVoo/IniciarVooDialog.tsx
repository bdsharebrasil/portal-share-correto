import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlayCircle,
  ShieldAlert,
  ClipboardCheck,
  CalendarClock,
  PlaneTakeoff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const nowHHMM = () =>
  new Date().toISOString().slice(11, 16);

const todayYYYYMMDD = () =>
  new Date().toISOString().slice(0, 10);

const timeValue = (value?: string | null) =>
  value?.slice(0, 5) ?? "";

export function IniciarVooDialog({
  voo,
  open,
  onOpenChange,
}: Props) {
  const navigate = useNavigate();

  const {
    iniciarVoo,
  } = useAgendamentoMutations();

  const tripulantes = useMemo(
    () =>
      [
        voo?.piloto_id,
        voo?.copiloto_id,
      ]
        .filter(
          (id): id is string => Boolean(id),
        )
        .filter(
          (id, index, ids) =>
            ids.indexOf(id) === index,
        )
        .map((id) => ({
          id,
          nome_completo: id,
        })),
    [voo?.piloto_id, voo?.copiloto_id],
  );

  const {
    data: pernas = [],
    isLoading: pernasLoading,
  } = usePernasVoo(
    open ? voo?.id : null,
  );

  const {
    data: jornadas = [],
    isLoading: jornadasLoading,
  } = useJornadasVoo(
    open ? voo?.id : null,
  );

  const {
    data: checklist,
    isLoading: checklistLoading,
  } = usePreVooChecklist(
    open ? voo?.id : null,
  );

  /* ============================================================
     ESTADOS
  ============================================================ */

  const [
    dataPartida,
    setDataPartida,
  ] = useState("");

  const [
    apresentacao,
    setApresentacao,
  ] = useState("");

  const [
    acionamento,
    setAcionamento,
  ] = useState("");

  const [
    decolagem,
    setDecolagem,
  ] = useState("");

  const [picId, setPicId] =
    useState("");

  const [sicId, setSicId] =
    useState("");

  const [
    passageirosConfirmados,
    setPassageirosConfirmados,
  ] = useState("1");

  const [
    minutosPosCorte,
    setMinutosPosCorte,
  ] = useState<30 | 45>(45);

  /* ============================================================
     CHECKLIST
  ============================================================ */

  const checklistConcluido =
    checklist?.status ===
    "concluido";

  /* ============================================================
     PERNAS ORDENADAS
  ============================================================ */

  const pernasOrdenadas = useMemo(
    () =>
      [...pernas].sort(
        (a, b) =>
          a.numero_perna -
          b.numero_perna,
      ),
    [pernas],
  );

  /*
   * A próxima perna a iniciar é a primeira
   * que ainda não possui decolagem.
   */
  const pernaAtual =
    pernasOrdenadas.find(
      (perna) =>
        !perna.horario_decolagem,
    ) ?? null;

  /*
   * Caso ainda não exista nenhuma perna,
   * o sistema cria a primeira automaticamente
   * usando origem/destino do agendamento.
   *
   * Porém, no fluxo normal, a perna já deve ter
   * sido criada quando o agendamento foi confirmado.
   */
  const ultimaPerna =
    pernasOrdenadas[
      pernasOrdenadas.length - 1
    ] ?? null;

  const dataOperacao =
    dataPartida ||
    pernaAtual?.data_perna ||
    voo?.data_partida ||
    voo?.data_agendada ||
    todayYYYYMMDD();

  /* ============================================================
     JORNADA DO DIA
  ============================================================ */

  const jornadaDoDia =
    jornadas.find(
      (j) =>
        j.data_jornada ===
          dataOperacao &&
        j.status === "aberta",
    ) ?? null;

  const jornadaAbertaOutroDia =
    jornadas.find(
      (j) => j.status === "aberta",
    ) ?? null;

  const proximaJornadaNumero =
    jornadas.length + 1;

  /* ============================================================
     INICIALIZAÇÃO
  ============================================================ */

  useEffect(() => {
    if (!open || !voo) return;

    const pernaInicial =
      pernas
        .slice()
        .sort(
          (a, b) =>
            a.numero_perna -
            b.numero_perna,
        )
        .find(
          (p) => !p.horario_decolagem,
        );

    const dataInicial =
      pernaInicial?.data_perna ??
      voo.data_partida ??
      voo.data_agendada ??
      todayYYYYMMDD();

    const jornadaExistente =
      jornadas.find(
        (j) =>
          j.status === "aberta" &&
          j.data_jornada ===
            dataInicial,
      );

    setDataPartida(
      dataInicial,
    );

    setApresentacao(
      jornadaExistente
        ? new Date(
            jornadaExistente.apresentacao_em,
          )
            .toISOString()
            .slice(11, 16)
        : nowHHMM(),
    );

    setAcionamento(
      pernaInicial
        ? timeValue(
            pernaInicial.horario_acionamento,
          )
        : nowHHMM(),
    );

    setDecolagem("");

    setPicId(
      voo.piloto_id ?? "",
    );

    setSicId(
      voo.copiloto_id ?? "",
    );

    setPassageirosConfirmados(
      String(
        voo.qtd_passageiros ??
          1,
      ),
    );

    setMinutosPosCorte(
      jornadaExistente?.minutos_pos_corte ??
        45,
    );
  }, [
    open,
    voo,
    pernas,
    jornadas,
  ]);

  /* ============================================================
     VALIDAÇÕES
  ============================================================ */

  const podeIniciar =
    Boolean(
      voo &&
        pernaAtual &&
        dataPartida &&
        apresentacao &&
        acionamento &&
        decolagem &&
        picId &&
        checklistConcluido,
    );

  /*
   * Se já existe jornada aberta em outro dia,
   * bloqueamos o início até resolver aquela jornada.
   */
  const jornadaConflitante =
    jornadaAbertaOutroDia &&
    jornadaAbertaOutroDia.data_jornada !==
      dataOperacao
      ? jornadaAbertaOutroDia
      : null;

  /* ============================================================
     SUBMIT
  ============================================================ */

  const submit = () => {
    if (
      !voo ||
      !pernaAtual ||
      !podeIniciar
    ) {
      return;
    }

    if (jornadaConflitante) {
      return;
    }

    iniciarVoo.mutate(
      {
        solicitacao: voo,

        perna: pernaAtual,

        dataPartida:
          dataPartida,

        horarioApresentacao:
          apresentacao,

        horarioAcionamento:
          acionamento,

        horarioDecolagem:
          decolagem,

        pilotoId:
          picId || null,

        copilotoId:
          sicId || null,

        qtdPassageiros:
          Number(
            passageirosConfirmados,
          ) || 1,

        minutosPosCorte,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  /* ============================================================
     SEM VOO
  ============================================================ */

  if (!voo) return null;

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-amber-500" />

            Iniciar perna
            {pernaAtual
              ? ` ${pernaAtual.numero_perna}`
              : ""}
          </DialogTitle>

          <DialogDescription>
            {voo.aeronave?.matricula ??
              "Aeronave"}
            {" · "}
            {pernaAtual?.origem ??
              voo.origem ??
              "—"}
            {" → "}
            {pernaAtual?.destino ??
              voo.destino ??
              "—"}
            . Informe os horários
            em Zulu (UTC).
          </DialogDescription>
        </DialogHeader>

        {/* ======================================================
            INFORMAÇÕES DA JORNADA
        ====================================================== */}

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">

          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />

            <div>
              <p className="text-sm font-semibold">
                {jornadaDoDia
                  ? `Jornada ${jornadaDoDia.numero_jornada} em andamento`
                  : `Nova jornada ${proximaJornadaNumero}`}
              </p>

              <p className="text-xs text-muted-foreground">
                {dataOperacao}
              </p>
            </div>
          </div>

          {jornadaDoDia ? (
            <p className="mt-2 text-xs text-muted-foreground">
              A jornada deste dia já está
              aberta. A apresentação
              registrada anteriormente será
              mantida.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Esta apresentação iniciará uma
              nova jornada de trabalho.
            </p>
          )}
        </div>

        {/* ======================================================
            JORNADA ABERTA EM OUTRO DIA
        ====================================================== */}

        {jornadaConflitante && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">

            <p className="font-semibold">
              Existe uma jornada aberta em
              outro dia
            </p>

            <p className="mt-1 text-xs">
              Jornada{" "}
              {jornadaConflitante.numero_jornada}
              {" • "}
              {jornadaConflitante.data_jornada}
            </p>

            <p className="mt-1 text-xs">
              Encerre a jornada anterior antes
              de iniciar uma nova jornada.
            </p>
          </div>
        )}

        {/* ======================================================
            CHECKLIST
        ====================================================== */}

        {!checklistLoading &&
          !checklistConcluido && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">

              <p className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />

                Checklist pré-voo pendente
              </p>

              <p className="mt-1 text-xs">
                A perna só pode ser iniciada
                após a conclusão do checklist
                pré-voo desta solicitação.
              </p>

              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => {
                  onOpenChange(false);

                  navigate(
                    `/pre-voo/${voo.id}`,
                  );
                }}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />

                Abrir pré-voo
              </Button>
            </div>
          )}

        {/* ======================================================
            DADOS DA PERNA
        ====================================================== */}

        {!pernasLoading &&
          !jornadasLoading &&
          pernaAtual && (
            <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="data-partida">
                  Data da operação
                </Label>

                <Input
                  id="data-partida"
                  type="date"
                  value={dataPartida}
                  onChange={(e) =>
                    setDataPartida(
                      e.target.value,
                    )
                  }
                  className="font-mono"
                />
              </div>

              {!jornadaDoDia && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="apresentacao">
                    Apresentação da tripulação
                  </Label>

                  <Input
                    id="apresentacao"
                    type="time"
                    value={apresentacao}
                    onChange={(e) =>
                      setApresentacao(
                        e.target.value,
                      )
                    }
                    className="font-mono"
                  />

                  <p className="text-xs text-muted-foreground">
                    Início da jornada de
                    trabalho. Geralmente ocorre
                    cerca de 30 minutos antes
                    do voo.
                  </p>
                </div>
              )}

              {jornadaDoDia && (
                <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Apresentação registrada
                  </p>

                  <p className="mt-1 font-mono text-sm font-semibold">
                    {new Date(
                      jornadaDoDia.apresentacao_em,
                    )
                      .toISOString()
                      .slice(
                        11,
                        16,
                      )}{" "}
                    UTC
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="acionamento">
                  Acionamento (AC)
                </Label>

                <Input
                  id="acionamento"
                  type="time"
                  value={acionamento}
                  onChange={(e) =>
                    setAcionamento(
                      e.target.value,
                    )
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="decolagem">
                  Decolagem (DEP)
                </Label>

                <Input
                  id="decolagem"
                  type="time"
                  value={decolagem}
                  onChange={(e) =>
                    setDecolagem(
                      e.target.value,
                    )
                  }
                  className="font-mono"
                />
              </div>

            </div>
          )}

        {/* ======================================================
            REGRA PÓS-CORTE
        ====================================================== */}

        {!jornadaDoDia && (
          <div className="space-y-2 py-1">

            <Label>
              Encerramento da jornada
            </Label>

            <p className="text-xs text-muted-foreground">
              A jornada termina após o corte
              final dos motores. Informe o
              intervalo regulamentar utilizado
              para esta tripulação.
            </p>

            <div className="flex gap-2">

              <Button
                type="button"
                variant={
                  minutosPosCorte === 30
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setMinutosPosCorte(
                    30,
                  )
                }
              >
                30 minutos
              </Button>

              <Button
                type="button"
                variant={
                  minutosPosCorte === 45
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setMinutosPosCorte(
                    45,
                  )
                }
              >
                45 minutos
              </Button>

            </div>
          </div>
        )}

        {/* ======================================================
            TRIPULAÇÃO
        ====================================================== */}

        <div className="space-y-4 py-2">

          <div className="space-y-1.5">
            <Label htmlFor="pic">
              PIC *
            </Label>

            <Select
              value={picId}
              onValueChange={setPicId}
            >
              <SelectTrigger id="pic">
                <SelectValue placeholder="Selecione o comandante" />
              </SelectTrigger>

              <SelectContent>
                {tripulantes.map(
                  (tripulante) => (
                    <SelectItem
                      key={tripulante.id}
                      value={
                        tripulante.id
                      }
                    >
                      {
                        tripulante.nome_completo
                      }
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sic">
              SIC
            </Label>

            <Select
              value={sicId}
              onValueChange={setSicId}
            >
              <SelectTrigger id="sic">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>

              <SelectContent>
                {tripulantes
                  .filter(
                    (tripulante) =>
                      tripulante.id !==
                      picId,
                  )
                  .map(
                    (tripulante) => (
                      <SelectItem
                        key={
                          tripulante.id
                        }
                        value={
                          tripulante.id
                        }
                      >
                        {
                          tripulante.nome_completo
                        }
                      </SelectItem>
                    ),
                  )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="passageiros">
              Passageiros confirmados
            </Label>

            <Input
              id="passageiros"
              type="number"
              min="1"
              value={
                passageirosConfirmados
              }
              onChange={(e) =>
                setPassageirosConfirmados(
                  e.target.value,
                )
              }
            />
          </div>

        </div>

        {/* ======================================================
            FOOTER
        ====================================================== */}

        <DialogFooter className="flex-col gap-2 sm:flex-row">

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancelar
          </Button>

          <Button
            className="w-full sm:w-auto"
            onClick={submit}
            disabled={
              !pernaAtual ||
              !dataPartida ||
              !acionamento ||
              !decolagem ||
              !picId ||
              !checklistConcluido ||
              !!jornadaConflitante ||
              iniciarVoo.isPending ||
              pernasLoading ||
              jornadasLoading
            }
          >
            {iniciarVoo.isPending
              ? "Iniciando..."
              : `Iniciar perna ${
                  pernaAtual?.numero_perna ??
                  ""
                }`}
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
