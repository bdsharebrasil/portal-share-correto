import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, LayersControl, WMSTileLayer } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Play, Pause, RotateCcw, FileText, ExternalLink, CloudSun, Map as MapIcon } from 'lucide-react';
import { WeatherPanel } from './WeatherPanel';
import { FloatingPanel } from './FloatingPanel';
import { ChartProjectionOverlay, type ChartProjectionItem } from './ChartProjectionOverlay';
import { DECEA_WMS_URL, WAC_LAYERS, REA_LAYERS, ARC_LAYERS, CNAV_LAYERS, AIRSPACE_LAYERS } from './deceaLayers';
import type { ChartData } from '@/services/chartsService';
import type { AISWebMETARData } from '@/services/aiswebWeather';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface RoutePoint {
  icao: string;
  name: string;
  lat: number;
  lng: number;
  type: 'departure' | 'arrival' | 'alternate' | 'waypoint';
}

interface LegCalc {
  from: string;
  to: string;
  distanceNM: number;
  bearing: number;
}

interface SkyVectorMapProps {
  waypoints: RoutePoint[];
  legs: LegCalc[];
  originWeather: AISWebMETARData | null;
  destWeather: AISWebMETARData | null;
  loadingWeather?: boolean;
  weatherError?: string | null;
  /**
   * Cartas já resolvidas por ICAO (maiúsculo), vindas de `useFlightIntelligence`.
   * O mapa NÃO busca cartas por conta própria — isso evitava um fetch duplicado
   * do mesmo dado que já é buscado uma vez lá em cima, em `PlanoVoo.tsx`.
   */
  charts: Record<string, ChartData[]>;
  chartsLoading?: boolean;
  chartsError?: string | null;
}

