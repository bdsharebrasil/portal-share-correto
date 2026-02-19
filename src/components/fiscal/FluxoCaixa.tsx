import React, { useState, useMemo, useRef } from "react";
import { useControleBancario } from "@/hooks/useControleBancario";
import { useExportTransactions } from "@/hooks/useExportTransactions";
import { FinanceiroFilters, FinanceiroFilterState } from "./FinanceiroFilters";
import { VirtualizedTransactionTable } from "./VirtualizedTransactionTable";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuadroMensalTab } from "./QuadroMensalTab";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FluxoCaixa() {
  const { data: transacoes, isLoading } = useControleBancario();
  const { exportToCSV } = useExportTransactions();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const [advancedFilters, setAdvancedFilters] = useState<FinanceiroFilterState>({
    search: "",
    status: "all",
    dateRange: undefined,
    amountRange: [0, 100000],
    source: "all",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showInlineForm, setShowInlineForm] = useState(false);

  const maxAmount = useMemo(() => {
    if (!transacoes || transacoes.length === 0) return 100000;
    return Math.max(...transacoes.map((t: any) => Number(t.valor)));
  }, [transacoes]);

  React.useEffect(() => {
    setAdvancedFilters((prev) => ({ ...prev, amountRange: [0, maxAmount] }));
  }, [maxAmount]);

  const filteredTransacoes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t: any) => {
      const matchesSearch = t.descricao
        ?.toLowerCase()
        .includes(advancedFilters.search.toLowerCase());
      const matchesStatus =
        advancedFilters.status === "all" || t.status === advancedFilters.status;
      const matchesValue =
        Number(t.valor) >= advancedFilters.amountRange[0] &&
        Number(t.valor) <= advancedFilters.amountRange[1];
      return matchesSearch && matchesStatus && matchesValue;
    });
  }, [transacoes, advancedFilters]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX + (scrollContainerRef.current?.scrollLeft || 0));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    scrollContainerRef.current.scrollLeft = dragStart - e.clientX;
  };

  const handleMouseUp = () => setIsDragging(false);

  if (isLoading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="lista" className="w-full">
        {/* Sticky header com drag scroll */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="sticky top-0 z-20 flex items-center justify-between mb-4 pb-4 bg-gradient-to-b from-black/80 to-black/0 backdrop-blur-sm cursor-grab active:cursor-grabbing select-none"
        >
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="lista">Lista Geral</TabsTrigger>
            <TabsTrigger value="quadro">Visualização Mensal</TabsTrigger>
          </TabsList>

          <Button onClick={() => setShowInlineForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Movimentação
          </Button>
        </div>

        {/* Aba: Lista Geral */}
        <TabsContent value="lista" className="space-y-6">
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

          {/* Tabela Virtualizada */}
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

        {/* Aba: Visualização Mensal */}
        <TabsContent value="quadro">
          <QuadroMensalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
