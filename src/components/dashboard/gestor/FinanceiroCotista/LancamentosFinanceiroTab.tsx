import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Search,
  Paperclip,
  FileText,
  Calendar,
  Fuel,
  Wrench,
  Shield,
  Receipt,
  Plane,
  Eye,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  X,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatDateLong = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DespesaUnificada {
  id: string;
  origem: "conciliacao" | "direto";
  data: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string;
  categoria: string | null;
  valor_total: number;
  valor_rateado: number;
  pago_por: string;
  pago_por_tipo: string | null;
  pago_diretamente: boolean;
  forma_pagamento: string | null;
  fornecedor: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  status: string | null;
  observacoes: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  socio_id: string | null;
  socio_nome: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  fluxo?: "entrada" | "saida";
  tipo_rateio?: string | null;
  percentual_uso?: number | null;
  valor_pago_real?: number | null;
  fornecedor_nome?: string | null;
}

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface LancamentosFinanceiroTabProps {
  despesas: DespesaUnificada[];
  cotistas: Cotista[];
  aeronaveLabel?: string;
  onLancamentoClick?: (d: DespesaUnificada) => void;
}

// Mapeia categoria → ícone + cor temática (semantic tokens)
function getCategoriaStyle(categoria: string | null, descricao: string) {
  const t = `${categoria || ""} ${descricao || ""}`.toUpperCase();
  if (t.includes("COMBUST") || t.includes("ABASTEC"))
    return { icon: Fuel, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20" };
  if (t.includes("MANUTEN") || t.includes("REVIS"))
    return { icon: Wrench, color: "text-cyan-400", bg: "bg-cyan-500/10", ring: "ring-cyan-500/20" };
  if (t.includes("SEGURO"))
    return { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" };
  if (t.includes("HANGAR"))
    return { icon: Plane, color: "text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/20" };
  if (t.includes("DEPÓSITO") || t.includes("DEPOSITO") || t.includes("APORTE"))
    return { icon: Receipt, color: "text-success", bg: "bg-success/10", ring: "ring-success/20" };
  return { icon: Receipt, color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" };
}

export function LancamentosFinanceiroTab({
  despesas,
  cotistas,
  aeronaveLabel,
  onLancamentoClick,
}: LancamentosFinanceiroTabProps) {
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState<number>(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(hoje.getFullYear());
  const [cotistaFiltro, setCotistaFiltro] = useState<string | undefined>();
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<"todos" | "conciliacao" | "direto">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [despesaSelecionada, setDespesaSelecionada] = useState<DespesaUnificada | null>(null);

  // Categorias únicas presentes nos lançamentos
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    despesas.forEach((d) => {
      if (d.categoria) set.add(d.categoria);
    });
    return Array.from(set).sort();
  }, [despesas]);

  const despesasFiltradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();

    const filtradas = despesas.filter((d) => {
      if (!d.data && !d.data_vencimento) return false;

      const data = new Date(d.data || d.data_vencimento || new Date());
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();

      if (mes !== mesSelecionado || ano !== anoSelecionado) return false;

      // Filtro por intervalo de dias (calendário)
      if (dateRange?.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to ?? dateRange.from);
        to.setHours(23, 59, 59, 999);
        const ref = new Date(data);
        if (ref < from || ref > to) return false;
      }

      if (filtroOrigem !== "todos" && d.origem !== filtroOrigem) return false;
      if (filtroCategoria !== "todas" && (d.categoria || "") !== filtroCategoria) return false;

      if (cotistaFiltro) {
        const pertenceAoCotista =
          d.cliente_id === cotistaFiltro || d.socio_id === cotistaFiltro;
        if (!pertenceAoCotista) return false;
      }

      if (q) {
        return (
          d.descricao?.toLowerCase().includes(q) ||
          (d.fornecedor || "").toLowerCase().includes(q) ||
          (d.numero_doc || "").toLowerCase().includes(q) ||
          (d.numero_nf || "").toLowerCase().includes(q) ||
          (d.numero_boleto || "").toLowerCase().includes(q) ||
          (d.pago_por || "").toLowerCase().includes(q) ||
          (d.categoria || "").toLowerCase().includes(q) ||
          (d.cliente_nome || "").toLowerCase().includes(q) ||
          (d.socio_nome || "").toLowerCase().includes(q)
        );
      }

      return true;
    });

    // Ordenação por data
    return [...filtradas].sort((a, b) => {
      const da = new Date(a.data || a.data_vencimento || 0).getTime();
      const db = new Date(b.data || b.data_vencimento || 0).getTime();
      return sortOrder === "asc" ? da - db : db - da;
    });
  }, [despesas, mesSelecionado, anoSelecionado, cotistaFiltro, filtroTexto, filtroOrigem, filtroCategoria, sortOrder, dateRange]);

  const totaisFiltrados = useMemo(
    () => despesasFiltradas.reduce((a, d) => a + d.valor_total, 0),
    [despesasFiltradas]
  );

  const temMultiplosCotistas = cotistas.length > 1;

  return (
    <div className="space-y-5">
      {/* Header + Filtros */}
      <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Lançamentos detalhados</h2>
              <p className="text-xs text-muted-foreground">
                {MESES[mesSelecionado - 1]}/{anoSelecionado}
                {aeronaveLabel ? ` · ${aeronaveLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Total filtrado
            </p>
            <p className="text-xl font-bold font-mono text-foreground">
              {formatBRL(totaisFiltrados)}
            </p>
            <p className="text-[10px] text-muted-foreground">{despesasFiltradas.length} lançamento(s)</p>
          </div>
        </div>

        {/* Linha 1 - filtros */}
        <div className="flex flex-wrap gap-2.5">
          <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
            <SelectTrigger className="w-40 h-10 bg-background/60 border-border/50 rounded-xl">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
            <SelectTrigger className="w-28 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-56 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categoriasDisponiveis.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {temMultiplosCotistas && (
            <Select
              value={cotistaFiltro || "todos"}
              onValueChange={(v) => setCotistaFiltro(v === "todos" ? undefined : v)}
            >
              <SelectTrigger className="w-56 h-10 bg-background/60 border-border/50 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os sócios/clientes</SelectItem>
                {cotistas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} ({c.percentual}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filtroOrigem} onValueChange={(v: any) => setFiltroOrigem(v)}>
            <SelectTrigger className="w-44 h-10 bg-background/60 border-border/50 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              <SelectItem value="conciliacao">Pago pela Share</SelectItem>
              <SelectItem value="direto">Pago direto</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por intervalo de dias via calendário */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 rounded-xl bg-background/60 border-border/50 gap-2 px-3 font-normal",
                  !dateRange?.from && "text-muted-foreground"
                )}
              >
                <CalendarDays className="h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM", { locale: ptBR })} –{" "}
                      {format(dateRange.to, "dd/MM", { locale: ptBR })}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  )
                ) : (
                  <span>Filtrar dia(s)</span>
                )}
                {dateRange?.from && (
                  <X
                    className="h-3.5 w-3.5 ml-1 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateRange(undefined);
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <CalendarPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                defaultMonth={new Date(anoSelecionado, mesSelecionado - 1, 1)}
                numberOfMonths={1}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Ordenação asc/desc */}
          <Button
            variant="outline"
            onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
            className="h-10 rounded-xl bg-background/60 border-border/50 gap-2 px-3 font-normal"
            title={sortOrder === "asc" ? "Mais antigos primeiro" : "Mais recentes primeiro"}
          >
            {sortOrder === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
            <span className="text-xs">
              {sortOrder === "asc" ? "Crescente" : "Decrescente"}
            </span>
          </Button>

          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por categoria, descrição, fornecedor, documento..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="pl-9 h-10 bg-background/60 border-border/50 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Lista de cards modernos */}
      {despesasFiltradas.length === 0 ? (
        <div className="rounded-2xl bg-card/30 border border-border/40 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum lançamento encontrado com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {despesasFiltradas.map((d) => {
            const style = getCategoriaStyle(d.categoria, d.descricao);
            const Icon = style.icon;
            const docNumero =
              d.numero_nf || d.numero_doc || d.numero_boleto || d.numero_recibo;
            const anexos = [
              { url: d.comprovante_url, label: "Comprovante" },
              { url: d.recibo_url, label: "Recibo" },
              { url: d.nf_url, label: "NF" },
              { url: d.boleto_url, label: "Boleto" },
            ].filter((a) => !!a.url);

            const pagoBadge =
              d.origem === "conciliacao"
                ? { label: "Share Brasil", cls: "border-primary/40 text-primary bg-primary/10" }
                : d.pago_por_tipo === "CLIENTE"
                ? { label: "Cliente", cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" }
                : d.pago_por_tipo === "SOCIO"
                ? { label: "Sócio", cls: "border-violet-500/40 text-violet-400 bg-violet-500/10" }
                : { label: d.pago_por || "—", cls: "border-border text-muted-foreground bg-muted/30" };

            const statusBadge =
              (d.status || "").toLowerCase() === "pago"
                ? { label: "✓ Pago", cls: "border-success/40 text-success bg-success/10" }
                : (d.status || "").toLowerCase() === "pendente"
                ? { label: "Pendente", cls: "border-amber-500/40 text-amber-400 bg-amber-500/10" }
                : { label: d.status || "—", cls: "border-border text-muted-foreground bg-muted/30" };

            return (
              <button
                key={d.id}
                onClick={() => setDespesaSelecionada(d)}
                className="w-full text-left group rounded-2xl bg-card/60 backdrop-blur-md border border-border/40 hover:border-primary/40 hover:shadow-[0_6px_24px_rgb(0,0,0,0.18)] transition-all duration-300 p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Ícone categoria + fluxo */}
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-xl ${style.bg} ${style.color} ring-1 ${style.ring} flex items-center justify-center`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {d.fluxo && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-card ${d.fluxo === "entrada" ? "bg-success" : "bg-destructive"}`}>
                        {d.fluxo === "entrada" ? (
                          <TrendingUp className="h-3 w-3 text-white" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-white" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conteúdo principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {d.descricao}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateLong(d.data_pagamento || d.data_vencimento || d.data)}
                          </span>
                          {d.fornecedor && (
                            <span className="text-foreground/70">{d.fornecedor}</span>
                          )}
                          {docNumero && (
                            <span className="font-mono text-[11px] text-muted-foreground/80">
                              {docNumero}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
                          {formatBRL(d.valor_total)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {d.cliente_nome || d.socio_nome || "—"}
                        </p>
                        {d.socio_nome && d.cliente_nome && (
                          <p className="text-xs text-muted-foreground/70">
                            Sócio: {d.socio_nome}
                          </p>
                        )}
                        {d.numero_doc && (
                          <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                            Doc: {d.numero_doc}
                          </p>
                        )}
                        <Badge variant="outline" className={`text-[10px] mt-2 ${pagoBadge.cls}`}>
                          {pagoBadge.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Pills inferiores */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${style.bg} ${style.color} border-border/30`}>
                          {d.categoria || "Sem categoria"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </Badge>
                        {d.forma_pagamento && (
                          <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">
                            {d.forma_pagamento}
                          </Badge>
                        )}
                        {temMultiplosCotistas && (d.cliente_nome || d.socio_nome) && (
                          <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground">
                            {d.cliente_nome || d.socio_nome}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {anexos.length > 0 && (
                          <div className="flex items-center gap-1">
                            {anexos.map((a) => (
                              <a
                                key={a.label}
                                href={a.url!}
                                target="_blank"
                                rel="noreferrer"
                                title={a.label}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-background/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </a>
                            ))}
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                          Ver detalhes
                        </span>
                      </div>
                    </div>

                    {/* Detalhes secundários */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/30">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          Categoria
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 truncate">
                          {d.categoria || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          Valor Total
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 font-mono">
                          {formatBRL(d.valor_total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          Valor Rateado
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 font-mono">
                          {formatBRL(d.valor_rateado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          Status
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 capitalize">
                          {d.status || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={!!despesaSelecionada} onOpenChange={(open) => !open && setDespesaSelecionada(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {despesaSelecionada && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{despesaSelecionada.descricao}</DialogTitle>
                <DialogDescription>
                  Detalhes completos do lançamento financeiro
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Seção de valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                      Valor Total
                    </p>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {formatBRL(despesaSelecionada.valor_total)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                      Valor Rateado
                    </p>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {formatBRL(despesaSelecionada.valor_rateado)}
                    </p>
                  </div>
                  {despesaSelecionada.valor_pago_real && (
                    <div className="rounded-lg bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                        Valor Pago Real
                      </p>
                      <p className="text-2xl font-bold font-mono text-foreground">
                        {formatBRL(despesaSelecionada.valor_pago_real)}
                      </p>
                    </div>
                  )}
                  {despesaSelecionada.percentual_uso && (
                    <div className="rounded-lg bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
                        Percentual de Uso
                      </p>
                      <p className="text-2xl font-bold font-mono text-foreground">
                        {despesaSelecionada.percentual_uso.toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Datas */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Datas</p>
                  <div className="grid grid-cols-2 gap-4">
                    {despesaSelecionada.data_vencimento && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                        <p className="text-sm font-medium">
                          {formatDateLong(despesaSelecionada.data_vencimento)}
                        </p>
                      </div>
                    )}
                    {despesaSelecionada.data_pagamento && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                        <p className="text-sm font-medium">
                          {formatDateLong(despesaSelecionada.data_pagamento)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Informações do fornecedor e documento */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Fornecedor e Documentos</p>
                  <div className="grid grid-cols-2 gap-4">
                    {(despesaSelecionada.fornecedor_nome || despesaSelecionada.fornecedor) && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Fornecedor</p>
                        <p className="text-sm font-medium truncate">
                          {despesaSelecionada.fornecedor_nome || despesaSelecionada.fornecedor || "—"}
                        </p>
                      </div>
                    )}
                    {despesaSelecionada.numero_doc && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Documento</p>
                        <p className="text-sm font-mono font-medium">
                          {despesaSelecionada.numero_doc}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tipo de rateio */}
                {despesaSelecionada.tipo_rateio && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Tipo de Rateio</p>
                    <p className="text-sm font-medium">{despesaSelecionada.tipo_rateio}</p>
                  </div>
                )}

                {/* Links de documentos */}
                {(despesaSelecionada.comprovante_url || despesaSelecionada.nf_url || despesaSelecionada.boleto_url) && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Documentos</p>
                    <div className="flex flex-wrap gap-2">
                      {despesaSelecionada.comprovante_url && (
                        <a
                          href={despesaSelecionada.comprovante_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                        >
                          <Paperclip className="h-4 w-4" />
                          Comprovante
                        </a>
                      )}
                      {despesaSelecionada.nf_url && (
                        <a
                          href={despesaSelecionada.nf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                        >
                          <FileText className="h-4 w-4" />
                          Nota Fiscal
                        </a>
                      )}
                      {despesaSelecionada.boleto_url && (
                        <a
                          href={despesaSelecionada.boleto_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                        >
                          <Receipt className="h-4 w-4" />
                          Boleto
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Observações */}
                {despesaSelecionada.observacoes && (
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2">
                      Observações
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {despesaSelecionada.observacoes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
