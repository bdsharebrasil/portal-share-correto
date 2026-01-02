import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Wind, Thermometer, Eye, Cloud, Navigation, MapPin, X } from 'lucide-react';
import { useAviationWeather } from '@/hooks/useAviationWeather';
import { type Waypoint, type LegInfo, formatBearing } from '@/hooks/useFlightPlanCalcs';
import { WeatherMapSelector } from './WeatherMapSelector';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SkyVectorMapProps {
  waypoints: Waypoint[];
  legs: LegInfo[];
  mapboxToken?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

const OPEN_AIP_KEY = "b29d6c1253ac55cbf3fd1ee2abad70af";
const DECEA_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/ICA/wms";

// Custom plane icon
const createPlaneIcon = (rotation: number) => {
  return L.divIcon({
    className: 'plane-marker',
    html: `
      <div style="transform: rotate(${rotation}deg); display: flex; align-items: center; justify-content: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

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
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          <text x="14" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${label}</text>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};


// Weather panel component
const WeatherPanel: React.FC<{ icao: string | null; label: string }> = ({ icao, label }) => {
  const { metar, loading, error } = useAviationWeather(icao);

  if (!icao) return null;

  const getFlightCategoryColor = (category?: string) => {
    switch (category) {
      case 'VFR':
        return 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300';
      case 'MVFR':
        return 'bg-amber-500/30 border-amber-500/50 text-amber-300';
      case 'IFR':
        return 'bg-orange-500/30 border-orange-500/50 text-orange-300';
      case 'LIFR':
        return 'bg-red-500/30 border-red-500/50 text-red-300';
      default:
        return 'bg-slate-500/30 border-slate-500/50 text-slate-300';
    }
  };

  return (
    <Card className={`p-3 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 max-w-sm`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-cyan-400" />
          <div>
            <p className="font-semibold text-xs text-white">{label}</p>
            <p className="font-mono text-xs text-cyan-400">{icao}</p>
          </div>
        </div>
        {metar && (
          <span className={`text-xs px-2 py-1 rounded border font-semibold ${getFlightCategoryColor(metar.flightCategory)}`}>
            {metar.flightCategory || 'N/A'}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2">
          <div className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400">Carregando...</p>
        </div>
      )}
      {error && <p className="text-xs text-red-400">Erro: {error}</p>}

      {metar && (
        <div className="space-y-2 text-xs">
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
              <Cloud className="h-3 w-3 text-slate-400" />
              <span>{metar.altim.toFixed(2)} inHg</span>
            </div>
          </div>
          <div className="mt-2 p-2 bg-slate-950/70 rounded text-[10px] font-mono break-all text-slate-400 border border-slate-700/30 max-h-20 overflow-y-auto">
            {metar.rawOb}
          </div>
        </div>
      )}
    </Card>
  );
};

export const SkyVectorMap: React.FC<SkyVectorMapProps> = ({
  waypoints,
  legs,
  onMapClick,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [showWeatherMap, setShowWeatherMap] = useState(false);

  const routePositions = useMemo(() => {
    return waypoints.map(w => [w.lat, w.lng] as [number, number]);
  }, [waypoints]);

  // Simulation animation
  useEffect(() => {
    if (!isSimulating) return;
    
    const interval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 1) {
          setIsSimulating(false);
          return 0;
        }
        return prev + 0.005;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Calculate plane position based on simulation progress
  const planePosition = useMemo(() => {
    if (routePositions.length < 2 || !isSimulating) return null;
    
    const totalSegments = routePositions.length - 1;
    const progressPerSegment = 1 / totalSegments;
    const currentSegment = Math.min(
      Math.floor(simulationProgress / progressPerSegment),
      totalSegments - 1
    );
    const segmentProgress = (simulationProgress - currentSegment * progressPerSegment) / progressPerSegment;
    
    const start = routePositions[currentSegment];
    const end = routePositions[currentSegment + 1];
    
    if (!start || !end) return null;
    
    const lat = start[0] + (end[0] - start[0]) * segmentProgress;
    const lng = start[1] + (end[1] - start[1]) * segmentProgress;
    
    // Calculate bearing for plane rotation
    const dLon = (end[1] - start[1]) * Math.PI / 180;
    const lat1 = start[0] * Math.PI / 180;
    const lat2 = end[0] * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    return { lat, lng, bearing };
  }, [routePositions, simulationProgress, isSimulating]);

  const defaultCenter: [number, number] = [-23.5, -46.6];
  const hasRoute = waypoints.length > 0;
  const departure = waypoints.find(w => w.type === 'departure');
  const arrival = waypoints.find(w => w.type === 'arrival');

  const handleToggleSimulation = () => {
    if (simulationProgress >= 1) {
      setSimulationProgress(0);
    }
    setIsSimulating(prev => !prev);
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimulationProgress(0);
  };

  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapRef = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<L.Marker[]>([]);
  const polylineRef = React.useRef<L.Polyline | null>(null);
  const planeMarkerRef = React.useRef<L.Marker | null>(null);

  // Initialize map only once
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 6,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Handle click events
      if (onMapClick) {
        map.on('click', (e) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        });
      }

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

  // Update markers and route when waypoints change
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
        <div style="text-align: center;">
          <div style="font-family: monospace; font-weight: bold; font-size: 14px;">${wp.icao}</div>
          <div style="font-size: 12px; color: #666;">${wp.name}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">
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

    // Fit bounds to show all waypoints
    if (waypoints.length > 1) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [80, 80] });
    } else if (waypoints.length === 1) {
      map.setView([waypoints[0].lat, waypoints[0].lng], 10);
    }
  }, [waypoints, routePositions, onMapClick]);

  // Update plane marker during simulation
  useEffect(() => {
    if (!leafletMapRef.current) return;

    const map = leafletMapRef.current;

    // Remove existing plane marker
    if (planeMarkerRef.current) {
      planeMarkerRef.current.remove();
      planeMarkerRef.current = null;
    }

    // Add plane marker if simulating
    if (planePosition) {
      planeMarkerRef.current = L.marker([planePosition.lat, planePosition.lng], {
        icon: createPlaneIcon(planePosition.bearing),
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [planePosition]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '600px' }}
      />

      {/* Simulation Controls */}
      {hasRoute && routePositions.length > 1 && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Card className="p-3 bg-surface-dark/95 backdrop-blur-sm border-border-dark">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isSimulating ? "secondary" : "default"}
                onClick={handleToggleSimulation}
              >
                {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetSimulation}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <div className="ml-2 text-sm text-white">
                <span className="text-text-secondary">Progresso:</span>{' '}
                <span className="font-mono font-medium">{Math.round(simulationProgress * 100)}%</span>
              </div>
            </div>
            <div className="mt-2 h-1 bg-border-dark rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${simulationProgress * 100}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Weather panels */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2 max-w-xs">
        {departure && (
          <WeatherPanel icao={departure.icao} label="Partida" />
        )}
        {arrival && (
          <WeatherPanel icao={arrival.icao} label="Destino" />
        )}

        {/* Weather Map Toggle Button */}
        {!showWeatherMap && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowWeatherMap(true)}
            className="w-full bg-slate-900/95 backdrop-blur-sm border-slate-700/50 hover:bg-slate-800"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Mapa de Clima
          </Button>
        )}
      </div>

      {/* Leg Info Overlay */}
      {legs.length > 0 && waypoints.length >= 2 && (
        <div className="absolute bottom-4 right-4 z-[1000]">
          <Card className="p-3 bg-surface-dark/95 backdrop-blur-sm border-border-dark max-w-xs">
            <div className="text-[10px] uppercase text-text-secondary font-bold mb-2 flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Route Info
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-4">
                  <span className="font-mono text-primary">{leg.from}→{leg.to}</span>
                  <span className="font-mono text-white">
                    {formatBearing(leg.bearing)} {leg.distanceNM.toFixed(0)}nm
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Weather Map Panel */}
      {showWeatherMap && (
        <div className="absolute inset-4 z-[1100] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Mapa de Clima - AviationWeather</h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowWeatherMap(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700/50 overflow-hidden p-4">
            <WeatherMapSelector
              lat={departure?.lat}
              lng={departure?.lng}
              zoom={6}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SkyVectorMap;
