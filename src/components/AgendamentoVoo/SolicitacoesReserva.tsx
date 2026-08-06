import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { utcToBrasilia } from "@/lib/timezone-utils";
import {
  DisponibilidadeTripulante,
  Solicitacao,
  useAgendamentoMutations,
} from "@/hooks/useAgendamentoVoo";

interface Props {
  solicitacoes: Solicitacao[];
  disponibilidade: DisponibilidadeTripulante[];
}

export function SolicitacoesReserva({ solicitacoes, disponibilidade }: Props) {
  const { aprovar, rejeitar } = useAgendamentoMutations();
  const [aprovando, setAprovando] = useState<Solicitacao | null>(null);
  const [rejeitando, setRejeitando] = useState<Solicitacao | null>(null);
  const [pilotoId, setPilotoId] = useState("");
  const [copilotoId, setCopilotoId] = useState("");
  const [motivo, setMotivo] = useState("");

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const aptos = disponibilidade.filter((d) => d.situacao === "disponivel");

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Solicitações de Reserva</h2>
        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
          {pendentes.length} nova(s)
        </span>
      </header>

      {pendentes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
      ) : (
        <ul className="space-y-2">
          {pendentes.slice(0, 6).map((s) => (
            <li key={s.id} className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.cliente_nome ?? "Cliente"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.origem ?? "—"} → {s.destino ?? "—"} ·{" "}
                    {format(parseISO(s.data_agendada), "dd/MM", { locale: ptBR })}
                    {s.horario_partida ? ` · ${s.horario_partida.slice(0, 5)} UTC · ${utcToBrasilia(s.horario_partida)} BSB` : ""}
                  </p>
                  {s.qtd_passageiros ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {s.qtd_passageiros} passageiro(s)
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-emerald-500 hover:text-emerald-500"
                    onClick={() => {
                      setAprovando(s);
                      setPilotoId("");
                      setCopilotoId("");
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      setRejeitando(s);
                      setMotivo("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!aprovando} onOpenChange={(o) => !o && setAprovando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar voo e escalar tripulação</DialogTitle>
            <DialogDescription>
              A aeronave ficará indisponível nos dias do voo e a tripulação será marcada como escalada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comandante (PIC)</Label>
              <Select value={pilotoId} onValueChange={setPilotoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o comandante" />
                </SelectTrigger>
                <SelectContent>
                  {aptos.map((d) => (
                    <SelectItem key={d.tripulante.id} value={d.tripulante.id}>
                      {d.tripulante.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Copiloto (SIC)</Label>
              <Select value={copilotoId} onValueChange={setCopilotoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {aptos
                    .filter((d) => d.tripulante.id !== pilotoId)
                    .map((d) => (
                      <SelectItem key={d.tripulante.id} value={d.tripulante.id}>
                        {d.tripulante.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {aptos.length === 0 && (
              <p className={cn("text-xs text-destructive")}>
                Nenhum tripulante apto (férias, CMA vencido ou já escalado).
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={aprovar.isPending}
              onClick={() =>
                aprovando &&
                aprovar.mutate(
                  { solicitacao: aprovando, pilotoId, copilotoId },
                  { onSuccess: () => setAprovando(null) },
                )
              }
            >
              Confirmar voo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejeitando} onOpenChange={(o) => !o && setRejeitando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Informe o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={rejeitar.isPending}
              onClick={() =>
                rejeitando &&
                rejeitar.mutate({ id: rejeitando.id, motivo }, { onSuccess: () => setRejeitando(null) })
              }
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
