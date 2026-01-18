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
  const { weather, loading } = useWeather();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isDay = isDayTime();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('[METAR MANUAL] 🔄 Usuário clicou em refresh...');

    let abortController: AbortController | null = null;
    try {
      // Use backend proxy endpoint to avoid CORS issues
      const url = '/api/weather/metar?icao=SBGR';

      console.log('[METAR MANUAL] 🌐 Buscando via backend:', url);

      abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController?.abort(), 15000);

      try {
        const response = await fetch(url, {
          signal: abortController.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('[METAR MANUAL] ✅ Resposta recebida:', data);

          // Dados foram atualizados, aguardar um pouco antes de parar de rodar
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }
          refreshTimeoutRef.current = setTimeout(() => {
            setIsRefreshing(false);
            console.log('[METAR MANUAL] ✅ Refresh concluído!');
          }, 1500);
        } else {
          console.error('[METAR MANUAL] ❌ HTTP Error:', response.status, response.statusText);
          setIsRefreshing(false);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[METAR MANUAL] ⏱️ Timeout na requisição');
        } else {
          console.error('[METAR MANUAL] ❌ Erro fetch:', fetchError);
        }
        setIsRefreshing(false);
      }
    } catch (error) {
      console.error('[METAR MANUAL] ❌ Erro inesperado:', error);
      setIsRefreshing(false);
    } finally {
      abortController = null;
    }
  };

  if (loading) {
    return (
      <div className="hidden md:flex items-center space-x-2 text-sm">
        <svg className="h-4 w-4 text-primary animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-muted-foreground">Carregando clima...</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="hidden md:flex items-center space-x-2 text-sm">
        <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span className="text-muted-foreground">Clima indisponível</span>
      </div>
    );
  }

  // Map weather icons (considerando dia/noite)
  const getWeatherIcon = (icon: string) => {
    if (icon.includes('01')) {
      return <img src={isDay ? clearDayIcon : clearNightIcon} alt={isDay ? "Sol" : "Noite clara"} className="h-4 w-4" />;
    }
    if (icon.includes('02')) {
      return <img src={isDay ? partlyCloudyDayIcon : partlyCloudyNightIcon} alt="Parcialmente nublado" className="h-4 w-4" />;
    }
    if (icon.includes('03') || icon.includes('04')) {
      return <img src={isDay ? cloudyIcon : overcastNightIcon} alt="Nublado" className="h-4 w-4" />;
    }
    if (icon.includes('09') || icon.includes('10')) {
      return <img src={rainIcon} alt="Chuva" className="h-4 w-4" />;
    }
    if (icon.includes('11')) {
      return <img src={isDay ? thunderstormsIcon : thunderstormsNightIcon} alt="Tempestade" className="h-4 w-4" />;
    }
    return <img src={isDay ? cloudyIcon : overcastNightIcon} alt="Nublado" className="h-4 w-4" />;
  };

  // Get flight category color
  const getFlightCategoryColor = (category: string) => {
    switch (category) {
      case 'VFR':
        return 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300';
      case 'MVFR':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300';
      case 'IFR':
        return 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300';
      case 'LIFR':
        return 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="hidden md:flex items-center space-x-3 text-sm cursor-pointer hover:opacity-80 transition-opacity">
          <div className="flex items-center space-x-1">
            {/* Ícone de localização */}
            <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-muted-foreground max-w-[100px] truncate text-xs font-semibold">{weather.location}</span>
          </div>

          <div className="flex items-center space-x-1 bg-gradient-to-r from-primary/10 to-primary/5 px-2 py-1 rounded-lg border border-primary/20">
            {getWeatherIcon(weather.icon)}
            <span className="text-foreground font-semibold">{weather.temperature}°C</span>
          </div>

          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <img src={windIcon} alt="Vento" className="h-3 w-3 opacity-70" />
            <span>{weather.windSpeed || '--'}kt</span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header com aeródromo e categoria de voo */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{weather.location}</p>
              <p className="text-xs text-muted-foreground">
                METAR em tempo real
                {weather.rawMetar && (
                  <>
                    {' • '}
                    <span className="font-mono text-xs opacity-75">
                      {weather.rawMetar.split(' ')[2] || ''}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getFlightCategoryColor(weather.flightCategory)}`}>
                {weather.flightCategory}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Temperatura e Ponto de Orvalho */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Temperatura</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Temperatura</p>
                <p className="text-lg font-bold text-foreground">{weather.temperature}°C</p>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Ponto de Orvalho</p>
                <p className="text-lg font-bold text-foreground">{weather.dewpoint !== null ? `${weather.dewpoint}°C` : '--'}</p>
              </div>
            </div>
            {weather.dewpoint !== null && (
              <p className="text-xs text-muted-foreground">
                Diferença: {weather.temperature - weather.dewpoint}°C
              </p>
            )}
          </div>

          {/* Vento */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vento</p>
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">
                  {weather.windDirection !== null ? `${weather.windDirection}°` : '--'} 
                  {weather.windDirection !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({getWindDirection(weather.windDirection)})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <img src={windIcon} alt="Vento" className="h-5 w-5 text-primary opacity-70" />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {weather.windSpeed !== null ? `${weather.windSpeed}` : '--'} <span className="text-xs">kt</span>
                  </p>
                  {weather.windGust !== null && (
                    <p className="text-xs text-muted-foreground">
                      Rajada: {weather.windGust} kt
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visibilidade */}
          {weather.visibility && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visibilidade</p>
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-lg font-bold text-foreground">
                  {weather.visibility.value} <span className="text-xs text-muted-foreground">{weather.visibility.unit}</span>
                </p>
                {weather.visibility.unit === 'm' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(weather.visibility.value / 1609.34).toFixed(1)} SM
                  </p>
                )}
              </div>
            </div>
          )}

          {/* METAR bruto */}
          {weather.rawMetar && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">METAR Bruto</p>
              <p className="text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded border border-border break-words">
                {weather.rawMetar}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function para obter direção do vento em texto
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return directions[index];
}
