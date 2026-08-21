import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AnimatedFolder } from "@/components/AnimatedFolder";
import { FlightCycleCard } from "@/components/ciclo-voo/FlightCycleCard";
import { FlightCycleDetail } from "@/components/ciclo-voo/FlightCycleDetail";
import { CreateFlightCycleDialog } from "@/components/ciclo-voo/CreateFlightCycleDialog";
import { FlightCycle, FlightCycleStatus } from "@/types/flightCycle";
import { useFlightCycles } from "@/hooks/useFlightCycles";

const cyclePreviewImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1'%3E%3Cstop stop-color='%231e3a8a'/%3E%3Cstop offset='1' stop-color='%2338bdf8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' rx='12' fill='url(%23g)'/%3E%3Cpath d='M16 49h24l12-15 10 2 8 8h24v7H16z' fill='white' opacity='.92'/%3E%3Ccircle cx='34' cy='55' r='5' fill='%231e293b'/%3E%3Ccircle cx='86' cy='55' r='5' fill='%231e293b'/%3E%3C/svg%3E";

function aircraftLabel(cycle: FlightCycle) {
  return cycle.aircraft?.matricula || "Aeronave não definida";
}

function aircraftModel(cycles: FlightCycle[]) {
  return cycles.find((cycle) => cycle.aircraft?.modelo)?.aircraft?.modelo || "Modelo não informado";
}

function cycleYear(cycle: FlightCycle) {
  return cycle.flight_date ? new Date(`${cycle.flight_date}T12:00:00`).getFullYear() : 0;
}

function clientLabel(cycle: FlightCycle) {
  return (
    cycle.partner_name ||
    cycle.client?.company_name ||
    cycle.client?.proprietario ||
    "Cliente não definido"
  );
}

