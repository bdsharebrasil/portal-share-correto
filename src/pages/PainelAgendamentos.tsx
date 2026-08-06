import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CronogramaVoos } from "@/components/AgendamentoVoo/CronogramaVoos";
import { CalendarioEscala } from "@/components/AgendamentoVoo/CalendarioEscala";
import { SolicitacoesReserva } from "@/components/AgendamentoVoo/SolicitacoesReserva";
import { PainelFrota } from "@/components/AgendamentoVoo/PainelFrota";
import { EscalaTripulacao } from "@/components/AgendamentoVoo/EscalaTripulacao";
import { NovoAgendamentoDialog } from "@/components/AgendamentoVoo/NovoAgendamentoDialog";
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
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DetalhesVooDialog } from "@/components/AgendamentoVoo/DetalhesVooDialog";

export default function PainelAgendamentos() {
  useAgendamentoRealtime();
  const qc = useQueryClient();

  const [mes, setMes] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [novoAberto, setNovoAberto] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Solicitacao | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [selectedAeronaveIdForNew, setSelectedAeronaveIdForNew] = useState<string | null>(null);
  const [hasHandledAircraftLink, setHasHandledAircraftLink] = useState(false);
  const [searchParams] = useSearchParams();
  const aeronaveIdSelecionada = searchParams.get("aeronaveId");

  const { data: aeronaves = [] } = useAeronavesAgendamento();
  const { data: solicitacoes = [] } = useSolicitacoes();
  const { data: tripulantes = [] } = useTripulantes();
  const { data: ferias = [] } = useFerias();
  const { data: escala = [] } = useEscala();
  const { data: bloqueios = [] } = useDatasBloqueadas();
  const { data: statusFrota = [] } = useStatusFrota();
  const { data: disponibilidadeFrota = [] } = useDisponibilidadeAeronave();
  const { data: configsAgendamento = [] } = useConfigAgendamento();

  const disponibilidade = useMemo(
    () => tripulantes.map((t) => calcularDisponibilidadeTripulante(t, diaSelecionado, ferias, escala)),
    [tripulantes, diaSelecionado, ferias, escala],
  );

  const aeronavesAgendaveis = useMemo(
    () => aeronaves.filter((a) => isAgendamentoHabilitado(a.id, configsAgendamento)),
    [aeronaves, configsAgendamento],
  );

  useEffect(() => {
    if (!aeronaveIdSelecionada || hasHandledAircraftLink || solicitacoes.length === 0) return;

    const activeBooking = solicitacoes.find(
      (s) => s.aeronave_id === aeronaveIdSelecionada && ["em_voo", "em_rota"].includes(s.status),
    );

    if (activeBooking) {
      setSelectedBooking(activeBooking);
      setDetalhesAberto(true);
    } else {
      setSelectedAeronaveIdForNew(aeronaveIdSelecionada);
      setNovoAberto(true);
    }

    setHasHandledAircraftLink(true);
  }, [aeronaveIdSelecionada, hasHandledAircraftLink, solicitacoes]);

  return (
    <Layout>
      <div className="space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Agendamento de Voos</h1>
            <p className="text-sm text-muted-foreground">
              Cronograma, escala de tripulação e disponibilidade da frota em tempo real
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["agv"] })}>
              <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setNovoAberto(true)}>
              <Plus className="mr-1 h-4 w-4" /> Novo agendamento
            </Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CronogramaVoos solicitacoes={solicitacoes} onSelect={(voo) => {
              setSelectedBooking(voo);
              setDetalhesAberto(true);
            }} />
          </div>
          <CalendarioEscala
            mes={mes}
            onMesChange={setMes}
            diaSelecionado={diaSelecionado}
            onDiaSelecionado={setDiaSelecionado}
            solicitacoes={solicitacoes}
            bloqueios={bloqueios}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <SolicitacoesReserva solicitacoes={solicitacoes} disponibilidade={disponibilidade} />
          <div className="lg:col-span-2">
            <PainelFrota
              aeronaves={aeronaves}
              bloqueios={bloqueios}
              statusFrota={statusFrota}
              disponibilidade={disponibilidadeFrota}
              configs={configsAgendamento}
              dia={diaSelecionado}
            />
          </div>
        </div>

        <EscalaTripulacao
          disponibilidade={disponibilidade}
          escala={escala}
          aeronaves={aeronaves}
          diaSelecionado={diaSelecionado}
        />
      </div>

      <DetalhesVooDialog
        voo={selectedBooking}
        open={detalhesAberto}
        onOpenChange={(open) => {
          if (!open) setSelectedBooking(null);
          setDetalhesAberto(open);
        }}
      />

      <NovoAgendamentoDialog
        open={novoAberto}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAeronaveIdForNew(null);
          }
          setNovoAberto(open);
        }}
        aeronaves={aeronavesAgendaveis}
        diaSelecionado={diaSelecionado}
        selectedAeronaveId={selectedAeronaveIdForNew}
      />
    </Layout>
  );
}
