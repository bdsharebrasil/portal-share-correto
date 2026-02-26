import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cloud, Eye, Wind, Waves, Droplets, Gauge, Thermometer } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Fix for default marker icons in Leaflet
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

interface FlightRouteMapProProps {
  points: RoutePoint[];
  flightData?: {
    altitude?: number;
    speed?: number;
    heading?: number;
    temperature?: number;
    pressure?: number;
    windSpeed?: number;
    windDirection?: number;
    rpmEngine?: number;
    fuelFlow?: number;
  };
  className?: string;
}

type MapBackground = 'dark' | 'satellite' | 'street' | 'topographic';
type ToolsTab = 'weather' | 'backgrounds' | 'symbols';

// Aircraft marker icon SVG
const createAircraftIcon = (heading: number = 0, color: string = '#ef4444') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" transform="rotate(${heading})">
      <path d="M12 2L4 20h16L12 2z" fill="${color}" stroke="white" stroke-width="0.5"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'aircraft-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Waypoint marker icon
const createWaypointIcon = (color: string = '#3b82f6') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
      <rect x="3" y="3" width="18" height="18" fill="none" stroke="${color}" stroke-width="2" rx="2"/>
      <circle cx="12" cy="12" r="3" fill="${color}"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'waypoint-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// Aerodrome marker icon (departure/arrival)
const createAerodromeIcon = (type: 'departure' | 'arrival', color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
      <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="1.5"/>
      ${type === 'departure' ? '<path d="M12 8v8M8 12h8" stroke="white" stroke-width="2"/>': '<path d="M12 8l4 4l-4 4l-4-4z" fill="white"/>'}
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'aerodrome-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// Get icon based on point type
const getMarkerIcon = (type: RoutePoint['type'], heading: number = 0) => {
  switch (type) {
    case 'departure':
      return createAerodromeIcon('departure', '#22c55e');
    case 'arrival':
      return createAerodromeIcon('arrival', '#ef4444');
    case 'alternate':
      return createAerodromeIcon('arrival', '#f59e0b');
    case 'waypoint':
      return createWaypointIcon('#06b6d4');
    default:
      return createAircraftIcon(heading, '#3b82f6');
  }
};

// Map tile layers configuration
const mapLayers: Record<MapBackground, { url: string; attribution: string; label: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors',
    label: 'Dark Mode',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    label: 'Satellite',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    label: 'Street',
  },
  topographic: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
    label: 'Topographic',
  },
};

// Fit bounds component
function FitBounds({ points }: { points: RoutePoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as LatLngExpression));
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [map, points]);

  return null;
}

// Type workaround for react-leaflet
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;

