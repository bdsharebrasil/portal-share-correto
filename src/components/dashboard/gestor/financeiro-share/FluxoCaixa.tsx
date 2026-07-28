// @ts-nocheck
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Trash2,
  BarChart3,
  Plus,
  Edit2,
  CreditCard,
  FileText,
  Receipt,
  Paperclip,
  EyeOff,
  GripHorizontal,
  Wallet,
  Clock,
  Check,
} from "lucide-react";
import { useMovimentacoes } from "@/hooks/useMovimentacoes";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FluxoCaixaInlineForm } from "./FluxoCaixaInlineForm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { FinanceiroFilters, FinanceiroFilterState } from "./FinanceiroFilters";
import { QuadroMensalTab } from "./QuadroMensalTab";

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";

/* ─────────────────────────── Configuração das colunas ─────────────────────────── */
const columnConfig: Record<string, { label: string; sortField?: SortField }> = {
  data: { label: "Data", sortField: "data" },
  tipo: { label: "Tipo", sortField: "tipo_movimento" },
  descricao: { label: "Descrição" },
  categoria: { label: "Categoria" },
  caixa: { label: "Caixa" },
  cliente: { label: "Cliente" },
  valor: { label: "Valor", sortField: "valor" },
  conta: { label: "Conta" },
  aeronave: { label: "Aeronave" },
  nDoc: { label: "Nº Doc" },
  anexos: { label: "Anexos" },
  status: { label: "Status" },
};

const DEFAULT_COLUMN_ORDER = [
  "data", "tipo", "caixa", "descricao", "categoria", "cliente",
  "valor", "conta", "aeronave", "nDoc", "anexos", "status",
];

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200, 500, 1000];

/* ─────────────────────────── helpers de status (visual) ─────────────────────────── */
function num(v: any) { return Number(v) || 0; }

function StatusBadge({ status, tipoMovimento }: { status: string | null | undefined; tipoMovimento: "entrada" | "saida" }) {
  const s = (status || "").toLowerCase();

  if (s === "pago" || s === "recebido" || s === "quitado" || s === "confirmado") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="h-3 w-3" />
        {status}
      </span>
    );
  }
  if (s === "cancelado") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
        {status}
      </span>
    );
  }
  if (s === "pendente" || s === "aguardando_reembolso") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="h-3 w-3" />
        {status === "aguardando_reembolso" ? "Aguard. Reembolso" : status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      {status || "—"}
    </span>
  );
}

