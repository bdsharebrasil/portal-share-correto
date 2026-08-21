import { useState } from "react";
import { Search, MapPin, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAerodromeSearch } from "./hooks";
import { useCalculator } from "./context";

interface Props {
  mode: "adep" | "ades";
  onBack: () => void;
}

export function AirportSearchView({ mode, onBack }: Props) {
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useAerodromeSearch(query);
  const { set } = useCalculator();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <div className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white">
              {mode === "adep" ? "Aeroporto de Origem" : "Aeroporto de Destino"}
            </h2>
            <p className="text-xs text-muted-foreground">Pesquise por ICAO ou cidade</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: SBGR, Guarulhos..."
            className="pl-10 bg-card-secondary/50 border-border text-white placeholder:text-muted-foreground"
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm text-center py-8">Buscando...</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {query.length < 2 ? "Digite ao menos 2 caracteres." : "Nenhum aeródromo encontrado."}
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  set(mode, a);
                  onBack();
                }}
                className="w-full text-left rounded-lg border border-border/60 bg-card-secondary/40 hover:bg-secondary/50 hover:border-amber-500/50 transition-all p-3 flex items-center gap-3"
              >
                <MapPin className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{a.icao}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
