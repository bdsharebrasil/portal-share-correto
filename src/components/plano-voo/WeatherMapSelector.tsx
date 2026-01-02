import React, { useState, forwardRef } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wind, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeatherMapSelectorProps {
  lat?: number;
  lng?: number;
  zoom?: number;
}

type MapType = 'temps-low' | 'temps-high' | 'winds-low' | 'winds-high' | 'precip' | 'turb' | 'sigwx';

interface MapConfig {
  label: string;
  level: 'sfc' | 'low' | 'high';
  tab: 'temps' | 'winds' | 'precip' | 'turb' | 'sigwx';
}

const MAP_TYPES: Record<MapType, MapConfig> = {
  'winds-low': {
    label: 'Vento - Baixa Altitude',
    level: 'low',
    tab: 'winds'
  },
  'winds-high': {
    label: 'Vento - Alta Altitude',
    level: 'high',
    tab: 'winds'
  },
  'temps-low': {
    label: 'Temperatura - Baixa Altitude',
    level: 'low',
    tab: 'temps'
  },
  'temps-high': {
    label: 'Temperatura - Alta Altitude',
    level: 'high',
    tab: 'temps'
  },
  'precip': {
    label: 'Precipitação',
    level: 'sfc',
    tab: 'precip'
  },
  'turb': {
    label: 'Turbulência',
    level: 'high',
    tab: 'turb'
  },
  'sigwx': {
    label: 'Tempo Significativo',
    level: 'high',
    tab: 'sigwx'
  }
};

export const WeatherMapSelector = forwardRef<HTMLDivElement, WeatherMapSelectorProps>(({
  lat = -15.0,
  lng = -47.0,
  zoom = 4
}, ref) => {
  const [selectedMapType, setSelectedMapType] = useState<MapType>('winds-low');
  const [key, setKey] = useState(0);

  const config = MAP_TYPES[selectedMapType];
  
  // Build AviationWeather GFA URL with selected parameters
  const buildGFAUrl = () => {
    const params = new URLSearchParams({
      tab: config.tab,
      mode: 'na',
      basemap: 'esriDark',
      mapLayers: 'basicMap,airports',
      center: `${lat},${lng}`,
      zoom: zoom.toString(),
      tz: 'local',
      posLegend: '1',
      gui: '0',
      level: config.level,
    });

    return `https://aviationweather.gov/gfa/?${params.toString()}`;
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div ref={ref} className="space-y-3">
      <Card className="p-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Mapa de Clima</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedMapType} onValueChange={(value) => setSelectedMapType(value as MapType)}>
          <SelectTrigger className="w-full bg-slate-800/50 border-slate-600/50 text-white hover:bg-slate-700/50">
            <SelectValue placeholder="Selecione o tipo de mapa..." />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {Object.entries(MAP_TYPES).map(([key, value]) => (
              <SelectItem key={key} value={key} className="text-white hover:bg-slate-700">
                {value.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Weather Map Iframe */}
      <div className="rounded-lg overflow-hidden border border-slate-700/50 bg-slate-900/50">
        <iframe
          key={key}
          src={buildGFAUrl()}
          title={`AviationWeather - ${config.label}`}
          className="w-full"
          style={{
            height: '400px',
            border: 'none'
          }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
        />
      </div>

      <p className="text-xs text-slate-400 text-center">
        Dados fornecidos por Aviation Weather Center (aviationweather.gov)
      </p>
    </div>
  );
});

WeatherMapSelector.displayName = 'WeatherMapSelector';
