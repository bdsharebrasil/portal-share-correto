import React from 'react';
import { Cloud, Thermometer, Wind, Eye } from 'lucide-react';
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

function formatWind(wdir: number | string | null, wspd: number | null, wgst: number | null): string {
  if (wspd === null || wspd === 0) return 'Calmo';
  const direction = wdir !== null ? `${wdir}°` : 'VRB';
  const gust = wgst && wgst > wspd ? ` G${wgst}` : '';
  return `${direction} ${wspd}kt${gust}`;
}

function getCategoryStyle(cat: string) {
  switch (cat) {
    case 'VFR': return { color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/50' };
    case 'MVFR': return { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/50' };
    case 'IFR': return { color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/50' };
    case 'LIFR': return { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/50' };
    default: return { color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' };
  }
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({ weather, label, icao, loading, error }) => {
  if (!icao) return null;

  return (
    <Card className="p-3 bg-card/95 backdrop-blur-sm border-border shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm text-foreground">{label}: {icao}</span>
        {weather && (
          <Badge className={`${getCategoryStyle(weather.flightCategory).bg} ${getCategoryStyle(weather.flightCategory).color} border text-[10px] h-5`}>
            {weather.flightCategory}
          </Badge>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Carregando meteorologia...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {weather && (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-foreground">
            <Thermometer className="h-3 w-3 text-primary" />
            <span>{weather.temp}°C / {weather.dewp}°C</span>
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <Wind className="h-3 w-3 text-primary" />
            <span>{formatWind(weather.wdir, weather.wspd, weather.wgst)}</span>
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <Eye className="h-3 w-3 text-primary" />
            <span>{weather.visib ?? '--'}</span>
          </div>
          {weather.rawOb && (
            <div className="mt-2 p-2 bg-muted rounded text-[10px] font-mono break-all text-muted-foreground">
              {weather.rawOb}
            </div>
          )}
        </div>
      )}

      {!weather && !loading && !error && (
        <p className="text-xs text-muted-foreground">Aguardando dados...</p>
      )}
    </Card>
  );
};
