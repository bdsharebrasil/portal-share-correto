import { useMemo } from "react";
import { Plane, ArrowRight, MapPin, Fuel, Clock, Gauge, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCalculator, type AerodromeSel } from "./context";
import { useFuelPrices } from "./hooks";
import {
  aircraftCategory,
  calculateFlightCosts,
  formatBRL,
  formatTime,
  haversineNm,
  type FlightCosts,
  type PilotType,
} from "./utils";

interface Props {
  onSelectAircraft: () => void;
  onSelectAirport: (mode: "adep" | "ades") => void;
  onViewResults: (costs: FlightCosts) => void;
}

export function MainView({ onSelectAircraft, onSelectAirport, onViewResults }: Props) {
  const { state, set } = useCalculator();
  const { data: fuelPrices } = useFuelPrices();

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

  return (
    

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Aeronave */}
        <Section title="Aeronave">
          <Button
            variant="outline"
            className="w-full h-16 border-dashed border-slate-600 bg-slate-800/30 hover:bg-slate-700/50 hover:border-amber-500/50 text-left justify-start gap-3"
            onClick={onSelectAircraft}
          >
            {state.aircraft ? (
              <>
                {state.aircraft.image && (
                  <img src={state.aircraft.image} alt="" className="h-10 w-14 object-cover rounded bg-slate-700/50" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{state.aircraft.name}</p>
                  <p className="text-xs text-slate-400">
                    {state.aircraft.cruiseKts} kts · {state.aircraft.fuelBurnLph} L/h
                  </p>
                </div>
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400/80 whitespace-nowrap">
                  {aircraftCategory(state.aircraft.cruiseKts)}
                </Badge>
              </>
            ) : (
              <span className="text-slate-400 flex items-center gap-2">
                <Plane className="h-5 w-5 text-slate-500" /> Selecionar aeronave
              </span>
            )}
          </Button>
        </Section>

        {/* Rotas */}
        <Section title="Rotas">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <AirportButton label="Origem" airport={state.adep} onClick={() => onSelectAirport("adep")} />
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <AirportButton label="Destino" airport={state.ades} onClick={() => onSelectAirport("ades")} />
          </div>
        </Section>

        {/* Combustível */}
        <Section title="Combustível">
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="pl-10 bg-slate-800/50 border-slate-600 text-white text-lg font-mono"
                value={state.fuelPriceBRL}
                onChange={(e) => set("fuelPriceBRL", parseFloat(e.target.value) || 0)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">/L</span>
            </div>
            {fuelPrices && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => set("fuelPriceBRL", fuelPrices.media_jet ?? 8.5)}
                >
                  <Fuel className="h-3 w-3 mr-1" />
                  Média Jet-A1: {formatBRL(fuelPrices.media_jet ?? 8.5)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => set("fuelPriceBRL", fuelPrices.media_avgas ?? 13.5)}
                >
                  <Fuel className="h-3 w-3 mr-1" />
                  Média Avgas: {formatBRL(fuelPrices.media_avgas ?? 13.5)}
                </Button>
              </div>
            )}
          </div>
        </Section>

        {/* Piloto + horas */}
        <div className="grid md:grid-cols-2 gap-4">
          <Section title="Tipo de Piloto">
            <RadioGroup
              value={state.pilotType}
              onValueChange={(v: PilotType) => set("pilotType", v)}
              className="flex gap-3"
            >
              <PilotOption id="fixed" checked={state.pilotType === "fixed"} label="Fixo" />
              <PilotOption id="freelance" checked={state.pilotType === "freelance"} label="Freelance" />
            </RadioGroup>
            {state.pilotType === "fixed" && (
              <div className="mt-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                <Input
                  type="number"
                  min="0"
                  className="pl-10 bg-slate-800/50 border-slate-600 text-white text-sm font-mono"
                  value={state.fixedPilotMonthlyBRL}
                  onChange={(e) => set("fixedPilotMonthlyBRL", parseFloat(e.target.value) || 0)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">/mês</span>
              </div>
            )}
            {state.aircraft && (
              <p className="text-xs text-slate-500 mt-2">
                Hora de voo do piloto: {formatBRL(state.aircraft.pilotHourlyBRL)}
              </p>
            )}
          </Section>

          <Section title="Horas Anuais">
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                className="bg-slate-800/50 border-slate-600 text-white text-center text-lg font-mono"
                value={state.annualHours}
                onChange={(e) => set("annualHours", parseInt(e.target.value) || 0)}
              />
              <span className="text-sm text-slate-400 font-medium">h/ano</span>
            </div>
          </Section>
        </div>

        {/* Preview */}
        {costs ? (
          <Card
            className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 cursor-pointer hover:from-amber-500/15 hover:to-amber-600/10 transition-all"
            onClick={() => onViewResults(costs)}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-300/70 font-medium uppercase tracking-wider mb-1">
                  Custo Estimado
                </p>
                <p className="text-3xl font-bold text-white">{formatBRL(costs.grandTotal)}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatTime(costs.flightTimeMinutes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> {formatBRL(costs.costPerHour)}/h
                  </span>
                  <span>{costs.distanceNm} NM</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-8">
            <Settings2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Selecione uma aeronave, origem e destino para calcular</p>
          </div>
        )}
     
 
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h2>
      {children}
    </div>
  );
}

function AirportButton({
  label,
  airport,
  onClick,
}: {
  label: string;
  airport: AerodromeSel | null;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className={`w-full h-16 border-dashed ${
        airport ? "border-slate-500 bg-slate-800/30" : "border-slate-600 bg-slate-800/30 hover:border-amber-500/50"
      } hover:bg-slate-700/50 text-left justify-start gap-3 transition-all`}
      onClick={onClick}
    >
      <MapPin className={`h-5 w-5 flex-shrink-0 ${airport ? "text-amber-400" : "text-slate-500"}`} />
      <div className="min-w-0 flex-1">
        {airport ? (
          <>
            <p className="text-white font-medium text-sm truncate">{airport.name}</p>
            <p className="text-xs text-slate-400 font-mono">{airport.icao}</p>
          </>
        ) : (
          <span className="text-slate-400 text-sm">{label}</span>
        )}
      </div>
    </Button>
  );
}

function PilotOption({ id, checked, label }: { id: string; checked: boolean; label: string }) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={id} id={id} className="peer sr-only" />
      <Label
        htmlFor={id}
        className={`flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-all ${
          checked
            ? "border-amber-500 bg-amber-500/10"
            : "border-slate-600 bg-slate-800/30 hover:bg-slate-700/50"
        }`}
      >
        <Plane className={`h-4 w-4 ${checked ? "text-amber-400" : "text-slate-300"}`} />
        <span className="text-xs text-slate-300">{label}</span>
      </Label>
    </div>
  );
}
