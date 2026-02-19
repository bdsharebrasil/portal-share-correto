import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search, Download, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Minus, ArrowUp, Edit2, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCategorias } from "@/hooks/useCategorias";
import { FinanceiroFilters, FinanceiroFilterState } from "./FinanceiroFilters";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transacao {
  id: string;
  data: string;
  tipo_movimento: "entrada" | "saida";
  descricao: string;
  categoria_id: string | null;
  observacoes: string | null;
  valor: number;
  numero_documento?: string | null;
  client_name?: string | null;
  aeronave_registro?: string | null;
  grupo_categoria?: string | null;
  prazo?: string | null;
  conta_banco?: string | null;
  metodo_pagamento?: string | null;
  status?: string | null;
  nf_url?: string | null;
  boleto_url?: string | null;
  recibo_url?: string | null;
}

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

export function QuadroMensalTab() {
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [filterTipo, setFilterTipo] = useState<"todas" | "entrada" | "saida">("todas");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtros avançados
  const [advancedFilters, setAdvancedFilters] = useState<FinanceiroFilterState>({
    search: "",
    status: "all",
    dateRange: undefined,
    amountRange: [0, 100000],
    source: "all",
  });

  const mesKey = `${mesAtual.year}-${String(mesAtual.month + 1).padStart(2, "0")}`;
  const startDate = startOfMonth(new Date(mesAtual.year, mesAtual.month));
  const endDate = endOfMonth(startDate);
  const mesAnteriorKey = format(subMonths(startDate, 1), "yyyy-MM");

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["quadro-mensal", mesKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .gte("data", format(startDate, "yyyy-MM-dd"))
        .lte("data", format(endDate, "yyyy-MM-dd"))
        .order("data", { ascending: false });
      if (error) throw error;
      return (data as Transacao[]) || [];
    },
  });

  const { data: transacoesAnterior } = useQuery({
    queryKey: ["quadro-mensal", mesAnteriorKey],
    queryFn: async () => {
      const start = startOfMonth(subMonths(startDate, 1));
      const end = endOfMonth(start);
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .gte("data", format(start, "yyyy-MM-dd"))
        .lte("data", format(end, "yyyy-MM-dd"));
      if (error) throw error;
      return (data as Transacao[]) || [];
    },
  });

  const { data: categoriasData } = useCategorias();

  // Calcular maxAmount para os filtros
  const maxAmount = useMemo(() => {
    if (!transacoes || transacoes.length === 0) return 100000;
    return Math.max(...transacoes.map((t: any) => Number(t.valor)));
  }, [transacoes]);

  // Atualizar o range quando os dados carregam
  React.useEffect(() => {
    setAdvancedFilters(prev => ({ ...prev, amountRange: [0, maxAmount] }));
  }, [maxAmount]);

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return "-";
    return categoriasData.find((c) => c.id === id)?.nome || "-";
  };

  const navigateMes = (dir: "prev" | "next") => {
    setMesAtual((m) => {
      const date = dir === "prev"
        ? subMonths(new Date(m.year, m.month), 1)
        : addMonths(new Date(m.year, m.month), 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const categorias = useMemo(() => {
    if (!transacoes || !categoriasData) return [];
    const uniqueIds = [...new Set(transacoes.map((t) => t.categoria_id))].filter(Boolean);
    return uniqueIds.map((id) => {
      const cat = categoriasData.find((c) => c.id === id);
      return { id, nome: cat?.nome || id };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [transacoes, categoriasData]);

  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];
    const filtered = transacoes.filter((t) => {
      const nome = getCategoriaName(t.categoria_id);

      // Filtros avançados
      const matchesSearch = t.descricao?.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        nome.toLowerCase().includes(advancedFilters.search.toLowerCase());

      const matchesStatus = advancedFilters.status === "all" || t.status === advancedFilters.status;

      const matchesValue = Number(t.valor) >= advancedFilters.amountRange[0] &&
        Number(t.valor) <= advancedFilters.amountRange[1];

      const matchesTipo = filterTipo === "todas" || t.tipo_movimento === filterTipo;

      // Filtro de período (data)
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

      return matchesSearch && matchesStatus && matchesValue && matchesTipo && matchesDateRange;
    });

    // Aplicar ordenação por data
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.data).getTime();
      const dateB = new Date(b.data).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [transacoes, advancedFilters, filterTipo, categoriasData, sortOrder]);

  const totalReceitas = useMemo(() =>
    (transacoes || []).filter((t) => t.tipo_movimento === "entrada").reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoes]);

  const totalDespesas = useMemo(() =>
    (transacoes || []).filter((t) => t.tipo_movimento === "saida").reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoes]);

  const receitasAnterior = useMemo(() =>
    (transacoesAnterior || []).filter((t) => t.tipo_movimento === "entrada").reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoesAnterior]);

  const despesasAnterior = useMemo(() =>
    (transacoesAnterior || []).filter((t) => t.tipo_movimento === "saida").reduce((acc, t) => acc + Number(t.valor), 0),
    [transacoesAnterior]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getDelta = (atual: number, anterior: number) => {
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("controle_bancario")
        .delete()
        .eq("id", id);

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

  const handleEdit = (id: string) => {
    setEditingId(id);
    toast.info("Funcionalidade de edição em desenvolvimento");
  };

  const DeltaBadge = ({ atual, anterior, invert = false }: { atual: number; anterior: number; invert?: boolean }) => {
    const delta = getDelta(atual, anterior);
    if (delta === null) return null;
    const positive = invert ? delta < 0 : delta > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${positive ? "bg-emerald-500/20 text-emerald-400" : delta === 0 ? "bg-muted text-muted-foreground" : "bg-destructive/20 text-destructive"}`}>
        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) return <QuadroSkeleton />;

  return (
    <div className="space-y-5">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
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
        <Button variant="outline" size="sm" className="border-border/40 bg-card/30 backdrop-blur-sm gap-2">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* KPI Cards - Clicáveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Entradas */}
        <button
          onClick={() => setFilterTipo(filterTipo === "entrada" ? "todas" : "entrada")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "entrada"
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-2 ring-emerald-500/40"
              : "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/30 hover:from-emerald-500/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">Total Entradas</p>
            <DeltaBadge atual={totalReceitas} anterior={receitasAnterior} />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalReceitas)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            vs {formatCurrency(receitasAnterior)} mês anterior
          </p>
        </button>

        {/* Card Saídas */}
        <button
          onClick={() => setFilterTipo(filterTipo === "saida" ? "todas" : "saida")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "saida"
              ? "border-destructive/40 bg-gradient-to-br from-destructive/20 to-red-900/10 ring-2 ring-destructive/40"
              : "border-destructive/20 bg-gradient-to-br from-destructive/10 to-red-900/5 hover:border-destructive/30 hover:from-destructive/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive/80">Total Saídas</p>
            <DeltaBadge atual={totalDespesas} anterior={despesasAnterior} invert />
          </div>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            vs {formatCurrency(despesasAnterior)} mês anterior
          </p>
        </button>

        {/* Card Mês */}
        <button
          onClick={() => setFilterTipo("todas")}
          className={`text-left rounded-xl border backdrop-blur-sm p-5 transition-all ${
            filterTipo === "todas"
              ? "border-primary/40 bg-gradient-to-br from-primary/20 to-blue-900/10 ring-2 ring-primary/40"
              : "border-primary/20 bg-gradient-to-br from-primary/10 to-blue-900/5 hover:border-primary/30 hover:from-primary/15"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Mês Atual</p>
          </div>
          <p className="text-2xl font-bold text-primary capitalize">
            {format(new Date(mesAtual.year, mesAtual.month), "MMMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {transacoesFiltradas.length} transações
          </p>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background/50 border-border/40"
            />
          </div>
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="px-3 py-2 bg-background/50 border border-border/40 rounded-md text-foreground text-sm"
          >
            <option value="Todas">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{c.nome}</option>
            ))}
          </select>
          {(searchTerm || filterCategoria !== "Todas") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchTerm(""); setFilterCategoria("Todas"); }}
              className="text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}
        </div>
        {(searchTerm || filterCategoria !== "Todas") && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">{transacoesFiltradas.length} transações encontradas</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h3 className="font-semibold text-foreground">
            Transações — <span className="capitalize">{format(new Date(mesAtual.year, mesAtual.month), "MMMM yyyy", { locale: ptBR })}</span>
          </h3>
        </div>
        {transacoesFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" fill="none" viewBox="0 0 64 64">
              <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="32" x2="36" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="40" x2="28" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-muted-foreground font-medium">Nenhuma transação encontrada</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Tente ajustar os filtros ou selecionar outro mês</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[560px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead
                    className="text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    <div className="flex items-center gap-1">
                      Data
                      <ArrowUp className={`w-3 h-3 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} />
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">N° Doc</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Descrição</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Aeronave</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">Valor</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Grupo</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Prazo</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Banco</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Pagamento</TableHead>
                  <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoesFiltradas.map((transacao) => (
                  <TableRow key={transacao.id} className="border-border/40 hover:bg-accent/30 transition-colors">
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(transacao.data), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {transacao.tipo_movimento === "entrada" ? (
                          <ArrowUpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${transacao.tipo_movimento === "entrada" ? "text-emerald-400" : "text-destructive"}`}>
                          {transacao.tipo_movimento === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transacao.numero_documento || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transacao.client_name || "—"}</TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{transacao.descricao}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transacao.aeronave_registro || "—"}</TableCell>
                    <TableCell className={`font-semibold text-sm text-right ${transacao.tipo_movimento === "entrada" ? "text-emerald-400" : "text-destructive"}`}>
                      {formatCurrency(Number(transacao.valor))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Badge variant="outline" className="border-border/60 text-muted-foreground text-xs">
                        {transacao.grupo_categoria || getCategoriaName(transacao.categoria_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {transacao.prazo ? format(new Date(transacao.prazo), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transacao.conta_banco || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{transacao.metodo_pagamento || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Badge variant="outline" className="border-border/60 text-muted-foreground text-xs">
                        {transacao.status || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
