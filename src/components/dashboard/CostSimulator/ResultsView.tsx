import { ArrowLeft, Clock, Gauge, Fuel, Users, Wrench, Warehouse, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCalculator } from "./context";
import { formatBRL, formatTime, type FlightCosts } from "./utils";

interface Props {
  costs: FlightCosts;
  onBack: () => void;
}

export function ResultsView({ costs, onBack }: Props) {
  const { state } = useCalculator();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-300 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white">Resultado da Simulação</h2>
            <p className="text-xs text-slate-400">
              {state.adep?.icao} → {state.ades?.icao} · {state.aircraft?.name}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Card className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border-amber-500/30">
          <CardContent className="p-6">
            <p className="text-xs text-amber-300/70 font-medium uppercase tracking-wider mb-1">
              Custo Total Estimado
            </p>
            <p className="text-4xl font-bold text-white">{formatBRL(costs.grandTotal)}</p>
            <div className="grid grid-cols-3 gap-3 mt-4 text-xs text-slate-300">
              <Stat icon={<Clock className="h-4 w-4 text-amber-400" />} label="Tempo" value={formatTime(costs.flightTimeMinutes)} />
              <Stat icon={<Gauge className="h-4 w-4 text-amber-400" />} label="Custo/h" value={formatBRL(costs.costPerHour)} />
              <Stat icon={<Fuel className="h-4 w-4 text-amber-400" />} label="Combustível" value={`${costs.fuelLiters.toFixed(0)} L`} />
            </div>
            <p className="text-xs text-slate-400 mt-3">Distância: {costs.distanceNm} NM ({costs.distanceKm} km)</p>
          </CardContent>
        </Card>

        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Custos Fixos
          </h3>
          <Card className="bg-slate-800/40 border-slate-700/60">
            <CardContent className="p-4 space-y-2">
              <Line icon={<Users className="h-4 w-4" />} label={`Tripulação (${state.pilotType === "fixed" ? "Fixo" : "Freelance"})`} value={costs.fixed.crew} />
              <Line icon={<Warehouse className="h-4 w-4" />} label="Hangar (rateado)" value={costs.fixed.hangar} />
              <Line icon={<Wrench className="h-4 w-4" />} label="Manutenção" value={costs.fixed.maintenance} />
              <div className="border-t border-slate-700/60 pt-2 mt-2 flex justify-between text-sm">
                <span className="text-slate-300 font-medium">Subtotal fixo</span>
                <span className="text-white font-mono font-semibold">{formatBRL(costs.fixed.total)}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Custos Variáveis
          </h3>
          <Card className="bg-slate-800/40 border-slate-700/60">
            <CardContent className="p-4 space-y-2">
              <Line icon={<Fuel className="h-4 w-4" />} label="Combustível" value={costs.variable.fuel} />
              <Line icon={<DollarSign className="h-4 w-4" />} label="DECEA (navegação)" value={costs.variable.decea} />
              <Line icon={<DollarSign className="h-4 w-4" />} label="INFRAERO (pouso + decolagem)" value={costs.variable.infraero} />
              <div className="border-t border-slate-700/60 pt-2 mt-2 flex justify-between text-sm">
                <span className="text-slate-300 font-medium">Subtotal variável</span>
                <span className="text-white font-mono font-semibold">{formatBRL(costs.variable.total)}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-slate-500 text-center pb-8">
          Valores estimados. Ajuste as premissas conforme o contrato operacional.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 p-2">
      <div className="flex items-center gap-1 text-slate-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-white font-mono text-sm mt-1">{value}</p>
    </div>
  );
}

function Line({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="flex items-center gap-2 text-slate-300">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <span className="text-white font-mono">{formatBRL(value)}</span>
    </div>
  );
}
