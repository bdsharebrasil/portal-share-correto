import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { CronogramaVoos } from "@/components/AgendamentoVoo/CronogramaVoos";
import { CalendarioEscala } from "@/components/AgendamentoVoo/CalendarioEscala";
import { SolicitacoesReserva } from "@/components/AgendamentoVoo/SolicitacoesReserva";
import { PainelFrota } from "@/components/AgendamentoVoo/PainelFrota";
import { EscalaTripulacao } from "@/components/AgendamentoVoo/EscalaTripulacao";
import { NovoAgendamentoDialog } from "@/components/AgendamentoVoo/NovoAgendamentoDialog";
import { DetalhesVooDialog } from "@/components/AgendamentoVoo/DetalhesVooDialog";
import { AtualizarHorariosVooDialog } from "@/components/AgendamentoVoo/AtualizarHorariosVooDialog";

import {
  calcularDisponibilidadeTripulante,
  isAgendamentoHabilitado,
  useAeronavesAgendamento,
  useAgendamentoRealtime,
  useConfigAgendamento,
  useDatasBloqueadas,
  useDisponibilidadeAeronave,
  useEscala,
  useFerias,
  useSolicitacoes,
  useStatusFrota,
  useTripulantes,
  type Solicitacao,
} from "@/hooks/useAgendamentoVoo";

