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

// AISWeb API Base URL (via Workers proxy)
const AISWEB_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

// Fetch NOTAMs via Workers proxy
export async function fetchAISWebNOTAMs(icao: string): Promise<NOTAMData[]> {
  const icaoUpper = icao.toUpperCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(
        `${AISWEB_BASE_URL}/api/notam/${icaoUpper}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404) {
          console.debug(`[fetchAISWebNOTAMs] No NOTAMs found for ${icaoUpper}`);
          return [];
        }
        console.warn(`[fetchAISWebNOTAMs] API error for ${icaoUpper}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const parsed = parseAndPrioritizeNOTAMs(data);
      console.debug(`[fetchAISWebNOTAMs] Found ${parsed.length} NOTAMs for ${icaoUpper}`);
      return parsed;
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn(`[fetchAISWebNOTAMs] Timeout fetching NOTAMs for ${icaoUpper}`);
      } else {
        console.warn(`[fetchAISWebNOTAMs] Failed to fetch NOTAMs for ${icaoUpper}:`, fetchError);
      }
      return [];
    }
  } catch (error) {
    console.error(`[fetchAISWebNOTAMs] Unexpected error for ${icaoUpper}:`, error);
    return [];
  }
}

// Parse e priorizar NOTAMs - com validação robusta de dados
function parseAndPrioritizeNOTAMs(rawData: any): NOTAMData[] {
  // Handle both array and object responses
  const dataArray = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.notams || []);

  if (!Array.isArray(dataArray)) {
    console.warn('[parseAndPrioritizeNOTAMs] Response is not an array:', rawData);
    return [];
  }

  return dataArray
    .map(notam => {
      // Validar e normalizar dados críticos
      if (!notam) return null;

      // Normalizar campos de data (suportar múltiplos formatos)
      let startDate = notam.startDate || notam.start_date || notam.validFrom || notam.valid_from;
      let endDate = notam.endDate || notam.end_date || notam.validTo || notam.valid_to;

      // Validar datas - se forem null/undefined, usar datas padrão
      if (!isValidDate(startDate)) {
        startDate = new Date().toISOString();
        console.warn(`[parseNOTAM] Invalid startDate for ${notam.icao}/${notam.number}, using current date`);
      }
      if (!isValidDate(endDate)) {
        // Se não temos end date, assumir 30 dias a partir do start
        const start = new Date(startDate);
        endDate = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        console.warn(`[parseNOTAM] Invalid endDate for ${notam.icao}/${notam.number}, using +30 days from start`);
      }

      // Determinar prioridade
      let priority: NOTAMData['priority'] = 'low';
      const msg = (notam.message || notam.text || notam.description || '').toLowerCase();

      if (msg.includes('closed') || msg.includes('fechado') ||
          msg.includes('unsafe') || msg.includes('não autorizado') ||
          msg.includes('inoperacional')) {
        priority = 'critical';
      } else if (msg.includes('restricted') || msg.includes('restrito') ||
                 msg.includes('caution') || msg.includes('atenção') ||
                 msg.includes('danger') || msg.includes('perigo')) {
        priority = 'high';
      } else if (msg.includes('tempo') || msg.includes('temporary') ||
                 msg.includes('provisório') || msg.includes('experimental')) {
        priority = 'medium';
      }

      // Normalizar NOTAM com valores padrão
      return {
        id: notam.id || `${notam.icao}-${notam.number}-${Date.now()}`,
        icao: (notam.icao || 'UNKN').toUpperCase(),
        number: notam.number || '0000',
        type: notam.type || 'NOTAM',
        category: notam.category || 'AIRSPACE',
        traffic: notam.traffic || 'ALL',
        purpose: notam.purpose || 'INFORMATION',
        scope: notam.scope || 'AOR',
        lower: notam.lower || 'SFC',
        upper: notam.upper || 'UNLIM',
        coordinates: notam.coordinates || null,
        radius: notam.radius || null,
        message: notam.message || notam.text || 'Sem descrição',
        startDate,
        endDate,
        schedule: notam.schedule || null,
        created: notam.created || new Date().toISOString(),
        source: notam.source || 'AISWEB',
        priority,
      } as NOTAMData;
    })
    .filter((notam): notam is NOTAMData => notam !== null)
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

// Helper para validar se uma data é válida
function isValidDate(dateValue: any): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date instanceof Date && !isNaN(date.getTime());
}

// Fetch ROTAER (InfoTemp) via Workers proxy
export async function fetchROTAER(icao: string): Promise<ROTAERData | null> {
  try {
    const response = await fetch(
      `${AISWEB_BASE_URL}/api/infotemp/${icao.toUpperCase()}`,
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
    // Skip if not enough points
    if (!points || points.length < 2) {
      return [];
    }

    const routeCoords = points.map(p => `${p.lat},${p.lng}`).join(';');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(
        `${AISWEB_BASE_URL}/airspace/restrictions?route=${routeCoords}&altitude=${altitude}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Airspace restrictions check returned status ${response.status}`);
        return [];
      }

      return await response.json();
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('Airspace restrictions check timed out');
      } else {
        console.debug('Airspace restrictions unavailable, continuing with empty restrictions');
      }
      return [];
    }
  } catch (error) {
    console.debug('Error in checkRouteRestrictions:', error);
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
