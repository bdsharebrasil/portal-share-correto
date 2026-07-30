import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CronogramaVoos } from "@/components/agendamento/CronogramaVoos";
import { CalendarioEscala } from "@/components/agendamento/CalendarioEscala";
import { SolicitacoesReserva } from "@/components/agendamento/SolicitacoesReserva";
import { PainelFrota } from "@/components/agendamento/PainelFrota";
import { EscalaTripulacao } from "@/components/agendamento/EscalaTripulacao";
import { NovoAgendamentoDialog } from "@/components/agendamento/NovoAgendamentoDialog";
import {
  calcularDisponibilidadeTripulante,
  useAeronavesAgendamento,
  useAgendamentoRealtime,
  useDatasBloqueadas,
  useEscala,
  useFerias,
  useSolicitacoes,
  useStatusFrota,
  useTripulantes,
} from "@/hooks/useAgendamentoVoo";
import { useQueryClient } from "@tanstack/react-query";

export default function PainelAgendamentos() {
  useAgendamentoRealtime();
  const qc = useQueryClient();

  const [mes, setMes] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [novoAberto, setNovoAberto] = useState(false);

  const { data: aeronaves = [] } = useAeronavesAgendamento();
  const { data: solicitacoes = [] } = useSolicitacoes();
  const { data: tripulantes = [] } = useTripulantes();
  const { data: ferias = [] } = useFerias();
  const { data: escala = [] } = useEscala();
  const { data: bloqueios = [] } = useDatasBloqueadas();
  const { data: statusFrota = [] } = useStatusFrota();

  const disponibilidade = useMemo(
    () => tripulantes.map((t) => calcularDisponibilidadeTripulante(t, diaSelecionado, ferias, escala)),
    [tripulantes, diaSelecionado, ferias, escala],
  );

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
            <CronogramaVoos solicitacoes={solicitacoes} />
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

      <NovoAgendamentoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        aeronaves={aeronaves}
        diaSelecionado={diaSelecionado}
      />
    </Layout>
  );
}
