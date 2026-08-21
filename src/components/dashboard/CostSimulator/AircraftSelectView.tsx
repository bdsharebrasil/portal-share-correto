import { useState, useMemo } from "react";
import { Search, Plane, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAircraftOptions } from "./hooks";
import { useCalculator } from "./context";
import { aircraftCategory, inferAircraftDefaults } from "./utils";

interface Props {
  onBack: () => void;
}

export function AircraftSelectView({ onBack }: Props) {
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useAircraftOptions();
  const { set } = useCalculator();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.matricula.toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white">Selecionar Aeronave</h2>
            <p className="text-xs text-muted-foreground">Digite ou escolha um modelo</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por modelo ou matrícula..."
            className="pl-10 bg-card-secondary/50 border-border text-white placeholder:text-muted-foreground"
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm text-center py-8">Carregando aeronaves...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma aeronave encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((a) => {
              const cat = aircraftCategory(a.cruiseKts);
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    const defaults = inferAircraftDefaults(a.cruiseKts);
                    set("aircraft", a);
                    set("mtowKg", defaults.mtowKg);
                    set("hangarMonthlyBRL", defaults.hangarMonthlyBRL);
                    set("maintenanceHourlyBRL", defaults.maintenanceHourlyBRL);
                    onBack();
                  }}
                  className="text-left rounded-xl border border-border/60 bg-card-secondary/40 hover:bg-secondary/50 hover:border-amber-500/50 transition-all overflow-hidden group"
                >
                  <div className="h-28 bg-card/60 flex items-center justify-center overflow-hidden">
                    {a.image ? (
                      <img src={a.image} alt={a.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Plane className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-medium text-sm truncate">{a.name}</p>
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400/80">
                        {cat}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{a.matricula}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.cruiseKts} kts · {a.fuelBurnLph} L/h
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
