import { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  getDaysInMonth,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, Plus, Search, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Aeronave,
  DisponibilidadeTripulante,
  EscalaItem,
  useAgendamentoMutations,
} from "@/hooks/useAgendamentoVoo";

// ---------------------------------------------------------------------------
// Metadados visuais
// ---------------------------------------------------------------------------

const SITUACAO_META: Record<
  DisponibilidadeTripulante["situacao"],
  { label: string; dot: string; className: string }
> = {
  disponivel: { label: "Disponível", dot: "bg-emerald-500", className: "bg-emerald-500/15 text-emerald-600" },
  em_voo: { label: "Em voo", dot: "bg-amber-500", className: "bg-amber-500/15 text-amber-600" },
  ferias: { label: "Férias", dot: "bg-sky-500", className: "bg-sky-500/15 text-sky-600" },
  cma_vencido: { label: "CMA vencido", dot: "bg-destructive", className: "bg-destructive/15 text-destructive" },
  inativo: { label: "Inativo", dot: "bg-muted-foreground/50", className: "bg-muted text-muted-foreground" },
};

const FUNCAO_META: Record<string, { label: string; sigla: string; barClass: string; dot: string }> = {
  pic: { label: "Comandante", sigla: "PIC", barClass: "bg-primary text-primary-foreground", dot: "bg-primary" },
  sic: { label: "Copiloto", sigla: "SIC", barClass: "bg-indigo-500 text-white", dot: "bg-indigo-500" },
  sobreaviso: {
    label: "Sobreaviso",
    sigla: "SBA",
    barClass: "border border-amber-500/50 bg-amber-500/15 text-amber-700",
    dot: "bg-amber-500",
  },
};

const FUNCAO_ORDEM = ["pic", "sic", "sobreaviso"];

interface Props {
  disponibilidade: DisponibilidadeTripulante[];
  escala: EscalaItem[];
  aeronaves: Aeronave[];
  diaSelecionado: Date;
}

