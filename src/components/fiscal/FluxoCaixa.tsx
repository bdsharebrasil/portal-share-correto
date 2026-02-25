import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useControleBancario } from "@/hooks/useControleBancario";
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

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";

export function FluxoCaixa() {
  const { user } = useAuth();
  const { data: transacoes, isLoading, error } = useControleBancario();
  const { categorias: contasData } = useCategoriasFinanceiro();

  const defaultColumnWidths = {
    data: 100,
    tipo: 100,
    descricao: 180,
    categoria: 130,
    cliente: 130,
    valor: 110,
    conta: 120,
    aeronave: 110,
    nDoc: 100,
    anexos: 80,
    status: 100,
  };

  const { columnWidths, setColumnWidth } = useColumnWidths('fluxo-caixa', defaultColumnWidths);

  // ── Advanced filters (replaces old individual filter states) ──────────────
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
  });

  // Keep amountRange ceiling in sync when data loads
  React.useEffect(() => {
    setAdvancedFilters((prev) => ({
      ...prev,
      amountRange: [prev.amountRange[0], maxAmount],
    }));
  }, [maxAmount]);
  // ─────────────────────────────────────────────────────────────────────────

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
    new Set([
      "data", "tipo", "descricao", "categoria", "cliente", "valor",
      "conta", "aeronave", "nDoc", "anexos", "status",
    ])
  );
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleColumnVisibility = (columnId: string) => {
    if (expandedColumns.has(columnId)) {
      const newExpanded = new Set(expandedColumns);
      newExpanded.delete(columnId);
      setExpandedColumns(newExpanded);
      setCollapsedColumns(new Set([...collapsedColumns, columnId]));
    } else if (collapsedColumns.has(columnId)) {
      const newCollapsed = new Set(collapsedColumns);
      newCollapsed.delete(columnId);
      setCollapsedColumns(newCollapsed);
      setExpandedColumns(new Set([...expandedColumns, columnId]));
    }
  };

  const calculateColSpan = () => expandedColumns.size + collapsedColumns.size + 2;

  const getColumnLabel = (columnId: string): string => {
    const labels: Record<string, string> = {
      data: "D", tipo: "T", descricao: "Desc", categoria: "Cat",
      cliente: "Cl", valor: "V", conta: "C", aeronave: "A",
      nDoc: "Doc", anexos: "Anx", status: "St",
    };
    return labels[columnId] || columnId.charAt(0).toUpperCase();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransacoes.length && paginatedTransacoes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransacoes.map((t: any) => t.id)));
    }
  };

  const handleColumnResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
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
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTableDragStart = (e: React.MouseEvent) => {
    // Apenas iniciar drag se não está clicando em um elemento interativo
    const target = e.target as HTMLElement;
    // Ignorar cliques em botões, checkboxes, inputs, links e selects
    if (target.closest('button, input, [role="button"], a, select')) {
      return;
    }

    const container = tableContainerRef.current;
    // Se o container tiver scrollbar horizontal
    if (container && container.scrollWidth > container.clientWidth) {
      setIsDragging(true);
      dragStartXRef.current = e.clientX;
      scrollStartXRef.current = container.scrollLeft;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!container) return;
        const delta = moveEvent.clientX - dragStartXRef.current;
        container.scrollLeft = scrollStartXRef.current - delta;
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredTransacoes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t: any) => {
      // search
      const matchesSearch =
        !advancedFilters.search ||
        t.descricao?.toLowerCase().includes(advancedFilters.search.toLowerCase()) ||
        t.numero_documento?.toLowerCase().includes(advancedFilters.search.toLowerCase());

      // status
      const matchesStatus =
        advancedFilters.status === "all" || t.status === advancedFilters.status;

      // amount range
      const val = Number(t.valor);
      const matchesValue =
        val >= advancedFilters.amountRange[0] && val <= advancedFilters.amountRange[1];

      // date range
      let matchesDate = true;
      if (advancedFilters.dateRange?.from) {
        const dateStr = t.data;
        let txDate: Date;
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, d] = dateStr.split('-').map(Number);
          txDate = new Date(y, m - 1, d);
        } else {
          txDate = new Date(t.data);
        }
        const from = advancedFilters.dateRange.from;
        const to = advancedFilters.dateRange.to ?? from;
        matchesDate = txDate >= from && txDate <= to;
      }

      // source filter (entrada vs saída)
      const matchesSource =
        advancedFilters.source === "all" || t.tipo_movimento === advancedFilters.source;

      return matchesSearch && matchesStatus && matchesValue && matchesDate && matchesSource;
    });
  }, [transacoes, advancedFilters]);
  // ─────────────────────────────────────────────────────────────────────────

  const sortedTransacoes = useMemo(() => {
    const sorted = [...filteredTransacoes].sort((a: any, b: any) => {
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
    return sorted;
  }, [filteredTransacoes, sortField, sortDirection]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(sortedTransacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransacoes = sortedTransacoes.slice(startIndex, startIndex + itemsPerPage);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc"
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const selectedTransacoes = sortedTransacoes.filter((t: any) => selectedIds.has(t.id));

  const getGroupedReport = () => {
    const grouped: { [key: string]: { total: number; count: number } } = {};
    selectedTransacoes.forEach((t: any) => {
      const key = `${t.categoria} (${t.tipo_movimento})`;
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += Number(t.valor);
      grouped[key].count += 1;
    });
    return grouped;
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("controle_bancario").delete().eq("id", id);
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
      const { error } = await supabase.from("controle_bancario").delete().in("id", Array.from(selectedIds));
      if (error) { toast.error(`Erro ao deletar: ${error.message}`); return; }
      toast.success(`${selectedIds.size} movimentação(ões) deletada(s) com sucesso!`);
      setSelectedIds(new Set());
      setCurrentPage(1);
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar movimentações");
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Nova Movimentação Form */}
      {showInlineForm && (
        <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
          <CardContent className="pt-6">
            <FluxoCaixaInlineForm
              onSuccess={() => {
                setShowInlineForm(false);
                setEditingMovimentacao(null);
                window.location.reload();
              }}
              onCancel={() => {
                setShowInlineForm(false);
                setEditingMovimentacao(null);
              }}
              movimentacao={editingMovimentacao}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Filtros Avançados ───────────────────────────────────────────────── */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-foreground">
              Filtros
            </CardTitle>
            {!showInlineForm && (
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
            onFiltersChange={(f) => {
              setAdvancedFilters(f);
              setCurrentPage(1); // reset page on filter change
            }}
            resultCount={filteredTransacoes.length}
            maxAmount={maxAmount}
          />
        </CardContent>
      </Card>

      {/* ── Transações Table ────────────────────────────────────────────────── */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Lista de Movimentações
              </CardTitle>
              <span className="text-xs text-foreground/50 px-2 py-1 rounded bg-muted/50 border border-border/30">
                Arraste para scroll horizontal →
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
        <CardContent className="space-y-4">
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

          <div
            ref={tableContainerRef}
            className={`overflow-x-auto cursor-grab ${isDragging ? "cursor-grabbing select-none" : ""}`}
            onMouseDown={handleTableDragStart}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedTransacoes.length > 0 && selectedIds.size === paginatedTransacoes.length}
                      onCheckedChange={() => toggleSelectAll()}
                      className="h-5 w-5"
                    />
                  </TableHead>
                  {expandedColumns.has("data") && (
                    <TableHead
                      className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors group relative select-none"
                      onClick={() => handleSort("data")}
                      style={{ width: `${columnWidths.data}px`, minWidth: `${columnWidths.data}px`, maxWidth: `${columnWidths.data}px` }}
                    >
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Data {renderSortIcon("data")}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggleColumnVisibility("data"); }} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "data")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "data" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("tipo") && (
                    <TableHead
                      className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors group relative select-none"
                      onClick={() => handleSort("tipo_movimento")}
                      style={{ width: `${columnWidths.tipo}px`, minWidth: `${columnWidths.tipo}px`, maxWidth: `${columnWidths.tipo}px` }}
                    >
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Tipo {renderSortIcon("tipo_movimento")}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggleColumnVisibility("tipo"); }} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "tipo")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "tipo" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("descricao") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.descricao}px`, minWidth: `${columnWidths.descricao}px`, maxWidth: `${columnWidths.descricao}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Descrição</span>
                          <button onClick={() => toggleColumnVisibility("descricao")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "descricao")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "descricao" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("categoria") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.categoria}px`, minWidth: `${columnWidths.categoria}px`, maxWidth: `${columnWidths.categoria}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Categoria</span>
                          <button onClick={() => toggleColumnVisibility("categoria")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "categoria")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "categoria" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("cliente") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.cliente}px`, minWidth: `${columnWidths.cliente}px`, maxWidth: `${columnWidths.cliente}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Cliente</span>
                          <button onClick={() => toggleColumnVisibility("cliente")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "cliente")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "cliente" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("valor") && (
                    <TableHead
                      className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors group relative select-none"
                      onClick={() => handleSort("valor")}
                      style={{ width: `${columnWidths.valor}px`, minWidth: `${columnWidths.valor}px`, maxWidth: `${columnWidths.valor}px` }}
                    >
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Valor {renderSortIcon("valor")}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggleColumnVisibility("valor"); }} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "valor")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "valor" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("conta") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.conta}px`, minWidth: `${columnWidths.conta}px`, maxWidth: `${columnWidths.conta}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Conta</span>
                          <button onClick={() => toggleColumnVisibility("conta")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "conta")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "conta" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("aeronave") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.aeronave}px`, minWidth: `${columnWidths.aeronave}px`, maxWidth: `${columnWidths.aeronave}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Aeronave</span>
                          <button onClick={() => toggleColumnVisibility("aeronave")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "aeronave")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "aeronave" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("nDoc") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.nDoc}px`, minWidth: `${columnWidths.nDoc}px`, maxWidth: `${columnWidths.nDoc}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Nº Doc</span>
                          <button onClick={() => toggleColumnVisibility("nDoc")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "nDoc")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "nDoc" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("anexos") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.anexos}px`, minWidth: `${columnWidths.anexos}px`, maxWidth: `${columnWidths.anexos}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Anexos</span>
                          <button onClick={() => toggleColumnVisibility("anexos")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "anexos")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "anexos" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {expandedColumns.has("status") && (
                    <TableHead className="text-foreground/70 group relative select-none" style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`, maxWidth: `${columnWidths.status}px` }}>
                      <div className="flex items-center justify-between h-full pr-0">
                        <div className="flex items-center gap-1 flex-1 truncate">
                          <span>Status</span>
                          <button onClick={() => toggleColumnVisibility("status")} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" title="Ocultar coluna">
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                        <div onMouseDown={(e) => handleColumnResizeStart(e, "status")} className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${resizingColumn === "status" ? "bg-primary" : ""}`} />
                      </div>
                    </TableHead>
                  )}
                  {collapsedColumns.size > 0 && (
                    <TableHead className="text-foreground/70 group relative max-w-[120px]">
                      <div className="flex items-center gap-1 flex-wrap">
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
                      {expandedColumns.has("data") && (
                        <TableCell className="text-foreground/80 whitespace-nowrap" style={{ width: `${columnWidths.data}px`, minWidth: `${columnWidths.data}px`, maxWidth: `${columnWidths.data}px` }}>
                          <div className="flex items-center gap-1">
                            <span className="text-foreground/50 text-xs font-semibold">#{lineNumber}</span>
                            <span>
                              {(() => {
                                const dateStr = transacao.data;
                                if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                  const [y, m, d] = dateStr.split('-').map(Number);
                                  return format(new Date(y, m - 1, d), "dd/MM/yyyy", { locale: ptBR });
                                }
                                return format(new Date(transacao.data), "dd/MM/yyyy", { locale: ptBR });
                              })()}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {expandedColumns.has("tipo") && (
                        <TableCell style={{ width: `${columnWidths.tipo}px`, minWidth: `${columnWidths.tipo}px`, maxWidth: `${columnWidths.tipo}px` }}>
                          <div className="flex items-center gap-2">
                            {isEntrada
                              ? <ArrowUpCircle className={`w-4 h-4 ${isPendente ? "text-orange-400" : "text-green-400"}`} />
                              : <ArrowDownCircle className="w-4 h-4 text-red-400" />}
                            <span className={isEntrada ? (isPendente ? "text-orange-400" : "text-green-400") : "text-red-400"}>
                              {isEntrada ? "Entrada" : "Saída"}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {expandedColumns.has("descricao") && (
                        <TableCell className="text-white font-medium truncate" style={{ width: `${columnWidths.descricao}px`, minWidth: `${columnWidths.descricao}px`, maxWidth: `${columnWidths.descricao}px` }}>
                          {transacao.descricao}
                        </TableCell>
                      )}
                      {expandedColumns.has("categoria") && (
                        <TableCell className="text-foreground/80" style={{ width: `${columnWidths.categoria}px`, minWidth: `${columnWidths.categoria}px`, maxWidth: `${columnWidths.categoria}px` }}>
                          {transacao.categoria_nome || "-"}
                        </TableCell>
                      )}
                      {expandedColumns.has("cliente") && (
                        <TableCell className="text-foreground/80 truncate" title={transacao.cliente_nome || ""} style={{ width: `${columnWidths.cliente}px`, minWidth: `${columnWidths.cliente}px`, maxWidth: `${columnWidths.cliente}px` }}>
                          {transacao.cliente_nome || "-"}
                        </TableCell>
                      )}
                      {expandedColumns.has("valor") && (
                        <TableCell
                          className={`font-semibold ${isEntrada ? (isPendente ? "text-orange-400" : "text-green-400") : "text-red-400"}`}
                          style={{ width: `${columnWidths.valor}px`, minWidth: `${columnWidths.valor}px`, maxWidth: `${columnWidths.valor}px` }}
                        >
                          R$ {Number(transacao.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      )}
                      {expandedColumns.has("conta") && (
                        <TableCell className="text-foreground/80" style={{ width: `${columnWidths.conta}px`, minWidth: `${columnWidths.conta}px`, maxWidth: `${columnWidths.conta}px` }}>
                          {transacao.conta_banco || "-"}
                        </TableCell>
                      )}
                      {expandedColumns.has("aeronave") && (
                        <TableCell className="text-foreground/80" style={{ width: `${columnWidths.aeronave}px`, minWidth: `${columnWidths.aeronave}px`, maxWidth: `${columnWidths.aeronave}px` }}>
                          {transacao.aeronave_registro || "-"}
                        </TableCell>
                      )}
                      {expandedColumns.has("nDoc") && (
                        <TableCell className="text-foreground/80" style={{ width: `${columnWidths.nDoc}px`, minWidth: `${columnWidths.nDoc}px`, maxWidth: `${columnWidths.nDoc}px` }}>
                          {transacao.numero_documento || "-"}
                        </TableCell>
                      )}
                      {expandedColumns.has("anexos") && (
                        <TableCell style={{ width: `${columnWidths.anexos}px`, minWidth: `${columnWidths.anexos}px`, maxWidth: `${columnWidths.anexos}px` }}>
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
                              {!transacao.comprovante_url && !transacao.nf_url && !transacao.boleto_url && (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      )}
                      {expandedColumns.has("status") && (
                        <TableCell style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`, maxWidth: `${columnWidths.status}px` }}>
                          {transacao.status ? (
                            <Badge variant="outline" className={getStatusColor(transacao.status, transacao.tipo_movimento)}>
                              {transacao.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
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
                {sortedTransacoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={calculateColSpan()} className="text-center text-foreground/40 py-8">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {sortedTransacoes.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/40">
              <div className="text-sm text-foreground/60">
                Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedTransacoes.length)} de {sortedTransacoes.length}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline" className="bg-muted/30 border-border/60 hover:bg-muted/50">
                  Anterior
                </Button>
                <div className="flex items-center gap-2 px-4 py-2 text-foreground/80">
                  Página {currentPage} de {totalPages}
                </div>
                <Button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} variant="outline" className="bg-muted/30 border-border/60 hover:bg-muted/50">
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}
