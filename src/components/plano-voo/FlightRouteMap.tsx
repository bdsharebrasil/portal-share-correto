import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Vite
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

interface FlightRouteMapProps {
  points: RoutePoint[];
  className?: string;
}

// Custom marker icons
const createIcon = (color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const departureIcon = createIcon('#22c55e');
const arrivalIcon = createIcon('#ef4444');
const alternateIcon = createIcon('#f59e0b');
const waypointIcon = createIcon('#3b82f6');

const getMarkerIcon = (type: RoutePoint['type']) => {
  switch (type) {
    case 'departure':
      return departureIcon;
    case 'arrival':
      return arrivalIcon;
    case 'alternate':
      return alternateIcon;
    default:
      return waypointIcon;
  }
};

// Component to fit bounds
function FitBounds({ points }: { points: RoutePoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as LatLngExpression));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);

  return null;
}

// Type workaround for react-leaflet version compatibility
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;

export const FlightRouteMap: React.FC<FlightRouteMapProps> = ({ points, className = '' }) => {
  const center = useMemo((): LatLngExpression => {
    if (points.length === 0) return [-15.79, -47.88]; // Brasília default
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [points]);

  const routeCoordinates = useMemo((): LatLngExpression[] => {
    return points
      .filter(p => p.type !== 'alternate')
      .map(p => [p.lat, p.lng] as LatLngExpression);
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
      <div className={`flex items-center justify-center bg-slate-800/50 rounded-lg ${className}`}>
        <p className="text-slate-400 text-sm">Selecione origem e destino para visualizar a rota</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      <MapContainerAny
        center={center}
        zoom={6}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        className="z-0"
      >
        <TileLayerAny
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <FitBounds points={points} />

        {/* Main route line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#22d3ee',
              weight: 3,
              opacity: 0.8,
              dashArray: '10, 5',
            }}
          />
        )}

        {/* Alternate route line */}
        {alternateRoute.length > 0 && (
          <Polyline
            positions={alternateRoute}
            pathOptions={{
              color: '#f59e0b',
              weight: 2,
              opacity: 0.6,
              dashArray: '5, 10',
            }}
          />
        )}

        {/* Markers */}
        {points.map((point, index) => (
          <MarkerAny
            key={`${point.icao}-${index}`}
            position={[point.lat, point.lng] as LatLngExpression}
            icon={getMarkerIcon(point.type)}
          >
            <Popup>
              <div className="text-slate-900">
                <strong className="text-lg">{point.icao}</strong>
                <p className="text-sm">{point.name}</p>
                <p className="text-xs text-slate-600 capitalize">{point.type}</p>
              </div>
            </Popup>
          </MarkerAny>
        ))}
      </MapContainerAny>
    </div>
  );
};

export default FlightRouteMap;
