import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Solicitacao, SolicitacaoStatus, useAgendamentoMutations, usePernasVoo, useTripulantes } from "@/hooks/useAgendamentoVoo";
import { supabase } from "@/integrations/supabase/client";
import { EditarAgendamentoDialog } from "./EditarAgendamentoDialog";
import { NovaPernaDialog } from "./NovaPernaDialog";
import { usePreVooChecklist } from "@/hooks/usePreVooChecklist";

interface Props {
  voo: Solicitacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StatusHistory {
  status_anterior: string | null;
  status_novo: string;
  alterado_por: string | null;
  /** coluna real da tabela: atualizado_em */
  atualizado_em: string | null;
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
    case "em_voo":
      return "Em Voo";
    case "pouso":
    case "pousado":
      return "Pousado";
    case "concluido":
      return "Concluído";
    case "rejeitado":
      return "Rejeitado";
    case "cancelado":
      return "Cancelado";
    default:
      return status
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
  }
}


export function DetalhesVooDialog({ voo, open, onOpenChange }: Props) {
  const { alterarStatusVoo, excluirSolicitacao } = useAgendamentoMutations();
  const navigate = useNavigate();
  const { data: tripulantes = [], isLoading: tripulantesLoading } = useTripulantes();
  const [editarAberto, setEditarAberto] = useState(false);
  const [exclusaoAberta, setExclusaoAberta] = useState(false);
  const [pernaAberta, setPernaAberta] = useState(false);
  const { data: pernas = [] } = usePernasVoo(open ? voo?.id : null);
  const { data: checklistPreVoo } = usePreVooChecklist(open ? voo?.id : null);

  const { data: history = [], isLoading: historyLoading } = useQuery<StatusHistory[]>({
    queryKey: ["historico-status", voo?.id],
    queryFn: async (): Promise<StatusHistory[]> => {
      const { data, error } = await supabase
        .from("historico_status_solicitacao")
        .select("status_anterior, status_novo, alterado_por, atualizado_em, observacao")
        .eq("solicitacao_id", voo!.id)
        .order("atualizado_em", { ascending: false });

      if (error) throw error;
      return (data ?? []) as StatusHistory[];
    },

    enabled: !!voo?.id && open,
  });

  const autorIds = [...new Set(history.map((h) => h.alterado_por).filter(Boolean))] as string[];
  const { data: autores = {} } = useQuery<Record<string, string>>({
    queryKey: ["historico-status-autores", autorIds.sort().join(",")],
    enabled: autorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, display_name, email")
        .in("id", autorIds);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? []).map((u: any) => [u.id, u.display_name || u.full_name || u.email || "Usuário"]),
      );
    },
  });

  if (!voo) return null;

  const temPouso = Boolean(voo.horario_pouso);
  const preVooConcluido = checklistPreVoo?.status === "concluido";
  const podeEditar = !["concluido", "cancelado", "rejeitado"].includes(voo.status);
  const nomeTripulante = (id: string | null) => {
    if (!id) return "Não informado";
    if (tripulantesLoading) return "Carregando...";
    return tripulantes.find((tripulante) => tripulante.id === id)?.nome_completo ?? "Tripulante não encontrado";
  };

  const handleStatusUpdate = (novoStatus: SolicitacaoStatus) => {
    alterarStatusVoo.mutate({ solicitacao: voo, status: novoStatus });
  };


  return (
    <>
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
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pernas de voo</p>
              <Button size="sm" variant="outline" onClick={() => setPernaAberta(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova perna
              </Button>
            </div>
            {pernas.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma perna registrada ainda.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {pernas.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/50 p-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      #{p.numero_perna} · {p.origem} → {p.destino}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.data_perna ? format(parseISO(p.data_perna), "dd/MM/yyyy", { locale: ptBR }) : "—"} ·{" "}
                      DEP {p.horario_decolagem?.slice(0, 5) ?? "--:--"} · ARR {p.horario_pouso?.slice(0, 5) ?? "--:--"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      <span>{item.atualizado_em ? format(parseISO(item.atualizado_em), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                      <span className="sm:text-right">
                        {item.alterado_por ? autores[item.alterado_por] ?? "Usuário" : "Sistema"}
                      </span>
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

            {podeEditar && (
              <Button variant="secondary" onClick={() => setEditarAberto(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Editar agendamento
              </Button>
            )}

            {voo.status === "pendente" && (
              <Button onClick={() => setEditarAberto(true)}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar voo
              </Button>
            )}

            {podeEditar && (
              <Button
                variant="destructive"
                onClick={() => handleStatusUpdate("cancelado")}
                disabled={alterarStatusVoo.isPending}
              >
                <XCircle className="mr-1 h-4 w-4" /> Cancelar voo
              </Button>
            )}

            {voo.status === "confirmado" && (
              <Button
                variant={preVooConcluido ? "outline" : "default"}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/pre-voo/${voo.id}`);
                }}
              >
                <ClipboardCheck className="mr-1 h-4 w-4" />
                {preVooConcluido ? "Ver pré-voo (concluído)" : "Iniciar Pré-Voo"}
              </Button>
            )}

            {voo.status === "confirmado" && preVooConcluido && (
              <Button
                onClick={() => handleStatusUpdate("em_rota")}
                disabled={alterarStatusVoo.isPending}
              >
                Iniciar Voo (Em Rota)
              </Button>
            )}

            {voo.status === "confirmado" && !preVooConcluido && (
              <p className="col-span-full text-xs text-amber-500">
                Conclua o checklist de pré-voo para liberar o início do voo em rota.
              </p>
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

            {(voo.status === "cancelado" || voo.status === "rejeitado") && (
              <Button variant="destructive" onClick={() => setExclusaoAberta(true)}>
                <Trash2 className="mr-1 h-4 w-4" /> Excluir voo
              </Button>
            )}

            {temPouso && (
              <Button disabled variant="secondary">
                Voo Concluído
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={exclusaoAberta} onOpenChange={setExclusaoAberta}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir voo?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o voo <strong className="text-foreground">{voo.aeronave?.matricula ?? "—"} ({voo.origem ?? "—"} → {voo.destino ?? "—"})</strong>? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              excluirSolicitacao.mutate(voo);
              setExclusaoAberta(false);
              onOpenChange(false);
            }}
            disabled={excluirSolicitacao.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluirSolicitacao.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <EditarAgendamentoDialog voo={voo} open={editarAberto} onOpenChange={setEditarAberto} />
    <NovaPernaDialog voo={voo} open={pernaAberta} onOpenChange={setPernaAberta} />
    </>
  );

}
