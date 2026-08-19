import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plane, CalendarCheck, CalendarX, Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { DataBloqueada } from "@/hooks/useAgendamentoVoo";

type SituacaoAeronave = "disponivel" | "em_voo" | "manutencao" | "reservado";

type Aeronave = {
  id: string;
  matricula: string;
  modelo?: string | null;
  fabricante?: string | null;
  url_imagem?: string | null;
};

type ConfigsAgendamento = Array<Record<string, unknown>>;
type StatusFrota = Array<Record<string, unknown>>;

function isAgendamentoHabilitado(aeronaveId: string, configs: ConfigsAgendamento): boolean {
  const config = configs.find((item) => {
    const id = item.aeronave_id ?? item.id;
    return id === aeronaveId;
  });

  return config?.habilitado !== false;
}

function calcularSituacaoAeronave(
  aeronave: Aeronave,
  dia: Date,
  bloqueios: DataBloqueada[],
  statusFrota: StatusFrota,
): { situacao: SituacaoAeronave; detalhe?: string } {
  const data = format(dia, "yyyy-MM-dd");
  const status = statusFrota.find((item) => {
    const id = item.aeronave_id ?? item.id;
    return id === aeronave.id;
  });
  const statusAtual = String(status?.status ?? "");

  if (["disponivel", "em_voo", "manutencao", "reservado"].includes(statusAtual)) {
    return { situacao: statusAtual as SituacaoAeronave };
  }

  const bloqueio = bloqueios.find((item) => {
    const registro = item as unknown as Record<string, unknown>;
    const id = registro.aeronave_id ?? registro.id;
    const dataBloqueio = registro.data ?? registro.data_bloqueada ?? registro.dia;
    return (id == null || id === aeronave.id) && String(dataBloqueio ?? "").startsWith(data);
  });

  return bloqueio
    ? { situacao: "reservado", detalhe: "Indisponível na data selecionada" }
    : { situacao: "disponivel" };
}

type DisponibilidadeAeronave = {
  id?: string | null;
  registro?: string | null;
  localizacao_atual?: string | null;
  dias_bloqueados?: number | null;
};

const SITUACAO_META: Record<SituacaoAeronave, { label: string; className: string }> = {
  disponivel: { label: "Pronto", className: "bg-emerald-500/15 text-emerald-500" },
  em_voo: { label: "Em Voo", className: "bg-amber-500/15 text-amber-500" },
  manutencao: { label: "Manutenção", className: "bg-destructive/15 text-destructive" },
  reservado: { label: "Reservado", className: "bg-primary/15 text-primary" },
};

interface Props {
  aeronaves: Aeronave[];
  bloqueios: DataBloqueada[];
  statusFrota: StatusFrota;
  disponibilidade?: DisponibilidadeAeronave[];
  configs?: ConfigsAgendamento;
  dia: Date;
}

export function PainelFrota({ aeronaves, bloqueios, statusFrota, disponibilidade = [], configs = [], dia }: Props) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return aeronaves.filter((a) => {
      const alvo = `${a.matricula} ${a.modelo ?? ""} ${a.fabricante ?? ""}`.toLowerCase();
      const okBusca = !termo || alvo.includes(termo);
      const { situacao } = calcularSituacaoAeronave(a, dia, bloqueios, statusFrota);
      const okFiltro = filtro === "todos" || situacao === filtro;
      return okBusca && okFiltro;
    });
  }, [aeronaves, busca, filtro, dia, bloqueios, statusFrota]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Painel da Frota</h2>
          <span className="text-xs text-muted-foreground">
            {lista.length} de {aeronaves.length} aeronave(s) · {format(dia, "dd/MM/yyyy")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aeronave"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas situações</SelectItem>
              {Object.entries(SITUACAO_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((a) => {
          const { situacao, detalhe } = calcularSituacaoAeronave(a, dia, bloqueios, statusFrota);
          const meta = SITUACAO_META[situacao];
          const disp = disponibilidade.find((d) => d.id === a.id || d.registro === a.matricula);
          const agendavel = isAgendamentoHabilitado(a.id, configs);
          const recolhido = recolhidos[a.id] ?? false;
          return (
            <article key={a.id} className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
              <button
                type="button"
                onClick={() => setRecolhidos((p) => ({ ...p, [a.id]: !recolhido }))}
                className="flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left transition-colors hover:bg-accent/30"
              >
                <span className="truncate text-xs font-semibold text-foreground">{a.matricula}</span>
                <span className="flex items-center gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", meta.className)}>{meta.label}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", recolhido && "-rotate-90")} />
                </span>
              </button>

              <div className={cn(recolhido && "hidden")}>
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
              </div>
              <div className="p-3">

                <p className="truncate text-sm font-semibold text-foreground">{a.modelo ?? a.fabricante ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Matrícula {a.matricula}</p>
                {detalhe && <p className="mt-1 truncate text-[11px] text-muted-foreground">{detalhe}</p>}
                {disp && (
                  <p className="mt-1 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                    <span>{disp.localizacao_atual ?? "Localização —"}</span>
                    <span>·</span>
                    <span>{Number(disp.dias_bloqueados ?? 0)} dia(s) bloqueado(s)</span>
                  </p>
                )}
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                    agendavel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {agendavel ? <CalendarCheck className="h-3 w-3" /> : <CalendarX className="h-3 w-3" />}
                  {agendavel ? "Agendamento liberado" : "Agendamento bloqueado"}
                </span>

              </div>
              </div>
            </article>

          );
        })}
      </div>
    </section>
  );
}