function StatusDot({ status }: { status: string | null | undefined }) {
  const s = (status || "").toLowerCase();
  const color =
    s === "pago" || s === "recebido" || s === "quitado" || s === "confirmado" ? "bg-emerald-500" :
    s === "cancelado" ? "bg-red-500" :
    s === "pendente" || s === "aguardando_reembolso" ? "bg-amber-500" : "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

function KpiCard({
  label, value, tone, icon: Icon,
}: {
  label: string; value: number; tone: "green" | "red" | "blue" | "amber"; icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
}) {
  const cfg = {
    green: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", iconBg: "#dcfce7" },
    red: { bg: "#fff5f5", border: "#fecaca", text: "#dc2626", iconBg: "#fee2e2" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", iconBg: "#dbeafe" },
    amber: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", iconBg: "#fef3c7" },
  }[tone];

  return (
    <div className="rounded-2xl p-4 border shadow-sm" style={{ background: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cfg.iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: cfg.text } as React.CSSProperties} />
        </div>
      </div>
      <div className="font-bold text-lg" style={{ color: cfg.text }}>
        R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export function FluxoCaixa() {
  const { user } = useAuth();
  const { data: transacoes, isLoading, error } = useMovimentacoes();
  const { categorias: contasData } = useCategoriasFinanceiro();

  /* ── Larguras das colunas ─────────────────────────────────────────────────────── */
  const defaultColumnWidths = {
    data: 100, tipo: 100, caixa: 100, descricao: 180, categoria: 130, cliente: 130,
    valor: 110, conta: 120, aeronave: 110, nDoc: 100, anexos: 80, status: 120,
  };
  const { columnWidths, setColumnWidth } = useColumnWidths("fluxo-caixa", defaultColumnWidths);

  /* ── Ordem das colunas (drag-and-drop) ───────────────────────────────────────── */
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  /* ── Filtros avançados ────────────────────────────────────────────────────────── */
  const maxAmount = useMemo(() => {
    if (!transacoes?.length) return 100000;
    return Math.ceil(Math.max(...transacoes.map((t: any) => Number(t.valor) || 0)) / 1000) * 1000 || 100000;
  }, [transacoes]);

  const [advancedFilters, setAdvancedFilters] = useState<FinanceiroFilterState>({
    search: "",
    status: "all",
    dateRange: undefined,
    amountRange: [0, 100000],
    source: "all",
    caixaType: "all",
  });

  useEffect(() => {
    setAdvancedFilters((prev) => ({
      ...prev,
      amountRange: [prev.amountRange[0], maxAmount],
    }));
  }, [maxAmount]);

  /* ── Estado geral ─────────────────────────────────────────────────────────────── */
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"lista" | "visualizacao-mensal" | "caixa-cliente">("lista");
  const [showReport, setShowReport] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set(DEFAULT_COLUMN_ORDER)
  );
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  useEffect(() => { setPageInputValue(String(currentPage)); }, [currentPage]);

  /* ── Refs para scroll sincronizado (top + bottom) ──────────────────────────────── */
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
      }
    });
    if (tableContainerRef.current) {
      observer.observe(tableContainerRef.current);
      setTableScrollWidth(tableContainerRef.current.scrollWidth);
    }
    return () => observer.disconnect();
  }, [columnOrder, expandedColumns, columnWidths]);

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (tableContainerRef.current && topScrollRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  const handleBottomScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  /* ── Drag para scroll horizontal (no container) ────────────────────────────────── */
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  const handleTableDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="button"], a, select, [draggable="true"]')) {
      return;
    }
    const container = tableContainerRef.current;
    if (container && container.scrollWidth > container.clientWidth) {
      setIsDragging(true);
      dragStartXRef.current = e.clientX;
      scrollStartXRef.current = container.scrollLeft;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!container) return;
        const delta = moveEvent.clientX - dragStartXRef.current;
        const newScroll = scrollStartXRef.current - delta;
        container.scrollLeft = newScroll;
        if (topScrollRef.current) topScrollRef.current.scrollLeft = newScroll;
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
    }
  };

  /* ── Handlers de drag-and-drop das colunas ─────────────────────────────────────── */
  const handleColumnDragStart = (e: React.DragEvent, column: string) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedColumn) return;
    const sourceIndex = columnOrder.indexOf(draggedColumn);
    if (sourceIndex === targetIndex) return;
    const newOrder = [...columnOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);
    setColumnOrder(newOrder);
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  const handleColumnDragLeave = () => setDragOverIndex(null);
  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDragOverIndex(null);
  };

  /* ── Redimensionamento de colunas ───────────────────────────────────────────────── */
  const handleColumnResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnId] || defaultColumnWidths[columnId as keyof typeof defaultColumnWidths];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(60, startWidthRef.current + diff);
      setColumnWidth(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  /* ── Sort ───────────────────────────────────────────────────────────────────────── */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  /* ── Seleção ──────────────────────────────────────────────────────────────────────── */
  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransacoes.length && paginatedTransacoes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransacoes.map((t: any) => t.id)));
    }
  };

  /* ── Visibilidade das colunas ─────────────────────────────────────────────────────── */
  const toggleColumnVisibility = (columnId: string) => {
    if (expandedColumns.has(columnId)) {
      setExpandedColumns((prev) => { const s = new Set(prev); s.delete(columnId); return s; });
      setCollapsedColumns((prev) => new Set([...prev, columnId]));
    } else if (collapsedColumns.has(columnId)) {
      setCollapsedColumns((prev) => { const s = new Set(prev); s.delete(columnId); return s; });
      setExpandedColumns((prev) => new Set([...prev, columnId]));
    }
  };

  const getColumnLabel = (columnId: string): string => {
    const labels: Record<string, string> = {
      data: "D", tipo: "T", caixa: "Cx", descricao: "Desc", categoria: "Cat",
      cliente: "Cl", valor: "V", conta: "C", aeronave: "A",
      nDoc: "Doc", anexos: "Anx", status: "St",
    };
    return labels[columnId] || columnId.charAt(0).toUpperCase();
  };

  const calculateColSpan = () => expandedColumns.size + collapsedColumns.size + 2;

  /* ── Filtragem ────────────────────────────────────────────────────────────────────── */
  const filteredTransacoes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t: any) => {
      const matchesSearch =
        !advancedFilters.search ||
        t.descricao?.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        t.numero_documento?.toLowerCase().includes(advancedFilters.search.toLowerCase());

      const matchesStatus =
        advancedFilters.status === "all" || t.status === advancedFilters.status;

      const val = Number(t.valor);
      const matchesValue =
        val >= advancedFilters.amountRange[0] && val <= advancedFilters.amountRange[1];

      let matchesDate = true;
      if (advancedFilters.dateRange?.from) {
        const dateStr = t.data;
        let txDate: Date;
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, d] = dateStr.split("-").map(Number);
          txDate = new Date(y, m - 1, d);
        } else {
          txDate = new Date(t.data);
        }
        const from = advancedFilters.dateRange.from;
        const to = advancedFilters.dateRange.to ?? from;
        matchesDate = txDate >= from && txDate <= to;
      }

      const matchesSource =
        advancedFilters.source === "all" || t.tipo_movimento === advancedFilters.source;

      const matchesCaixa =
        advancedFilters.caixaType === "all" || (t.tipo_caixa || 'share') === advancedFilters.caixaType;

      return matchesSearch && matchesStatus && matchesValue && matchesDate && matchesSource && matchesCaixa;
    });
  }, [transacoes, advancedFilters]);

  /* ── Ordenação ────────────────────────────────────────────────────────────────────── */
  const sortedTransacoes = useMemo(() => {
    return [...filteredTransacoes].sort((a: any, b: any) => {
      if (!sortField) return 0;
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      if (sortField === "data") {
        aValue = new Date(a.data).getTime();
        bValue = new Date(b.data).getTime();
      } else if (sortField === "valor") {
        aValue = Number(a.valor);
        bValue = Number(b.valor);
      }
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTransacoes, sortField, sortDirection]);

  /* ── Paginação ────────────────────────────────────────────────────────────────────── */
  const transacoesForTab = useMemo(() => {
    if (activeTab === 'caixa-cliente') {
      return sortedTransacoes.filter((t: any) => (t.tipo_caixa || 'share') === 'cliente');
    }
    return sortedTransacoes;
  }, [activeTab, sortedTransacoes]);

  const totalPages = Math.max(1, Math.ceil(transacoesForTab.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransacoes = transacoesForTab.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const commitPageInput = () => {
    const parsed = Math.min(totalPages, Math.max(1, Number(pageInputValue) || 1));
    setCurrentPage(parsed);
    setPageInputValue(String(parsed));
  };

  /* ── KPIs (sobre o conjunto filtrado da aba ativa) ───────────────────────────────── */
  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0, pendentes = 0;
    for (const t of transacoesForTab) {
      const v = num(t.valor);
      if (t.tipo_movimento === "entrada") entradas += v; else saidas += v;
      const s = (t.status || "").toLowerCase();
      if (s === "pendente" || s === "aguardando_reembolso") pendentes += v;
    }
    return { entradas, saidas, saldo: entradas - saidas, pendentes };
  }, [transacoesForTab]);

  /* ── Relatório agrupado ───────────────────────────────────────────────────────────── */
  const selectedTransacoes = transacoesForTab.filter((t: any) => selectedIds.has(t.id));

  const getGroupedReport = () => {
    const grouped: Record<string, { total: number; count: number }> = {};
    selectedTransacoes.forEach((t: any) => {
      const key = `${t.categoria} (${t.tipo_movimento})`;
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += Number(t.valor);
      grouped[key].count += 1;
    });
    return grouped;
  };

  /* ── Delete ───────────────────────────────────────────────────────────────────────── */
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) { toast.error(`Erro ao deletar: ${error.message}`); return; }
      toast.success("Movimentação deletada com sucesso!");
      setDeleteConfirmId(null);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("movimentacoes").delete().in("id", ids);
      if (error) { toast.error(`Erro ao deletar: ${error.message}`); return; }
      toast.success(`${selectedIds.size} movimentação(ões) deletada(s) com sucesso!`);
      setSelectedIds(new Set());
      setCurrentPage(1);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar movimentações");
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8 bg-red-50 border border-red-200 rounded-xl">
        Erro ao carregar transações. Verifique suas permissões.
      </div>
    );
  }

  /* ── Render da célula do body por coluna ─────────────────────────────────────────── */
  const renderCell = (column: string, transacao: any, lineNumber: number) => {
    const isEntrada = transacao.tipo_movimento === "entrada";
    const isPendente = (transacao.status || "").toLowerCase() === "pendente" || (transacao.status || "").toLowerCase() === "aguardando_reembolso";
    const colWidth = columnWidths[column] ?? defaultColumnWidths[column as keyof typeof defaultColumnWidths];
    const style = { width: colWidth, minWidth: colWidth, maxWidth: colWidth };

    switch (column) {
      case "data":
        return (
          <TableCell key="data" className="text-slate-500 whitespace-nowrap" style={style}>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-300 text-[11px] font-semibold">#{lineNumber}</span>
              <span className="text-slate-700 text-xs">
                {(() => {
                  const ds = transacao.data;
                  if (ds && /^\d{4}-\d{2}-\d{2}$/.test(ds)) {
                    const [y, m, d] = ds.split("-").map(Number);
                    return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR });
                  }
                  return format(new Date(transacao.data), "dd/MM/yyyy", { locale: ptBR });
                })()}
              </span>
            </div>
          </TableCell>
        );
      case "tipo":
        return (
          <TableCell key="tipo" style={style}>
            <div className="flex items-center gap-1.5">
              {isEntrada
                ? <ArrowUpCircle className={`w-4 h-4 ${isPendente ? "text-amber-500" : "text-emerald-500"}`} />
                : <ArrowDownCircle className="w-4 h-4 text-slate-400" />}
              <span className={`text-xs font-medium ${isEntrada ? (isPendente ? "text-amber-600" : "text-emerald-600") : "text-slate-600"}`}>
                {isEntrada ? "Entrada" : "Saída"}
              </span>
            </div>
          </TableCell>
        );
      case "descricao":
        return (
          <TableCell key="descricao" className="text-slate-700 font-medium truncate" style={style} title={transacao.descricao}>
            {transacao.descricao}
          </TableCell>
        );
      case "categoria":
        return (
          <TableCell key="categoria" style={style}>
            <span
              className="inline-block px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-500 bg-white"
              style={{ border: "1px solid #cbd5e1" }}
            >
              {transacao.categoria_nome || "-"}
            </span>
          </TableCell>
        );
      case "caixa":
        return (
          <TableCell key="caixa" style={style}>
            <span
              className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide text-white"
              style={{ background: transacao.tipo_caixa === "cliente" ? "#ea8c00" : "#1e3a5f" }}
            >
              {(transacao.tipo_caixa === "cliente" && "Cliente") || (transacao.tipo_caixa === "share" && "Share") || transacao.tipo_caixa || "-"}
            </span>
          </TableCell>
        );
      case "cliente":
        return (
          <TableCell key="cliente" className="truncate" style={style} title={transacao.client_name || ""}>
            <span className="font-medium" style={{ color: "#ea8c00" }}>
              {transacao.client_name || "-"}
            </span>
          </TableCell>
        );
      case "valor":
        return (
          <TableCell key="valor" style={style}>
            <span className={`font-bold text-[13px] ${isEntrada ? (isPendente ? "text-amber-600" : "text-emerald-600") : "text-slate-700"}`}>
              {isEntrada ? "+" : ""}R$ {Number(transacao.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </TableCell>
        );
      case "conta":
        return (
          <TableCell key="conta" className="text-slate-500 text-xs" style={style}>
            {transacao.conta_banco || "-"}
          </TableCell>
        );
      case "aeronave":
        return (
          <TableCell key="aeronave" style={style}>
            {transacao.aeronave_registro ? (
              <span
                className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide text-white"
                style={{ background: "#1e3a5f" }}
              >
                {transacao.aeronave_registro}
              </span>
            ) : <span className="text-slate-300">-</span>}
          </TableCell>
        );
      case "nDoc":
        return (
          <TableCell key="nDoc" className="text-slate-500 text-xs" style={style}>
            {transacao.numero_documento || "-"}
          </TableCell>
        );
      case "anexos":
        return (
          <TableCell key="anexos" style={style}>
            <TooltipProvider>
              <div className="flex items-center gap-1">
                {transacao.comprovante_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.comprovante_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-100 transition-colors">
                        <CreditCard className="w-4 h-4 text-emerald-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Comprovante</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.nf_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.nf_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-100 transition-colors">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Nota Fiscal</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.boleto_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.boleto_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-100 transition-colors">
                        <Paperclip className="w-4 h-4 text-orange-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Boleto</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.recibo_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.recibo_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-100 transition-colors">
                        <Receipt className="w-4 h-4 text-purple-500" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Recibo</p></TooltipContent>
                  </Tooltip>
                )}
                {!transacao.comprovante_url && !transacao.nf_url && !transacao.boleto_url && !transacao.recibo_url && (
                  <span className="text-slate-300">-</span>
                )}
              </div>
            </TooltipProvider>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" style={style}>
            <div className="flex items-center gap-2">
              <StatusDot status={transacao.status} />
              <StatusBadge status={transacao.status} tipoMovimento={transacao.tipo_movimento} />
            </div>
          </TableCell>
        );
      default:
        return null;
    }
  };

  /* ── Tabela de movimentações reutilizável (usada em "lista" e "caixa-cliente") ────── */
  const renderMovimentacoesTable = () => (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Entradas" value={kpis.entradas} tone="green" icon={ArrowUpRight} />
        <KpiCard label="Total Saídas" value={kpis.saidas} tone="red" icon={ArrowDownRight} />
        <KpiCard label="Saldo Líquido" value={kpis.saldo} tone={kpis.saldo >= 0 ? "blue" : "red"} icon={Wallet} />
        <KpiCard label="Pendências" value={kpis.pendentes} tone="amber" icon={Clock} />
      </div>

      {/* Filtros Avançados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
          <span className="font-bold text-sm text-slate-800">Filtros</span>
          {activeTab === "lista" && !showInlineForm && (
            <Button
              onClick={() => setShowInlineForm(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Movimentação
            </Button>
          )}
        </div>
        <div className="p-5">
          <FinanceiroFilters
            filters={advancedFilters}
            onFiltersChange={(f) => { setAdvancedFilters(f); setCurrentPage(1); }}
            resultCount={filteredTransacoes.length}
            maxAmount={maxAmount}
          />
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex justify-between items-center gap-4 flex-wrap px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">Lista de Movimentações</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
              {transacoesForTab.length} registros
            </span>
            <span className="text-[11px] text-slate-400 px-2 py-1 rounded bg-slate-50 border border-slate-100">
              Arraste colunas para reordenar
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-slate-800 text-white hover:bg-slate-800">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </Badge>
              <Button
                onClick={() => setShowReport(!showReport)}
                variant="outline"
                className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Agrupar
              </Button>
              <Button
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir ${selectedIds.size} movimentação(ões)?`)) {
                    handleDeleteMultiple();
                  }
                }}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Deletar
              </Button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          {showReport && selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-slate-800 font-semibold mb-3 text-sm">Relatório Agrupado</h3>
              <div className="space-y-2">
                {Object.entries(getGroupedReport()).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center bg-white border border-blue-100 p-2 rounded text-sm">
                    <span className="text-slate-600">{key}</span>
                    <div className="flex gap-4 text-slate-800">
                      <span>{value.count} item{value.count !== 1 ? "ns" : ""}</span>
                      <span className="font-semibold">
                        R$ {value.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TABELA COM SCROLL SINCRONIZADO ─────────────────────────────────── */}
          <div className="relative">
            <div
              ref={tableContainerRef}
              onScroll={handleBottomScroll}
              className={`overflow-x-auto ${isDragging ? "cursor-grabbing select-none" : "cursor-default"}`}
              onMouseDown={handleTableDragStart}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedTransacoes.length > 0 && selectedIds.size === paginatedTransacoes.length}
                        onCheckedChange={() => toggleSelectAll()}
                        className="h-5 w-5"
                      />
                    </TableHead>

                    {columnOrder.map((column, index) => {
                      if (!expandedColumns.has(column)) return null;
                      const config = columnConfig[column];
                      const colWidth = columnWidths[column] ?? defaultColumnWidths[column as keyof typeof defaultColumnWidths];
                      const isSorted = sortField === config.sortField;

                      return (
                        <TableHead
                          key={column}
                          className="text-slate-500 group relative select-none p-0"
                          style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
                          onClick={() => config.sortField && handleSort(config.sortField)}
                        >
                          <div
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, column)}
                            onDragOver={(e) => handleColumnDragOver(e, index)}
                            onDrop={(e) => handleColumnDrop(e, index)}
                            onDragLeave={handleColumnDragLeave}
                            onDragEnd={handleColumnDragEnd}
                            className={`
                              flex items-center justify-between h-full px-2 py-3 transition-colors rounded
                              ${dragOverIndex === index ? "bg-blue-50 outline outline-1 outline-blue-200" : ""}
                              ${column === draggedColumn ? "opacity-40" : ""}
                            `}
                          >
                            <div className="flex items-center gap-1 flex-1 truncate cursor-move min-w-0">
                              <GripHorizontal className="w-3 h-3 text-slate-300 flex-shrink-0" />
                              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">
                                {config.label}
                              </span>
                              {isSorted && (
                                sortDirection === "asc"
                                  ? <ChevronUp className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-slate-600 flex-shrink-0" />
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(column); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                title="Ocultar coluna"
                              >
                                <EyeOff className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>

                            <div
                              onMouseDown={(e) => handleColumnResizeStart(e, column)}
                              onClick={(e) => e.stopPropagation()}
                              className={`
                                w-1 h-6 cursor-col-resize bg-slate-200 hover:bg-slate-400 transition-colors flex-shrink-0
                                ${resizingColumn === column ? "bg-slate-500" : ""}
                              `}
                            />
                          </div>
                        </TableHead>
                      );
                    })}

                    {collapsedColumns.size > 0 && (
                      <TableHead className="text-slate-500 group relative max-w-[120px]">
                        <div className="flex items-center gap-1 flex-wrap p-2">
                          {Array.from(collapsedColumns).map((colId) => (
                            <button
                              key={colId}
                              onClick={() => toggleColumnVisibility(colId)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors border border-slate-200"
                              title={`Expandir coluna - ${colId}`}
                            >
                              {getColumnLabel(colId)}
                            </button>
                          ))}
                        </div>
                      </TableHead>
                    )}

                    <TableHead className="text-right text-slate-500">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedTransacoes.map((transacao: any, idx: number) => {
                    const isEntrada = transacao.tipo_movimento === "entrada";
                    const isSelected = selectedIds.has(transacao.id);
                    const isPendente = (transacao.status || "").toLowerCase() === "pendente";
                    const lineNumber = startIndex + idx + 1;

                    return (
                      <TableRow
                        key={transacao.id}
                        className={`border-slate-100 ${isSelected ? "bg-blue-50"
                            : isEntrada && isPendente ? "bg-amber-50/50"
                              : "hover:bg-slate-50"
                          }`}
                      >
                        <TableCell className="text-center">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectId(transacao.id)} className="h-5 w-5" />
                        </TableCell>

                        {columnOrder.map((column) => {
                          if (!expandedColumns.has(column)) return null;
                          return renderCell(column, transacao, lineNumber);
                        })}

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-100">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingMovimentacao(transacao); setShowInlineForm(true); }}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteConfirmId(transacao.id)} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" />
                                <span>Deletar</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {transacoesForTab.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={calculateColSpan()} className="text-center text-slate-400 py-12">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto overflow-y-hidden absolute top-0 left-0 right-0 pointer-events-auto"
              style={{ height: 12, marginTop: 49 }}
            >
              <div style={{ width: tableScrollWidth, height: 1 }} />
            </div>
          </div>

          {/* ── Paginação estilo Supabase ────────────────────────────────────────── */}
          {transacoesForTab.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                Exibindo <span className="font-semibold text-slate-600">{startIndex + 1}</span> a{" "}
                <span className="font-semibold text-slate-600">{Math.min(startIndex + itemsPerPage, transacoesForTab.length)}</span> de{" "}
                <span className="font-semibold text-slate-600">{transacoesForTab.length}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Linhas por página</span>
                <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 w-[100px] bg-white border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROWS_PER_PAGE_OPTIONS.map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1 ml-2">
                  <Button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-200 hover:bg-slate-50"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-200 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  <span className="text-xs text-slate-500 px-1">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInputValue}
                    onChange={(e) => setPageInputValue(e.target.value)}
                    onBlur={commitPageInput}
                    onKeyDown={(e) => { if (e.key === "Enter") commitPageInput(); }}
                    className="h-9 w-16 text-center bg-white border-slate-200 text-xs"
                  />
                  <span className="text-xs text-slate-500 px-1">of {totalPages}</span>

                  <Button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-200 hover:bg-slate-50"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-200 hover:bg-slate-50"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: "#f1f5f9" }}>
      <div className="p-5 lg:p-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "lista" | "visualizacao-mensal" | "caixa-cliente")
          }
          className="w-full"
        >
          <TabsList className="bg-white border border-slate-200 rounded-lg p-1 w-full justify-start h-auto gap-2 shadow-sm">
            <TabsTrigger
              value="lista"
              className="rounded-md py-2 px-4 text-xs font-semibold transition-all whitespace-nowrap
                data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-50
                data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              Lista de Movimentações
            </TabsTrigger>
            <TabsTrigger
              value="visualizacao-mensal"
              className="rounded-md py-2 px-4 text-xs font-semibold transition-all whitespace-nowrap
                data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-50
                data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              Visualização Mensal
            </TabsTrigger>
            <TabsTrigger
              value="caixa-cliente"
              className="rounded-md py-2 px-4 text-xs font-semibold transition-all whitespace-nowrap
                data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-slate-50
                data-[state=active]:bg-slate-800 data-[state=active]:text-white"
            >
              Caixa Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-5 w-full">
            {showInlineForm && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 p-6">
                <FluxoCaixaInlineForm
                  onSuccess={() => { setShowInlineForm(false); setEditingMovimentacao(null); window.location.reload(); }}
                  onCancel={() => { setShowInlineForm(false); setEditingMovimentacao(null); }}
                  movimentacao={editingMovimentacao}
                />
              </div>
            )}
            {renderMovimentacoesTable()}
          </TabsContent>

          <TabsContent value="caixa-cliente" className="mt-5 w-full">
            {renderMovimentacoesTable()}
          </TabsContent>

          <TabsContent value="visualizacao-mensal" className="mt-5 w-full">
            <QuadroMensalTab />
          </TabsContent>

          <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
            <DialogContent className="bg-white border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-3 text-slate-800">
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </div>
                  <span>Confirmar Exclusão</span>
                </DialogTitle>
              </DialogHeader>
              <p className="text-slate-500 text-sm">
                Deseja realmente deletar esta movimentação? Esta ação não pode ser desfeita.
              </p>
              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-slate-200 hover:bg-slate-50">
                  Cancelar
                </Button>
                <Button onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">
                  Deletar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Tabs>
      </div>
    </div>
  );
}