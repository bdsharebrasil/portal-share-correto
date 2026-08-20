// @ts-nocheck
// lib/aviation.ts - ARQUIVO COMPLETO

// Aviation calculation utilities
export {
  calculateDistance,
  calculateDistanceNM,
  calculateMagneticHeading,
  calcularRumo,
  parseAerodromeCoordLatLng,
  parseAerodromeCoordString,
  parseDMSCoordinate,
  type LatLon,
} from '@/lib/geo';
import { calculateDistance, calculateMagneticHeading } from '@/lib/geo';

// Divide route into segments (30 min or 200 NM)
export function divideRoute(
  points: Array<{ lat: number; lon: number; name: string }>,
  cruiseSpeed: number = 250 // knots
): Array<{
  from: string;
  to: string;
  distance: number;
  heading: number;
  time: number;
}> {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
    const heading = calculateMagneticHeading(from.lat, from.lon, to.lat, to.lon);
    const time = (distance / cruiseSpeed) * 60; // minutes
    segments.push({
      from: from.name,
      to: to.name,
      distance: Math.round(distance * 10) / 10,
      heading,
      time: Math.round(time),
    });
  }
  return segments;
}

// =============================================================================
// NOTA: As funções de meteorologia (METAR/TAF) foram migradas para:
// src/services/aiswebWeather.ts
// Use: import { fetchAISWebMETAR, fetchAISWebTAF } from '@/services/aiswebWeather'
// =============================================================================


// Types para AISWeb
export interface NOTAMData {
  id: string;
  icao: string;
  number: string;
  type: string;
  category: string;
  traffic: string;
  purpose: string;
  scope: string;
  lower: string;
  upper: string;
  coordinates: string | null;
  radius: number | null;
  message: string;
  startDate: string;
  endDate: string;
  schedule: string | null;
  created: string;
  source: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ROTAERData {
  icao: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  type: string;
  coordinates: { lat: number; lng: number };
  elevation: number;
  runways: Array<{
    designator: string;
    length: number;
    width: number;
    surface: string;
    strength: string;
  }>;
  frequencies: Array<{
    type: string;
    frequency: string;
  }>;
  navaids: Array<{
    type: string;
    identifier: string;
    frequency: string;
  }>;
  services: {
    fuel: boolean;
    hangar: boolean;
    maintenance: boolean;
    customs: boolean;
  };
  operatingHours: string;
  restrictions: string[];
  contact?: {
    phone?: string;
    email?: string;
  };
}

// Validar se aeródromo está operacional
export function isAerodromeOperational(notams: NOTAMData[]): {
  operational: boolean;
  reason: string | null;
  criticalNOTAMs: NOTAMData[];
  warnings?: string[];
} {
  const criticalNOTAMs = notams.filter(n => n.priority === 'critical');

  for (const notam of criticalNOTAMs) {
    const msg = notam.message.toLowerCase();
    if (msg.includes('closed') || msg.includes('fechado')) {
      return {
        operational: false,
        reason: notam.message,
        criticalNOTAMs,
      };
    }
  }

  return {
    operational: true,
    reason: null,
    criticalNOTAMs,
  };
}
