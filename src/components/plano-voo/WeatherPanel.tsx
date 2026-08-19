import { Cloud, Eye, Thermometer, Wind } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AISWebMETARData } from '@/services/aiswebWeather';

interface WeatherPanelProps {
  weather: AISWebMETARData | null;
  label: string;
  icao: string;
  loading?: boolean;
  error?: string | null;
}

function formatWind(wdir: number | string | null, wspd: number | null, wgst: number | null) {
  if (wspd === null || wspd === 0) return 'Calmo';
  const direction = wdir !== null ? `${wdir}°` : 'VRB';
  const gust = wgst && wgst > wspd ? ` G${wgst}` : '';
  return `${direction} ${wspd}kt${gust}`;
}

function getCategoryStyle(category: AISWebMETARData['flightCategory']) {
  switch (category) {
    case 'VFR': return { color: 'text-green-400', background: 'bg-green-500/20 border-green-500/50' };
    case 'MVFR': return { color: 'text-blue-400', background: 'bg-blue-500/20 border-blue-500/50' };
    case 'IFR': return { color: 'text-orange-400', background: 'bg-orange-500/20 border-orange-500/50' };
    case 'LIFR': return { color: 'text-red-400', background: 'bg-red-500/20 border-red-500/50' };
    default: return { color: 'text-muted-foreground', background: 'bg-muted/50 border-border' };
  }
}

export function WeatherPanel({ weather, label, icao, loading, error }: WeatherPanelProps) {
  if (!icao) return null;
  const categoryStyle = weather ? getCategoryStyle(weather.flightCategory) : null;

  return (
    <Card className="border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Cloud className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{label}: {icao}</span>
        {weather && <Badge className={`${categoryStyle?.background} ${categoryStyle?.color} h-5 border text-[10px]`}>{weather.flightCategory}</Badge>}
      </div>
      {loading && <p className="text-xs text-muted-foreground">Carregando meteorologia...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {weather && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-foreground"><Thermometer className="h-3 w-3 text-primary" /><span>{weather.temp ?? '--'}°C / {weather.dewp ?? '--'}°C</span></div>
          <div className="flex items-center gap-2 text-foreground"><Wind className="h-3 w-3 text-primary" /><span>{formatWind(weather.wdir, weather.wspd, weather.wgst)}</span></div>
          <div className="flex items-center gap-2 text-foreground"><Eye className="h-3 w-3 text-primary" /><span>{weather.visib ?? '--'}</span></div>
          {weather.rawOb && <div className="mt-2 break-all rounded bg-muted p-2 font-mono text-[10px] text-muted-foreground">{weather.rawOb}</div>}
        </div>
      )}
      {!weather && !loading && !error && <p className="text-xs text-muted-foreground">Aguardando dados...</p>}
    </Card>
  );
}
