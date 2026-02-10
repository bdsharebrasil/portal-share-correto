import { useState, useEffect } from "react";
import { RefreshCw, Wind, Droplets, Gauge, Eye, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/useWeather";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useFindNearestAirport } from "@/hooks/useFindNearestAirport";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchAirports } from "@/services/airports";
import { getWeatherIconType } from "@/utils/weatherIcons";

import clearDayIcon from "@/assets/meteocons/clear-day.svg";
import clearNightIcon from "@/assets/meteocons/clear-night.svg";
import partlyCloudyDayIcon from "@/assets/meteocons/partly-cloudy-day.svg";
import partlyCloudyNightIcon from "@/assets/meteocons/partly-cloudy-night.svg";
import cloudyIcon from "@/assets/meteocons/cloudy.svg";
import rainIcon from "@/assets/meteocons/rain.svg";
import thunderstormsIcon from "@/assets/meteocons/thunderstorms.svg";
import fogIcon from "@/assets/meteocons/fog.svg";

export function WeatherDisplay() {
  const { coords } = useGeolocation();
  const { nearest, findNearest } = useFindNearestAirport();
  const { weather, loading, error, refetch, currentIcao, changeAirport } = useWeather();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Auto-detect nearest airport on component mount or when coords change
  useEffect(() => {
    if (coords && !weather) {
      findNearest(coords.latitude, coords.longitude);
    }
  }, [coords, weather, findNearest]);

  // Change to nearest airport when found
  useEffect(() => {
    if (nearest && !weather) {
      changeAirport(nearest.airport.icao);
    }
  }, [nearest, weather, changeAirport]);

  const isDayTime = (): boolean => {
    const hours = new Date().getHours();
    return hours >= 6 && hours < 18;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSearchAirports = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchAirports(query);
      setSearchResults(results);
    } catch (err) {
      console.error("Erro ao buscar aeroportos:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAirport = (icao: string) => {
    changeAirport(icao);
    setSearchQuery("");
    setSearchResults([]);
  };

  const renderIcon = (rawMetar: string) => {
    const type = getWeatherIconType(rawMetar, isDayTime());
    const props = { className: "h-6 w-6" };

    switch (true) {
      case type.includes("thunder"):       return <img src={thunderstormsIcon} {...props} />;
      case type.includes("rain"):          return <img src={rainIcon} {...props} />;
      case type.includes("fog"):           return <img src={fogIcon} {...props} />;
      case type.includes("cloudy"):        return <img src={cloudyIcon} {...props} />;
      case type.includes("partly-cloudy-d"): return <img src={partlyCloudyDayIcon} {...props} />;
      case type.includes("partly-cloudy-n"): return <img src={partlyCloudyNightIcon} {...props} />;
      case type.includes("clear-n"):       return <img src={clearNightIcon} {...props} />;
      default:                             return <img src={clearDayIcon} {...props} />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "VFR":  return "text-green-500 bg-green-500/10 border-green-500/20";
      case "MVFR": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "IFR":  return "text-red-500 bg-red-500/10 border-red-500/20";
      case "LIFR": return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      default:     return "text-gray-500";
    }
  };

  // Converte altímetro (inHg) para hPa — arredonda para inteiro
  const toHpa = (altim?: number): string =>
    altim ? Math.round(altim * 33.8639).toString() : "---";

  // Formata visibilidade: >= 9999 → "10km+", caso contrário em metros ou km
  const formatVisib = (visib?: number): string => {
    if (visib === undefined || visib === null) return "---";
    if (visib >= 9999) return "10km+";
    if (visib >= 1000) return `${(visib / 1000).toFixed(1)}km`;
    return `${visib}m`;
  };

  // Formata direção do vento — aceita número ou string "VRB"
  const formatWdir = (wdir: number | string | undefined): string => {
    if (wdir === undefined || wdir === null) return "---";
    if (typeof wdir === "string") return wdir; // ex: "VRB"
    return String(wdir).padStart(3, "0") + "°";
  };

  if (loading && !weather)
    return <div className="text-xs p-2 animate-pulse">Buscando METAR...</div>;
  if (error || !weather)
    return <div className="text-xs p-2 text-red-400">Offline</div>;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center space-x-2 text-sm hover:opacity-80 transition-all group">
          <div className="flex flex-col items-end leading-none">
            <span className="text-xs font-bold text-muted-foreground">
              {weather.icao}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(weather.reportTime).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-colors ${getCategoryColor(weather.flightCategory)}`}
          >
            {renderIcon(weather.rawOb)}
            <span className="font-bold text-lg">{weather.temp}°</span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0 overflow-hidden shadow-xl" align="end">
        {/* Header */}
        <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              {weather.icao} — Condições Atuais
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getCategoryColor(weather.flightCategory)}`}
              >
                {weather.flightCategory}
              </span>
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {nearest && (
                <span className="inline-flex items-center gap-0.5 mr-1">
                  <MapPin className="h-2.5 w-2.5" />
                  ~{Math.round(nearest.distance)}km • {nearest.airport.name}
                </span>
              )}
              Fonte: AISWEB • Atualizado às{" "}
              {new Date(weather.updatedTime).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Airport Selector */}
        <div className="p-3 border-b space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Trocar Aeroporto</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Digite ICAO ou nome do aeroporto..."
              value={searchQuery}
              onChange={(e) => handleSearchAirports(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-input bg-background shadow-lg z-50">
                {searchResults.slice(0, 5).map((airport) => (
                  <button
                    key={airport.icao}
                    onClick={() => handleSelectAirport(airport.icao)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center border-b last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold">{airport.icao}</div>
                      <div className="text-xs text-muted-foreground">{airport.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Grid 2x2 — 4 cards */}
          <div className="grid grid-cols-2 gap-3">

            {/* Vento */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-sky-500/10 p-2 rounded-full text-sky-500">
                <Wind className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Vento
                </p>
                <p className="text-sm font-bold">
                  {formatWdir(weather.wdir)}
                  <span className="mx-1 text-muted-foreground">@</span>
                  {weather.wspd ?? "---"}kt
                  {weather.wgst && (
                    <span className="text-red-400 ml-1">G{weather.wgst}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Temperatura / Orvalho */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-full text-cyan-500">
                <Droplets className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Orvalho
                </p>
                <p className="text-sm font-bold">
                  {weather.dewp !== undefined ? `${weather.dewp}°C` : "---"}
                </p>
              </div>
            </div>

            {/* Visibilidade */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-full text-amber-500">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  Visibilidade
                </p>
                <p className="text-sm font-bold">{formatVisib(weather.visib)}</p>
              </div>
            </div>

            {/* QNH */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-slate-500/10 p-2 rounded-full text-slate-500">
                <Gauge className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                  QNH
                </p>
                <p className="text-sm font-bold">{toHpa(weather.altim)} hPa</p>
              </div>
            </div>

          </div>

          {/* METAR Raw */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">
              METAR Raw
            </p>
            <div className="bg-black text-green-400 p-2 rounded-md font-mono text-xs break-all border border-green-900/30">
              {weather.rawOb}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
