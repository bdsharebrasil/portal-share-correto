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
  const { coords, loading: geoLoading } = useGeolocation();
  const { nearest, findNearest } = useFindNearestAirport();
  const { weather, loading, error, refetch, currentIcao, changeAirport } = useWeather();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (coords) {
      findNearest(coords.latitude, coords.longitude);
    }
  }, [coords, findNearest]);

  useEffect(() => {
    if (nearest && !weather) {
      changeAirport(nearest.airport.icao);
    }
  }, [nearest, weather, changeAirport]);

  // Fallback para SBGR se não conseguir geolocalização após 5 segundos
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!weather && !nearest) {
        changeAirport('SBGR');
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [weather, nearest, changeAirport]);

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

  const renderIcon = (rawMetar: string, size: string = "h-6 w-6") => {
    const type = getWeatherIconType(rawMetar, isDayTime());
    const props = { className: size };

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

  // Função para determinar o gradiente de fundo baseado na temperatura e condição
  const getWeatherGradient = (temp: number, rawMetar: string): string => {
    const type = getWeatherIconType(rawMetar, isDayTime());
    
    // Noturno
    if (type.includes("clear-n") || type.includes("partly-cloudy-n")) {
      return "from-indigo-500 via-purple-500 to-indigo-700";
    }
    
    // Chuvoso
    if (type.includes("rain") || type.includes("thunder")) {
      return "from-cyan-400 via-blue-500 to-cyan-600";
    }
    
    // Nublado
    if (type.includes("cloudy") || type.includes("fog")) {
      return "from-slate-400 via-gray-500 to-slate-600";
    }
    
    // Ensolarado - varia com temperatura
    if (temp >= 30) {
      return "from-orange-400 via-red-400 to-orange-500";
    } else if (temp >= 20) {
      return "from-amber-300 via-orange-400 to-amber-500";
    } else {
      return "from-sky-300 via-blue-400 to-sky-500";
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

  const toHpa = (altim?: number): string =>
    altim ? Math.round(altim * 33.8639).toString() : "---";

  const formatVisib = (visib?: number): string => {
    if (visib === undefined || visib === null) return "---";
    if (visib >= 9999) return "10km+";
    if (visib >= 1000) return `${(visib / 1000).toFixed(1)}km`;
    return `${visib}m`;
  };

  const formatWdir = (wdir: number | string | undefined): string => {
    if (wdir === undefined || wdir === null) return "---";
    if (typeof wdir === "string") return wdir;
    return String(wdir).padStart(3, "0") + "°";
  };

  if ((loading || geoLoading) && !weather)
    return <div className="text-xs p-2 animate-pulse">Detectando localização...</div>;
  if (error || !weather)
    return <div className="text-xs p-2 text-red-400">Sem dados</div>;

  const gradient = getWeatherGradient(weather.temp, weather.rawOb);
  const weatherType = getWeatherIconType(weather.rawOb, isDayTime());

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="group relative overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105" style={{ borderRadius: '16px', marginLeft: '20px', marginRight: '20px', paddingLeft: '5px', paddingRight: '5px' }}>
          {/* Card compacto com gradiente - tamanho ajustado para header */}
          <div className={`relative bg-gradient-to-br ${gradient} h-12 min-w-[120px]`} style={{ borderRadius: '17px', overflow: 'hidden' }}>
            {/* Overlay com padrão decorativo */}
            <div className="absolute inset-0 opacity-20" style={{ borderRadius: '9px', overflow: 'hidden' }}>
              {weatherType.includes("rain") && (
                <div className="absolute top-1 left-2 text-white/40">
                  <Droplets className="h-4 w-4" />
                </div>
              )}
              {weatherType.includes("clear-d") && (
                <div className="absolute top-1 right-2 text-white/30">
                  <div className="w-5 h-5 rounded-full bg-white/40" />
                </div>
              )}
              {weatherType.includes("clear-n") && (
                <div className="absolute top-1 right-2 text-white/40">
                  <div className="w-4 h-4 rounded-full bg-white/50" />
                  <div className="absolute top-1 left-0.5 w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
                </div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="relative z-10 h-full flex items-center justify-between gap-3 text-white" style={{ overflow: 'hidden', borderRadius: '7px' }}>
              {/* Info esquerda */}
              <div className="flex flex-col justify-center leading-none">
                <div className="text-[10px] font-semibold tracking-tight opacity-90">
                  {weather.icao}
                </div>
                <div className="text-[8px] opacity-70 font-medium truncate max-w-[80px]">
                  {nearest?.airport?.name || weather.icao}
                </div>
              </div>

              {/* Temperatura e ícone */}
              <div className="flex items-center" style={{ marginLeft: '7px', marginRight: '7px', paddingLeft: '0px', paddingRight: '0px' }}>
                <span className="font-bold tracking-tight" style={{ fontSize: '30px', letterSpacing: '2.6px', lineHeight: '31px', minHeight: '9px', maxWidth: '47px', boxShadow: '1px 1px 3px -3px rgba(0, 0, 0, 1)' }}>
                  {weather.temp}°
                </span>
                <div className="opacity-80">
                  {renderIcon(weather.rawOb, "h-5 w-5")}
                </div>
              </div>
            </div>

            {/* Badge de categoria (menor) */}
            <div className="absolute top-1 right-1">
              <div className="text-[7px] px-1 py-0.5 rounded-full font-bold backdrop-blur-sm" style={{ backgroundColor: 'rgba(219, 131, 131, 1)', color: 'rgba(22, 128, 234, 1)' }}>
                {weather.flightCategory}
              </div>
            </div>
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
                <p className="text-sm font-bold">{formatVisib(typeof weather.visib === 'string' ? parseInt(weather.visib, 10) : weather.visib)}</p>
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
