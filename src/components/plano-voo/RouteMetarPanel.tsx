import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import { useAviationWeather, type MetarData } from '@/hooks/useAviationWeather';
import type { AvwxRouteData } from '@/services/avwxRouteService';

interface RouteMetarPanelProps {
  route: AvwxRouteData | null;
  isOffline?: boolean;
  className?: string;
}

function RouteMetarCard({ icao, label }: { icao: string; label: string }) {
  const { metar, loading } = useAviationWeather(icao);
  const [expanded, setExpanded] = useState(false);

  const getFlightCategoryColor = (category?: string) => {
    switch (category) {
      case 'VFR':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'MVFR':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'IFR':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'LIFR':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <div className="border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-300">{label}</p>
          <p className="text-xs font-mono text-cyan-400">{icao.toUpperCase()}</p>
        </div>
        
        {metar && (
          <div className="flex items-center gap-2">
            <Badge className={getFlightCategoryColor(metar.flightCategory)}>
              {metar.flightCategory || 'N/A'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-5 w-5 p-0 text-slate-400 hover:text-white"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {loading && (
          <div className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
        )}
      </div>

      {expanded && metar && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Temp:</span>
            <span className="font-mono">{metar.temp}°C / {metar.dewp}°C</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Vento:</span>
            <span className="font-mono">{metar.wdir}° {metar.wspd}kt</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Visib:</span>
            <span className="font-mono">{metar.visib} SM</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Altim:</span>
            <span className="font-mono">{metar.altim.toFixed(2)} inHg</span>
          </div>
          {metar.source === 'FALLBACK' && (
            <p className="text-[9px] text-amber-400 italic mt-1">Dados em modo offline</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RouteMetarPanel({ route, isOffline = false, className = '' }: RouteMetarPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!route || route.waypoints.length === 0) {
    return null;
  }

  return (
    <Card className={`p-3 bg-slate-900/95 backdrop-blur-sm border-slate-700/50 max-w-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            METAR ao Longo da Rota
            {isOffline && (
              <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/50">
                Offline
              </Badge>
            )}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {route.waypoints.map((wp, index) => {
            const label = 
              index === 0 ? '📍 Partida' :
              index === route.waypoints.length - 1 ? '🎯 Destino' :
              `✈️ Waypoint ${index}`;

            return (
              <RouteMetarCard
                key={`${wp.name}-${index}`}
                icao={wp.name}
                label={label}
              />
            );
          })}
        </div>
      )}

      {collapsed && (
        <p className="text-xs text-slate-400">
          {route.waypoints.length} waypoints com informações METAR
        </p>
      )}
    </Card>
  );
}
