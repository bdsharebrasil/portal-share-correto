import React, { useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Trash2,
  BarChart3,
  Plus,
  Edit2,
  Download,
  X,
  Filter,
} from "lucide-react";
import { FilterCombobox } from "./FilterCombobox";
import { useControleBancario } from "@/hooks/useControleBancario";
import { useCategorias } from "@/hooks/useCategorias";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useDebounce } from "@/hooks/useDebounce";
import { useExportTransactions } from "@/hooks/useExportTransactions";
import { ActiveFiltersChips } from "./ActiveFiltersChips";
import { EmptyTransactionsState } from "./EmptyTransactionsState";
import { VirtualizedTransactionTable } from "./VirtualizedTransactionTable";
import { ValueRangeFilter } from "./ValueRangeFilter";
import { KPICard } from "@/components/ui/kpi-card";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FluxoCaixaInlineForm } from "./FluxoCaixaInlineForm";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";

export function FluxoCaixa() {
  const { user } = useAuth();
  const { data: transacoes, isLoading, error } = useControleBancario();
  const { data: categoriasData } = useCategorias();
  const { categorias: contasData } = useCategoriasFinanceiro();
  const { aeronaves } = useAeronaves();
  const { exportToCSV } = useExportTransactions();

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterTipos, setFilterTipos] = useState<Set<string>>(new Set());
  const [filterCategorias, setFilterCategorias] = useState<Set<string>>(
    new Set()
  );
  const [filterGrupos, setFilterGrupos] = useState<Set<string>>(new Set());
  const [filterBancos, setFilterBancos] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set());
  const [filterValueRange, setFilterValueRange] = useState<[number, number] | null>(null);

  // UI state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Fetch contas bancárias
  React.useEffect(() => {
    const fetchContasBancarias = async () => {
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, banco, nome")
        .eq("ativo", true)
        .order("banco");
      setContasBancarias(data || []);
    };
    fetchContasBancarias();
  }, []);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!transacoes) return { totalEntradas: 0, totalSaidas: 0, saldo: 0, totalTransacoes: 0 };
    
    const entradas = transacoes
      .filter(t => t.tipo_movimento === "entrada")
      .reduce((sum, t) => sum + Number(t.valor), 0);
    const saidas = transacoes
      .filter(t => t.tipo_movimento === "saida")
      .reduce((sum, t) => sum + Number(t.valor), 0);
    
    return {
      totalEntradas: entradas,
      totalSaidas: saidas,
      saldo: entradas - saidas,
      totalTransacoes: transacoes.length,
    };
  }, [transacoes]);

  // Group categories
  const gruposCategorias = useMemo(() => {
    if (!Array.isArray(contasData)) return [];
    const grupos = [...new Set(contasData.map((c: any) => c.grupo_categoria).filter(Boolean))];
    return grupos.sort();
  }, [contasData]);

  const categoriasDoGrupo = useMemo(() => {
    if (!Array.isArray(contasData)) return [];
    if (filterGrupos.size === 0) {
      return contasData.map((c: any) => c.nome);
    }
    return contasData
      .filter((c: any) => filterGrupos.has(c.grupo_categoria))
      .map((c: any) => c.nome);
  }, [contasData, filterGrupos]);

  const tipos: string[] = ["entrada", "saida"];
  const bancos: string[] = useMemo(() => {
    const bancosUnicos = [...new Set(contasBancarias.map((c: any) => c.banco).filter(Boolean))];
    return bancosUnicos.sort();
  }, [contasBancarias]);
  const statusOptions: string[] = ["recebido", "pago", "pendente", "aguardando_reembolso", "cancelado"];

  // Helper functions
  const toggleFilter = (set: Set<string>, value: string) => {
    const newSet = new Set(set);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    return newSet;
  };

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Filter and sort
  const filteredTransacoes = useMemo(() => {
    return (
      transacoes?.filter((transacao: any) => {
        const matchesSearch =
          transacao.descricao
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()) ||
          (transacao.numero_documento &&
            transacao.numero_documento
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase()));
        const matchesTipo =
          filterTipos.size === 0 || filterTipos.has(transacao.tipo_movimento);
        const matchesGrupo =
          filterGrupos.size === 0 ||
          (transacao.grupo_categoria && filterGrupos.has(transacao.grupo_categoria));
        const matchesCategoria =
          filterCategorias.size === 0 ||
          filterCategorias.has(transacao.categoria_nome);
        const matchesBanco =
          filterBancos.size === 0 ||
          (transacao.conta_banco && filterBancos.has(transacao.conta_banco));
        const matchesStatus =
          filterStatus.size === 0 ||
          (transacao.status && filterStatus.has(transacao.status));
        const matchesValueRange =
          !filterValueRange ||
          (Number(transacao.valor) >= filterValueRange[0] &&
            Number(transacao.valor) <= filterValueRange[1]);

        return (
          matchesSearch &&
          matchesTipo &&
          matchesGrupo &&
          matchesCategoria &&
          matchesBanco &&
          matchesStatus &&
          matchesValueRange
        );
      }) || []
    );
  }, [transacoes, debouncedSearchTerm, filterTipos, filterGrupos, filterCategorias, filterBancos, filterStatus, filterValueRange]);

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

  // Build active filters list
  const activeFiltersList = useMemo(() => {
    const filters = [];
    
    Array.from(filterTipos).forEach((tipo) => {
      filters.push({
        id: `tipo-${tipo}`,
        label: "Tipo",
        value: tipo,
        category: "tipo",
      });
    });
    
    Array.from(filterGrupos).forEach((grupo) => {
      filters.push({
        id: `grupo-${grupo}`,
        label: "Grupo",
        value: grupo,
        category: "grupo",
      });
    });
    
    Array.from(filterCategorias).forEach((categoria) => {
      filters.push({
        id: `categoria-${categoria}`,
        label: "Categoria",
        value: categoria,
        category: "categoria",
      });
    });
    
    Array.from(filterBancos).forEach((banco) => {
      filters.push({
        id: `banco-${banco}`,
        label: "Banco",
        value: banco,
        category: "banco",
      });
    });
    
    Array.from(filterStatus).forEach((status) => {
      filters.push({
        id: `status-${status}`,
        label: "Status",
        value: status,
        category: "status",
      });
    });

    return filters;
  }, [filterTipos, filterGrupos, filterCategorias, filterBancos, filterStatus]);

  const handleRemoveFilter = (filterId: string) => {
    const [category, value] = filterId.split("-");
    const actualCategory = category + (filterId.includes("-") ? `-${value.split("-").slice(0, -1).join("-")}` : "");
    
    switch (category) {
      case "tipo":
        setFilterTipos(toggleFilter(filterTipos, value));
        break;
      case "grupo":
        setFilterGrupos(toggleFilter(filterGrupos, value));
        break;
      case "categoria":
        setFilterCategorias(toggleFilter(filterCategorias, value));
        break;
      case "banco":
        setFilterBancos(toggleFilter(filterBancos, value));
        break;
      case "status":
        setFilterStatus(toggleFilter(filterStatus, value));
        break;
    }
  };

  const handleClearAllFilters = () => {
    setFilterTipos(new Set());
    setFilterGrupos(new Set());
    setFilterCategorias(new Set());
    setFilterBancos(new Set());
    setFilterStatus(new Set());
    setFilterValueRange(null);
    setSearchTerm("");
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
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from("controle_bancario")
        .delete()
        .in("id", idsArray);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success(
        `${selectedIds.size} movimentação(ões) deletada(s) com sucesso!`
      );
      setSelectedIds(new Set());
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar movimentações");
    }
  };

  const selectedTransacoes = sortedTransacoes.filter((t: any) =>
    selectedIds.has(t.id)
  );

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-96"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-foreground/60">Carregando transações...</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-red-400 p-8"
      >
        Erro ao carregar transações. Verifique suas permissões.
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <KPICard
          label="Entradas"
          value={`R$ ${kpis.totalEntradas.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          icon={<ArrowUpCircle className="w-6 h-6 text-emerald-400" />}
          gradient={{ from: "from-emerald-500/20", to: "to-green-500/10" }}
        />
        <KPICard
          label="Saídas"
          value={`R$ ${kpis.totalSaidas.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          icon={<ArrowDownCircle className="w-6 h-6 text-red-400" />}
          gradient={{ from: "from-red-500/20", to: "to-pink-500/10" }}
        />
        <KPICard
          label="Saldo"
          value={`R$ ${kpis.saldo.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          icon={<DollarSign className="w-6 h-6 text-primary" />}
          gradient={{ from: "from-primary/20", to: "to-cyan-500/10" }}
          trend={kpis.saldo > 0 ? 12 : -5}
          trendLabel={kpis.saldo > 0 ? "vs. mês anterior" : "vs. mês anterior"}
        />
        <KPICard
          label="Transações"
          value={kpis.totalTransacoes}
          icon={<Filter className="w-6 h-6 text-blue-400" />}
          gradient={{ from: "from-blue-500/20", to: "to-indigo-500/10" }}
        />
      </motion.div>

      {/* Nova Movimentação Form */}
      <AnimatePresence>
        {showInlineForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Desktop Filters */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl hidden md:block">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </CardTitle>
              {!showInlineForm && (
                <Button
                  onClick={() => setShowInlineForm(true)}
                  className="bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nova Movimentação
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar descrição ou documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-border/60 text-foreground focus:border-primary/60"
              />
            </div>

            {/* Filter Combos */}
            <div className="grid grid-cols-5 gap-3">
              <FilterCombobox
                title="Tipo"
                options={tipos}
                selectedValues={filterTipos}
                onSelectionChange={(value) =>
                  setFilterTipos(toggleFilter(filterTipos, value))
                }
                onClear={() => setFilterTipos(new Set())}
              />
              <FilterCombobox
                title="Grupo"
                options={gruposCategorias}
                selectedValues={filterGrupos}
                onSelectionChange={(value) =>
                  setFilterGrupos(toggleFilter(filterGrupos, value))
                }
                onClear={() => setFilterGrupos(new Set())}
              />
              <FilterCombobox
                title="Categoria"
                options={categoriasDoGrupo}
                selectedValues={filterCategorias}
                onSelectionChange={(value) =>
                  setFilterCategorias(toggleFilter(filterCategorias, value))
                }
                onClear={() => setFilterCategorias(new Set())}
              />
              <FilterCombobox
                title="Banco"
                options={bancos}
                selectedValues={filterBancos}
                onSelectionChange={(value) =>
                  setFilterBancos(toggleFilter(filterBancos, value))
                }
                onClear={() => setFilterBancos(new Set())}
              />
              <FilterCombobox
                title="Status"
                options={statusOptions}
                selectedValues={filterStatus}
                onSelectionChange={(value) =>
                  setFilterStatus(toggleFilter(filterStatus, value))
                }
                onClear={() => setFilterStatus(new Set())}
              />
            </div>

            {/* Value Range Filter */}
            {transacoes && transacoes.length > 0 && (
              <ValueRangeFilter
                min={0}
                max={Math.max(...transacoes.map((t: any) => Number(t.valor)))}
                step={100}
                onRangeChange={(min, max) => setFilterValueRange([min, max])}
              />
            )}
          </CardContent>
        </Card>

        {/* Mobile Filters Sheet */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Filter className="w-4 h-4" />
              Abrir Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full overflow-y-auto">
            <div className="space-y-4 mt-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Combos */}
              <FilterCombobox
                title="Tipo"
                options={tipos}
                selectedValues={filterTipos}
                onSelectionChange={(value) =>
                  setFilterTipos(toggleFilter(filterTipos, value))
                }
                onClear={() => setFilterTipos(new Set())}
              />
              <FilterCombobox
                title="Grupo"
                options={gruposCategorias}
                selectedValues={filterGrupos}
                onSelectionChange={(value) =>
                  setFilterGrupos(toggleFilter(filterGrupos, value))
                }
                onClear={() => setFilterGrupos(new Set())}
              />
              <FilterCombobox
                title="Categoria"
                options={categoriasDoGrupo}
                selectedValues={filterCategorias}
                onSelectionChange={(value) =>
                  setFilterCategorias(toggleFilter(filterCategorias, value))
                }
                onClear={() => setFilterCategorias(new Set())}
              />
              <FilterCombobox
                title="Banco"
                options={bancos}
                selectedValues={filterBancos}
                onSelectionChange={(value) =>
                  setFilterBancos(toggleFilter(filterBancos, value))
                }
                onClear={() => setFilterBancos(new Set())}
              />
              <FilterCombobox
                title="Status"
                options={statusOptions}
                selectedValues={filterStatus}
                onSelectionChange={(value) =>
                  setFilterStatus(toggleFilter(filterStatus, value))
                }
                onClear={() => setFilterStatus(new Set())}
              />

              {/* Value Range */}
              {transacoes && transacoes.length > 0 && (
                <ValueRangeFilter
                  min={0}
                  max={Math.max(...transacoes.map((t: any) => Number(t.valor)))}
                  step={100}
                  onRangeChange={(min, max) => setFilterValueRange([min, max])}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </motion.div>

      {/* Active Filters Chips */}
      <AnimatePresence>
        {activeFiltersList.length > 0 && (
          <ActiveFiltersChips
            filters={activeFiltersList}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
            totalResults={sortedTransacoes.length}
          />
        )}
      </AnimatePresence>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/10 border-blue-700/40 backdrop-blur-xl">
              <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-blue-600 text-white">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowReport(!showReport)}
                    variant="outline"
                    size="sm"
                    className="bg-muted/50 border-border/60 text-foreground hover:bg-muted/80 gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Agrupar
                  </Button>
                  <Button
                    onClick={() => exportToCSV(selectedTransacoes)}
                    variant="outline"
                    size="sm"
                    className="bg-muted/50 border-border/60 text-foreground hover:bg-muted/80 gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                  <Button
                    onClick={() => {
                      if (
                        confirm(
                          `Tem certeza que deseja excluir ${selectedIds.size} movimentação(ões)?`
                        )
                      ) {
                        handleDeleteMultiple();
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-red-900/20 border-red-700/40 text-red-400 hover:bg-red-900/30 gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report */}
      <AnimatePresence>
        {showReport && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-blue-950/30 border-blue-700/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-blue-400">Relatório Agrupado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    selectedTransacoes.reduce(
                      (
                        grouped: any,
                        t: any
                      ) => {
                        const key = `${t.categoria_nome} (${t.tipo_movimento})`;
                        if (!grouped[key]) {
                          grouped[key] = { total: 0, count: 0 };
                        }
                        grouped[key].total += Number(t.valor);
                        grouped[key].count += 1;
                        return grouped;
                      },
                      {}
                    )
                  ).map(([key, value]: any) => (
                    <div
                      key={key}
                      className="flex justify-between items-center bg-muted/30 p-3 rounded text-sm"
                    >
                      <span className="text-foreground/80">{key}</span>
                      <div className="flex gap-4 text-foreground">
                        <span>
                          {value.count} item{value.count !== 1 ? "ns" : ""}
                        </span>
                        <span className="font-semibold">
                          R${" "}
                          {value.total.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transações Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedTransacoes.length === 0 ? (
              <EmptyTransactionsState
                onCreateNew={() => setShowInlineForm(true)}
                hasFiltersActive={activeFiltersList.length > 0}
              />
            ) : (
              <VirtualizedTransactionTable
                transactions={sortedTransacoes}
                selectedIds={selectedIds}
                onSelectChange={toggleSelectId}
                onEdit={(transaction) => {
                  setEditingMovimentacao(transaction);
                  setShowInlineForm(true);
                }}
                onDelete={(id) => setDeleteConfirmId(id)}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

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
            Deseja realmente deletar esta movimentação? Esta ação não pode ser
            desfeita.
          </p>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="border-border/60 hover:bg-muted/50"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