export const FlightRouteMapPro: React.FC<FlightRouteMapProProps> = ({
  points,
  flightData,
  className = '',
}) => {
  const [mapBackground, setMapBackground] = useState<MapBackground>('dark');
  const [activeTab, setActiveTab] = useState<ToolsTab>('weather');
  const [overlays, setOverlays] = useState({
    pressure: true,
    temperature: false,
    trs: false,
    wind: false,
    wavesCurrent: false,
  });

  const center = useMemo((): LatLngExpression => {
    if (points.length === 0) return [-15.79, -47.88];
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [points]);

  const routeCoordinates = useMemo((): LatLngExpression[] => {
    return points.filter(p => p.type !== 'alternate').map(p => [p.lat, p.lng] as LatLngExpression);
  }, [points]);

  const alternateRoute = useMemo((): LatLngExpression[] => {
    const arrival = points.find(p => p.type === 'arrival');
    const alternate = points.find(p => p.type === 'alternate');
    if (arrival && alternate) {
      return [[arrival.lat, arrival.lng], [alternate.lat, alternate.lng]] as LatLngExpression[];
    }
    return [];
  }, [points]);

  if (points.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 rounded-lg h-96 ${className}`}>
        <p className="text-slate-400">Selecione origem e destino para visualizar a rota</p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-slate-900 ${className}`}>
      {/* Left Panel - Tools */}
      <div className="w-64 bg-slate-950 border-r border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">Tools</h2>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ToolsTab)} className="flex-1 flex flex-col">
          <TabsList className="w-full bg-slate-800 border-b border-slate-700 rounded-none">
            <TabsTrigger value="weather" className="text-xs">
              <Cloud className="w-4 h-4 mr-1" />
              Weather
            </TabsTrigger>
            <TabsTrigger value="backgrounds" className="text-xs">
              <Eye className="w-4 h-4 mr-1" />
              Backgrounds
            </TabsTrigger>
            <TabsTrigger value="symbols" className="text-xs">
              <Gauge className="w-4 h-4 mr-1" />
              Symbols
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Weather Tab */}
            <TabsContent value="weather" className="space-y-3">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Backgrounds</h3>
                <div className="space-y-2">
                  {[
                    { checked: overlays.pressure, label: 'Pressure', value: 'pressure' },
                    { checked: overlays.temperature, label: 'Temperature', value: 'temperature' },
                    { checked: overlays.trs, label: 'TRS', value: 'trs' },
                  ].map((item) => (
                    <div key={item.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={item.value}
                        checked={item.checked}
                        onCheckedChange={(checked) =>
                          setOverlays({ ...overlays, [item.value]: checked })
                        }
                        className="border-slate-500"
                      />
                      <label htmlFor={item.value} className="text-sm text-slate-300 cursor-pointer">
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Backgrounds Tab */}
            <TabsContent value="backgrounds" className="space-y-3">
              <div className="space-y-2">
                {Object.entries(mapLayers).map(([key]) => (
                  <button
                    key={key}
                    onClick={() => setMapBackground(key as MapBackground)}
                    className={cn(
                      'w-full px-3 py-2 rounded text-sm text-left transition-colors capitalize',
                      mapBackground === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* Symbols Tab */}
            <TabsContent value="symbols" className="space-y-3">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Symbols</h3>
                {[
                  { checked: overlays.pressure, label: 'Pressure', value: 'pressure' },
                  { checked: overlays.temperature, label: 'Temperature', value: 'temperature' },
                  { checked: overlays.trs, label: 'TRS', value: 'trs' },
                  { checked: overlays.wind, label: 'Wind', value: 'wind' },
                  { checked: overlays.wavesCurrent, label: 'Waves, Current', value: 'wavesCurrent' },
                ].map((item) => (
                  <div key={item.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`sym-${item.value}`}
                      checked={item.checked}
                      onCheckedChange={(checked) =>
                        setOverlays({ ...overlays, [item.value]: checked })
                      }
                      className="border-slate-500"
                    />
                    <label htmlFor={`sym-${item.value}`} className="text-sm text-slate-300 cursor-pointer">
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Center - Map */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 rounded-lg overflow-hidden">
          <MapContainerAny
            center={center}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayerAny
              url={mapLayers[mapBackground].url}
              attribution={mapLayers[mapBackground].attribution}
            />
            <FitBounds points={points} />

            {/* Main Route */}
            {routeCoordinates.length > 1 && (
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: '#ef4444',
                  weight: 3,
                  opacity: 0.9,
                  dashArray: '8, 4',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}

            {/* Alternate Route */}
            {alternateRoute.length > 0 && (
              <Polyline
                positions={alternateRoute}
                pathOptions={{
                  color: '#f59e0b',
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '4, 8',
                  lineCap: 'round',
                }}
              />
            )}

            {/* Markers */}
            {points.map((point, index) => (
              <MarkerAny
                key={`${point.icao}-${index}`}
                position={[point.lat, point.lng] as LatLngExpression}
                icon={getMarkerIcon(point.type, flightData?.heading || 0)}
              >
                <Popup>
                  <div className="text-slate-900 min-w-max">
                    <strong className="text-lg">{point.icao}</strong>
                    <p className="text-sm">{point.name}</p>
                    <p className="text-xs text-slate-600 capitalize">{point.type}</p>
                  </div>
                </Popup>
              </MarkerAny>
            ))}
          </MapContainerAny>
        </div>
      </div>

      {/* Right Panel - Flight Data */}
      <div className="w-72 bg-slate-950 border-l border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">Flight Data</h2>
        </div>

        <div className="p-4 space-y-4">
          {flightData && (
            <>
              {/* Altitude */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-slate-300 text-sm">
                    <Badge className="bg-blue-600 mr-2">ALT</Badge>
                    Altitude
                  </div>
                  <span className="text-white font-bold text-lg">
                    {flightData.altitude?.toLocaleString() || '—'}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded h-1">
                  <div
                    className="bg-blue-500 h-1 rounded"
                    style={{
                      width: `${Math.min(100, (flightData.altitude || 0) / 50)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Speed */}
              <Card className="bg-slate-800 border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300 text-sm">Speed</span>
                  <span className="text-white font-bold">{flightData.speed || '—'} kts</span>
                </div>
                <div className="text-xs text-slate-400">Ground Speed</div>
              </Card>

              {/* Engine Data */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-slate-800 border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Gauge className="w-4 h-4 text-orange-400" />
                    <span className="text-white font-bold">{flightData.rpmEngine || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-400">RPM</div>
                </Card>

                <Card className="bg-slate-800 border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Droplets className="w-4 h-4 text-green-400" />
                    <span className="text-white font-bold">{flightData.fuelFlow || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-400">Fuel Flow</div>
                </Card>
              </div>

              {/* Temperature & Pressure */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-slate-800 border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Thermometer className="w-4 h-4 text-red-400" />
                    <span className="text-white font-bold">{flightData.temperature || '—'}°</span>
                  </div>
                  <div className="text-xs text-slate-400">Temp</div>
                </Card>

                <Card className="bg-slate-800 border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Gauge className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-bold">{flightData.pressure || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-400">Press.</div>
                </Card>
              </div>

              {/* Wind */}
              <Card className="bg-slate-800 border-slate-700 p-3">
                <div className="flex items-center justify-between mb-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-bold">
                    {flightData.windSpeed || '—'} kts @ {flightData.windDirection || '—'}°
                  </span>
                </div>
                <div className="text-xs text-slate-400">Wind</div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlightRouteMapPro;
