import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Plane, FileText, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFlightCycles } from "@/hooks/useFlightCycles";
import { FlightCycleStats } from "./FlightCycleStats";
import { FlightCycleCard } from "./FlightCycleCard";
import { FlightCycleDetail } from "./FlightCycleDetail";
import { CreateFlightCycleDialog } from "./CreateFlightCycleDialog";
import { FlightCycle, FlightCycleStatus, FLIGHT_STATUS_CONFIG } from "@/types/flightCycle";
import { Skeleton } from "@/components/ui/skeleton";
export function FlightCycleDashboard() {
  const {
    cycles,
    loading,
    createCycle,
    updateCycle,
    updateCycleStatus,
    updateExpenseStatus,
    addManualExpense,
    deleteExpense,
    deleteCycle,
    getStatistics
  } = useFlightCycles();
  const [selectedCycle, setSelectedCycle] = useState<FlightCycle | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FlightCycleStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState('active');
  const stats = getStatistics();

  // Filter cycles
  const filteredCycles = cycles.filter(cycle => {
    if (activeTab === 'active') {
      return cycle.situacao !== 'finalizado';
    } else {
      return cycle.situacao === 'finalizado';
    }
  }).filter(cycle => {
    if (statusFilter === 'all') return true;
    return cycle.situacao === statusFilter;
  });
  if (selectedCycle) {
    // Find the updated cycle from the list
    const currentCycle = cycles.find(c => c.id === selectedCycle.id) || selectedCycle;
    return <FlightCycleDetail cycle={currentCycle} onBack={() => setSelectedCycle(null)} onUpdateExpenseStatus={updateExpenseStatus} onUpdateCycleStatus={updateCycleStatus} onAddExpense={addManualExpense} onDeleteExpense={deleteExpense} onUpdateCycle={updateCycle} onDeleteCycle={deleteCycle} />;
  }
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <div>
            
            <p className="text-sm text-muted-foreground">Acompanhe voos e despesas em tempo real</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ciclo
        </Button>
      </div>

      {/* Statistics */}
      <FlightCycleStats activeFlights={stats.activeFlights} overdueExpenses={stats.overdueExpenses} completedFlights={stats.completedFlights} pendingExpenses={stats.pendingExpenses} />

      {/* Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <Plane className="h-4 w-4" />
              Voos Ativos
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <FileText className="h-4 w-4" />
              Finalizados
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as FlightCycleStatus | 'all')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(FLIGHT_STATUS_CONFIG).map(([key, config]) => <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="active" className="mt-6">
          {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div> : filteredCycles.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCycles.map(cycle => <FlightCycleCard key={cycle.id} cycle={cycle} onClick={() => setSelectedCycle(cycle)} />)}
            </div> : <div className="text-center py-12 text-muted-foreground">
              <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum voo ativo encontrado</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                Criar primeiro ciclo
              </Button>
            </div>}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div> : filteredCycles.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCycles.map(cycle => <FlightCycleCard key={cycle.id} cycle={cycle} onClick={() => setSelectedCycle(cycle)} />)}
            </div> : <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum voo finalizado</p>
            </div>}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateFlightCycleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreate={createCycle} />
    </div>;
}