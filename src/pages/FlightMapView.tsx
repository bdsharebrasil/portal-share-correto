// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlightRouteMap as FlightRouteMapPro, type RoutePoint } from '@/components/plano-voo/FlightRouteMap';
import { useAerodromes, type Aerodromo } from '@/hooks/useAerodromes';
import { useAeronaves } from '@/hooks/useAeronaves';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Parse coordenadas do banco de dados
function parseCoordinates(coordStr: string | null): {
  lat: number;
  lng: number;
} | null {
  if (!coordStr) return null;

  // Formato decimal: "-23.5505,-46.6333"
  if (coordStr.includes(',') && !coordStr.includes(' ')) {
    const [lat, lng] = coordStr.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // Formato DMS: "42 47 34.95 W 4 57 33.97 S"
  const dmsRegex = /(\d+)\s+(\d+)\s+([\d.]+)\s*([NSEW])\s+(\d+)\s+(\d+)\s+([\d.]+)\s*([NSEW])/i;
  const match = coordStr.match(dmsRegex);
  if (match) {
    let lng = parseInt(match[1]) + parseInt(match[2]) / 60 + parseFloat(match[3]) / 3600;
    let lat = parseInt(match[5]) + parseInt(match[6]) / 60 + parseFloat(match[7]) / 3600;
    if (match[4].toUpperCase() === 'W') lng = -lng;
    if (match[8].toUpperCase() === 'S') lat = -lat;
    return { lat, lng };
  }
  return null;
}

interface FlightMapViewProps {
  origin?: string;
  destination?: string;
  alternate?: string;
  altitude?: number;
  speed?: number;
  temperature?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  heading?: number;
}

export default function FlightMapViewPage() {
  const navigate = useNavigate();
  const { aerodromes } = useAerodromes();
  const { aeronaves } = useAeronaves();

  const getAerodromeByCode = useCallback((code: string): Aerodromo | undefined => {
    return aerodromes.find(a => a.designativo === code);
  }, [aerodromes]);

  const [flightData] = useState<FlightMapViewProps>({
    origin: 'SBSP',
    destination: 'SBVT',
    alternate: 'SBRJ',
    altitude: 6000,
    speed: 120,
    temperature: -5,
    pressure: 29.92,
    windSpeed: 15,
    windDirection: 180,
    heading: 45,
  });

  const routePoints = useMemo((): RoutePoint[] => {
    const points: RoutePoint[] = [];

    if (flightData.origin) {
      const originAerodrome = getAerodromeByCode(flightData.origin);
      if (originAerodrome) {
        const coords = parseCoordinates(originAerodrome.coordenadas);
        if (coords) {
          points.push({
            icao: originAerodrome.designativo,
            name: originAerodrome.name,
            lat: coords.lat,
            lng: coords.lng,
            type: 'departure',
          });
        }
      }
    }

    if (flightData.destination) {
      const destAerodrome = getAerodromeByCode(flightData.destination);
      if (destAerodrome) {
        const coords = parseCoordinates(destAerodrome.coordenadas);
        if (coords) {
          points.push({
            icao: destAerodrome.designativo,
            name: destAerodrome.name,
            lat: coords.lat,
            lng: coords.lng,
            type: 'arrival',
          });
        }
      }
    }

    if (flightData.alternate) {
      const altAerodrome = getAerodromeByCode(flightData.alternate);
      if (altAerodrome) {
        const coords = parseCoordinates(altAerodrome.coordenadas);
        if (coords) {
          points.push({
            icao: altAerodrome.designativo,
            name: altAerodrome.name,
            lat: coords.lat,
            lng: coords.lng,
            type: 'alternate',
          });
        }
      }
    }

    return points;
  }, [flightData, getAerodromeByCode]);

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-700 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-white font-semibold">Flight Map</h1>
            <p className="text-xs text-slate-400">
              {flightData.origin} → {flightData.destination}
              {flightData.alternate && ` | ALT: ${flightData.alternate}`}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <FlightRouteMapPro
          points={routePoints}
          className="h-full"
        />
      </div>
    </div>
  );
}