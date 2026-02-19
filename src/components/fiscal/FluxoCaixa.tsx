import React, { useState, useMemo, useCallback } from "react";
import { useControleBancario } from "@/hooks/useControleBancario";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useExportTransactions } from "@/hooks/useExportTransactions";
import { FinanceiroFilters, FinanceiroFilterState } from "./FinanceiroFilters";
import { VirtualizedTransactionTable } from "./VirtualizedTransactionTable";
import { KPICard } from "@/components/ui/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuadroMensalTab } from "./QuadroMensalTab"; // Sua nova visão mensal
import { Loader2, ArrowUpCircle, ArrowDownCircle, DollarSign, Filter, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FluxoCaixa() {
  const { data: transacoes, isLoading, error } = useControleBancario();
  const { exportToCSV } = useExportTransactions();

  // 1. Estados de Filtro
  const [advancedFilters, setAdvancedFilters] = useState<FinanceiroFilterState>({
    search: "",
    status: "all",
    dateRange: undefined,
    amountRange: [0, 100000],
    source: "all",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showInlineForm, setShowInlineForm] = useState(false);

  // 2. Cálculo do maxAmount (Correção de Inicialização)
  const maxAmount = useMemo(() => {
    if (!transacoes || transacoes.length === 0) return 100000;
    return Math.max(...transacoes.map((t: any) => Number(t.valor)));
  }, [transacoes]);

  // Atualiza o range quando os dados carregam
  React.useEffect(() => {
    setAdvancedFilters(prev => ({ ...prev, amountRange: [0, maxAmount] }));
  }, [maxAmount]);

  // 3. Lógica de Filtragem (Mantendo suas regras)
  const filteredTransacoes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t: any) => {
      const matchesSearch = t.descricao?.toLowerCase().includes(advancedFilters.search.toLowerCase());
      const matchesStatus = advancedFilters.status === "all" || t.status === advancedFilters.status;
      const matchesValue = Number(t.valor) >= advancedFilters.amountRange[0] && Number(t.valor) <= advancedFilters.amountRange[1];

      return matchesSearch && matchesStatus && matchesValue;
    });
  }, [transacoes, advancedFilters]);

  // 4. KPIs Rápidos (Mês atual)
  const kpis = useMemo(() => {
    const entradas = filteredTransacoes.filter(t => t.tipo_movimento === "entrada").reduce((acc, t) => acc + Number(t.valor), 0);
    const saidas = filteredTransacoes.filter(t => t.tipo_movimento === "saida").reduce((acc, t) => acc + Number(t.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filteredTransacoes]);

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="lista" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="lista">Lista Geral</TabsTrigger>
            <TabsTrigger value="quadro">Visualização Mensal</TabsTrigger>
          </TabsList>

          <Button onClick={() => setShowInlineForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Movimentação
          </Button>
        </div>

        <TabsContent value="lista" className="space-y-6">
          {/* Dashboard de Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard label="Entradas" value={`R$ ${kpis.entradas.toLocaleString()}`} icon={<ArrowUpCircle className="text-emerald-400" />} />
            <KPICard label="Saídas" value={`R$ ${kpis.saidas.toLocaleString()}`} icon={<ArrowDownCircle className="text-red-400" />} />
            <KPICard label="Saldo" value={`R$ ${kpis.saldo.toLocaleString()}`} icon={<DollarSign className="text-primary" />} />
          </div>

          {/* Filtros Avançados */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardContent className="pt-6">
              <FinanceiroFilters
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
                resultCount={filteredTransacoes.length}
                maxAmount={maxAmount}
              />
            </CardContent>
          </Card>

          {/* Tabela Virtualizada com a lógica de "Entradas Primeiro" */}
          <VirtualizedTransactionTable
            transactions={filteredTransacoes}
            selectedIds={selectedIds}
            onSelectChange={(id) => {
              const newSet = new Set(selectedIds);
              newSet.has(id) ? newSet.delete(id) : newSet.add(id);
              setSelectedIds(newSet);
            }}
            onEdit={(t) => console.log("Editar", t)}
            onDelete={(id) => console.log("Deletar", id)}
          />
        </TabsContent>

        <TabsContent value="quadro">
          {/* Aqui entra o seu componente QuadroMensalTab */}
          <QuadroMensalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
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

      {/* Advanced Filtros Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardContent className="pt-6">
            <FinanceiroFilters
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              resultCount={sortedTransacoes.length}
              maxAmount={maxAmount}
            />
          </CardContent>
        </Card>

        {/* Legacy Desktop Filters */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl hidden lg:block">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar descrição ou documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-border/60 text-foreground focus:border-primary/60"
              />
            </div>

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

            {transacoes && transacoes.length > 0 && (
              <ValueRangeFilter
                min={0}
                max={maxAmount}
                step={100}
                onRangeChange={(min, max) => setFilterValueRange([min, max])}
              />
            )}
          </CardContent>
        </Card>

        {/* Mobile Filters */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Filter className="w-4 h-4" />
              Abrir Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full overflow-y-auto">
            <div className="space-y-4 mt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <FilterCombobox
                title="Tipo"
                options={tipos}
                selectedValues={filterTipos}
                onSelectionChange={(value) =>
                  setFilterTipos(toggleFilter(filterTipos, value))
                }
                onClear={() => setFilterTipos(new Set())}
              />
              {/* Repetir os outros combos conforme necessário... */}

              {transacoes && transacoes.length > 0 && (
                <ValueRangeFilter
                  min={0}
                  max={maxAmount}
                  step={100}
                  onRangeChange={(min, max) => setFilterValueRange([min, max])}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </motion.div>

      {/* Active Chips */}
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
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </Badge>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowReport(!showReport)} variant="outline" size="sm">
                    <BarChart3 className="w-4 h-4 mr-2" /> Agrupar
                  </Button>
                  <Button onClick={() => exportToCSV(selectedTransacoes)} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" /> Exportar
                  </Button>
                  <Button onClick={handleDeleteMultiple} variant="outline" size="sm" className="bg-red-900/20 text-red-400">
                    <Trash2 className="w-4 h-4 mr-2" /> Deletar
                  </Button>
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
                sortField={sortField}
                sortDirection={sortDirection}
                onSortChange={(field, direction) => {
                  setSortField(field);
                  setSortDirection(direction);
                }}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-400" />
              <span>Confirmar Exclusão</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-foreground/80 text-sm">
            Deseja realmente deletar esta movimentação? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Deletar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}