import { useMemo, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Plane,
  FileText,
  Filter,
  ChevronDown,
  Activity,
  Clock3,
  AlertTriangle,
  WalletCards,
  ArrowUpRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlightCycles } from "@/hooks/useFlightCycles";
import { FlightCycleStats } from "./FlightCycleStats";
import { FlightCycleCard } from "./FlightCycleCard";
import { FlightCycleDetail } from "./FlightCycleDetail";
import { CreateFlightCycleDialog } from "./CreateFlightCycleDialog";
import {
  FlightCycle,
  FlightCycleStatus,
  FLIGHT_STATUS_CONFIG,
} from "@/types/flightCycle";
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
    getStatistics,
  } = useFlightCycles();

  const [selectedCycle, setSelectedCycle] = useState<FlightCycle | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    FlightCycleStatus | "all"
  >("all");
  const [activeTab, setActiveTab] = useState("active");

  const stats = getStatistics();

  const filteredCycles = useMemo(() => {
    return cycles
      .filter((cycle) => {
        if (activeTab === "active") {
          return cycle.status !== "finalizado";
        }

        return cycle.status === "finalizado";
      })
      .filter((cycle) => {
        if (statusFilter === "all") return true;

        return cycle.status === statusFilter;
      });
  }, [cycles, activeTab, statusFilter]);

  const currentTabCount = filteredCycles.length;

  if (selectedCycle) {
    const currentCycle =
      cycles.find((c) => c.id === selectedCycle.id) || selectedCycle;

    return (
      <FlightCycleDetail
        cycle={currentCycle}
        onBack={() => setSelectedCycle(null)}
        onUpdateExpenseStatus={updateExpenseStatus}
        onUpdateCycleStatus={updateCycleStatus}
        onAddExpense={addManualExpense}
        onDeleteExpense={deleteExpense}
        onUpdateCycle={updateCycle}
        onDeleteCycle={deleteCycle}
      />
    );
  }

  return (
    <div className="min-h-full w-full overflow-hidden rounded-[31px] bg-background">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 overflow-hidden rounded-[30px] border-2 border-[rgba(45,52,67,0.22)] bg-[rgba(0,10,24,0.96)] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* =========================================================
            HERO / HEADER
        ========================================================== */}
        <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_70px_-30px_rgba(15,23,42,0.55)] sm:p-8">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner backdrop-blur-xl">
                <Plane className="h-7 w-7 text-white" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Ciclos de voo
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Acompanhe operações, despesas, pendências e ciclos de voo em
                  um único painel.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="h-12 rounded-xl bg-white px-5 font-semibold text-slate-900 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 xl:shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo ciclo
            </Button>
          </div>

          {/* Quick indicators */}
          <div className="relative z-10 mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4">
            <QuickMetric
              label="Ativos"
              value={stats.activeFlights}
              icon={Activity}
            />

            <QuickMetric
              label="Finalizados"
              value={stats.completedFlights}
              icon={FileText}
            />

            <QuickMetric
              label="Pendências"
              value={stats.pendingExpenses}
              icon={Clock3}
            />

            <QuickMetric
              label="Em atraso"
              value={stats.overdueExpenses}
              icon={AlertTriangle}
              danger={stats.overdueExpenses > 0}
            />
          </div>
        </section>

        {/* =========================================================
            MAIN KPIs
        ========================================================== */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Visão operacional
              </p>

              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Status da operação
              </h2>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-[rgba(172,236,187,1)] sm:flex">
              Atualização em tempo real
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-card p-3 shadow-sm sm:p-4">
            <FlightCycleStats
              activeFlights={stats.activeFlights}
              overdueExpenses={stats.overdueExpenses}
              completedFlights={stats.completedFlights}
              pendingExpenses={stats.pendingExpenses}
            />
          </div>
        </section>

        {/* =========================================================
            CONTENT
        ========================================================== */}
        <section className="rounded-[28px] border border-border/70 bg-[rgba(5,41,83,0)] p-4 shadow-sm backdrop-blur-xl sm:p-5 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-[rgba(2,34,73,0)]">
            {/* Top bar */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Operações
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight">
                        Seus ciclos
                      </h2>

                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {currentTabCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop controls */}
              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                <TabsList className="h-11 w-full rounded-xl border border-border bg-muted/60 p-1 sm:w-auto">
                  <TabsTrigger
                    value="active"
                    className="h-9 flex-1 rounded-lg px-4 text-xs font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:flex-none"
                  >
                    <Plane className="mr-2 h-3.5 w-3.5" />
                    Ativos
                  </TabsTrigger>

                  <TabsTrigger
                    value="completed"
                    className="h-9 flex-1 rounded-lg px-4 text-xs font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:flex-none"
                  >
                    <FileText className="mr-2 h-3.5 w-3.5" />
                    Finalizados
                  </TabsTrigger>
                </TabsList>

                <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(
                        value as FlightCycleStatus | "all"
                      )
                    }
                  >
                    <SelectTrigger className="h-9 min-w-[180px] border-0 bg-transparent p-0 text-xs font-medium shadow-none focus:ring-0">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        Todos os status
                      </SelectItem>

                      {Object.entries(FLIGHT_STATUS_CONFIG).map(
                        ([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* =====================================================
                ACTIVE
            ====================================================== */}
            <TabsContent
              value="active"
              className="mt-6 bg-[rgba(191,198,226,1)] focus-visible:outline-none"
            >
              <CycleGrid
                loading={loading}
                cycles={filteredCycles}
                emptyIcon={<Plane className="h-6 w-6" />}
                emptyTitle="Nenhum voo ativo"
                emptyDescription="Não existem ciclos ativos para os filtros selecionados."
                actionLabel="Criar primeiro ciclo"
                onCreate={() => setCreateDialogOpen(true)}
                onSelect={setSelectedCycle}
              />
            </TabsContent>

            {/* =====================================================
                COMPLETED
            ====================================================== */}
            <TabsContent
              value="completed"
              className="mt-6 bg-[rgba(8,11,25,1)] focus-visible:outline-none"
            >
              <CycleGrid
                loading={loading}
                cycles={filteredCycles}
                emptyIcon={<FileText className="h-6 w-6" />}
                emptyTitle="Nenhum voo finalizado"
                emptyDescription="Os ciclos concluídos aparecerão aqui."
                actionLabel=""
                onCreate={() => setCreateDialogOpen(true)}
                onSelect={setSelectedCycle}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* =========================================================
            CREATE DIALOG
        ========================================================== */}
        <CreateFlightCycleDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={createCycle}
        />
      </div>
    </div>
  );
}

/* ===============================================================
   QUICK METRIC
================================================================ */

interface QuickMetricProps {
  label: string;
  value: number;
  icon: React.ElementType;
  danger?: boolean;
}

function QuickMetric({
  label,
  value,
  icon: Icon,
  danger = false,
}: QuickMetricProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          danger
            ? "border-red-400/20 bg-red-400/10 text-red-300"
            : "border-white/10 bg-white/10 text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className={`mt-0.5 text-lg font-bold tracking-tight ${
            danger && value > 0 ? "text-red-300" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ===============================================================
   CYCLE GRID
================================================================ */

interface CycleGridProps {
  loading: boolean;
  cycles: FlightCycle[];
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  onCreate: () => void;
  onSelect: (cycle: FlightCycle) => void;
}

function CycleGrid({
  loading,
  cycles,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  actionLabel,
  onCreate,
  onSelect,
}: CycleGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-[22px] border border-border bg-background p-4"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />

                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>

              <Skeleton className="h-20 w-full rounded-xl" />

              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-border bg-muted/20 px-6 py-12">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
            <div className="text-muted-foreground">{emptyIcon}</div>
          </div>

          <h3 className="text-base font-semibold">{emptyTitle}</h3>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {emptyDescription}
          </p>

          {actionLabel && (
            <Button
              variant="outline"
              onClick={onCreate}
              className="mt-5 h-10 rounded-xl px-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 bg-[rgba(5,8,19,1)] text-[rgba(206,215,235,1)] md:grid-cols-2 2xl:grid-cols-3">
      {cycles.map((cycle) => (
        <div
          key={cycle.id}
          className="group relative min-w-0 transition-transform duration-200 hover:-translate-y-1"
        >
          {/* Glow */}
          <div className="pointer-events-none absolute inset-x-5 -bottom-2 h-10 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

          <div className="relative bg-[rgba(233,217,217,0)]">
            <FlightCycleCard
              cycle={cycle}
              onClick={() => onSelect(cycle)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