const createWaypointIcon = (type: 'departure' | 'arrival' | 'alternate' | 'waypoint') => {
  const colors = {
    departure: { fill: '#22c55e', stroke: '#16a34a', label: 'D' },
    arrival: { fill: '#ef4444', stroke: '#dc2626', label: 'A' },
    alternate: { fill: '#f59e0b', stroke: '#d97706', label: 'ALT' },
    waypoint: { fill: '#3b82f6', stroke: '#2563eb', label: 'W' },
  };
  const { fill, stroke, label } = colors[type];

  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <text x="14" y="18" text-anchor="middle" fill="white" font-size="${label.length > 1 ? '8' : '12'}" font-weight="bold">${label}</text>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const createPlaneIcon = (rotation: number) => {
  return L.divIcon({
    className: 'plane-marker',
    html: `<div style="transform:rotate(${rotation}deg);display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" stroke-width="0.5"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const FitBounds: React.FC<{ waypoints: RoutePoint[] }> = ({ waypoints }) => {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng] as LatLngExpression));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [waypoints, map]);
  return null;
};

const CHART_TYPE_LABEL: Record<ChartData['type'], string> = {
  SID: 'SID',
  STAR: 'STAR',
  APPROACH: 'Aprox.',
  DEPARTURE: 'Partida',
  IFR: 'IFR',
  VFR: 'VFR',
  IAP: 'IAP',
  AIRPORT: 'Aeródromo',
};

const ChartsList: React.FC<{
  icao: string;
  charts: ChartData[];
  loading: boolean;
  error: string | null;
  onProject: (chart: ChartProjectionItem) => void;
}> = ({ icao, charts, loading, error, onProject }) => {
  if (loading) return <div className="text-xs text-muted-foreground">Carregando cartas de {icao}...</div>;
  if (error) return <div className="text-xs text-destructive">Erro ao buscar cartas de {icao}: {error}</div>;
  if (charts.length === 0) return <div className="text-xs text-muted-foreground">Nenhuma carta encontrada para {icao}.</div>;

  return (
    <div className="space-y-1">
      {charts.map((chart, i) => (
        <div key={i} className="flex items-center justify-between gap-1 text-[11px]">
          <button
            type="button"
            disabled={!chart.url}
            onClick={() => onProject({ title: `${icao} · ${chart.title}`, url: chart.url, format: chart.format })}
            className={`flex-1 text-left truncate ${chart.url ? 'text-primary hover:underline' : 'text-muted-foreground'}`}
            title="Projetar carta sobre o mapa"
          >
            <span className="font-mono text-[9px] opacity-70 mr-1">[{CHART_TYPE_LABEL[chart.type]}]</span>
            {chart.title}
          </button>
          {chart.url && (
            <a href={chart.url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
              <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
};

const MapContainerAny = MapContainer as any;
const LayersControlAny = LayersControl as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const WMSTileLayerAny = WMSTileLayer as any;

export const SkyVectorMap: React.FC<SkyVectorMapProps> = ({
  waypoints,
  legs,
  originWeather,
  destWeather,
  loadingWeather,
  weatherError,
  charts,
  chartsLoading,
  chartsError,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [projectedChart, setProjectedChart] = useState<ChartProjectionItem | null>(null);

  // Todos os pontos não-alternativa, na ordem em que vêm de PlanoVoo.tsx:
  // partida -> waypoints intermediários resolvidos da rota -> destino.
  const routePositions = useMemo(() => {
    return waypoints.filter(w => w.type !== 'alternate').map(w => [w.lat, w.lng] as [number, number]);
  }, [waypoints]);

  const alternateRoute = useMemo((): [number, number][] => {
    const arrival = waypoints.find(w => w.type === 'arrival');
    const alt = waypoints.find(w => w.type === 'alternate');
    if (arrival && alt) return [[arrival.lat, arrival.lng], [alt.lat, alt.lng]];
    return [];
  }, [waypoints]);

  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 1) { setIsSimulating(false); return 0; }
        return prev + 0.005;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isSimulating]);

  const planePosition = useMemo(() => {
    if (routePositions.length < 2 || !isSimulating) return null;
    const totalSegments = routePositions.length - 1;
    const progressPerSegment = 1 / totalSegments;
    const currentSegment = Math.min(Math.floor(simulationProgress / progressPerSegment), totalSegments - 1);
    const segmentProgress = (simulationProgress - currentSegment * progressPerSegment) / progressPerSegment;
    const start = routePositions[currentSegment];
    const end = routePositions[currentSegment + 1];
    if (!start || !end) return null;
    const lat = start[0] + (end[0] - start[0]) * segmentProgress;
    const lng = start[1] + (end[1] - start[1]) * segmentProgress;
    const dLon = (end[1] - start[1]) * Math.PI / 180;
    const lat1 = start[0] * Math.PI / 180;
    const lat2 = end[0] * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { lat, lng, bearing };
  }, [routePositions, simulationProgress, isSimulating]);

  const defaultCenter: [number, number] = [-15.79, -47.88];
  const hasRoute = waypoints.length > 0;
  const departure = waypoints.find(w => w.type === 'departure');
  const arrival = waypoints.find(w => w.type === 'arrival');

  const departureCharts = {
    charts: charts[departure?.icao ?? ''] ?? [],
    loading: !!chartsLoading,
    error: chartsError ?? null,
  };
  const arrivalCharts = {
    charts: charts[arrival?.icao ?? ''] ?? [],
    loading: !!chartsLoading,
    error: chartsError ?? null,
  };

  return (
    <div className="relative w-full h-full">
      <MapContainerAny center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }} className="z-0">
        <LayersControlAny position="topright">
          <LayersControl.BaseLayer checked name="CartoDB Dark">
            <TileLayerAny url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayerAny url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite (Google)">
            <TileLayerAny url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terreno">
            <TileLayerAny url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="&copy; OpenTopoMap" />
          </LayersControl.BaseLayer>

          {/*
            IMPORTANTE: antes NENHUMA dessas overlays tinha `checked`, então as
            cartas do DECEA nunca apareciam por padrão — o usuário precisava
            abrir o controle de camadas manualmente e marcar cada uma.
            Deixamos Espaço Aéreo e WAC ligadas por padrão (mais relevantes e
            leves); REA/ARC/CNAV continuam opcionais para não sobrecarregar o
            mapa com várias camadas raster grandes ao mesmo tempo.
          */}
          <LayersControl.Overlay checked name="Espaço aéreo (CTR/CTA/ATZ/TMA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers={AIRSPACE_LAYERS} format="image/png" transparent version="1.1.1" attribution="© DECEA" opacity={0.7} zIndex={404} />
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name="Cartas WAC (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers={WAC_LAYERS} format="image/png" transparent version="1.1.1" attribution="© DECEA" opacity={0.9} zIndex={400} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Corredores Visuais / REA (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers={REA_LAYERS} format="image/png" transparent version="1.1.1" attribution="© DECEA" opacity={0.9} zIndex={401} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Cartas de Área ARC (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers={ARC_LAYERS} format="image/png" transparent version="1.1.1" attribution="© DECEA" opacity={0.9} zIndex={402} />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Cartas de Navegação CNAV (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers={CNAV_LAYERS} format="image/png" transparent version="1.1.1" attribution="© DECEA" opacity={0.9} zIndex={403} />
          </LayersControl.Overlay>
        </LayersControlAny>

        {hasRoute && <FitBounds waypoints={waypoints} />}

        {routePositions.length > 1 && (
          <Polyline positions={routePositions} pathOptions={{ color: '#ff00ff', weight: 3, dashArray: '10, 5', opacity: 0.8 }} />
        )}

        {alternateRoute.length > 0 && (
          <Polyline positions={alternateRoute} pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '5, 10', opacity: 0.6 }} />
        )}

        {waypoints.map((wp, index) => (
          <MarkerAny key={`${wp.icao}-${index}`} position={[wp.lat, wp.lng]} icon={createWaypointIcon(wp.type)}>
            <Popup>
              <div className="font-mono font-bold text-primary">{wp.icao}</div>
              <div className="text-sm text-muted-foreground">{wp.name}</div>
              <div className="text-xs capitalize">{wp.type === 'departure' ? 'Partida' : wp.type === 'arrival' ? 'Destino' : wp.type === 'alternate' ? 'Alternativa' : 'Waypoint'}</div>
            </Popup>
          </MarkerAny>
        ))}

        {planePosition && (
          <MarkerAny position={[planePosition.lat, planePosition.lng]} icon={createPlaneIcon(planePosition.bearing)} />
        )}
      </MapContainerAny>

      {hasRoute && routePositions.length > 1 && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Card className="p-3 bg-card/95 backdrop-blur-sm border-border">
            <div className="flex items-center gap-2">
              <Button size="sm" variant={isSimulating ? 'secondary' : 'default'} onClick={() => {
                if (simulationProgress >= 1) setSimulationProgress(0);
                setIsSimulating(prev => !prev);
              }}>
                {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsSimulating(false); setSimulationProgress(0); }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <div className="ml-2 text-sm text-foreground">
                <span className="text-muted-foreground">Progresso:</span>{' '}
                <span className="font-mono font-medium">{Math.round(simulationProgress * 100)}%</span>
              </div>
            </div>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-100" style={{ width: `${simulationProgress * 100}%` }} />
            </div>
          </Card>
        </div>
      )}

      {/* Painéis flutuantes arrastáveis. As cartas começam recolhidas para não
          ocupar o mapa automaticamente; o usuário expande pelo ícone. */}
      {departure && (
        <>
          <FloatingPanel
            id={`wx-dep`}
            title={`METAR ${departure.icao}`}
            icon={<CloudSun className="w-5 h-5 text-green-400" />}
            defaultPosition={{ x: 16, y: 16 }}
            defaultCollapsed={false}
          >
            <WeatherPanel weather={originWeather} label="Partida" icao={departure.icao} loading={loadingWeather} error={weatherError} />
          </FloatingPanel>
          <FloatingPanel
            id={`charts-dep`}
            title={`Cartas ${departure.icao}`}
            icon={<FileText className="w-5 h-5 text-green-400" />}
            defaultPosition={{ x: 16, y: 76 }}
            defaultCollapsed={true}
            width={280}
          >
            <ChartsList icao={departure.icao} {...departureCharts} onProject={setProjectedChart} />
          </FloatingPanel>
        </>
      )}
      {arrival && (
        <>
          <FloatingPanel
            id={`wx-arr`}
            title={`METAR ${arrival.icao}`}
            icon={<CloudSun className="w-5 h-5 text-red-400" />}
            defaultPosition={{ x: 76, y: 16 }}
            defaultCollapsed={false}
          >
            <WeatherPanel weather={destWeather} label="Destino" icao={arrival.icao} loading={loadingWeather} error={weatherError} />
          </FloatingPanel>
          <FloatingPanel
            id={`charts-arr`}
            title={`Cartas ${arrival.icao}`}
            icon={<FileText className="w-5 h-5 text-red-400" />}
            defaultPosition={{ x: 76, y: 76 }}
            defaultCollapsed={true}
            width={280}
          >
            <ChartsList icao={arrival.icao} {...arrivalCharts} onProject={setProjectedChart} />
          </FloatingPanel>
        </>
      )}

      {projectedChart && (
        <ChartProjectionOverlay chart={projectedChart} onClose={() => setProjectedChart(null)} />
      )}

      {legs.length > 0 && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <Card className="p-3 bg-card/95 backdrop-blur-sm border-border max-w-xs">
            <div className="text-[10px] uppercase text-muted-foreground font-bold mb-2 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Route Info
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-4">
                  <span className="font-mono text-primary">{leg.from}→{leg.to}</span>
                  <span className="font-mono text-foreground">
                    {Math.round(leg.bearing).toString().padStart(3, '0')}° {leg.distanceNM.toFixed(0)}nm
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
