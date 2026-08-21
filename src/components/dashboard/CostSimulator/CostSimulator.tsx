import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Clock3,
  Fuel,
  Gauge,
  MapPin,
  Plane,
  RotateCcw,
  Settings2,
  TrendingUp,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { CalculatorProvider, useCalculator, type AerodromeSel } from "./context";
import { useAircraftOptions, useFuelPrices } from "./hooks";
import {
  calculateFlightCosts,
  formatBRL,
  formatTime,
  haversineNm,
  inferAircraftDefaults,
  parseAerodromeCoords,
  type FlightCosts,
  type PilotType,
} from "./utils";
import { useAerodromes } from "@/hooks/useAerodromes";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function SimulatorInner() {
  const navigate = useNavigate();
  const { state, set, reset } = useCalculator();
  const { data: aircraftOptions = [], isLoading: isLoadingAircraft } = useAircraftOptions();
  const { data: fuelPrices } = useFuelPrices();
  const { aerodromes = [], isLoadingAerodromes } = useAerodromes();

  const aircraftItems = useMemo(
    () => aircraftOptions.map((aircraft) => ({
      id: aircraft.id,
      label: `${aircraft.matricula} · ${aircraft.name}`,
    })),
    [aircraftOptions],
  );

  const aerodromeOptions = useMemo<AerodromeSel[]>(
    () => aerodromes.flatMap((aerodrome) => {
      const coordinates = parseAerodromeCoords(aerodrome.coordenadas);
      if (!coordinates) return [];
      return [{
        id: aerodrome.id,
        icao: aerodrome.designativo,
        name: aerodrome.nome,
        ...coordinates,
      }];
    }),
    [aerodromes],
  );

  const aerodromeItems = useMemo(
    () => aerodromeOptions.map((aerodrome) => ({
      id: aerodrome.id,
      label: `${aerodrome.icao} · ${aerodrome.name}`,
    })),
    [aerodromeOptions],
  );

  const costs = useMemo<FlightCosts | null>(() => {
    if (!state.aircraft || !state.adep || !state.ades) return null;
    const distanceNm = haversineNm(state.adep.lat, state.adep.lon, state.ades.lat, state.ades.lon);
    if (!Number.isFinite(distanceNm) || distanceNm <= 0) return null;
    return calculateFlightCosts({
      distanceNm,
      cruiseKts: state.aircraft.cruiseKts,
      fuelBurnLph: state.aircraft.fuelBurnLph,
      mtowKg: state.mtowKg,
      fuelPriceBRL: state.fuelPriceBRL,
      annualHours: state.annualHours,
      pilotType: state.pilotType,
      pilotHourlyBRL: state.aircraft.pilotHourlyBRL,
      fixedPilotMonthlyBRL: state.fixedPilotMonthlyBRL,
      hangarMonthlyBRL: state.hangarMonthlyBRL,
      maintenanceHourlyBRL: state.maintenanceHourlyBRL,
    });
  }, [state]);

  const handleAircraftChange = (id: string) => {
    const aircraft = aircraftOptions.find((option) => option.id === id);
    if (!aircraft) return;
    const defaults = inferAircraftDefaults(aircraft.cruiseKts);
    set("aircraft", aircraft);
    set("mtowKg", defaults.mtowKg);
    set("hangarMonthlyBRL", defaults.hangarMonthlyBRL);
    set("maintenanceHourlyBRL", defaults.maintenanceHourlyBRL);
  };

  const handleAerodromeChange = (key: "adep" | "ades", id: string) => {
    const aerodrome = aerodromeOptions.find((option) => option.id === id);
    if (aerodrome) set(key, aerodrome);
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--muted)/0.35))]">
      <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-background/80 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" /> Intelligence operacional</div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Simulador de custos de voo</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Transforme rota, aeronave e premissas em uma decisão financeira clara — com leitura rápida para operação e gestão.</p>
            </div>
            <div className="grid min-w-[250px] grid-cols-2 gap-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-1 text-sm font-semibold text-emerald-300">{costs ? "Simulação pronta" : "Aguardando dados"}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Modo</p><p className="mt-1 text-sm font-semibold text-white">Por trecho</p></div></div>
          </div>
        </section>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="mb-2 flex items-center gap-2"><Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1"><Calculator className="h-3.5 w-3.5" /> Configuração da simulação</Badge></div>
              <p className="max-w-2xl text-sm text-muted-foreground">Defina os parâmetros abaixo para atualizar a estimativa em tempo real.</p>
            </div>
          </div>
          <Button variant="ghost" onClick={reset} className="gap-2 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-4 w-4" /> Limpar simulação
          </Button>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader className="border-b border-border/60 bg-card/80 pb-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Plane className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Rota e aeronave</CardTitle>
                    <CardDescription>Escolha os dados principais para iniciar a estimativa.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 lg:grid-cols-3">
                <div className="space-y-2 lg:col-span-3">
                  <Label>Aeronave</Label>
                  <SearchableCombobox
                    items={aircraftItems}
                    value={state.aircraft?.id ?? ""}
                    onChange={handleAircraftChange}
                    placeholder={isLoadingAircraft ? "Carregando aeronaves..." : "Selecione a aeronave"}
                    searchPlaceholder="Buscar por matrícula ou modelo..."
                    emptyMessage="Nenhuma aeronave encontrada."
                    icon={<Plane className="h-4 w-4" />}
                    disabled={isLoadingAircraft}
                  />
                  {state.aircraft && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                      <span>{state.aircraft.cruiseKts} kts de cruzeiro</span>
                      <span>•</span>
                      <span>{state.aircraft.fuelBurnLph} L/h</span>
                      <span>•</span>
                      <span>Hora de piloto: {formatBRL(state.aircraft.pilotHourlyBRL)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Aeródromo de origem</Label>
                  <SearchableCombobox
                    items={aerodromeItems}
                    value={state.adep?.id ?? ""}
                    onChange={(id) => handleAerodromeChange("adep", id)}
                    placeholder={isLoadingAerodromes ? "Carregando aeródromos..." : "Selecione a origem"}
                    searchPlaceholder="Buscar por ICAO ou nome..."
                    emptyMessage="Nenhum aeródromo encontrado."
                    icon={<MapPin className="h-4 w-4" />}
                    disabled={isLoadingAerodromes}
                  />
                </div>
                <div className="hidden items-end justify-center pb-2 lg:flex">
                  <ChevronRight className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <Label>Aeródromo de destino</Label>
                  <SearchableCombobox
                    items={aerodromeItems}
                    value={state.ades?.id ?? ""}
                    onChange={(id) => handleAerodromeChange("ades", id)}
                    placeholder={isLoadingAerodromes ? "Carregando aeródromos..." : "Selecione o destino"}
                    searchPlaceholder="Buscar por ICAO ou nome..."
                    emptyMessage="Nenhum aeródromo encontrado."
                    icon={<MapPin className="h-4 w-4" />}
                    disabled={isLoadingAerodromes}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Premissas operacionais</CardTitle>
                    <CardDescription>Ajuste os valores para refletir o cenário real da operação.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-5 pt-0">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <NumberField label="Combustível" suffix="R$/L" value={state.fuelPriceBRL} step="0.01" onChange={(value) => set("fuelPriceBRL", value)} />
                  <NumberField label="Horas anuais" suffix="h/ano" value={state.annualHours} min="1" onChange={(value) => set("annualHours", value)} />
                  <NumberField label="MTOW estimado" suffix="kg" value={state.mtowKg} min="1" onChange={(value) => set("mtowKg", value)} />
                  <NumberField label="Hangar mensal" suffix="R$/mês" value={state.hangarMonthlyBRL} step="0.01" onChange={(value) => set("hangarMonthlyBRL", value)} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField label="Manutenção" suffix="R$/h" value={state.maintenanceHourlyBRL} step="0.01" onChange={(value) => set("maintenanceHourlyBRL", value)} />
                  <div className="space-y-2">
                    <Label>Tipo de piloto</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["freelance", "fixed"] as PilotType[]).map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={state.pilotType === type ? "default" : "outline"}
                          onClick={() => set("pilotType", type)}
                          className="justify-start gap-2"
                        >
                          <Users className="h-4 w-4" /> {type === "fixed" ? "Piloto fixo" : "Freelance"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {state.pilotType === "fixed" && (
                  <div className="max-w-md">
                    <NumberField label="Salário mensal do piloto fixo" suffix="R$/mês" value={state.fixedPilotMonthlyBRL} step="0.01" onChange={(value) => set("fixedPilotMonthlyBRL", value)} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  <Button variant="outline" size="sm" onClick={() => set("fuelPriceBRL", fuelPrices?.media_jet ?? 8.5)} className="gap-2">
                    <Fuel className="h-3.5 w-3.5" /> Usar média Jet-A1 ({formatBRL(fuelPrices?.media_jet ?? 8.5)})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => set("fuelPriceBRL", fuelPrices?.media_avgas ?? 13.5)} className="gap-2">
                    <Fuel className="h-3.5 w-3.5" /> Usar média Avgas ({formatBRL(fuelPrices?.media_avgas ?? 13.5)})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <Card className="overflow-hidden rounded-3xl border-primary/30 bg-gradient-to-br from-primary/15 via-slate-950 to-background shadow-xl shadow-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estimativa da rota</p>
                    <CardTitle className="mt-1 text-4xl font-semibold tracking-tight text-white">{costs ? formatBRL(costs.grandTotal) : "—"}</CardTitle>
                  </div>
                  <div className="rounded-2xl bg-primary/15 p-3 text-primary">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
                <CardDescription>
                  {costs ? "Custo total estimado para o trecho selecionado." : "Selecione aeronave, origem e destino."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <Separator className="mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <SummaryMetric icon={<Clock3 className="h-4 w-4" />} label="Tempo de voo" value={costs ? formatTime(costs.flightTimeMinutes) : "—"} />
                  <SummaryMetric icon={<Gauge className="h-4 w-4" />} label="Custo por hora" value={costs ? formatBRL(costs.costPerHour) : "—"} />
                  <SummaryMetric icon={<MapPin className="h-4 w-4" />} label="Distância" value={costs ? `${costs.distanceNm} NM` : "—"} />
                  <SummaryMetric icon={<Fuel className="h-4 w-4" />} label="Combustível" value={costs ? `${costs.fuelLiters.toFixed(0)} L` : "—"} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Composição do custo</CardTitle>
                <CardDescription>Valores estimados por trecho.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5 pt-0">
                <CostLine icon={<Users className="h-4 w-4" />} label="Tripulação" value={costs?.fixed.crew} />
                <CostLine icon={<Warehouse className="h-4 w-4" />} label="Hangar rateado" value={costs?.fixed.hangar} />
                <CostLine icon={<Wrench className="h-4 w-4" />} label="Manutenção" value={costs?.fixed.maintenance} />
                <Separator />
                <CostLine icon={<Fuel className="h-4 w-4" />} label="Combustível" value={costs?.variable.fuel} />
                <CostLine icon={<Gauge className="h-4 w-4" />} label="DECEA" value={costs?.variable.decea} />
                <CostLine icon={<MapPin className="h-4 w-4" />} label="INFRAERO" value={costs?.variable.infraero} />
                <div className="mt-2 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total estimado</span>
                    <span className="text-primary">{costs ? formatBRL(costs.grandTotal) : "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {state.aircraft && state.adep && state.ades && (
              <div className="rounded-xl border border-border/60 bg-card/70 p-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Plane className="h-4 w-4 text-primary" /> {state.aircraft.matricula}
                </div>
                <p className="mt-1 pl-6">{state.adep.icao} → {state.ades.icao}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  min = "0",
  step = "1",
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (value: number) => void;
  min?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="pr-20"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function SummaryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function CostLine({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><span className="text-primary/70">{icon}</span>{label}</span>
      <span className={cn("font-medium tabular-nums", value === undefined ? "text-muted-foreground" : "text-foreground")}>{value === undefined ? "—" : formatBRL(value)}</span>
    </div>
  );
}

export function CostSimulator() {
  return (
    <CalculatorProvider>
      <SimulatorInner />
    </CalculatorProvider>
  );
}
