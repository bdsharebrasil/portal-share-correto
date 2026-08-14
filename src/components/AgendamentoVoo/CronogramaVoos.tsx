import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, CircleDot, CheckCircle2, Clock, History, MoreVertical, Trash2, XCircle, PlayCircle, AlertTriangle, ClipboardCheck, UserCheck, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Solicitacao, SolicitacaoStatus, useAgendamentoMutations, vooCobreDia } from "@/hooks/useAgendamentoVoo";
import { usePreVooChecklistsStatus } from "@/hooks/usePreVooChecklist";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ConcluirVooDialog } from "./ConcluirVooDialog";
import { IniciarVooDialog } from "./IniciarVooDialog";
import { AtualizarHorariosVooDialog } from "./AtualizarHorariosVooDialog";
import { EscalarTripulacaoDialog } from "./EscalarTripulacaoDialog";
import { utcToBrasilia } from "@/lib/timezone-utils";


// Mapeamento dos status permitidos na CHECK constraint do PostgreSQL.
const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pendente: { label: "Pendente", badge: "bg-muted text-muted-foreground", dot: "text-muted-foreground" },
  confirmado: { label: "Agendado", badge: "bg-primary/15 text-primary", dot: "text-primary" },
  em_rota: { label: "Em Rota", badge: "bg-amber-500/20 text-amber-400", dot: "text-amber-400 font-semibold" },
  concluido: { label: "Concluído", badge: "bg-emerald-500/15 text-emerald-400", dot: "text-emerald-400" },
  rejeitado: { label: "Rejeitado", badge: "bg-destructive/15 text-destructive", dot: "text-destructive" },
  cancelado: { label: "Cancelado", badge: "bg-destructive/15 text-destructive", dot: "text-destructive" },
};

interface Props {
  solicitacoes: Solicitacao[];
  onSelect?: (s: Solicitacao) => void;
}

