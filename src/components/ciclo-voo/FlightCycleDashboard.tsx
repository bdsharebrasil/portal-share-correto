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
  Search,
  X,
  Activity,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

/* ===============================================================
   HELPERS
================================================================ */

function getClientName(cycle: FlightCycle) {
  return (
    cycle.partner_name ||
    cycle.client?.company_name ||
    cycle.client?.proprietario ||
    "Cliente não definido"
  );
}

function getAircraftLabel(cycle: FlightCycle) {
  return cycle.aircraft?.matricula || "N/A";
}

/** Alguns projetos ainda não têm um campo dedicado de número de voo.
 *  Usamos ele se existir, e caímos para os últimos dígitos do ID como
 *  identificador estável. */
function getFlightNumber(cycle: FlightCycle) {
  const explicit = (cycle as any).flight_number as string | undefined;
  if (explicit) return explicit;
  return cycle.id ? cycle.id.slice(0, 8).toUpperCase() : "—";
}

const ALL_VALUE = "__all__";

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
  const [aircraftFilter, setAircraftFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const stats = getStatistics();

  /* -----------------------------------------------------------
     Opções de filtro derivadas dos ciclos existentes
  ------------------------------------------------------------ */
  const aircraftOptions = useMemo(() => {
    const set = new Map<string, string>();
    cycles.forEach((cycle) => {
      const label = getAircraftLabel(cycle);
      if (label && label !== "N/A") set.set(label, label);
    });
    return Array.from(set.values()).sort();
  }, [cycles]);

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    cycles.forEach((cycle) => set.add(getClientName(cycle)));
    return Array.from(set.values()).sort();
  }, [cycles]);

  /* -----------------------------------------------------------
     Filtragem
  ------------------------------------------------------------ */
  const filteredCycles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return cycles
      .filter((cycle) =>
        activeTab === "active"
          ? cycle.status !== "finalizado"
          : cycle.status === "finalizado"
      )
      .filter((cycle) =>
        statusFilter === "all" ? true : cycle.status === statusFilter
      )
      .filter((cycle) =>
        aircraftFilter === "all"
          ? true
          : getAircraftLabel(cycle) === aircraftFilter
      )
      .filter((cycle) =>
        clientFilter === "all" ? true : getClientName(cycle) === clientFilter
      )
      .filter((cycle) => {
        if (!query) return true;

        const haystack = [
          getFlightNumber(cycle),
          getAircraftLabel(cycle),
          getClientName(cycle),
          cycle.origin_icao,
          cycle.destination_icao,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
  }, [cycles, activeTab, statusFilter, aircraftFilter, clientFilter, searchQuery]);

  const currentTabCount = filteredCycles.length;

  const hasActiveFilters =
    statusFilter !== "all" ||
    aircraftFilter !== "all" ||
    clientFilter !== "all" ||
    searchQuery.trim().length > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setAircraftFilter("all");
    setClientFilter("all");
    setSearchQuery("");
  };

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
      <div className="mx-auto w-full max-w-[1600px] space-y-6 overflow-hidden rounded-[30px] border border-border/60 bg-background px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {/* =========================================================
            HERO / HEADER
        ========================================================== */}
        <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-card to-card-secondary p-6 text-white shadow-[0_20px_70px_-30px_rgba(15,23,42,0.55)] sm:p-8">
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

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
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

            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-emerald-500 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
        <section className="rounded-[28px] border border-border/70 bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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

              <TabsList className="h-11 w-full rounded-xl border border-border bg-muted/60 p-1 xl:w-auto">
                <TabsTrigger
                  value="active"
                  className="h-9 flex-1 rounded-lg px-4 text-xs font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm xl:flex-none"
                >
                  <Plane className="mr-2 h-3.5 w-3.5" />
                  Ativos
                </TabsTrigger>

                <TabsTrigger
                  value="completed"
                  className="h-9 flex-1 rounded-lg px-4 text-xs font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm xl:flex-none"
                >
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  Finalizados
                </TabsTrigger>
              </TabsList>
            </div>

            {/* =====================================================
                FILTER BAR
            ====================================================== */}
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 lg:min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nº do voo, aeronave, cliente ou rota..."
                  className="h-10 rounded-xl border-border bg-background pl-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0 lg:items-center">
                <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background text-xs font-medium lg:w-[160px]">
                    <Plane className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Aeronave" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">Todas as aeronaves</SelectItem>
                    {aircraftOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background text-xs font-medium lg:w-[180px]">
                    <Filter className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clientOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as FlightCycleStatus | "all")
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background text-xs font-medium lg:w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(FLIGHT_STATUS_CONFIG).map(
                      ([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="h-10 rounded-xl px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* =====================================================
                ACTIVE
            ====================================================== */}
            <TabsContent value="active" className="mt-6 focus-visible:outline-none">
              <CycleGrid
                loading={loading}
                cycles={filteredCycles}
                emptyIcon={<Plane className="h-6 w-6" />}
                emptyTitle={
                  hasActiveFilters ? "Nenhum resultado" : "Nenhum voo ativo"
                }
                emptyDescription={
                  hasActiveFilters
                    ? "Nenhum ciclo corresponde aos filtros selecionados."
                    : "Não existem ciclos ativos no momento."
                }
                actionLabel={hasActiveFilters ? "Limpar filtros" : "Criar primeiro ciclo"}
                onCreate={hasActiveFilters ? clearFilters : () => setCreateDialogOpen(true)}
                onSelect={setSelectedCycle}
              />
            </TabsContent>

            {/* =====================================================
                COMPLETED
            ====================================================== */}
            <TabsContent value="completed" className="mt-6 focus-visible:outline-none">
              <CycleGrid
                loading={loading}
                cycles={filteredCycles}
                emptyIcon={<FileText className="h-6 w-6" />}
                emptyTitle={
                  hasActiveFilters ? "Nenhum resultado" : "Nenhum voo finalizado"
                }
                emptyDescription={
                  hasActiveFilters
                    ? "Nenhum ciclo corresponde aos filtros selecionados."
                    : "Os ciclos concluídos aparecerão aqui."
                }
                actionLabel={hasActiveFilters ? "Limpar filtros" : ""}
                onCreate={clearFilters}
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
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-2xl border border-border bg-background p-4"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />

                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>

              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-border bg-muted/20 px-6 py-12">
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {cycles.map((cycle) => (
        <FlightCycleCard
          key={cycle.id}
          cycle={cycle}
          onClick={() => onSelect(cycle)}
        />
      ))}
    </div>
  );
}