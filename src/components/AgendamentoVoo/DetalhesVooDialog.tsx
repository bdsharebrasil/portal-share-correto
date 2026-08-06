import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Solicitacao, useAgendamentoMutations } from "@/hooks/useAgendamentoVoo";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusLabel(status: string) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "confirmado":
      return "Agendado";
    case "em_rota":
      return "Em Rota";
    case "em_voo":
      return "Em Voo";
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
  const { data: history = [], isLoading: historyLoading } = useQuery<any[]>({
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
    enabled: !!voo?.id,
  });

  if (!voo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Voo</DialogTitle>
          <DialogDescription>
            {voo.aeronave?.matricula ?? "Aeronave"} · {voo.origem ?? "—"} → {voo.destino ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
              <Badge className="mt-2 bg-primary/10 text-primary">{statusLabel(voo.status)}</Badge>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cliente</p>
              <p className="mt-2 text-sm text-foreground">{voo.cliente_nome ?? "Cliente não informado"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Agendado</p>
              <p className="mt-2 text-sm text-foreground">
                {format(parseISO(voo.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                <br />
                {voo.horario_partida?.slice(0, 5) ?? "--:--"} UTC
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Real</p>
              <p className="mt-2 text-sm text-foreground">
                {voo.data_partida ? format(parseISO(voo.data_partida), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                <br />
                AC {voo.horario_acionamento?.slice(0, 5) ?? "--:--"} UTC
                <br />
                DEP {voo.horario_decolagem?.slice(0, 5) ?? "--:--"} UTC
                {voo.horario_pouso ? <><br />ARR {voo.horario_pouso.slice(0, 5)} UTC</> : null}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <Label>Piloto</Label>
              <p className="mt-2 text-sm text-foreground">{voo.piloto_id ?? "Não informado"}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <Label>Copiloto</Label>
              <p className="mt-2 text-sm text-foreground">{voo.copiloto_id ?? "Não informado"}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <Label>Passageiros</Label>
              <p className="mt-2 text-sm text-foreground">{voo.qtd_passageiros ?? 0}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <Label>Observações</Label>
            <p className="mt-2 text-sm text-muted-foreground">{voo.observacoes ?? "Nenhuma observação registrada."}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Histórico de status</p>
              {historyLoading ? (
                <span className="text-[11px] text-muted-foreground">Carregando...</span>
              ) : null}
            </div>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {history.map((item: any, index: number) => (
                  <div key={index} className="rounded-lg bg-background/50 p-3 border border-border">
                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase text-muted-foreground">
                      <span>{format(parseISO(item.alterado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      <span>{item.alterado_por ?? "Sistema"}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {item.status_anterior ? `${statusLabel(item.status_anterior)} → ` : ""}
                      <strong>{statusLabel(item.status_novo)}</strong>
                    </p>
                    {item.observacao ? (
                      <p className="mt-1 text-sm text-muted-foreground">{item.observacao}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Voltar
            </Button>
            <Button
              onClick={() => alterarStatusVoo.mutate({ solicitacao: voo, status: voo.status === "em_rota" ? "em_voo" : "concluido" })}
              disabled={voo.status === "concluido" || voo.status === "cancelado" || alterarStatusVoo.isPending}
            >
              {voo.status === "em_rota" ? "Marcar como em voo" : "Concluir voo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