export function CronogramaVoos({ solicitacoes, onSelect }: Props) {
  const navigate = useNavigate();
  const { alterarStatusVoo, excluirSolicitacao, confirmarVoo } = useAgendamentoMutations();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Solicitacao | null>(null);
  const [iniciarTarget, setIniciarTarget] = useState<Solicitacao | null>(null);
  const [concluirTarget, setConcluirTarget] = useState<Solicitacao | null>(null);
  const [horariosTarget, setHorariosTarget] = useState<Solicitacao | null>(null);
  const [escalarTarget, setEscalarTarget] = useState<Solicitacao | null>(null);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const voos = useMemo(
    () =>
      solicitacoes
        .filter((s) => ["confirmado", "em_rota", "cancelado", "pendente"].includes(s.status))
        .filter((s) => vooCobreDia(s, hoje) || s.data_agendada >= hoje)
        .slice(0, 6),
    [solicitacoes, hoje],
  );
  const { data: checklistStatus = {} } = usePreVooChecklistsStatus(voos.map((v) => v.id));
  const historico = useMemo(
    () =>
      solicitacoes
        .filter((s) => s.status === "concluido" || s.data_agendada < hoje)
        .sort((a, b) => (b.data_partida ?? b.data_agendada).localeCompare(a.data_partida ?? a.data_agendada)),
    [solicitacoes, hoje],
  );

  const handleStatusChange = (voo: Solicitacao, newStatus: SolicitacaoStatus) => {
    alterarStatusVoo.mutate({ solicitacao: voo, status: newStatus });
  };


  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Cronograma de Voos</h2>
        <span className="text-xs text-muted-foreground">Próximos voos</span>
      </header>

      {voos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum voo programado.</p>
      ) : (
        <ol className="relative space-y-3 pl-7">
          <span className="absolute left-[9px] top-2 bottom-2 w-px bg-border" aria-hidden />
          {voos.map((voo) => {
            const meta = STATUS_META[voo.status] ?? STATUS_META.pendente;
            const emRota = voo.status === "em_rota";
            const temPouso = Boolean(voo.horario_pouso);
            const preVooOk = checklistStatus[voo.id] === "concluido";
            const confirmado = voo.status === "confirmado";

            
            const Icon = temPouso ? CheckCircle2 : emRota ? Plane : CircleDot;
            const expanded = expandedId === voo.id;

            // Ajuste dos horários vindos do banco
            const horarioAgendado = voo.horario_previsto_agendamento?.slice(0, 5) ?? "--:--";

            return (
              <li key={voo.id} className="relative">
                <Icon className={cn("absolute -left-7 top-4 h-[18px] w-[18px] bg-card", meta.dot)} />
                <div
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/50",
                    emRota && "border-amber-500/40 bg-amber-500/5",
                    voo.status === "cancelado" && "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(expanded ? null : voo.id);
                      onSelect?.(voo);
                    }}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {voo.aeronave?.matricula ?? "Aeronave —"}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({voo.origem ?? "—"} → {voo.destino ?? "—"})
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(parseISO(voo.data_partida || voo.data_agendada), "dd 'de' MMM", { locale: ptBR })}
                      {voo.cliente_nome ? ` · ${voo.cliente_nome}` : ""}
                    </p>
                  </button>
                  
                  <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium", meta.badge)}>
                    {temPouso ? "Pousado" : meta.label}
                  </span>

                  {voo.status === "pendente" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmarVoo.mutate(voo);
                      }}
                      disabled={confirmarVoo.isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar voo
                    </button>
                  )}

                  {["confirmado", "em_rota"].includes(voo.status) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {confirmado && voo.numero_voo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEscalarTarget(voo);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Escalar Trip
                        </button>
                      )}
                      {voo.numero_voo && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {voo.numero_voo}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pre-voo/${voo.id}`);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" /> {preVooOk ? "Pré-Voo Concluído" : "Iniciar Pré-Voo"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIniciarTarget(voo);
                        }}
                        disabled={emRota || temPouso || !preVooOk}
                        title={!preVooOk ? "Conclua o checklist pré-voo para iniciar o voo" : undefined}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Iniciar Voo
                      </button>
                    </div>
                  )}

                  
                  {voo.data_partida && voo.data_partida !== voo.data_agendada && (
                    <span className="text-xs text-muted-foreground block mb-1">
                      Agendado: {format(parseISO(voo.data_agendada), "dd/MM")}
                    </span>
                  )}

                  {emRota ? (
                    <div className="flex flex-col gap-1 text-xs font-semibold tabular-nums text-foreground">
                      <span>AC {voo.horario_acionamento?.slice(0, 5) ?? "--:--"} UTC</span>
                      <span>DEP {voo.horario_decolagem?.slice(0, 5) ?? "--:--"} UTC</span>
                      {voo.horario_pouso && <span>ARR {voo.horario_pouso.slice(0, 5)} UTC</span>}
                    </div>
                  ) : temPouso ? (
                    <div className="flex items-center gap-2 text-sm font-semibold tabular-nums text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>ARR {voo.horario_pouso?.slice(0, 5) ?? "--:--"} UTC</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{horarioAgendado} UTC</span>
                      {voo.horario_previsto_agendamento && (
                        <span className="text-muted-foreground/70">· {utcToBrasilia(voo.horario_previsto_agendamento)} BSB</span>
                      )}
                    </span>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(voo, "confirmado")}
                        disabled={voo.status === "confirmado"}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Confirmar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIniciarTarget(voo)}
                        disabled={emRota || temPouso}
                      >
                        <PlayCircle className="mr-2 h-4 w-4 text-amber-500" /> Iniciar voo
                      </DropdownMenuItem>
                      {emRota && (
                        <DropdownMenuItem onClick={() => setHorariosTarget(voo)}>
                          <Clock className="mr-2 h-4 w-4 text-amber-500" /> Atualizar horários
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setConcluirTarget(voo)}
                        disabled={!emRota}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Conclusão direta
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(voo, "cancelado")}
                        disabled={voo.status === "cancelado"}
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar voo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(voo.status === "cancelado" || voo.status === "rejeitado") && (
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(voo)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir solicitação
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="mt-5 border-t border-border pt-5" aria-label="Histórico de voos">
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Histórico de voos</h3>
          </div>
          <span className="text-xs text-muted-foreground">{historico.length} registro(s)</span>
        </header>
        {historico.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum voo concluído ou anterior.</p>
        ) : (
          <div className="space-y-2">
            {historico.map((voo) => {
              const meta = STATUS_META[voo.status] ?? STATUS_META.pendente;
              const dataVoo = voo.data_partida ?? voo.data_agendada;
              return (
                <button
                  key={voo.id}
                  type="button"
                  onClick={() => onSelect?.(voo)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left transition-colors hover:border-primary/50"
                >
                  <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {voo.aeronave?.matricula ?? "Aeronave —"} · {voo.origem ?? "—"} → {voo.destino ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {format(parseISO(dataVoo), "dd/MM/yyyy", { locale: ptBR })}
                      {voo.horario_pouso ? ` · ARR ${voo.horario_pouso.slice(0, 5)} UTC` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-md px-2 py-1 text-[11px] font-medium", meta.badge)}>
                    {voo.horario_pouso ? "Pousado" : meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <IniciarVooDialog
        voo={iniciarTarget}
        open={!!iniciarTarget}
        onOpenChange={(open) => !open && setIniciarTarget(null)}
      />
      <ConcluirVooDialog
        voo={concluirTarget}
        open={!!concluirTarget}
        onOpenChange={(open) => !open && setConcluirTarget(null)}
      />
      <AtualizarHorariosVooDialog
        voo={horariosTarget}
        open={!!horariosTarget}
        onOpenChange={(open) => !open && setHorariosTarget(null)}
      />
      <EscalarTripulacaoDialog
        voo={escalarTarget}
        open={!!escalarTarget}
        onOpenChange={(open) => !open && setEscalarTarget(null)}
      />


      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir voo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o voo{" "}
              <strong className="text-foreground">
                {deleteTarget?.aeronave?.matricula ?? "—"} ({deleteTarget?.origem ?? "—"} → {deleteTarget?.destino ?? "—"})
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) excluirSolicitacao.mutate(deleteTarget);
                setDeleteTarget(null);
              }}
              disabled={excluirSolicitacao.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirSolicitacao.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
