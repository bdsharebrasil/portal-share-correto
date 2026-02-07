// lib/aviation.ts - ARQUIVO COMPLETO

// Aviation calculation utilities

// Haversine formula for distance calculation
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate magnetic heading between two points
export function calculateMagneticHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.cos(dLon);
  let heading = (Math.atan2(y, x) * 180) / Math.PI;
  heading = (heading + 360) % 360;
  // Apply magnetic variation (aproximação para Brasil: -20°)
  const magneticVariation = -20;
  heading = (heading + magneticVariation + 360) % 360;
  return Math.round(heading);
}

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
}

export interface AirspaceRestriction {
  id: string;
  name: string;
  type: string;
  lowerLimit: string;
  upperLimit: string;
  active: boolean;
  schedule: string | null;
  coordinates: Array<{ lat: number; lng: number }>;
  notes: string;
}

// AISWeb API Base URL
const AISWEB_BASE_URL = 'https://api.aisweb.aer.mil.br';

// Fetch NOTAMs da AISWeb
export async function fetchAISWebNOTAMs(icao: string): Promise<NOTAMData[]> {
  try {
    const response = await fetch(
      `${AISWEB_BASE_URL}/notam?icao=${icao.toUpperCase()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`AISWeb API error: ${response.status}`);
    }
    
    const data = await response.json();
    return parseAndPrioritizeNOTAMs(data);
  } catch (error) {
    console.error('Error fetching NOTAMs from AISWeb:', error);
    throw error;
  }
}

// Parse e priorizar NOTAMs
function parseAndPrioritizeNOTAMs(rawData: any[]): NOTAMData[] {
  return rawData.map(notam => {
    let priority: NOTAMData['priority'] = 'low';
    const msg = notam.message?.toLowerCase() || '';
    
    if (msg.includes('closed') || msg.includes('fechado') || 
        msg.includes('unsafe') || msg.includes('não autorizado')) {
      priority = 'critical';
    } else if (msg.includes('restricted') || msg.includes('restrito') || 
               msg.includes('caution') || msg.includes('atenção')) {
      priority = 'high';
    } else if (msg.includes('tempo') || msg.includes('temporary')) {
      priority = 'medium';
    }
    
    return {
      ...notam,
      priority,
    };
  }).sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// Fetch ROTAER
export async function fetchROTAER(icao: string): Promise<ROTAERData | null> {
  try {
    const response = await fetch(
      `${AISWEB_BASE_URL}/rotaer?icao=${icao.toUpperCase()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`ROTAER fetch failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching ROTAER:', error);
    return null;
  }
}

// Verificar restrições de espaço aéreo na rota
export async function checkRouteRestrictions(
  points: Array<{ lat: number; lng: number }>,
  altitude: number
): Promise<AirspaceRestriction[]> {
  try {
    const routeCoords = points.map(p => `${p.lat},${p.lng}`).join(';');
    
    const response = await fetch(
      `${AISWEB_BASE_URL}/airspace/restrictions?route=${routeCoords}&altitude=${altitude}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) throw new Error('Failed to check restrictions');
    
    return await response.json();
  } catch (error) {
    console.error('Error checking route restrictions:', error);
    return [];
  }
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

// Calcular altitude ótima considerando restrições
export function calculateOptimalAltitude(
  bearing: number,
  flightRule: 'V' | 'I' | 'Y' | 'Z',
  restrictions: AirspaceRestriction[]
): {
  suggested: string;
  alternatives: string[];
  warnings: string[];
} {
  const isIFR = flightRule === 'I';
  const warnings: string[] = [];
  
  let baseAlt: number;
  if (bearing >= 0 && bearing < 180) {
    baseAlt = isIFR ? 7000 : 5500;
  } else {
    baseAlt = isIFR ? 8000 : 6500;
  }
  
  const conflictingRestrictions = restrictions.filter(r => {
    const lower = parseAltitude(r.lowerLimit);
    const upper = parseAltitude(r.upperLimit);
    return baseAlt >= lower && baseAlt <= upper;
  });
  
  if (conflictingRestrictions.length > 0) {
    warnings.push(
      `Altitude ${baseAlt}ft conflita com: ${conflictingRestrictions.map(r => r.name).join(', ')}`
    );
  }
  
  const alternatives = isIFR
    ? ['FL070', 'FL090', 'FL110', 'FL130']
    : ['3500', '5500', '7500', '9500'];
  
  return {
    suggested: isIFR ? `FL${Math.floor(baseAlt / 100)}` : baseAlt.toString(),
    alternatives,
    warnings,
  };
}

function parseAltitude(alt: string): number {
  if (alt.startsWith('FL')) {
    return parseInt(alt.substring(2)) * 100;
  }
  return parseInt(alt);
}
