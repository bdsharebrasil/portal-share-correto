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
    