import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, LayersControl, WMSTileLayer } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Play, Pause, RotateCcw } from 'lucide-react';
import { WeatherPanel } from './WeatherPanel';
import type { AISWebMETARData } from '@/services/aiswebWeather';
import type { RoutePoint } from './FlightRouteMap';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const OPEN_AIP_KEY = 'b242e3e6b5e7b1a0e0a4117a042ce3e5';
const DECEA_WMS_URL = 'https://geoaisweb.decea.mil.br/geoserver/ICA/wms';

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

const MapContainerAny = MapContainer as any;
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
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);

  const routePositions = useMemo(() => {
    return waypoints.filter(w => w.tipo !== 'alternate').map(w => [w.lat, w.lng] as [number, number]);
  }, [waypoints]);

  const alternateRoute = useMemo((): [number, number][] => {
    const arrival = waypoints.find(w => w.tipo === 'arrival');
    const alt = waypoints.find(w => w.tipo === 'alternate');
    if (arrival && alt) return [[arrival.lat, arrival.lng], [alt.lat, alt.lng]];
    return [];
  }, [waypoints]);

  // Simulation
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
  const departure = waypoints.find(w => w.tipo === 'departure');
  const arrival = waypoints.find(w => w.tipo === 'arrival');

  return (
    <div className="relative w-full h-full">
      <MapContainerAny center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }} className="z-0">
        <LayersControl position="topright">
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

          <LayersControl.Overlay checked name="openAIP Aeronautical">
            <TileLayerAny
              url={`https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${OPEN_AIP_KEY}`}
              attribution="&copy; openAIP"
              zIndex={1000}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Carta WAC (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers="ICA:cartas_wac" format="image/png" transparent version="1.1.1" attribution="© DECEA" />
          </LayersControl.Overlay>
          <LayersControl.Overlay name="Corredores REA (DECEA)">
            <WMSTileLayerAny url={DECEA_WMS_URL} layers="ICA:cartas_rea" format="image/png" transparent version="1.1.1" attribution="© DECEA" />
          </LayersControl.Overlay>
        </LayersControl>

        {hasRoute && <FitBounds waypoints={waypoints} />}

        {/* Main route */}
        {routePositions.length > 1 && (
          <Polyline positions={routePositions} pathOptions={{ color: '#ff00ff', weight: 3, dashArray: '10, 5', opacity: 0.8 }} />
        )}

        {/* Alternate route */}
        {alternateRoute.length > 0 && (
          <Polyline positions={alternateRoute} pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '5, 10', opacity: 0.6 }} />
        )}

        {/* Waypoint markers */}
        {waypoints.map((wp, index) => (
          <MarkerAny key={`${wp.icao}-${index}`} position={[wp.lat, wp.lng]} icon={createWaypointIcon(wp.tipo)}>
            <Popup>
              <div className="font-mono font-bold text-primary">{wp.icao}</div>
              <div className="text-sm text-muted-foreground">{wp.nome}</div>
              <div className="text-xs capitalize">{wp.tipo === 'departure' ? 'Partida' : wp.tipo === 'arrival' ? 'Destino' : wp.tipo === 'alternate' ? 'Alternativa' : 'Waypoint'}</div>
            </Popup>
          </MarkerAny>
        ))}

        {/* Plane during simulation */}
        {planePosition && (
          <MarkerAny position={[planePosition.lat, planePosition.lng]} icon={createPlaneIcon(planePosition.bearing)} />
        )}
      </MapContainerAny>

      {/* Simulation Controls */}
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

      {/* Weather panels */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2 max-w-xs">
        {departure && (
          <WeatherPanel weather={originWeather} label="Partida" icao={departure.icao} loading={loadingWeather} error={weatherError} />
        )}
        {arrival && (
          <WeatherPanel weather={destWeather} label="Destino" icao={arrival.icao} loading={loadingWeather} />
        )}
      </div>

      {/* Leg Info Overlay */}
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
