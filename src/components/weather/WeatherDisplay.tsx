import { useState } from "react";
import { RefreshCw, Wind, Droplets, Gauge, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/useWeather"; // Ajuste o caminho
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getWeatherIconType } from "@/utils/weatherIcons"; // Ajuste o caminho ou inclua a função aqui

// Imports dos seus assets (mantive os seus originais)
import clearDayIcon from "@/assets/meteocons/clear-day.svg";
import clearNightIcon from "@/assets/meteocons/clear-night.svg";
import partlyCloudyDayIcon from "@/assets/meteocons/partly-cloudy-day.svg";
import partlyCloudyNightIcon from "@/assets/meteocons/partly-cloudy-night.svg";
import cloudyIcon from "@/assets/meteocons/cloudy.svg";
import rainIcon from "@/assets/meteocons/rain.svg";
import thunderstormsIcon from "@/assets/meteocons/thunderstorms.svg";
import fogIcon from "@/assets/meteocons/fog.svg"; // Adicione se tiver, ou use cloudy

export function WeatherDisplay() {
  // Agora usamos 'refetch' em vez de updateWeather com parametro
  const { weather, loading, error, refetch } = useWeather('SBGR'); 
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lógica de dia/noite baseada no horário atual
  const isDayTime = (): boolean => {
    const hours = new Date().getHours();
    return hours >= 6 && hours < 18;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Mapeamento de ícones baseado no retorno da função utilitária
  const renderIcon = (rawMetar: string) => {
    const type = getWeatherIconType(rawMetar, isDayTime());
    const props = { className: "h-6 w-6" };

    switch (true) {
      case type.includes('thunder'): return <img src={thunderstormsIcon} {...props} />;
      case type.includes('rain'): return <img src={rainIcon} {...props} />;
      case type.includes('cloudy'): return <img src={cloudyIcon} {...props} />;
      case type.includes('partly-cloudy-d'): return <img src={partlyCloudyDayIcon} {...props} />;
      case type.includes('partly-cloudy-n'): return <img src={partlyCloudyNightIcon} {...props} />;
      case type.includes('clear-n'): return <img src={clearNightIcon} {...props} />;
      default: return <img src={clearDayIcon} {...props} />;
    }
  };

  // Cores para categorias de voo
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'VFR': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'MVFR': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'IFR': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'LIFR': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      default: return 'text-gray-500';
    }
  };

  if (loading && !weather) return <div className="text-xs p-2 animate-pulse">Buscando METAR...</div>;
  if (error || !weather) return <div className="text-xs p-2 text-red-400">Offline</div>;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center space-x-2 text-sm hover:opacity-80 transition-all group">
          <div className="flex flex-col items-end leading-none">
            <span className="text-xs font-bold text-muted-foreground">{weather.icao}</span>
            <span className="text-[10px] text-muted-foreground/60">{new Date(weather.reportTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-colors ${getCategoryColor(weather.flightCategory)}`}>
            {renderIcon(weather.rawOb)}
            <span className="font-bold text-lg">{weather.temp}°</span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 overflow-hidden shadow-xl" align="end">
        {/* Header */}
        <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              {weather.icao} - Condições Atuais
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getCategoryColor(weather.flightCategory)}`}>
                {weather.flightCategory}
              </span>
            </h4>
            <p className="text-[10px] text-muted-foreground">Fonte: AISWEB • Atualizado em {new Date(weather.updatedTime).toLocaleTimeString()}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Grid de Informações */}
          <div className="grid grid-cols-2 gap-3">
           {/* Vento - Ajustado para aceitar VRB (Variável) */}
<p className="text-sm font-bold">
  {typeof weather.wdir === 'number' 
    ? String(weather.wdir).padStart(3, '0') + '°' 
    : 'VRB'} 
  <span className="mx-1 text-muted-foreground">@</span> 
  {weather.wspd}kt
  {weather.wgst && <span className="text-red-400 ml-1">G{weather.wgst}</span>}
</p>
              </div>
            </div>

            {/* Umidade / Dewpoint */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2 rounded-full text-cyan-500">
                <Droplets className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Orvalho</p>
                <p className="text-sm font-bold">{weather.dewp}°C</p>
              </div>
            </div>

            {/* Visibilidade */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-full text-amber-500">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Visibilidade</p>
                <p className="text-sm font-bold">
                  {weather.visib && weather.visib >= 9999 ? '10km+' : `${weather.visib}m`}
                </p>
              </div>
            </div>

            {/* Pressão (QNH) */}
            <div className="bg-card border rounded-md p-2 flex items-center gap-3">
              <div className="bg-slate-500/10 p-2 rounded-full text-slate-500">
                <Gauge className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">QNH</p>
                <p className="text-sm font-bold">
                  {weather.altim ? Math.round(weather.altim * 33.8639) : '---'} hPa
                </p>
              </div>
            </div>
          </div>

          {/* Raw Metar */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground font-bold">METAR Raw</p>
            <div className="bg-black text-green-400 p-2 rounded-md font-mono text-xs break-all border border-green-900/30">
              {weather.rawOb}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}