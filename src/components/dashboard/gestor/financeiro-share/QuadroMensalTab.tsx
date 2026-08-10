// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { FinanceiroFilters, FinanceiroFilterState } from "./FinanceiroFilters";
import React, { useMemo, useState, useRef } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * `controle_bancario` não existe mais — os dados agora vêm de `movimentacoes`.
 * Como esta aba precisa de campos que o hook genérico `useMovimentacoes` não
 * expõe (grupo_custo, forma_pagamento, número de parcela), fazemos aqui uma
 * busca própria diretamente em `movimentacoes`, já com os joins necessários.
 *
 * ATENÇÃO / AJUSTE NECESSÁRIO:
 * - `categoria_id` é assumido como referência a uma tabela com coluna `nome`
 *   (ajuste o nome da tabela/coluna no `select` abaixo se for diferente).
 * - O antigo campo "Prazo" (mensal/extra) não existe em `movimentacoes`; foi
 *   substituído pela exibição da parcela (`numero_parcela`/`quantidade_parcelas`).
 */

interface Transacao {
  id: string;
  data: string;
  tipo_movimento: "entrada" | "saida";
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  observacoes: string | null;
  valor: number;
  numero_documento?: string | null;
  client_name?: string | null;
  aeronave_registro?: string | null;
  grupo_categoria?: string | null;
  numero_parcela?: number | null;
  quantidade_parcelas?: number | null;
  conta_banco?: string | null;
  metodo_pagamento?: string | null;
  status?: string | null;
  tipo_caixa?: string | null;
  nf_url?: string | null;
  boleto_url?: string | null;
  recibo_url?: string | null;
  comprovante_url?: string | null;
}

function useMovimentacoesMensal() {
  return useQuery({
    queryKey: ["movimentacoes-mensal"],
    queryFn: async (): Promise<Transacao[]> => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(
          `
          id,
          descricao,
          tipo,
          tipo_caixa,
          valor,
          data_competencia,
          data_vencimento,
          data_pagamento,
          status,
          numero_doc,
          forma_pagamento,
      
          conta_bancaria,
          grupo_custo,
          categoria_id,
          clientes_id,
          aeronave_id,
          numero_parcela,
          quantidade_parcelas,
          nf_url,
          boleto_url,
          recibo_url,
          comprovante_url
        `
        )
        .order("data_competencia", { ascending: false });

      if (error) throw error;

      const movimentacoes = data || [];
      const categoriaIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.categoria_id).filter(Boolean))
      );
      const clienteIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.clientes_id).filter(Boolean))
      );
      const aeronaveIds = Array.from(
        new Set(movimentacoes.map((row: any) => row.aeronave_id).filter(Boolean))
      );

      let categoriasById = new Map<string, string>();
      let clientesById = new Map<string, string>();
      let aeronavesById = new Map<string, string>();

      if (categoriaIds.length > 0) {
        const { data: categoriasData } = await supabase
          .from("categorias_movimentacao")
          .select("id, nome")
          .in("id", categoriaIds);

        if (categoriasData) {
          categoriasById = new Map(categoriasData.map((categoria: any) => [categoria.id, categoria.nome]));
        }
      }

      if (clienteIds.length > 0) {
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, nome")
          .in("id", clienteIds);

        if (clientesData) {
          clientesById = new Map(clientesData.map((cliente: any) => [cliente.id, cliente.nome]));
        }
      }

      if (aeronaveIds.length > 0) {
        const { data: aeronavesData } = await supabase
          .from("aeronave")
          .select("id, registro")
          .in("id", aeronaveIds);

        if (aeronavesData) {
          aeronavesById = new Map(aeronavesData.map((aeronave: any) => [aeronave.id, aeronave.registro]));
        }
      }

      return movimentacoes.map((row: any) => ({
        id: row.id,
        data: row.data_competencia,
        tipo_movimento: row.tipo === "receita" || row.tipo === "entrada" ? "entrada" : "saida",
        descricao: row.descricao,
        categoria_id: row.categoria_id,
        categoria_nome: categoriasById.get(row.categoria_id) ?? null,
        observacoes: null,
        valor: Number(row.valor),
        numero_documento: row.numero_doc,
        client_name: clientesById.get(row.clientes_id) ?? null,
        aeronave_registro: aeronavesById.get(row.aeronave_id) ?? null,
        grupo_categoria: row.grupo_custo,
        numero_parcela: row.numero_parcela,
        quantidade_parcelas: row.quantidade_parcelas,
        conta_banco: row.conta_bancaria || row.conta_bancaria || null,
        metodo_pagamento: row.forma_pagamento,
        status: row.status,
        tipo_caixa: row.tipo_caixa,
        nf_url: row.nf_url,
        boleto_url: row.boleto_url,
        recibo_url: row.recibo_url,
        comprovante_url: row.comprovante_url,
      }));
    },
  });
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Returns Tailwind text-color class for the valor cell.
 *
 * Entrada → sempre verde, EXCETO:
 *   pendente → laranja
 *   recebido → azul
 *
 * Saída → sempre vermelho, EXCETO:
 *   recebido → azul
 *   pendente → laranja
 *   pago     → vermelho (padrão)
 */