export function EscalaTripulacao({ disponibilidade, escala, aeronaves, diaSelecionado }: Props) {
  const { criarEscala, removerEscala } = useAgendamentoMutations();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"semanal" | "mensal">("semanal");
  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todos");
  const [form, setForm] = useState({
    membro_id: "",
    aeronave_id: "",
    funcao: "pic",
    data_inicio: format(diaSelecionado, "yyyy-MM-dd"),
    data_fim: format(diaSelecionado, "yyyy-MM-dd"),
  });

  const dias = useMemo(() => {
    if (modo === "mensal") {
      const inicio = startOfMonth(diaSelecionado);
      const total = getDaysInMonth(diaSelecionado);
      return Array.from({ length: total }, (_, i) => addDays(inicio, i));
    }
    return Array.from({ length: 7 }, (_, i) => addDays(diaSelecionado, i));
  }, [diaSelecionado, modo]);

  const inicioGrade = dias[0];
  const totalDias = dias.length;
  const hojeIdx = useMemo(
    () => differenceInCalendarDays(startOfDay(new Date()), inicioGrade),
    [inicioGrade],
  );

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return disponibilidade.filter((d) => {
      const okBusca = !termo || d.tripulante.nome_completo.toLowerCase().includes(termo);
      const okSituacao = filtroSituacao === "todos" || d.situacao === filtroSituacao;
      return okBusca && okSituacao;
    });
  }, [disponibilidade, busca, filtroSituacao]);

  const kpis = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const d of disponibilidade) contagem[d.situacao] = (contagem[d.situacao] ?? 0) + 1;
    return contagem;
  }, [disponibilidade]);

  // Segmentos de escala recortados para a janela visível de cada tripulante
  function segmentosDoTripulante(membroId: string) {
    const fimGrade = dias[dias.length - 1];
    return escala
      .filter((e) => e.membro_id === membroId)
      .map((item) => {
        const ini = parseISO(item.data_inicio);
        const fim = parseISO(item.data_fim);
        if (fim < inicioGrade || ini > fimGrade) return null;
        const startIdx = Math.max(0, differenceInCalendarDays(ini, inicioGrade));
        const endIdx = Math.min(totalDias - 1, differenceInCalendarDays(fim, inicioGrade));
        return { item, startIdx, span: endIdx - startIdx + 1 };
      })
      .filter((s): s is { item: EscalaItem; startIdx: number; span: number } => s !== null)
      .sort((a, b) => a.startIdx - b.startIdx);
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      {/* Cabeçalho operacional */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plane className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Escala de Tripulação</h2>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {modo === "mensal"
                ? format(diaSelecionado, "MMMM 'de' yyyy", { locale: ptBR })
                : `${format(dias[0], "dd MMM", { locale: ptBR })} – ${format(dias[dias.length - 1], "dd MMM", { locale: ptBR })}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SITUACAO_META).map(([k, v]) => {
            const n = kpis[k] ?? 0;
            if (!n) return null;
            return (
              <div key={k} className="flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
                <span className="font-mono text-xs font-semibold text-foreground">{n}</span>
                <span className="text-[10px] text-muted-foreground">{v.label}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
        <div className="flex rounded-lg border border-border/60 bg-background p-0.5">
          {(["semanal", "mensal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors",
                modo === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/40",
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar tripulante"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
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
          <Button
            size="sm"
            onClick={() => {
              setForm((f) => ({
                ...f,
                data_inicio: format(diaSelecionado, "yyyy-MM-dd"),
                data_fim: format(diaSelecionado, "yyyy-MM-dd"),
              }));
              setAberto(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Escalar
          </Button>
        </div>
      </div>

      {/* Grade de escala */}
      <div className="overflow-x-auto px-5 py-4">
        <div className="min-w-[820px]">
          {/* Cabeçalho de dias */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `220px repeat(${totalDias}, minmax(26px, 1fr))` }}
          >
            <div />
            {dias.map((d) => {
              const fimDeSemana = getDay(d) === 0 || getDay(d) === 6;
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "flex flex-col items-center justify-end pb-2 font-mono text-[10px] uppercase",
                    fimDeSemana ? "text-muted-foreground/70" : "text-muted-foreground",
                    isSameDay(d, new Date()) && "font-bold text-primary",
                  )}
                >
                  <span>{format(d, "EEEEEE", { locale: ptBR })}</span>
                  <span className="text-[11px]">{format(d, "dd")}</span>
                </div>
              );
            })}
          </div>

          {/* Linhas por tripulante */}
          <div className="space-y-1">
            {listaFiltrada.map(({ tripulante, situacao, detalhe }) => {
              const meta = SITUACAO_META[situacao];
              const segmentos = segmentosDoTripulante(tripulante.id);

              return (
                <div
                  key={tripulante.id}
                  className="grid items-center rounded-lg bg-background/40 hover:bg-accent/20"
                  style={{ gridTemplateColumns: `220px repeat(${totalDias}, minmax(26px, 1fr))` }}
                >
                  {/* Coluna do tripulante */}
                  <div className="flex items-center gap-2 py-2 pr-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={tripulante.url_avatar ?? undefined} alt={tripulante.nome_completo} />
                      <AvatarFallback className="text-[11px]">
                        {tripulante.nome_completo.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{tripulante.nome_completo}</p>
                      <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", meta.className)}>
                        <span className={cn("h-1 w-1 rounded-full", meta.dot)} />
                        {detalhe ?? meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Trilha de dias com barras de escala */}
                  <div
                    className="relative col-span-full grid h-10"
                    style={{
                      gridColumn: `2 / span ${totalDias}`,
                      gridTemplateColumns: `repeat(${totalDias}, minmax(26px, 1fr))`,
                    }}
                  >
                    {dias.map((d, idx) => {
                      const fimDeSemana = getDay(d) === 0 || getDay(d) === 6;
                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            "border-l border-border/30",
                            idx === totalDias - 1 && "border-r",
                            fimDeSemana && "bg-muted/30",
                          )}
                        />
                      );
                    })}

                    {hojeIdx >= 0 && hojeIdx < totalDias && (
                      <div
                        className="pointer-events-none absolute inset-y-0 w-px bg-primary/50"
                        style={{ left: `${(hojeIdx / totalDias) * 100}%` }}
                      />
                    )}

                    {segmentos.map(({ item, startIdx, span }) => {
                      const aeronave = aeronaves.find((a) => a.id === item.aeronave_id);
                      const fMeta = FUNCAO_META[item.funcao] ?? FUNCAO_META.sobreaviso;
                      return (
                        <button
                          key={item.id}
                          onClick={() => removerEscala.mutate(item.id)}
                          title={`${tripulante.nome_completo} · ${fMeta.label}${aeronave ? ` · ${aeronave.matricula}` : ""}\n${format(parseISO(item.data_inicio), "dd/MM")} – ${format(parseISO(item.data_fim), "dd/MM")}\nClique para remover`}
                          className={cn(
                            "group absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-center gap-1 truncate rounded-md px-2 text-[10px] font-semibold shadow-sm transition-transform hover:scale-[1.03]",
                            fMeta.barClass,
                          )}
                          style={{
                            left: `calc(${(startIdx / totalDias) * 100}% + 2px)`,
                            width: `calc(${(span / totalDias) * 100}% - 4px)`,
                          }}
                        >
                          <span className="truncate">{aeronave?.matricula ?? fMeta.sigla}</span>
                          <Trash2 className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {listaFiltrada.length === 0 && (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-10 text-center">
                <p className="text-xs font-medium text-foreground">Nenhum tripulante encontrado</p>
                <p className="text-[11px] text-muted-foreground">Ajuste a busca ou o filtro de situação.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 border-t border-border/60 px-5 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Função</span>
        {FUNCAO_ORDEM.map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-sm", FUNCAO_META[f].dot)} />
            <span className="text-[11px] text-muted-foreground">{FUNCAO_META[f].label}</span>
          </div>
        ))}
      </div>

      {/* Dialog de escalação */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalar tripulante</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tripulante</Label>
              <Select value={form.membro_id} onValueChange={(v) => setForm((f) => ({ ...f, membro_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {disponibilidade
                    .filter((d) => d.situacao === "disponivel")
                    .map((d) => (
                      <SelectItem key={d.tripulante.id} value={d.tripulante.id}>
                        {d.tripulante.nome_completo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aeronave</Label>
              <Select value={form.aeronave_id} onValueChange={(v) => setForm((f) => ({ ...f, aeronave_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {aeronaves.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.matricula} · {a.modelo ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <div className="grid grid-cols-3 gap-2">
                {FUNCAO_ORDEM.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, funcao: f }))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                      form.funcao === f
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent/30",
                    )}
                  >
                    <span className="font-mono text-[10px] font-bold">{FUNCAO_META[f].sigla}</span>
                    {FUNCAO_META[f].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!form.membro_id || criarEscala.isPending}
              onClick={() =>
                criarEscala.mutate(
                  {
                    membro_id: form.membro_id,
                    aeronave_id: form.aeronave_id || null,
                    funcao: form.funcao,
                    data_inicio: form.data_inicio,
                    data_fim: form.data_fim,
                    status: "escalado",
                  },
                  { onSuccess: () => setAberto(false) },
                )
              }
            >
              Salvar escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}