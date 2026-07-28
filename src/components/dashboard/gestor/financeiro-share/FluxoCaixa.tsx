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
  Loader2,
  ChevronUp,
  ChevronDown,
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

// ─── Configuração das colunas ──────────────────────────────────────────────────
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

export function FluxoCaixa() {
  const { user } = useAuth();
  // `controle_bancario` não existe mais: os dados vêm de `movimentacoes`
  const { data: transacoes, isLoading, error } = useMovimentacoes();
  const { categorias: contasData } = useCategoriasFinanceiro();

  // ── Larguras das colunas ─────────────────────────────────────────────────────
  const defaultColumnWidths = {
    data: 100, tipo: 100, caixa: 100, descricao: 180, categoria: 130, cliente: 130,
    valor: 110, conta: 120, aeronave: 110, nDoc: 100, anexos: 80, status: 100,
  };
  const { columnWidths, setColumnWidth } = useColumnWidths("fluxo-caixa", defaultColumnWidths);

  // ── Ordem das colunas (drag-and-drop) ────────────────────────────────────────
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Filtros avançados ────────────────────────────────────────────────────────
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

  // ── Estado geral ─────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
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

  // ── Refs para scroll sincronizado (top + bottom) ──────────────────────────────
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Largura total da tabela para o scroll superior
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

  // Sincroniza scroll superior ↔ inferior
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

  // ── Drag para scroll horizontal (no container) ───────────────────────────────
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  const handleTableDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Ignora cliques em elementos interativos E em elementos draggable (cabeçalhos de coluna)
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

  // ── Handlers de drag-and-drop das colunas ────────────────────────────────────
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

  // ── Redimensionamento de colunas ─────────────────────────────────────────────
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

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // ── Seleção ──────────────────────────────────────────────────────────────────
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

  // ── Visibilidade das colunas ─────────────────────────────────────────────────
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

  // ── Filtragem ────────────────────────────────────────────────────────────────
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

  // ── Ordenação ────────────────────────────────────────────────────────────────
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

  // ── Paginação ────────────────────────────────────────────────────────────────
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

  // ── Relatório agrupado ───────────────────────────────────────────────────────
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

  // ── Delete ───────────────────────────────────────────────────────────────────
  // `controle_bancario` não existe mais: toda movimentação agora vive em
  // `movimentacoes`, então não é mais necessário descobrir a "tabela de origem".
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


  // ── Status color ─────────────────────────────────────────────────────────────
  const getStatusColor = (status: string, tipoMovimento?: string) => {
    if (tipoMovimento === "entrada" && status === "pendente")
      return "bg-orange-900/20 text-orange-400 border-orange-600";
    switch (status) {
      case "recebido": return "bg-purple-900/20 text-purple-400 border-purple-600";
      case "pago": return "bg-green-900/20 text-green-400 border-green-600";
      case "pendente": return "bg-yellow-900/20 text-yellow-400 border-yellow-600";
      case "cancelado": return "bg-red-900/20 text-red-400 border-red-600";
      default: return "bg-gray-700 text-gray-300 border-gray-600";
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 p-8">
        Erro ao carregar transações. Verifique suas permissões.
      </div>
    );
  }

  // ── Render da célula do body por coluna ──────────────────────────────────────
  const renderCell = (column: string, transacao: any, lineNumber: number) => {
    const isEntrada = transacao.tipo_movimento === "entrada";
    const isPendente = transacao.status === "pendente";
    const colWidth = columnWidths[column] ?? defaultColumnWidths[column as keyof typeof defaultColumnWidths];
    const style = { width: colWidth, minWidth: colWidth, maxWidth: colWidth };

    switch (column) {
      case "data":
        return (
          <TableCell key="data" className="text-foreground/80 whitespace-nowrap" style={style}>
            <div className="flex items-center gap-1">
              <span className="text-foreground/50 text-xs font-semibold">#{lineNumber}</span>
              <span>
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
            <div className="flex items-center gap-2">
              {isEntrada
                ? <ArrowUpCircle className={`w-4 h-4 ${isPendente ? "text-orange-400" : "text-green-400"}`} />
                : <ArrowDownCircle className="w-4 h-4 text-red-400" />}
              <span className={isEntrada ? (isPendente ? "text-orange-400" : "text-green-400") : "text-red-400"}>
                {isEntrada ? "Entrada" : "Saída"}
              </span>
            </div>
          </TableCell>
        );
      case "descricao":
        return (
          <TableCell key="descricao" className="text-white font-medium truncate" style={style}>
            {transacao.descricao}
          </TableCell>
        );
      case "categoria":
        return (
          <TableCell key="categoria" className="text-foreground/80" style={style}>
            {transacao.categoria_nome || "-"}
          </TableCell>
        );
      case "caixa":
        return (
          <TableCell key="caixa" className="text-foreground/80" style={style}>
            {(transacao.tipo_caixa === "cliente" && "Caixa Cliente") || (transacao.tipo_caixa === "share" && "Share Brasil") || transacao.tipo_caixa || "-"}
          </TableCell>
        );
      case "cliente":
        return (
          <TableCell key="cliente" className="text-foreground/80 truncate" title={transacao.cliente_nome || ""} style={style}>
            {transacao.cliente_nome || "-"}
          </TableCell>
        );
      case "valor":
        return (
          <TableCell key="valor" className={`font-semibold ${isEntrada ? (isPendente ? "text-orange-400" : "text-green-400") : "text-red-400"}`} style={style}>
            R$ {Number(transacao.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </TableCell>
        );
      case "conta":
        return (
          <TableCell key="conta" className="text-foreground/80" style={style}>
            {transacao.conta_banco || "-"}
          </TableCell>
        );
      case "aeronave":
        return (
          <TableCell key="aeronave" className="text-foreground/80" style={style}>
            {transacao.aeronave_registro || "-"}
          </TableCell>
        );
      case "nDoc":
        return (
          <TableCell key="nDoc" className="text-foreground/80" style={style}>
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
                      <a href={transacao.comprovante_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <CreditCard className="w-4 h-4 text-green-400" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Comprovante</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.nf_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.nf_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <FileText className="w-4 h-4 text-blue-400" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Nota Fiscal</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.boleto_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.boleto_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <Paperclip className="w-4 h-4 text-orange-400" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Boleto</p></TooltipContent>
                  </Tooltip>
                )}
                {transacao.recibo_url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href={transacao.recibo_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted/50 transition-colors">
                        <Receipt className="w-4 h-4 text-purple-400" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent><p>Recibo</p></TooltipContent>
                  </Tooltip>
                )}
                {!transacao.comprovante_url && !transacao.nf_url && !transacao.boleto_url && !transacao.recibo_url && (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </TooltipProvider>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key="status" style={style}>
            {transacao.status ? (
              <Badge variant="outline" className={getStatusColor(transacao.status, transacao.tipo_movimento)}>
                {transacao.status}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        );
      default:
        return null;
    }
  };

  // ── Tabela de movimentações reutilizável (usada em "lista" e "caixa-cliente") ─
  const renderMovimentacoesTable = () => (
    <div className="space-y-6">
      {/* Filtros Avançados */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-foreground">Filtros</CardTitle>
            {activeTab === "lista" && !showInlineForm && (
              <Button
                onClick={() => setShowInlineForm(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Plus className="w-4 h-4" />
                Nova Movimentação
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <FinanceiroFilters
            filters={advancedFilters}
            onFiltersChange={(f) => { setAdvancedFilters(f); setCurrentPage(1); }}
            resultCount={filteredTransacoes.length}
            maxAmount={maxAmount}
          />
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Lista de Movimentações
              </CardTitle>
              <span className="text-xs text-foreground/50 px-2 py-1 rounded bg-muted/50 border border-border/30">
                Arraste colunas para reordenar
              </span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </Badge>
                <Button
                  onClick={() => setShowReport(!showReport)}
                  variant="outline"
                  className="bg-muted/50 border-border/60 text-foreground hover:bg-muted/80 gap-2"
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
                  className="bg-red-900/20 border-red-700/40 text-red-400 hover:bg-red-900/30 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {showReport && selectedIds.size > 0 && (
            <div className="bg-blue-950/30 border border-blue-700/40 rounded-md p-4 mb-4">
              <h3 className="text-white font-semibold mb-3">Relatório Agrupado</h3>
              <div className="space-y-2">
                {Object.entries(getGroupedReport()).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center bg-muted/30 p-2 rounded text-sm">
                    <span className="text-foreground/80">{key}</span>
                    <div className="flex gap-4 text-foreground">
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

          {/* ── TABELA COM SCROLL SINCRONIZADO ─────────────────────────────────────── */}
          <div className="relative">
            {/* Tabela */}
            <div
              ref={tableContainerRef}
              onScroll={handleBottomScroll}
              className={`overflow-x-auto ${isDragging ? "cursor-grabbing select-none" : "cursor-default"}`}
              onMouseDown={handleTableDragStart}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    {/* Checkbox */}
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedTransacoes.length > 0 && selectedIds.size === paginatedTransacoes.length}
                        onCheckedChange={() => toggleSelectAll()}
                        className="h-5 w-5"
                      />
                    </TableHead>

                    {/* Colunas dinâmicas (respeitando columnOrder) */}
                    {columnOrder.map((column, index) => {
                      if (!expandedColumns.has(column)) return null;
                      const config = columnConfig[column];
                      const colWidth = columnWidths[column] ?? defaultColumnWidths[column as keyof typeof defaultColumnWidths];
                      const isSorted = sortField === config.sortField;

                      return (
                        <TableHead
                          key={column}
                          className="text-foreground/70 group relative select-none p-0"
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
                              ${dragOverIndex === index ? "bg-primary/20 outline outline-1 outline-primary/40" : ""}
                              ${column === draggedColumn ? "opacity-40" : ""}
                            `}
                          >
                            {/* Grip + label + sort + hide */}
                            <div className="flex items-center gap-1 flex-1 truncate cursor-move min-w-0">
                              <GripHorizontal className="w-3 h-3 text-foreground/30 flex-shrink-0" />
                              <span className="text-xs uppercase tracking-wider text-foreground/60 font-medium truncate">
                                {config.label}
                              </span>
                              {isSorted && (
                                sortDirection === "asc"
                                  ? <ChevronUp className="w-3 h-3 text-primary flex-shrink-0" />
                                  : <ChevronDown className="w-3 h-3 text-primary flex-shrink-0" />
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleColumnVisibility(column); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                title="Ocultar coluna"
                              >
                                <EyeOff className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Resize handle */}
                            <div
                              onMouseDown={(e) => handleColumnResizeStart(e, column)}
                              onClick={(e) => e.stopPropagation()}
                              className={`
                                w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0
                                ${resizingColumn === column ? "bg-primary" : ""}
                              `}
                            />
                          </div>
                        </TableHead>
                      );
                    })}

                    {/* Colunas ocultas (collapsed) */}
                    {collapsedColumns.size > 0 && (
                      <TableHead className="text-foreground/70 group relative max-w-[120px]">
                        <div className="flex items-center gap-1 flex-wrap p-2">
                          {Array.from(collapsedColumns).map((colId) => (
                            <button
                              key={colId}
                              onClick={() => toggleColumnVisibility(colId)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded bg-muted/50 hover:bg-muted text-xs font-semibold text-foreground/70 hover:text-foreground transition-colors border border-border/50 hover:border-border"
                              title={`Expandir coluna - ${colId}`}
                            >
                              {getColumnLabel(colId)}
                            </button>
                          ))}
                        </div>
                      </TableHead>
                    )}

                    <TableHead className="text-right text-foreground/70">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedTransacoes.map((transacao: any, idx: number) => {
                    const isEntrada = transacao.tipo_movimento === "entrada";
                    const isSelected = selectedIds.has(transacao.id);
                    const isPendente = transacao.status === "pendente";
                    const lineNumber = startIndex + idx + 1;

                    return (
                      <TableRow
                        key={transacao.id}
                        className={`border-border/40 ${isSelected ? "bg-blue-900/20"
                            : isEntrada && isPendente ? "bg-orange-900/20"
                              : ""
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
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingMovimentacao(transacao); setShowInlineForm(true); }}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteConfirmId(transacao.id)} className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10">
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
                      <TableCell colSpan={calculateColSpan()} className="text-center text-foreground/40 py-8">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Scroll superior - sincronizado com a tabela - Posicionado após os títulos */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto overflow-y-hidden absolute top-0 left-0 right-0 pointer-events-auto"
              style={{ height: 12, marginTop: 49 }}
            >
              {/* Elemento fantasma com a largura real da tabela */}
              <div style={{ width: tableScrollWidth, height: 1 }} />
            </div>
          </div>

          {/* Paginação */}
          {transacoesForTab.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/40">
              <div className="text-sm text-foreground/60">
                Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, transacoesForTab.length)} de {transacoesForTab.length}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-foreground/70">Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(event) => setCurrentPage(Math.min(totalPages, Math.max(1, Number(event.target.value) || 1)))}
                  className="h-9 w-14 text-center bg-muted/30 border-border/60"
                />
                <span className="text-sm text-foreground/70">of {totalPages}</span>
                <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-9 w-[112px] bg-muted/30 border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 200].map((count) => <SelectItem key={count} value={String(count)}>{count} rows</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="bg-muted/30 border-border/60 hover:bg-muted/50"
                >
                  Anterior
                </Button>
                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  variant="outline"
                  className="bg-muted/30 border-border/60 hover:bg-muted/50"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        setActiveTab(value as "lista" | "visualizacao-mensal" | "caixa-cliente")
      }
      className="w-full"
    >
      <TabsList className="bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-xl rounded-lg p-1 border border-white/10 w-full justify-start h-auto gap-2">
        <TabsTrigger
          value="lista"
          className="rounded-md py-2 px-4 text-sm font-medium transition-all duration-300 whitespace-nowrap
            data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/10
            data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-md"
        >
          Lista de Movimentações
        </TabsTrigger>
        <TabsTrigger
          value="visualizacao-mensal"
          className="rounded-md py-2 px-4 text-sm font-medium transition-all duration-300 whitespace-nowrap
            data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/10
            data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-md"
        >
          Visualização Mensal
        </TabsTrigger>
        <TabsTrigger
          value="caixa-cliente"
          className="rounded-md py-2 px-4 text-sm font-medium transition-all duration-300 whitespace-nowrap
            data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-white/10
            data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-white data-[state=active]:shadow-md"
        >
          Caixa Cliente
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lista" className="mt-6 w-full">
        {showInlineForm && (
          <Card className="bg-card/50 border-border/50 backdrop-blur-xl mb-6">
            <CardContent className="pt-6">
              <FluxoCaixaInlineForm
                onSuccess={() => { setShowInlineForm(false); setEditingMovimentacao(null); window.location.reload(); }}
                onCancel={() => { setShowInlineForm(false); setEditingMovimentacao(null); }}
                movimentacao={editingMovimentacao}
              />
            </CardContent>
          </Card>
        )}
        {renderMovimentacoesTable()}
      </TabsContent>

      <TabsContent value="caixa-cliente" className="mt-6 w-full">
        {renderMovimentacoesTable()}
      </TabsContent>


      <TabsContent value="visualizacao-mensal" className="mt-6 w-full">
        <QuadroMensalTab />
      </TabsContent>

      {/* Dialog de confirmação de exclusão (compartilhado entre as abas) */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <span>Confirmar Exclusão</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-foreground/80 text-sm">
            Deseja realmente deletar esta movimentação? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-border/60 hover:bg-muted/50">
              Cancelar
            </Button>
            <Button onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}