function getValorColorClass(tipo: "entrada" | "saida", status: string | null | undefined): string {
  const s = (status || "").toLowerCase();

  if (tipo === "entrada") {
    if (s === "pendente") return "text-orange-400";
    if (s === "recebido") return "text-blue-400";
    return "text-emerald-400"; // default entrada
  }

  // saida
  if (s === "recebido") return "text-blue-400";
  if (s === "pendente") return "text-orange-400";
  return "text-destructive"; // pago ou sem status
}

/**
 * Returns classes for the Status badge.
 * Mesmas regras do valor.
 */
function getStatusBadgeClass(tipo: "entrada" | "saida", status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  const base = "text-xs font-medium border px-2 py-0.5 rounded-full";

  if (tipo === "entrada") {
    if (s === "pendente") return `${base} border-orange-400/40 bg-orange-400/10 text-orange-400`;
    if (s === "recebido") return `${base} border-blue-400/40 bg-blue-400/10 text-blue-400`;
    return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-400`;
  }

  // saida
  if (s === "recebido") return `${base} border-blue-400/40 bg-blue-400/10 text-blue-400`;
  if (s === "pendente") return `${base} border-orange-400/40 bg-orange-400/10 text-orange-400`;
  return `${base} border-destructive/40 bg-destructive/10 text-destructive`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QuadroSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-6">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-6">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuadroMensalTab() {
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [filterTipo, setFilterTipo] = useState<"todas" | "entrada" | "saida">("todas");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [advancedFilters, setAdvancedFilters] = useState<FinanceiroFilterState>({
    search: "",
    status: "all",
    dateRange: undefined,
    amountRange: [0, 100000],
    source: "all",
    caixaType: "all",
  });

  // ── Drag-scroll refs ──────────────────────────────────────────────────────
  // Header (month nav)
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [headerDragging, setHeaderDragging] = useState(false);
  const [headerDragStart, setHeaderDragStart] = useState(0);

  // Table wrapper
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableDragging, setTableDragging] = useState(false);
  const [tableDragStart, setTableDragStart] = useState(0);

  // Table title drag (syncs with table body)
  const [titleDragging, setTitleDragging] = useState(false);
  const [titleDragStart, setTitleDragStart] = useState(0);

  const makeDragHandlers = (
    ref: React.RefObject<HTMLDivElement>,
    setDragging: (v: boolean) => void,
    setStart: (v: number) => void,
    dragging: boolean,
    start: number
  ) => ({
    onMouseDown: (e: React.MouseEvent) => {
      setDragging(true);
      setStart(e.clientX + (ref.current?.scrollLeft || 0));
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!dragging || !ref.current) return;
      ref.current.scrollLeft = start - e.clientX;
    },
    onMouseUp: () => setDragging(false),
    onMouseLeave: () => setDragging(false),
  });

  const headerDragHandlers = makeDragHandlers(
    headerScrollRef, setHeaderDragging, setHeaderDragStart, headerDragging, headerDragStart
  );

  const tableDragHandlers = makeDragHandlers(
    tableScrollRef, setTableDragging, setTableDragStart, tableDragging, tableDragStart
  );

  // Title drag: scroll the table body
  const titleDragHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      setTitleDragging(true);
      setTitleDragStart(e.clientX + (tableScrollRef.current?.scrollLeft || 0));
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!titleDragging || !tableScrollRef.current) return;
      tableScrollRef.current.scrollLeft = titleDragStart - e.clientX;
    },
    onMouseUp: () => setTitleDragging(false),
    onMouseLeave: () => setTitleDragging(false),
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  // `controle_bancario` não existe mais: buscamos direto em `movimentacoes`.
  const { data: controleTransacoes, isLoading } = useMovimentacoesMensal();

  const startDate = startOfMonth(new Date(mesAtual.year, mesAtual.month));
  const endDate = endOfMonth(startDate);

  const normalizeTransactionDate = (transacao: any) => {
    if (transacao.data) return new Date(transacao.data);
    if (transacao.data_vencimento) return new Date(transacao.data_vencimento);
    if (transacao.data_competencia) return new Date(transacao.data_competencia);
    if (transacao.criado_em) return new Date(transacao.criado_em);
    return null;
  };

  const transacoes = useMemo(() => {
    if (!controleTransacoes) return [];
    return (controleTransacoes as any[]).filter((t) => {
      const transacaoDate = normalizeTransactionDate(t);
      return transacaoDate && transacaoDate >= startDate && transacaoDate <= endDate;
    });
  }, [controleTransacoes, startDate, endDate]);

  const transacoesAnterior = useMemo(() => {
    if (!controleTransacoes) return [];
    const start = startOfMonth(subMonths(startDate, 1));
    const end = endOfMonth(start);
    return (controleTransacoes as any[]).filter((t) => {
      const transacaoDate = normalizeTransactionDate(t);
      return transacaoDate && transacaoDate >= start && transacaoDate <= end;
    });
  }, [controleTransacoes, startDate]);

  const maxAmount = useMemo(() => {
    if (!transacoes || transacoes.length === 0) return 100000;
    return Math.max(...transacoes.map((t) => Number(t.valor)));
  }, [transacoes]);

  React.useEffect(() => {
    setAdvancedFilters((prev) => ({ ...prev, amountRange: [0, maxAmount] }));
  }, [maxAmount]);

  const navigateMes = (dir: "prev" | "next") => {
    setMesAtual((m) => {
      const date =
        dir === "prev"
          ? subMonths(new Date(m.year, m.month), 1)
          : addMonths(new Date(m.year, m.month), 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];

    const filtered = transacoes.filter((t) => {
      const nome = t.categoria_nome || "-";

      const matchesSearch =
        t.descricao?.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        nome.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        t.numero_documento?.toLowerCase().includes(advancedFilters.search.toLowerCase());

      const matchesStatus =
        advancedFilters.status === "all" || t.status === advancedFilters.status;

      const matchesValue =
        Number(t.valor) >= advancedFilters.amountRange[0] &&
        Number(t.valor) <= advancedFilters.amountRange[1];

      const matchesTipo =
        filterTipo === "todas" || t.tipo_movimento === filterTipo;

      const matchesCaixa =
        advancedFilters.caixaType === "all" ||
        t.tipo_caixa === advancedFilters.caixaType;

      let matchesDateRange = true;
      if (advancedFilters.dateRange?.from) {
        const transacaoDate = new Date(t.data);
        const rangeStart = new Date(advancedFilters.dateRange.from);
        rangeStart.setHours(0, 0, 0, 0);
        matchesDateRange = transacaoDate >= rangeStart;
        if (advancedFilters.dateRange.to) {
          const rangeEnd = new Date(advancedFilters.dateRange.to);
          rangeEnd.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && transacaoDate <= rangeEnd;
        }
      }

      const matchesSource =
        advancedFilters.source === "all" ||
        (advancedFilters.source === "reconciliation" && t.conta_banco) ||
        (advancedFilters.source === "despesa" && !t.conta_banco);

      return matchesSearch && matchesStatus && matchesValue && matchesTipo && matchesCaixa && matchesDateRange && matchesSource;
    });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.data).getTime();
      const dateB = new Date(b.data).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [transacoes, advancedFilters, filterTipo, sortOrder]);

  const tableThemeClass =
    advancedFilters.caixaType === "share"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : advancedFilters.caixaType === "cliente"
        ? "border-blue-500/40 bg-blue-500/10"
        : "border-border/40 bg-card/30";

  const tableHeaderThemeClass =
    advancedFilters.caixaType === "share"
      ? "bg-emerald-950/70"
      : advancedFilters.caixaType === "cliente"
        ? "bg-blue-950/70"
        : "bg-card/80";

  // ── KPI totals ────────────────────────────────────────────────────────────
  const totalReceitas = useMemo(
    () =>
      (transacoes || [])
        .filter((t) => t.tipo_movimento === "entrada")
        .reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoes]
  );

  const totalDespesas = useMemo(
    () =>
      (transacoes || [])
        .filter((t) => t.tipo_movimento === "saida")
        .reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoes]
  );

  const receitasAnterior = useMemo(
    () =>
      (transacoesAnterior || [])
        .filter((t) => t.tipo_movimento === "entrada")
        .reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoesAnterior]
  );

  const despesasAnterior = useMemo(
    () =>
      (transacoesAnterior || [])
        .filter((t) => t.tipo_movimento === "saida")
        .reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoesAnterior]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getDelta = (atual: number, anterior: number) => {
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const DeltaBadge = ({
    atual,
    anterior,
    invert = false,
  }: {
    atual: number;
    anterior: number;
    invert?: boolean;
  }) => {
    const delta = getDelta(atual, anterior);
    if (delta === null) return null;
    const positive = invert ? delta < 0 : delta > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
          positive
            ? "bg-emerald-500/20 text-emerald-400"
            : delta === 0
            ? "bg-muted text-muted-foreground"
            : "bg-destructive/20 text-destructive"
        }`}
      >
        {delta > 0 ? (
          <TrendingUp className="w-3 h-3" />
        ) : delta < 0 ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  };

  // `controle_bancario` não existe mais: exclusão sempre em `movimentacoes`.
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }
      toast.success("Transação deletada com sucesso!");
      setDeleteConfirmId(null);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  if (isLoading) return <QuadroSkeleton />;

  return (
    <div className="space-y-5">
      {/* ── Month Navigation ───────────────────────────────────────────── */}
      <div
        ref={headerScrollRef}
        {...headerDragHandlers}
        className="sticky top-0 z-20 flex items-center justify-between pb-2 bg-gradient-to-b from-black/80 to-black/0 backdrop-blur-sm cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/40 bg-card/30 backdrop-blur-sm hover:bg-accent"
            onClick={() => navigateMes("prev")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground capitalize min-w-[180px] text-center">
            {format(new Date(mesAtual.year, mesAtual.month), "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/40 bg-card/30 backdrop-blur-sm hover:bg-accent"
            onClick={() => navigateMes("next")}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border/40 bg-card/30 backdrop-blur-sm gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Entradas */}
        <button
          onClick={() => setFilterTipo(filterTipo === "entrada" ? "todas" : "entrada")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "entrada"
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-2 ring-emerald-500/40"
              : "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/30 hover:from-emerald-500/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
              Total Entradas
            </p>
            <DeltaBadge atual={totalReceitas} anterior={receitasAnterior} />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalReceitas)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            vs {formatCurrency(receitasAnterior)} mês anterior
          </p>
        </button>

        {/* Saídas */}
        <button
          onClick={() => setFilterTipo(filterTipo === "saida" ? "todas" : "saida")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "saida"
              ? "border-destructive/40 bg-gradient-to-br from-destructive/20 to-red-900/10 ring-2 ring-destructive/40"
              : "border-destructive/20 bg-gradient-to-br from-destructive/10 to-red-900/5 hover:border-destructive/30 hover:from-destructive/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive/80">
              Total Saídas
            </p>
            <DeltaBadge atual={totalDespesas} anterior={despesasAnterior} invert />
          </div>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            vs {formatCurrency(despesasAnterior)} mês anterior
          </p>
        </button>

        {/* Mês Atual */}
        <button
          onClick={() => setFilterTipo("todas")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "todas"
              ? "border-primary/40 bg-gradient-to-br from-primary/20 to-blue-900/10 ring-2 ring-primary/40"
              : "border-primary/20 bg-gradient-to-br from-primary/10 to-blue-900/5 hover:border-primary/30 hover:from-primary/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
              Mês Atual
            </p>
          </div>
          <p className="text-2xl font-bold text-primary capitalize">
            {format(new Date(mesAtual.year, mesAtual.month), "MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {transacoesFiltradas.length} transações
          </p>
        </button>
      </div>

      {/* ── Advanced Filters ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-4">
        <FinanceiroFilters
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
          resultCount={transacoesFiltradas.length}
          maxAmount={maxAmount}
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className={`rounded-xl border backdrop-blur-sm overflow-hidden transition-colors ${tableThemeClass}`}>
        {/* Table title — drag scrolls the table body */}
        <div
          {...titleDragHandlers}
          className="px-5 py-4 border-b border-border/40 cursor-grab active:cursor-grabbing select-none"
        >
          <h3 className="font-semibold text-foreground">
            Transações
            {advancedFilters.caixaType !== "all" && ` — Caixa ${advancedFilters.caixaType === "share" ? "Share" : "Cliente"}`}
            {" — "}
            <span className="capitalize">
              {format(new Date(mesAtual.year, mesAtual.month), "MMMM yyyy", { locale: ptBR })}
            </span>
          </h3>
        </div>

        {transacoesFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30"
              fill="none"
              viewBox="0 0 64 64"
            >
              <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="32" x2="36" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="40" x2="28" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-muted-foreground font-medium">Nenhuma transação encontrada</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Tente ajustar os filtros ou selecionar outro mês
            </p>
          </div>
        ) : (
          /* Scrollable table wrapper — drag also works here */
          <div
            ref={tableScrollRef}
            {...tableDragHandlers}
            className="overflow-auto max-h-[560px] cursor-grab active:cursor-grabbing"
          >
            <Table>
              <TableHeader className={`sticky top-0 backdrop-blur-sm z-10 transition-colors ${tableHeaderThemeClass}`}>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    <div className="flex items-center gap-1">
                      Data
                      <ArrowUp
                        className={`w-3 h-3 transition-transform ${
                          sortOrder === "desc" ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">N° Doc</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Descrição</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Aeronave</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">Valor</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Grupo</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Parcela</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Banco</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Pagamento</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoesFiltradas.map((transacao) => {
                  const valorColor = getValorColorClass(transacao.tipo_movimento, transacao.status);
                  const statusBadgeClass = getStatusBadgeClass(transacao.tipo_movimento, transacao.status);

                  // Tipo icon/label: entrada sempre verde, saída sempre vermelho
                  const tipoIsEntrada = transacao.tipo_movimento === "entrada";

                  return (
                    <TableRow
                      key={transacao.id}
                      className="border-border/40 hover:bg-accent/30 transition-colors"
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.data ? format(parseISO(transacao.data), "dd/MM/yyyy") : "—"}
                      </TableCell>

                      {/* Tipo — cor fixa: entrada=verde, saída=vermelho */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {tipoIsEntrada ? (
                            <ArrowUpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4 text-destructive shrink-0" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              tipoIsEntrada ? "text-emerald-400" : "text-destructive"
                            }`}
                          >
                            {tipoIsEntrada ? "Entrada" : "Saída"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.numero_documento || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.client_name || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-sm">
                        {transacao.descricao}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.aeronave_registro || "—"}
                      </TableCell>

                      {/* Valor — cor muda por status */}
                      <TableCell className={`font-semibold text-sm text-right ${valorColor}`}>
                        {formatCurrency(Number(transacao.valor))}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        <Badge
                          variant="outline"
                          className="border-border/60 text-muted-foreground text-xs"
                        >
                          {transacao.grupo_categoria || transacao.categoria_nome || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.quantidade_parcelas && transacao.quantidade_parcelas > 1
                          ? `${transacao.numero_parcela}/${transacao.quantidade_parcelas}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.conta_banco || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {transacao.metodo_pagamento || "—"}
                      </TableCell>

                      {/* Status — badge com cor por tipo+status */}
                      <TableCell>
                        <span className={statusBadgeClass}>
                          {transacao.status || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
