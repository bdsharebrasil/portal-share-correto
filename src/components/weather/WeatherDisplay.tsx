import { useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/useWeather";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Importar os ícones de dia
import clearDayIcon from "@/assets/meteocons/clear-day.svg";
import clearNightIcon from "@/assets/meteocons/clear-night.svg";
import partlyCloudyDayIcon from "@/assets/meteocons/partly-cloudy-day.svg";
import partlyCloudyNightIcon from "@/assets/meteocons/partly-cloudy-night.svg";
import cloudyIcon from "@/assets/meteocons/cloudy.svg";
import overcastNightIcon from "@/assets/meteocons/overcast-night.svg";
import rainIcon from "@/assets/meteocons/rain.svg";
import thunderstormsIcon from "@/assets/meteocons/thunderstorms.svg";
import thunderstormsNightIcon from "@/assets/meteocons/thunderstorms-night.svg";
import humidityIcon from "@/assets/meteocons/humidity.svg";
import windIcon from "@/assets/meteocons/wind.svg";

// Determinar se é dia ou noite
function isDayTime(): boolean {
  const now = new Date();
  // Brasília timezone (UTC-3 or UTC-2 during daylight saving)
  const brazilTime = new Date(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  const hours = brazilTime.getHours();

  // Considerar dia entre 6h e 18h
  return hours >= 6 && hours < 18;
}

export function WeatherDisplay() {
  const { weather, loading, fetchWeather } = useWeather();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWeather('SBGR');
    setTimeout(() => setIsRefreshing(false), 800);
  };

  if (loading && !weather) return <div className="text-xs p-2">Carregando...</div>;
  if (!weather) return <div className="text-xs p-2">Indisponível</div>;

  const getWeatherIcon = (iconCode: string) => {
    const isDay = iconCode.endsWith('d');
    if (iconCode.startsWith('01')) return <img src={isDay ? clearDayIcon : clearNightIcon} className="h-4 w-4" />;
    // Adicione os outros mapeamentos conforme sua lista de assets...
    return <img src={clearDayIcon} className="h-4 w-4" />;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center space-x-3 text-sm hover:opacity-80 transition-all">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground text-xs font-bold">{weather.location}</span>
          </div>
          <div className="flex items-center space-x-1 bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">
            {getWeatherIcon(weather.icon)}
            <span className="font-bold">{weather.temperature}°C</span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <p className="text-sm font-bold">{weather.location}</p>
              <p className="text-[10px] text-muted-foreground font-mono">AISWEB REAL-TIME</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 p-2 rounded">
              <p className="text-[10px] uppercase text-muted-foreground">Vento</p>
              <p className="text-sm font-bold">{weather.windDirection}° / {weather.windSpeed}kt</p>
            </div>
            <div className="bg-muted/30 p-2 rounded">
              <p className="text-[10px] uppercase text-muted-foreground">Categoria</p>
              <p className={`text-sm font-bold ${weather.flightCategory === 'VFR' ? 'text-green-500' : 'text-red-500'}`}>
                {weather.flightCategory}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">METAR Bruto</p>
            <p className="text-[10px] font-mono bg-black/5 p-2 rounded break-words">
              {weather.rawMetar}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