export default function PainelAgendamentos() {
  useAgendamentoRealtime();

  const qc = useQueryClient();

  const [mes, setMes] = useState(
    new Date(),
  );

  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(new Date());

  const [
    novoAberto,
    setNovoAberto,
  ] = useState(false);

  const [
    selectedBooking,
    setSelectedBooking,
  ] = useState<Solicitacao | null>(
    null,
  );

  const [
    detalhesAberto,
    setDetalhesAberto,
  ] = useState(false);

  const [
    horariosAberto,
    setHorariosAberto,
  ] = useState(false);

  const [
    selectedAeronaveIdForNew,
    setSelectedAeronaveIdForNew,
  ] = useState<string | null>(
    null,
  );

  const [
    hasHandledAircraftLink,
    setHasHandledAircraftLink,
  ] = useState(false);

  const [
    searchParams,
  ] = useSearchParams();

  const aeronaveIdSelecionada =
    searchParams.get(
      "aeronaveId",
    );

  const {
    data: aeronaves = [],
  } = useAeronavesAgendamento();

  const {
    data: solicitacoes = [],
  } = useSolicitacoes();

  const {
    data: tripulantes = [],
  } = useTripulantes();

  const {
    data: ferias = [],
  } = useFerias();

  const {
    data: escala = [],
  } = useEscala();

  const {
    data: bloqueios = [],
  } = useDatasBloqueadas();

  const {
    data: statusFrota = [],
  } = useStatusFrota();

  const {
    data: disponibilidadeFrota = [],
  } =
    useDisponibilidadeAeronave();

  const {
    data: configsAgendamento = [],
  } =
    useConfigAgendamento();

  /* ============================================================
     DISPONIBILIDADE DOS TRIPULANTES
  ============================================================ */

  const disponibilidade = useMemo(
    () =>
      tripulantes.map((t) =>
        calcularDisponibilidadeTripulante(
          t,
          diaSelecionado,
          ferias,
          escala,
        ),
      ),
    [
      tripulantes,
      diaSelecionado,
      ferias,
      escala,
    ],
  );

  /* ============================================================
     AERONAVES HABILITADAS PARA AGENDAMENTO
  ============================================================ */

  const aeronavesAgendaveis =
    useMemo(
      () =>
        aeronaves.filter(
          (a) =>
            isAgendamentoHabilitado(
              a.id,
              configsAgendamento,
            ),
        ),
      [
        aeronaves,
        configsAgendamento,
      ],
    );

  /* ============================================================
     ABERTURA DE UM VOO
  ============================================================ */

  const abrirVoo = (
    voo: Solicitacao,
  ) => {
    setSelectedBooking(voo);

    const podeOperar = [
      "em_voo",
      "em_rota",
      "pousado",
    ].includes(voo.status);

    if (podeOperar) {
      setHorariosAberto(
        true,
      );
    } else {
      setDetalhesAberto(
        true,
      );
    }
  };

  /* ============================================================
     DEEP LINK DA AERONAVE
  ============================================================ */

  useEffect(() => {
    if (
      !aeronaveIdSelecionada ||
      hasHandledAircraftLink ||
      solicitacoes.length === 0
    ) {
      return;
    }

    const activeBooking =
      solicitacoes.find(
        (s) =>
          s.aeronave_id ===
            aeronaveIdSelecionada &&
          [
            "em_voo",
            "em_rota",
            "pousado",
          ].includes(
            s.status,
          ),
      );

    if (activeBooking) {
      setSelectedBooking(
        activeBooking,
      );

      setHorariosAberto(
        true,
      );
    } else {
      setSelectedAeronaveIdForNew(
        aeronaveIdSelecionada,
      );

      setNovoAberto(
        true,
      );
    }

    setHasHandledAircraftLink(
      true,
    );
  }, [
    aeronaveIdSelecionada,
    hasHandledAircraftLink,
    solicitacoes,
  ]);

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Layout>
      <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">

        {/* ======================================================
            CABEÇALHO
        ====================================================== */}

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Agendamento de Voos
            </h1>

            <p className="text-sm text-muted-foreground">
              Cronograma, escala de tripulação
              e disponibilidade da frota em
              tempo real
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              className="min-h-11 w-full sm:w-auto"
              variant="outline"
              size="sm"
              onClick={() =>
                qc.invalidateQueries({
                  queryKey: ["agv"],
                })
              }
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Atualizar
            </Button>

            <Button
              className="min-h-11 w-full sm:w-auto"
              size="sm"
              onClick={() =>
                setNovoAberto(true)
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Novo agendamento
            </Button>
          </div>
        </header>

        {/* ======================================================
            TABS
        ====================================================== */}

        <Tabs
          defaultValue="painel"
          className="space-y-5"
        >
          <TabsList className="grid h-11 w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger
              value="painel"
              className="flex-1 sm:flex-none"
            >
              Painel de voos
            </TabsTrigger>

            <TabsTrigger
              value="escala"
              className="flex-1 sm:flex-none"
            >
              Escala & Frota
            </TabsTrigger>
          </TabsList>

          {/* ====================================================
              PAINEL DE VOOS
          ==================================================== */}

          <TabsContent
            value="painel"
            className="space-y-5"
          >
            <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">

              <div className="space-y-5 lg:col-span-2">

                <CronogramaVoos
                  solicitacoes={
                    solicitacoes
                  }
                  onSelect={
                    abrirVoo
                  }
                />

                <SolicitacoesReserva
                  solicitacoes={
                    solicitacoes
                  }
                  disponibilidade={
                    disponibilidade
                  }
                />
              </div>

              <CalendarioEscala
                mes={mes}
                onMesChange={
                  setMes
                }
                diaSelecionado={
                  diaSelecionado
                }
                onDiaSelecionado={
                  setDiaSelecionado
                }
                solicitacoes={
                  solicitacoes
                }
                bloqueios={
                  bloqueios
                }
                onSelectVoo={
                  abrirVoo
                }
              />
            </div>
          </TabsContent>

          {/* ====================================================
              ESCALA E FROTA
          ==================================================== */}

          <TabsContent
            value="escala"
            className="space-y-5"
          >
            <EscalaTripulacao
              disponibilidade={
                disponibilidade
              }
              escala={escala}
              aeronaves={
                aeronaves
              }
              diaSelecionado={
                diaSelecionado
              }
            />

            <PainelFrota
              aeronaves={
                aeronaves
              }
              bloqueios={
                bloqueios
              }
              statusFrota={
                statusFrota as unknown as Record<string, unknown>[]
              }
              disponibilidade={
                disponibilidadeFrota
              }
              configs={
                configsAgendamento as unknown as Record<string, unknown>[]
              }
              dia={
                diaSelecionado
              }
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ========================================================
          DETALHES DO VOO
      ======================================================== */}

      <DetalhesVooDialog
        voo={
          selectedBooking
            ? solicitacoes.find(
                (solicitacao) =>
                  solicitacao.id ===
                  selectedBooking.id,
              ) ??
              selectedBooking
            : null
        }
        open={
          detalhesAberto
        }
        onOpenChange={(
          open,
        ) => {
          setDetalhesAberto(
            open,
          );

          if (!open) {
            setSelectedBooking(
              null,
            );
          }
        }}
      />

      {/* ========================================================
          OPERAÇÃO / JORNADA / PERNAS
      ======================================================== */}

      <AtualizarHorariosVooDialog
        voo={
          selectedBooking
        }
        open={
          horariosAberto
        }
        onOpenChange={(
          open,
        ) => {
          setHorariosAberto(
            open,
          );

          if (!open) {
            setSelectedBooking(
              null,
            );
          }
        }}
      />

      {/* ========================================================
          NOVO AGENDAMENTO
      ======================================================== */}

      <NovoAgendamentoDialog
        open={novoAberto}
        onOpenChange={(
          open,
        ) => {
          setNovoAberto(
            open,
          );

          if (!open) {
            setSelectedAeronaveIdForNew(
              null,
            );
          }
        }}
        aeronaves={
          aeronavesAgendaveis
        }
        diaSelecionado={
          diaSelecionado
        }
        selectedAeronaveId={
          selectedAeronaveIdForNew
        }
      />
    </Layout>
  );
}