function makeFolderProjects(cycles: FlightCycle[]) {
  return cycles.map((cycle) => ({
    id: cycle.id,
    image: cyclePreviewImage,
    title: `${format(new Date(`${cycle.flight_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} · ${cycle.origin_icao || "---"} → ${cycle.destination_icao || "---"}`,
  }));
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function YearSection({
  year,
  cycles,
  onSelect,
}: {
  year: number;
  cycles: FlightCycle[];
  onSelect: (cycle: FlightCycle) => void;
}) {
  const active = cycles.filter((cycle) => cycle.status !== "finalizado").length;
  const completed = cycles.filter((cycle) => cycle.status === "finalizado").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight">Ciclos de {year}</h3>
              <Badge variant="secondary" className="rounded-full">{cycles.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Histórico anual desta aeronave</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" /> {active} ativos
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 font-semibold text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> {completed} finalizados
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {cycles.map((cycle) => (
          <FlightCycleCard key={cycle.id} cycle={cycle} onClick={() => onSelect(cycle)} />
        ))}
      </div>
    </section>
  );
}

export default function CiclosVoo() {
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
  } = useFlightCycles();

  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<FlightCycle | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const filteredCycles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cycles.filter((cycle) => {
      if (!q) return true;
      const haystack = [
        aircraftLabel(cycle),
        cycle.aircraft?.modelo,
        clientLabel(cycle),
        cycle.origin_icao,
        cycle.destination_icao,
        cycle.partner_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cycles, search]);

  const aircraftGroups = useMemo(() => {
    const grouped = new Map<string, FlightCycle[]>();
    filteredCycles.forEach((cycle) => {
      const key = aircraftLabel(cycle);
      const current = grouped.get(key) || [];
      current.push(cycle);
      grouped.set(key, current);
    });
    return Array.from(grouped.entries())
      .map(([matricula, aircraftCycles]) => ({
        matricula,
        cycles: aircraftCycles.sort((a, b) => b.flight_date.localeCompare(a.flight_date)),
      }))
      .sort((a, b) => a.matricula.localeCompare(b.matricula, "pt-BR"));
  }, [filteredCycles]);

  const currentAircraftCycles = useMemo(() => {
    if (!selectedAircraft) return [];
    return (aircraftGroups.find((group) => group.matricula === selectedAircraft)?.cycles || []).filter((cycle) => {
      return yearFilter == null || cycleYear(cycle) === yearFilter;
    });
  }, [aircraftGroups, selectedAircraft, yearFilter]);

  const years = useMemo(() => {
    const set = new Set<number>();
    currentAircraftCycles.forEach((cycle) => {
      const year = cycleYear(cycle);
      if (year) set.add(year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [currentAircraftCycles]);

  const yearGroups = useMemo(() => {
    const grouped = new Map<number, FlightCycle[]>();
    currentAircraftCycles.forEach((cycle) => {
      const year = cycleYear(cycle);
      if (!year) return;
      const current = grouped.get(year) || [];
      current.push(cycle);
      grouped.set(year, current);
    });
    return Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]);
  }, [currentAircraftCycles]);

  if (selectedCycle) {
    const freshCycle = cycles.find((cycle) => cycle.id === selectedCycle.id) || selectedCycle;
    return (
      <FlightCycleDetail
        cycle={freshCycle}
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
    <div className="min-h-full w-full bg-background">
      <div className="mx-auto w-full max-w-[1680px] space-y-6">
        <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-br from-background via-card to-card-secondary p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.6)] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <Plane className="h-3.5 w-3.5" /> Gestão operacional
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Ciclos de voo</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                Organize os ciclos por aeronave. Abra uma pasta para visualizar todo o histórico separado por ano.
              </p>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} className="h-12 shrink-0 rounded-xl px-5 font-semibold shadow-lg shadow-primary/10">
              <Plus className="mr-2 h-4 w-4" /> Novo ciclo
            </Button>
          </div>

          <div className="relative z-10 mt-6 flex flex-col gap-3 border-t border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <StatPill label="Ciclos" value={filteredCycles.length} />
              <StatPill label="Aeronaves" value={aircraftGroups.length} />
              <StatPill label="Ativos" value={filteredCycles.filter((cycle) => cycle.status !== "finalizado").length} />
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedAircraft(null);
                  setYearFilter(null);
                }}
                placeholder="Buscar aeronave, cliente ou rota..."
                className="h-11 rounded-xl border-border/70 bg-background/70 pl-9"
              />
            </div>
          </div>
        </section>

        {selectedAircraft ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 rounded-[26px] border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => { setSelectedAircraft(null); setYearFilter(null); }} className="h-10 w-10 rounded-xl shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Plane className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-bold tracking-tight">{selectedAircraft}</h2>
                    <Badge variant="secondary" className="rounded-full">{currentAircraftCycles.length} ciclos</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {aircraftModel(aircraftGroups.find((group) => group.matricula === selectedAircraft)?.cycles || [])}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={yearFilter === null ? "default" : "outline"} className="rounded-xl" onClick={() => setYearFilter(null)}>Todos os anos</Button>
                {years.map((year) => (
                  <Button key={year} variant={yearFilter === year ? "default" : "outline"} className="rounded-xl" onClick={() => setYearFilter(year)}>
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            {!loading && yearGroups.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhum ciclo encontrado para os filtros selecionados.
              </div>
            ) : (
              yearGroups.map(([year, yearCycles]) => (
                <YearSection key={year} year={year} cycles={yearCycles} onSelect={setSelectedCycle} />
              ))
            )}
          </section>
        ) : (
          <section className="rounded-[30px] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Frota</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Pastas de aeronaves</h2>
                <p className="mt-1 text-sm text-muted-foreground">Clique em uma aeronave para abrir os ciclos organizados por ano.</p>
              </div>
              <div className="text-xs text-muted-foreground">{aircraftGroups.length} pastas</div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-[220px] animate-pulse rounded-2xl border border-border/60 bg-muted/30" />
                ))}
              </div>
            ) : aircraftGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Plane className="mx-auto h-9 w-9 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma aeronave com ciclos</h3>
                <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro ciclo para sua frota aparecer aqui.</p>
                <Button className="mt-5 rounded-xl" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Criar ciclo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {aircraftGroups.map((group) => (
                  <AnimatedFolder
                    key={group.matricula}
                    title={group.matricula}
                    projects={makeFolderProjects(group.cycles)}
                    theme="blue"
                    showPreviewCards={false}
                    onClick={() => {
                      setSelectedAircraft(group.matricula);
                      setYearFilter(null);
                    }}
                    className="w-full"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <CreateFlightCycleDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={createCycle}
        />
      </div>
    </div>
  );
}
