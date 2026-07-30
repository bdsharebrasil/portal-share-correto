import { format } from "date-fns";
import { Plane, Wrench, CheckCircle2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Aeronave,
  DataBloqueada,
  SituacaoAeronave,
  StatusFrota,
  calcularSituacaoAeronave,
  useAgendamentoMutations,
} from "@/hooks/useAgendamentoVoo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SITUACAO_META: Record<SituacaoAeronave, { label: string; className: string }> = {
  disponivel: { label: "Pronto", className: "bg-emerald-500/15 text-emerald-500" },
  em_voo: { label: "Em Voo", className: "bg-amber-500/15 text-amber-500" },
  manutencao: { label: "Manutenção", className: "bg-destructive/15 text-destructive" },
  reservado: { label: "Reservado", className: "bg-primary/15 text-primary" },
};

interface Props {
  aeronaves: Aeronave[];
  bloqueios: DataBloqueada[];
  statusFrota: StatusFrota[];
  dia: Date;
}

export function PainelFrota({ aeronaves, bloqueios, statusFrota, dia }: Props) {
  const { definirStatusAeronave } = useAgendamentoMutations();

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Painel da Frota</h2>
        <span className="text-xs text-muted-foreground">
          {aeronaves.length} aeronave(s) · {format(dia, "dd/MM/yyyy")}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {aeronaves.map((a) => {
          const { situacao, detalhe } = calcularSituacaoAeronave(a, dia, bloqueios, statusFrota);
          const meta = SITUACAO_META[situacao];
          return (
            <article key={a.id} className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
              <div className="relative h-28 w-full bg-muted">
                {a.url_imagem ? (
                  <img
                    src={a.url_imagem}
                    alt={`Aeronave ${a.matricula}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Plane className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute right-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-medium backdrop-blur",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-foreground">{a.modelo ?? a.fabricante ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Matrícula {a.matricula}</p>
                {detalhe && <p className="mt-1 truncate text-[11px] text-muted-foreground">{detalhe}</p>}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      Alterar situação
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => definirStatusAeronave.mutate({ aeronaveId: a.id, status: "disponivel" })}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Disponível
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => definirStatusAeronave.mutate({ aeronaveId: a.id, status: "em_voo" })}
                    >
                      <Plane className="mr-2 h-4 w-4" /> Em voo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => definirStatusAeronave.mutate({ aeronaveId: a.id, status: "manutencao" })}
                    >
                      <Wrench className="mr-2 h-4 w-4" /> Em manutenção
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => definirStatusAeronave.mutate({ aeronaveId: a.id, status: "reservado" })}
                    >
                      <CalendarClock className="mr-2 h-4 w-4" /> Reservado
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
