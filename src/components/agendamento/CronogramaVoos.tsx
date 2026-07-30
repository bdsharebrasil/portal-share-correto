import { useMemo } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, CircleDot, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Solicitacao } from "@/hooks/useAgendamentoVoo";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pendente: { label: "Pendente", badge: "bg-muted text-muted-foreground", dot: "text-muted-foreground" },
  confirmado: { label: "Agendado", badge: "bg-primary/15 text-primary", dot: "text-primary" },
  em_voo: { label: "Em Voo", badge: "bg-amber-500/15 text-amber-500", dot: "text-amber-500" },
  concluido: { label: "Pousado", badge: "bg-emerald-500/15 text-emerald-500", dot: "text-emerald-500" },
  rejeitado: { label: "Rejeitado", badge: "bg-destructive/15 text-destructive", dot: "text-destructive" },
  cancelado: { label: "Cancelado", badge: "bg-muted text-muted-foreground", dot: "text-muted-foreground" },
};

interface Props {
  solicitacoes: Solicitacao[];
  onSelect?: (s: Solicitacao) => void;
}

export function CronogramaVoos({ solicitacoes, onSelect }: Props) {
  const voos = useMemo(
    () =>
      solicitacoes
        .filter((s) => ["confirmado", "em_voo", "concluido"].includes(s.status))
        .filter((s) => isToday(parseISO(s.data_agendada)) || s.data_agendada >= format(new Date(), "yyyy-MM-dd"))
        .slice(0, 6),
    [solicitacoes],
  );

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
            const Icon = voo.status === "concluido" ? CheckCircle2 : voo.status === "em_voo" ? Plane : CircleDot;
            return (
              <li key={voo.id} className="relative">
                <Icon className={cn("absolute -left-7 top-4 h-[18px] w-[18px] bg-card", meta.dot)} />
                <button
                  type="button"
                  onClick={() => onSelect?.(voo)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/50",
                    voo.status === "em_voo" && "border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium", meta.badge)}>{meta.label}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {voo.horario_partida?.slice(0, 5) ?? "--:--"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
