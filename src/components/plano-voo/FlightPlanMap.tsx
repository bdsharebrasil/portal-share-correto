import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Layers,
  Cloud,
  Wind,
  Thermometer,
  Eye,
  Navigation,
  MapPin,
  X,
  Route,
  Save,
  FileText,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAviationWeather, type MetarData } from '@/hooks/useAviationWeather';
import { RouteMetarPanel } from './RouteMetarPanel';
import { useAvwxRoute } from '@/hooks/useAvwxRoute';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface Waypoint {
  icao: string;
  name: string;
  lat: number;
  lng: number;
  type: 'departure' | 'arrival' | 'waypoint';
}

export interface LegInfo {
  from: string;
  to: string;
  distanceNM: number;
  bearing: number;
}

interface FlightPlanMapProps {
  waypoints: Waypoint[];
  legs: LegInfo[];
  onBack?: () => void;
  flightRules?: string;
  routeString?: string;
  departureIcao?: string;
  destinationIcao?: string;
  aircraftRegistration?: string;
  onOpenDepartureCharts?: () => void;
  onOpenArrivalCharts?: () => void;
  onSavePlan?: () => void;
}

// OpenAIP IFR Chart Layers - usando tiles OpenFlightMaps como fallback
// Se openaip.net não responder, usar SkyVector ou OpenFlightMaps
const IFR_LAYERS = {
  ifrLow: 'https://tiles.openaip.net/ifrl/{z}/{x}/{y}.png',
  ifrHigh: 'https://tiles.openaip.net/ifrh/{z}/{x}/{y}.png',
  // Fallback options
  fallback: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

// DECEA WMS Layers - Official Brazilian Airspace Data
const createDeceaAirwaysLayer = () =>
  L.tileLayer.wms(
    'https://geoaisweb.decea.mil.br/geoserver/ICA/wms',
    {
      layers: 'ICA:ENR_AIRWAY',
      format: 'image/png',
      transparent: true,
      attribution: '© DECEA',
      maxZoom: 14,
    }
  );

const createDeceaAerodromesLayer = () =>
  L.tileLayer.wms(
    'https://geoaisweb.decea.mil.br/geoserver/ICA/wms',
    {
      layers: 'ICA:AD_AERODROMO',
      format: 'image/png',
      transparent: true,
      attribution: '© DECEA',
      maxZoom: 14,
    }
  );

// Waypoint icons
const createWaypointIcon = (type: 'departure' | 'arrival' | 'waypoint') => {
  const colors = {
    departure: { fill: '#22c55e', stroke: '#16a34a', label: 'D' },
    arrival: { fill: '#ef4444', stroke: '#dc2626', label: 'A' },
    waypoint: { fill: '#f59e0b', stroke: '#d97706', label: 'W' }
  };
  const { fill, stroke, label } = colors[type];

  return L.divIcon({
    className: 'waypoint-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${label}</text>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Format bearing to cardinal direction
function formatBearing(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  const normalized = Math.round(bearing) % 360;
  return `${normalized.toString().padStart(3, '0')}°${directions[index]}`;
}

// Weather Card Component
interface WeatherCardProps {
  icao: string;
  label: string;
  position: 'left' | 'right';
}

function WeatherCard({ icao, label, position }: WeatherCardProps) {
  const { metar, loading, error } = useAviationWeather(icao);
  const [isExpanded, setIsExpanded] = useState(true);

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
    <Card className="bg-slate-900/95 backdrop-blur-sm border-slate-700/50 p-3 max-w-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-cyan-400" />
          <div>
            <p className="font-semibold text-xs text-white">{label}</p>
            <p className="font-mono text-xs text-cyan-400">{icao}</p>
          </div>
        </div>
        {metar && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-500 uppercase">Cat.</span>
            <Badge className={getFlightCategoryColor(metar.flightCategory)}>
              {metar.flightCategory || 'N/A'}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
        >
          {isExpanded ? <X className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2">
          <div className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400">Carregando METAR...</p>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-amber-400">METAR indisponível</p>
      )}

      {metar && isExpanded && (
        <div className="space-y-2 text-xs">
          <p className="text-[9px] text-slate-500 italic border-b border-slate-700/50 pb-2">
            Condições Meteorológicas (METAR)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1 text-slate-300">
              <Thermometer className="h-3 w-3 text-red-400" />
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
              <Navigation className="h-3 w-3 text-purple-400" />
              <span>{metar.altim.toFixed(2)} inHg</span>
            </div>
          </div>
          <div className="mt-2 p-2 bg-slate-950/70 rounded text-[10px] font-mono break-all text-slate-400 border border-slate-700/30 max-h-16 overflow-y-auto">
            {metar.rawOb}
          </div>
        </div>
      )}
    </Card>
  );
}

export function FlightPlanMap({
  waypoints,
  legs,
  onBack,
  flightRules,
  routeString,
  departureIcao,
  destinationIcao,
  aircraftRegistration,
  onOpenDepartureCharts,
  onOpenArrivalCharts,
  onSavePlan,
}: FlightPlanMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const ifrLowLayerRef = useRef<L.TileLayer | null>(null);
  const ifrHighLayerRef = useRef<L.TileLayer | null>(null);
  const deceaAirwaysLayerRef = useRef<L.TileLayer | null>(null);
  const deceaAerodromesLayerRef = useRef<L.TileLayer | null>(null);

  const [showIfrLow, setShowIfrLow] = useState(false);
  const [showIfrHigh, setShowIfrHigh] = useState(false);
  const [ifrOpacity, setIfrOpacity] = useState([0.7]);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showRouteMetar, setShowRouteMetar] = useState(true);
  const [showDeceaAirways, setShowDeceaAirways] = useState(false);
  const [showDeceaAerodromes, setShowDeceaAerodromes] = useState(false);

  // Load AVWX route data
  const departure = waypoints.find(w => w.type === 'departure')?.icao;
  const destination = waypoints.find(w => w.type === 'arrival')?.icao;
  const { route, isOffline } = useAvwxRoute({
    departure,
    destination,
    routeString,
    enabled: !!(departure && destination),
  });

  // Determine flight type based on flightRules
  const isIFR = flightRules === 'I' || flightRules === 'Y';
  const flightTypeLabel = isIFR ? 'IFR' : 'VFR';
  const flightTypeColor = isIFR ? 'text-orange-400' : 'text-emerald-400';

  const routePositions = useMemo(() => {
    return waypoints.map(w => [w.lat, w.lng] as [number, number]);
  }, [waypoints]);

  const departureWaypoint = waypoints.find(w => w.type === 'departure');
  const arrivalWaypoint = waypoints.find(w => w.type === 'arrival');

  // Calculate totals
  const totalDistance = useMemo(() => {
    return legs.reduce((sum, leg) => sum + leg.distanceNM, 0);
  }, [legs]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center: [-15.0, -47.0], // Brazil center
        zoom: 5,
        zoomControl: true,
      });

      // OpenStreetMap base layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.off();
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Handle IFR Low layer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (showIfrLow) {
      if (!ifrLowLayerRef.current) {
        // Try OpenAIP first, with error handling
        ifrLowLayerRef.current = L.tileLayer(IFR_LAYERS.ifrLow, {
          opacity: ifrOpacity[0],
          maxZoom: 12,
          attribution: 'Charts © OpenAIP',
          crossOrigin: 'anonymous',
          errorTileUrl: '',
          // Add retry logic
          maxNativeZoom: 12,
        }).addTo(map);

        // Log if tiles fail to load (for debugging)
        ifrLowLayerRef.current.on('tileerror', () => {
          console.warn('IFR Low tiles failed to load. OpenAIP may be unavailable.');
        });
      }
    } else {
      if (ifrLowLayerRef.current) {
        ifrLowLayerRef.current.remove();
        ifrLowLayerRef.current = null;
      }
    }
  }, [showIfrLow]);

  // Handle IFR High layer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (showIfrHigh) {
      if (!ifrHighLayerRef.current) {
        // Try OpenAIP first, with error handling
        ifrHighLayerRef.current = L.tileLayer(IFR_LAYERS.ifrHigh, {
          opacity: ifrOpacity[0],
          maxZoom: 12,
          attribution: 'Charts © OpenAIP',
          crossOrigin: 'anonymous',
          errorTileUrl: '',
          // Add retry logic
          maxNativeZoom: 12,
        }).addTo(map);

        // Log if tiles fail to load (for debugging)
        ifrHighLayerRef.current.on('tileerror', () => {
          console.warn('IFR High tiles failed to load. OpenAIP may be unavailable.');
        });
      }
    } else {
      if (ifrHighLayerRef.current) {
        ifrHighLayerRef.current.remove();
        ifrHighLayerRef.current = null;
      }
    }
  }, [showIfrHigh]);

  // Update opacity
  useEffect(() => {
    if (ifrLowLayerRef.current) {
      ifrLowLayerRef.current.setOpacity(ifrOpacity[0]);
    }
    if (ifrHighLayerRef.current) {
      ifrHighLayerRef.current.setOpacity(ifrOpacity[0]);
    }
  }, [ifrOpacity]);

  // Update markers and route
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Add waypoint markers
    waypoints.forEach((wp) => {
      const marker = L.marker([wp.lat, wp.lng], {
        icon: createWaypointIcon(wp.type),
      }).addTo(map);

      marker.bindPopup(`
        <div style="text-align: center; font-family: monospace;">
          <div style="font-weight: bold; font-size: 14px; color: #0ea5e9;">${wp.icao}</div>
          <div style="font-size: 12px; color: #666;">${wp.name}</div>
          <div style="font-size: 10px; color: #888; margin-top: 4px;">
            ${wp.lat.toFixed(4)}°, ${wp.lng.toFixed(4)}°
          </div>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Add route polyline
    if (routePositions.length > 1) {
      polylineRef.current = L.polyline(routePositions, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.9,
        dashArray: '12, 6',
      }).addTo(map);
    }

    // Fit bounds
    if (waypoints.length > 1) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [100, 100] });
    } else if (waypoints.length === 1) {
      map.setView([waypoints[0].lat, waypoints[0].lng], 10);
    }
  }, [waypoints, routePositions]);

  // Handle DECEA Airways layer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (showDeceaAirways) {
      if (!deceaAirwaysLayerRef.current) {
        deceaAirwaysLayerRef.current = createDeceaAirwaysLayer().addTo(map);
        deceaAirwaysLayerRef.current.on('tileerror', () => {
          console.warn('DECEA Airways tiles failed to load.');
        });
      }
    } else {
      if (deceaAirwaysLayerRef.current) {
        deceaAirwaysLayerRef.current.remove();
        deceaAirwaysLayerRef.current = null;
      }
    }
  }, [showDeceaAirways]);

  // Handle DECEA Aerodromes layer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (showDeceaAerodromes) {
      if (!deceaAerodromesLayerRef.current) {
        deceaAerodromesLayerRef.current = createDeceaAerodromesLayer().addTo(map);
        deceaAerodromesLayerRef.current.on('tileerror', () => {
          console.warn('DECEA Aerodromes tiles failed to load.');
        });
      }
    } else {
      if (deceaAerodromesLayerRef.current) {
        deceaAerodromesLayerRef.current.remove();
        deceaAerodromesLayerRef.current = null;
      }
    }
  }, [showDeceaAerodromes]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />

      {/* Top Action Bar */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2 max-w-xs">
        {/* Flight Rules Badge */}
        <div className="flex justify-end gap-2">
          <Badge className={`${isIFR ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'} border`}>
            {flightTypeLabel}
          </Badge>
          {aircraftRegistration && (
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {aircraftRegistration}
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {onBack && (
            <Button
              onClick={onBack}
              variant="secondary"
              className="w-full bg-slate-900/95 hover:bg-slate-800 text-white border-slate-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Formulário
            </Button>
          )}

          <Button
            onClick={() => {
              toast.success('Plano de voo salvo com sucesso!');
              onSavePlan?.();
            }}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Plano
          </Button>

          <Button
            onClick={() => setShowRouteMetar(!showRouteMetar)}
            variant={showRouteMetar ? "default" : "outline"}
            className={`w-full ${showRouteMetar ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-slate-900/95 hover:bg-slate-800 text-white border-slate-700'}`}
          >
            <Cloud className="h-4 w-4 mr-2" />
            {showRouteMetar ? 'Ocultar METAR' : 'Ver Meteorologia'}
          </Button>
        </div>
      </div>

      {/* Charts Buttons - SID/STAR/IAC */}
      {(onOpenDepartureCharts || onOpenArrivalCharts) && (
        <div className="absolute top-48 right-4 z-[1000] space-y-2">
          {onOpenDepartureCharts && departureWaypoint && (
            <Button
              onClick={onOpenDepartureCharts}
              size="sm"
              variant="outline"
              className="w-full bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              SID {departureWaypoint.icao}
            </Button>
          )}
          {onOpenArrivalCharts && arrivalWaypoint && (
            <Button
              onClick={onOpenArrivalCharts}
              size="sm"
              variant="outline"
              className="w-full bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              STAR/IAC {arrivalWaypoint.icao}
            </Button>
          )}
        </div>
      )}

      {/* Layers Control */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2">
        <Button
          onClick={() => setShowLayersPanel(!showLayersPanel)}
          variant="secondary"
          size="sm"
          className="bg-slate-900/95 hover:bg-slate-800 text-white border-slate-700"
        >
          <Layers className="h-4 w-4 mr-2" />
          Cartas IFR
        </Button>

        {showLayersPanel && (
          <Card className="mt-2 p-4 bg-slate-900/95 backdrop-blur-sm border-slate-700/50 min-w-[280px]">
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Camadas e Tipo de Voo
            </h3>

            <div className="space-y-3">
              {/* Flight Rules Display */}
              <div className="p-2 rounded bg-slate-800/50 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Regra de Voo:</p>
                <Badge className={isIFR ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 border' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 border'}>
                  {isIFR ? 'IFR - Regras por Instrumentos' : 'VFR - Regras Visuais'}
                </Badge>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-300">IFR Low Enroute</Label>
                    <Switch
                      checked={showIfrLow}
                      onCheckedChange={setShowIfrLow}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-300">IFR High Enroute</Label>
                    <Switch
                      checked={showIfrHigh}
                      onCheckedChange={setShowIfrHigh}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                  🛰️ DECEA - Espaço Aéreo Brasileiro
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-300">Rotas Aéreas (ENR)</Label>
                    <Switch
                      checked={showDeceaAirways}
                      onCheckedChange={setShowDeceaAirways}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-300">Aeródromos</Label>
                    <Switch
                      checked={showDeceaAerodromes}
                      onCheckedChange={setShowDeceaAerodromes}
                    />
                  </div>
                </div>
              </div>

              {(showIfrLow || showIfrHigh) && (
                <div className="pt-2 border-t border-slate-700">
                  <Label className="text-xs text-slate-400 mb-2 block">
                    Opacidade: {Math.round(ifrOpacity[0] * 100)}%
                  </Label>
                  <Slider
                    value={ifrOpacity}
                    onValueChange={setIfrOpacity}
                    min={0.1}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-700 space-y-2">
                <div>
                  <p className="text-[10px] text-slate-500">
                    Cartas OpenAIP: openaip.net
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Se as cartas não carregar, verifique sua conexão
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">
                    DECEA WMS: dados.decea.mil.br
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Dados oficiais do espaço aéreo brasileiro
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Weather Cards */}
      <div className="absolute bottom-4 left-4 z-[1000] space-y-2">
        {departureWaypoint && (
          <WeatherCard icao={departureWaypoint.icao} label="Partida" position="left" />
        )}
        {arrivalWaypoint && (
          <WeatherCard icao={arrivalWaypoint.icao} label="Destino" position="left" />
        )}
      </div>

      {/* Route METAR Panel */}
      {showRouteMetar && route && (
        <div className="absolute top-24 left-4 z-[1000]">
          <RouteMetarPanel route={route} isOffline={isOffline} />
        </div>
      )}

      {/* Route Info Panel */}
      {legs.length > 0 && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <Card className="p-3 bg-slate-900/95 backdrop-blur-sm border-slate-700/50 max-w-xs">
            <div className="text-[10px] uppercase text-slate-400 font-bold mb-2 flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Informações da Rota
            </div>

            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Distância Total:</span>
                <span className="font-mono text-cyan-400 font-bold">{totalDistance.toFixed(0)} NM</span>
              </div>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-4">
                  <span className="font-mono text-primary">{leg.from} → {leg.to}</span>
                  <span className="font-mono text-white">
                    {formatBearing(leg.bearing)} {leg.distanceNM.toFixed(0)}nm
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default FlightPlanMap;
