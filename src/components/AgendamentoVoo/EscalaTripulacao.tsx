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

// Alterado para nomenclaturas padrão de aviação no Brasil
const FUNCAO_META: Record<string, { label: string; sigla: string; barClass: string; dot: string }> = {
  pic: { label: "Comandante", sigla: "CMD", barClass: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20", dot: "bg-primary" },
  sic: { label: "Copiloto", sigla: "COP", barClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20", dot: "bg-indigo-500" },
  sobreaviso: {
    label: "Sobreaviso",
    sigla: "SBA",
    barClass: "bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/25",
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
  const [modo, setModo] = useState<"semanal" | "mensal">("semanal"); // Começando por padrão na semana
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
    // Visão semanal: Começa no dia selecionado e avança 7 dias
    return Array.from({ length: 7 }, (_, i) => addDays(diaSelecionado, i));
  }, [diaSelecionado, modo]);

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

  // Função para checar se o tripulante tem escala naquele dia específico da grade
  function getEventosDoDia(membroId: string, dataAtual: Date) {
    return escala.filter((e) => {
      if (e.membro_id !== membroId) return false;
      const ini = startOfDay(parseISO(e.data_inicio));
      const fim = startOfDay(parseISO(e.data_fim));
      const ref = startOfDay(dataAtual);
      return ref >= ini && ref <= fim;
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
      {/* Cabeçalho operacional */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plane className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Escala de Voo</h2>
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
              <div key={k} className="flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 bg-background">
                <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
                <span className="font-mono text-xs font-semibold text-foreground">{n}</span>
                <span className="text-[10px] text-muted-foreground">{v.label}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3 bg-background">
        <div className="flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
          {(["semanal", "mensal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition-all",
                modo === m ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
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
              placeholder="Buscar piloto..."
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
          <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
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
            <Plus className="mr-1 h-4 w-4" /> Nova Escala
          </Button>
        </div>
      </div>

      {/* Grade de Escala (Matriz Profissional) */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          
          {/* Cabeçalho dos Dias */}
          <div className="flex border-b border-border/80 bg-muted/10">
            <div className="w-[240px] shrink-0 p-3 border-r border-border/60 flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tripulação
            </div>
            <div className="flex flex-1">
              {dias.map((d) => {
                const fimDeSemana = getDay(d) === 0 || getDay(d) === 6;
                const hoje = isSameDay(d, new Date());
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "flex-1 min-w-[110px] border-r border-border/40 last:border-r-0 py-2 flex flex-col items-center justify-center transition-colors",
                      fimDeSemana ? "bg-muted/30" : "bg-transparent",
                      hoje && "bg-primary/5"
                    )}
                  >
                    <span className={cn("text-[10px] uppercase font-semibold", hoje ? "text-primary" : "text-muted-foreground")}>
                      {format(d, "EEE", { locale: ptBR })}
                    </span>
                    <span className={cn("text-sm font-bold", hoje ? "text-primary" : "text-foreground")}>
                      {format(d, "dd")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linhas da Matriz (Pilotos) */}
          <div className="flex flex-col bg-background">
            {listaFiltrada.map(({ tripulante, situacao, detalhe }) => {
              const meta = SITUACAO_META[situacao];

              return (
                <div key={tripulante.id} className="flex border-b border-border/40 last:border-b-0 hover:bg-muted/10 transition-colors group">
                  
                  {/* Coluna de Info do Piloto */}
                  <div className="w-[240px] shrink-0 p-3 border-r border-border/60 flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border/50">
                      <AvatarImage src={tripulante.url_avatar ?? undefined} alt={tripulante.nome_completo} />
                      <AvatarFallback className="text-xs bg-muted text-foreground">
                        {tripulante.nome_completo.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <p className="truncate text-sm font-semibold text-foreground leading-tight">
                        {tripulante.nome_completo}
                      </p>
                      <span className={cn("inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wide", meta.className)}>
                        {detalhe ?? meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Células de Dias */}
                  <div className="flex flex-1">
                    {dias.map((d) => {
                      const eventos = getEventosDoDia(tripulante.id, d);
                      const fimDeSemana = getDay(d) === 0 || getDay(d) === 6;

                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            "flex-1 min-w-[110px] border-r border-border/30 last:border-r-0 p-1.5 flex flex-col gap-1.5",
                            fimDeSemana && "bg-muted/10"
                          )}
                        >
                          {eventos.map((ev) => {
                            const aeronave = aeronaves.find((a) => a.id === ev.aeronave_id);
                            const fMeta = FUNCAO_META[ev.funcao] ?? FUNCAO_META.sobreaviso;
                            const isSba = ev.funcao === "sobreaviso";

                            return (
                              <button
                                key={ev.id}
                                onClick={() => removerEscala.mutate(ev.id)}
                                title="Clique para remover da escala"
                                className={cn(
                                  "relative group/btn flex flex-col items-center justify-center w-full rounded border px-1 py-1.5 transition-all text-center",
                                  fMeta.barClass
                                )}
                              >
                                {/* Botão invisível de lixeira que aparece no hover */}
                                <div className="absolute inset-0 bg-destructive text-destructive-foreground opacity-0 group-hover/btn:opacity-100 flex items-center justify-center rounded transition-opacity">
                                  <Trash2 className="h-4 w-4" />
                                </div>
                                
                                <span className="text-[11px] font-bold tracking-tight">
                                  {isSba ? "Sobreaviso" : (aeronave?.matricula ?? "Voo S/ ACFT")}
                                </span>
                                {!isSba && (
                                  <span className="text-[9px] font-medium opacity-80">
                                    {fMeta.sigla}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {listaFiltrada.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm font-medium">Nenhum tripulante encontrado</p>
                <p className="text-xs mt-1">Ajuste os filtros de busca ou situação.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legenda de Funções no rodapé */}
      <div className="flex flex-wrap items-center gap-5 border-t border-border/60 bg-muted/10 px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Legenda</span>
        {FUNCAO_ORDEM.map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", FUNCAO_META[f].dot)} />
            <span className="text-xs text-muted-foreground font-medium">{FUNCAO_META[f].label} <span className="opacity-60">({FUNCAO_META[f].sigla})</span></span>
          </div>
        ))}
      </div>

      {/* Dialog de Escalação (mantido o original) */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalar Tripulante</DialogTitle>
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
                  <SelectValue placeholder="Opcional (Deixe vazio p/ SBA)" />
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
              <Label>Função Designada</Label>
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
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
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
              Confirmar Escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}