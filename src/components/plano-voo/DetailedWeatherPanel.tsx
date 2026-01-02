import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cloud,
  Wind,
  Thermometer,
  Eye,
  Gauge,
  AlertTriangle,
  Clock,
  Navigation,
} from 'lucide-react';
import { useAviationWeather } from '@/hooks/useAviationWeather';
import type { METARData } from '@/hooks/useAviationWeather';

interface DetailedWeatherPanelProps {
  icao: string | null;
  label: string;
  showTAF?: boolean;
  compact?: boolean;
}

export function DetailedWeatherPanel({
  icao,
  label,
  showTAF = false,
  compact = false,
}: DetailedWeatherPanelProps) {
  const { metar, loading, error } = useAviationWeather(icao, 600000);

  if (!icao) return null;

  const getFlightCategoryColor = (category?: string) => {
    switch (category) {
      case 'VFR':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'MVFR':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'IFR':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'LIFR':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getFlightCategoryLabel = (category?: string) => {
    switch (category) {
      case 'VFR':
        return 'Visual Flight Rules';
      case 'MVFR':
        return 'Marginal VFR';
      case 'IFR':
        return 'Instrument Flight Rules';
      case 'LIFR':
        return 'Low IFR';
      default:
        return 'Unknown';
    }
  };

  if (compact) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-3">
          {loading && <p className="text-xs text-slate-400">Carregando...</p>}
          {error && <p className="text-xs text-red-400">Erro: {error}</p>}

          {metar && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{label} ({icao})</span>
                <Badge className={getFlightCategoryColor(metar.flightCategory)}>
                  {metar.flightCategory || 'N/A'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 text-slate-300">
                  <Thermometer className="h-3 w-3 text-cyan-400" />
                  <span>{metar.temp}°C</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300">
                  <Wind className="h-3 w-3 text-blue-400" />
                  <span>{metar.wdir}° {metar.wspd}kt</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300">
                  <Eye className="h-3 w-3 text-amber-400" />
                  <span>{metar.visib} SM</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300">
                  <Gauge className="h-3 w-3 text-purple-400" />
                  <span>{metar.altim.toFixed(2)} inHg</span>
                </div>
              </div>

              <div className="mt-2 p-2 bg-slate-900/50 rounded text-[10px] font-mono break-all text-slate-400">
                {metar.rawOb}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="border-b border-slate-700/50 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-white">{label}</CardTitle>
              <p className="text-sm text-slate-400 font-mono">{icao}</p>
            </div>
          </div>
          {metar && (
            <Badge className={`${getFlightCategoryColor(metar.flightCategory)} font-semibold`}>
              {metar.flightCategory || 'N/A'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin">
              <Cloud className="h-8 w-8 text-slate-500" />
            </div>
            <span className="ml-3 text-slate-400">Carregando dados meteorológicos...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-400">Erro ao carregar dados</p>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {metar && (
          <div className="space-y-6">
            {/* Flight Category Info */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-2">Categoria de Voo</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white text-lg">
                    {metar.flightCategory || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {getFlightCategoryLabel(metar.flightCategory)}
                  </p>
                </div>
                <Navigation className="h-6 w-6 text-slate-500" />
              </div>
            </div>

            {/* Temperature and Dewpoint */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-slate-400">Temperatura</p>
                </div>
                <p className="text-2xl font-bold text-white">{metar.temp}°C</p>
                <p className="text-xs text-slate-500 mt-1">Ponto de Orvalho: {metar.dewp}°C</p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-purple-400" />
                  <p className="text-sm text-slate-400">Altímetro</p>
                </div>
                <p className="text-2xl font-bold text-white">{metar.altim.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">inHg</p>
              </div>
            </div>

            {/* Wind Information */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wind className="h-4 w-4 text-blue-400" />
                <p className="text-sm text-slate-400">Vento</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Direção</p>
                  <p className="text-xl font-bold text-white">{metar.wdir}°</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Velocidade</p>
                  <p className="text-xl font-bold text-white">{metar.wspd} kt</p>
                </div>
                {metar.wgst && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Rajadas</p>
                    <p className="text-xl font-bold text-white">{metar.wgst} kt</p>
                  </div>
                )}
              </div>
            </div>

            {/* Visibility */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-amber-400" />
                <p className="text-sm text-slate-400">Visibilidade</p>
              </div>
              <p className="text-2xl font-bold text-white">{metar.visib}</p>
              <p className="text-xs text-slate-500 mt-1">Statute Miles (SM)</p>
            </div>

            {/* Raw METAR */}
            <div>
              <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                METAR Bruto
                {metar.updatedTime && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {new Date(metar.updatedTime).toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </p>
              <div className="bg-slate-900/50 p-4 rounded-lg font-mono text-sm break-all text-slate-300 max-h-24 overflow-y-auto">
                {metar.rawOb}
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-slate-700/20 rounded-lg p-3">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Legenda</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">inHg:</span>
                  <span className="text-slate-300 ml-1">polegadas de mercúrio</span>
                </div>
                <div>
                  <span className="text-slate-400">SM:</span>
                  <span className="text-slate-300 ml-1">statute miles</span>
                </div>
                <div>
                  <span className="text-slate-400">kt:</span>
                  <span className="text-slate-300 ml-1">nós</span>
                </div>
                <div>
                  <span className="text-slate-400">°C:</span>
                  <span className="text-slate-300 ml-1">graus Celsius</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
