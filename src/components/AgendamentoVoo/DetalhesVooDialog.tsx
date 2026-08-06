import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Solicitacao, SolicitacaoStatus, useAgendamentoMutations, useTripulantes } from "@/hooks/useAgendamentoVoo";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StatusHistory {
  status_anterior: string | null;
  status_novo: string;
  alterado_por: string | null;
  alterado_em: string;
  observacao: string | null;
}

// Mapeamento dos status reais configurados no banco de dados
function statusLabel(status: string, voo?: Solicitacao) {
  if (voo?.horario_pouso) return "Pousado";
  switch (status) {
    case "pendente":
      return "Pendente";
    case "confirmado":
      return "Agendado";
    case "em_rota":
      return "Em Rota";
    case "concluido":
      return "Concluído";
    case "rejeitado":
      return "Rejeitado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

export function DetalhesVooDialog({ voo, open, onOpenChange }: Props) {
  const { alterarStatusVoo } = useAgendamentoMutations();
  const { data: tripulantes = [], isLoading: tripulantesLoading } = useTripulantes();

  const { data: history = [], isLoading: historyLoading } = useQuery<StatusHistory[]>({
    queryKey: ["historico-status", voo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_status_solicitacao")
        .select("status_anterior, status_novo, alterado_por, alterado_em, observacao")
        .eq("solicitacao_id", voo!.id)
        .order("alterado_em", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!voo?.id && open,
  });

  if (!voo) return null;

  const temPouso = Boolean(voo.horario_pouso);
  const nomeTripulante = (id: string | null) => {
    if (!id) return "Não informado";
    if (tripulantesLoading) return "Carregando...";
    return tripulantes.find((tripulante) => tripulante.id === id)?.nome_completo ?? "Tripulante não encontrado";
  };

  const handleStatusUpdate = (novoStatus: SolicitacaoStatus) => {
    alterarStatusVoo.mutate({ solicitacao: voo, status: novoStatus });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Voo</DialogTitle>
          <DialogDescription>
            {voo.aeronave?.matricula ?? "Aeronave"} · {voo.origem ?? "—"} → {voo.destino ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
              <Badge className="mt-2 bg-primary/10 text-primary">{statusLabel(voo.status, voo)}</Badge>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cliente</p>
              <p className="mt-2 text-sm text-foreground">{voo.cliente_nome ?? "Cliente não informado"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Agendado</p>
              <p className="mt-2 text-sm text-foreground">
                {format(parseISO(voo.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                <br />
                {voo.horario_previsto_agendamento?.slice(0, 5) ?? "--:--"} UTC
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Execução Real</p>
              <p className="mt-2 text-sm text-foreground">
                {voo.data_partida ? format(parseISO(voo.data_partida), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                <br />
                AC: {voo.horario_acionamento?.slice(0, 5) ?? "--:--"} UTC
                <br />
                DEP: {voo.horario_decolagem?.slice(0, 5) ?? "--:--"} UTC
                {voo.horario_pouso && (
                  <>
                    <br />
                    ARR: {voo.horario_pouso.slice(0, 5)} UTC
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-border bg-background/80 p-4">
              <Label className="text-xs text-muted-foreground">Piloto</Label>
              <p className="mt-1 break-words text-sm text-foreground">{nomeTripulante(voo.piloto_id)}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-background/80 p-4">
              <Label className="text-xs text-muted-foreground">Copiloto</Label>
              <p className="mt-1 break-words text-sm text-foreground">{nomeTripulante(voo.copiloto_id)}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <Label className="text-xs text-muted-foreground">Passageiros</Label>
              <p className="mt-1 text-sm text-foreground">{voo.qtd_passageiros ?? 1}</p>
            </div>
          </div>

          {(voo.observacoes || voo.motivo_rejeicao) && (
            <div className="rounded-xl border border-border bg-background/80 p-4 space-y-2">
              {voo.observacoes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{voo.observacoes}</p>
                </div>
              )}
              {voo.motivo_rejeicao && (
                <div>
                  <Label className="text-xs text-destructive">Motivo de Rejeição/Cancelamento</Label>
                  <p className="mt-1 text-sm text-destructive/90">{voo.motivo_rejeicao}</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Histórico de status</p>
              {historyLoading && <span className="text-[11px] text-muted-foreground">Carregando...</span>}
            </div>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <div className="mt-3 space-y-3 max-h-48 overflow-y-auto">
                {history.map((item, index) => (
                  <div key={index} className="rounded-lg bg-background/50 p-3 border border-border">
                    <div className="flex flex-col gap-1 text-[11px] uppercase text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{format(parseISO(item.alterado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      <span className="break-all sm:text-right">{item.alterado_por ?? "Sistema"}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {item.status_anterior ? `${statusLabel(item.status_anterior)} → ` : ""}
                      <strong>{statusLabel(item.status_novo)}</strong>
                    </p>
                    {item.observacao && <p className="mt-1 text-sm text-muted-foreground">{item.observacao}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            {voo.status === "confirmado" && (
              <Button
                onClick={() => handleStatusUpdate("em_rota")}
                disabled={alterarStatusVoo.isPending}
              >
                Iniciar Voo (Em Rota)
              </Button>
            )}

            {voo.status === "em_rota" && (
              <Button
                onClick={() => handleStatusUpdate("confirmado")}
                variant="secondary"
                disabled={alterarStatusVoo.isPending || temPouso}
              >
                Retornar para Agendado
              </Button>
            )}

            {(voo.status === "cancelado" || voo.status === "rejeitado" || temPouso) && (
              <Button disabled variant="secondary">
                {temPouso ? "Voo Concluído" : "Voo Finalizado"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
