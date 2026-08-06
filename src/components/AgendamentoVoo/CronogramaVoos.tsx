import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, CircleDot, CheckCircle2, Clock, MoreVertical, Trash2, XCircle, PlayCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Solicitacao, SolicitacaoStatus, useAgendamentoMutations, vooCobreDia } from "@/hooks/useAgendamentoVoo";
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
import { toast } from "sonner";
import { IniciarVooDialog } from "./IniciarVooDialog";
import { utcToBrasilia } from "@/lib/timezone-utils";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pendente: { label: "Pendente", badge: "bg-muted text-muted-foreground", dot: "text-muted-foreground" },
  confirmado: { label: "Agendado", badge: "bg-primary/15 text-primary", dot: "text-primary" },
  em_voo: { label: "Em Voo", badge: "bg-amber-500/15 text-amber-500", dot: "text-amber-500" },
  em_rota: { label: "Em Rota", badge: "bg-amber-500/20 text-amber-400", dot: "text-amber-400" },
  concluido: { label: "Pousado", badge: "bg-emerald-500/15 text-emerald-500", dot: "text-emerald-500" },
  rejeitado: { label: "Rejeitado", badge: "bg-destructive/15 text-destructive", dot: "text-destructive" },
  cancelado: { label: "Cancelado", badge: "bg-destructive/15 text-destructive", dot: "text-destructive" },
};

interface Props {
  solicitacoes: Solicitacao[];
  onSelect?: (s: Solicitacao) => void;
}

export function CronogramaVoos({ solicitacoes, onSelect }: Props) {
  const { alterarStatusVoo, excluirSolicitacao } = useAgendamentoMutations();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Solicitacao | null>(null);
  const [iniciarTarget, setIniciarTarget] = useState<Solicitacao | null>(null);

  const voos = useMemo(
    () =>
      solicitacoes
        .filter((s) => ["confirmado", "em_voo", "em_rota", "concluido", "cancelado", "pendente"].includes(s.status))
        .filter((s) => vooCobreDia(s, format(new Date(), "yyyy-MM-dd")) || s.data_agendada >= format(new Date(), "yyyy-MM-dd"))
        .slice(0, 6),
    [solicitacoes],
  );

  // CORRIGIDO: agora envia { solicitacao, status } igual à assinatura da mutation
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
            const emVoo = voo.status === "em_voo" || voo.status === "em_rota";
            const Icon = voo.status === "concluido" ? CheckCircle2 : emVoo ? Plane : CircleDot;
            const expanded = expandedId === voo.id;
            return (
              <li key={voo.id} className="relative">
                <Icon className={cn("absolute -left-7 top-4 h-[18px] w-[18px] bg-card", meta.dot)} />
                <div
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/50",
                    emVoo && "border-amber-500/40 bg-amber-500/5",
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
                      {format(parseISO(voo.data_agendada), "dd 'de' MMM", { locale: ptBR })}
                      {voo.cliente_nome ? ` · ${voo.cliente_nome}` : ""}
                    </p>
                  </button>
                  <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium", meta.badge)}>{meta.label}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{voo.horario_partida?.slice(0, 5) ?? "--:--"} UTC</span>
                    {voo.horario_partida && (
                      <span className="text-muted-foreground/70">· {utcToBrasilia(voo.horario_partida)} BSB</span>
                    )}
                  </span>
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
                        disabled={emVoo || voo.status === "concluido"}
                      >
                        <PlayCircle className="mr-2 h-4 w-4 text-amber-500" /> Iniciar voo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(voo, "concluido")}
                        disabled={!emVoo}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Concluir voo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(voo, "cancelado")}
                        disabled={voo.status === "cancelado"}
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar voo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(voo)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir voo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <IniciarVooDialog
        voo={iniciarTarget}
        open={!!iniciarTarget}
        onOpenChange={(open) => !open && setIniciarTarget(null)}
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
