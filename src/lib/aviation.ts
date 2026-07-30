// @ts-nocheck
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
      from: from.nome,
      to: to.nome,
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
// Em dev: usa proxy Vite (/api) | Em prod: usa URL da API
const AISWEB_BASE_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '/api' : 'https://api.share-brasil.com');

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
        console.warn(`[fetchAISWebNOTAMs] API error for ${icaoUpper}: ${response.statuso}`);
        return [];
      }

      const data = await response.json();
      const parsed = parseAndPrioritizeNOTAMs(data);
      console.debug(`[fetchAISWebNOTAMs] Found ${parsed.length} NOTAMs for ${icaoUpper}`);
      return parsed;
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.nome === 'AbortError') {
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
  // A API pode retornar:
  // 1. Array direto: [...notams]
  // 2. Array com objetos contendo 'item': [{ item: [...] }]
  // 3. Objeto com 'data' ou 'notams': { data: [...] }

  let dataArray: any[] = [];

  if (Array.isArray(rawData)) {
    dataArray = rawData;
  } else if (rawData?.data && Array.isArray(rawData.data)) {
    dataArray = rawData.data;
  } else if (rawData?.notams && Array.isArray(rawData.notams)) {
    dataArray = rawData.notams;
  } else {
    console.warn('[parseAndPrioritizeNOTAMs] Unexpected response format:', rawData);
    return [];
  }

  // Se cada elemento tem 'item' (wrapper object), extrair items
  if (dataArray.length > 0 && dataArray[0]?.item && Array.isArray(dataArray[0].item)) {
    dataArray = dataArray.flatMap(wrapper => wrapper.item || []);
  }

  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return [];
  }

  return dataArray
    .map(notam => {
      // Validar e normalizar dados críticos
      if (!notam) return null;

      // Extrair ICAO de múltiplos campos possíveis
      const icao = (notam.loc || notam.icao || notam.icaoairport_id || 'UNKN').toUpperCase();

      // Normalizar campos de data - suportar formato DECEA (yyyymmddhhmm) e ISO
      let startDate = parseNOTAMDate(
        notam.b || notam.start || notam.startDate || notam.start_date || notam.validFrom
      );
      let endDate = parseNOTAMDate(
        notam.c || notam.end || notam.endDate || notam.end_date || notam.validTo
      );

      // Validar datas - se forem null/undefined, usar datas padrão
      if (!isValidDate(startDate)) {
        startDate = new Date().toISOString();
        console.debug(`[parseNOTAM] Invalid startDate for ${icao}/${notam.number}, using current date`);
      }
      if (!isValidDate(endDate)) {
        // Se não temos end date, assumir 30 dias a partir do start
        const start = new Date(startDate);
        endDate = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        console.debug(`[parseNOTAM] Invalid endDate for ${icao}/${notam.number}, using +30 days from start`);
      }

      // Extrair mensagem de múltiplos campos
      const message = notam.e || notam.message || notam.text || notam.descricao || 'Sem descrição';

      // Determinar prioridade
      let priority: NOTAMData['priority'] = 'low';
      const msg = message.toLowerCase();

      if (msg.includes('closed') || msg.includes('fechado') ||
        msg.includes('clsd') || msg.includes('unsafe') || msg.includes('não autorizado') ||
        msg.includes('inoperacional') || msg.includes('closed') || msg.includes('closure')) {
        priority = 'critical';
      } else if (msg.includes('restricted') || msg.includes('restrito') ||
        msg.includes('caution') || msg.includes('atenção') ||
        msg.includes('danger') || msg.includes('perigo') || msg.includes('limit')) {
        priority = 'high';
      } else if (msg.includes('tempo') || msg.includes('temporary') ||
        msg.includes('provisório') || msg.includes('experimental') ||
        msg.includes('test') || msg.includes('teste')) {
        priority = 'medium';
      }

      // Normalizar NOTAM com valores padrão
      return {
        id: notam.id || `${icao}-${notam.number}-${Date.now()}`,
        icao,
        number: String(notam.n || notam.number || '0000'),
        type: notam.tp || notam.tipo || 'NOTAM',
        category: notam.cat || notam.categoria || 'AIRSPACE',
        traffic: notam.traffic || 'ALL',
        purpose: notam.purpose || notam.p || 'M',
        scope: notam.scope || notam.s || 'AOR',
        lower: String(notam.lower || 'SFC'),
        upper: String(notam.upper || 'UNLIM'),
        coordinates: notam.coordinates || null,
        radius: notam.radius || null,
        message,
        startDate,
        endDate,
        schedule: notam.schedule || null,
        created: notam.dt || notam.created || new Date().toISOString(),
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

// Parse NOTAM dates - suporta formato DECEA (yyyymmddhhmm) e ISO
function parseNOTAMDate(dateValue: any): string {
  if (!dateValue) return '';

  // Se já for uma data ISO válida
  if (typeof dateValue === 'string' && dateValue.includes('-')) {
    if (isValidDate(dateValue)) {
      return dateValue;
    }
  }

  // Formato DECEA: yyyymmddhhmm ou yymmddhhmm
  if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(dateValue))) {
    const dateStr = String(dateValue);

    if (dateStr.length === 12) {
      // yymmddhhmm → 2512191818 = 25-12-19 18:18
      const year = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const day = parseInt(dateStr.substring(4, 6));
      const hour = parseInt(dateStr.substring(6, 8));
      const minute = parseInt(dateStr.substring(8, 10));

      // Converter YY para YYYY (assume 2000-2099)
      const fullYear = year < 50 ? 2000 + year : 1900 + year;

      try {
        const date = new Date(Date.UTC(fullYear, month - 1, day, hour, minute, 0));
        if (isValidDate(date)) {
          return date.toISOString();
        }
      } catch (e) {
        console.debug('[parseNOTAMDate] Error parsing DECEA format:', dateStr, e);
      }
    } else if (dateStr.length === 14) {
      // yyyymmddhhmm → 20251219 1818
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(8, 10));
      const minute = parseInt(dateStr.substring(10, 12));

      try {
        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
        if (isValidDate(date)) {
          return date.toISOString();
        }
      } catch (e) {
        console.debug('[parseNOTAMDate] Error parsing full format:', dateStr, e);
      }
    }
  }

  return '';
}

// Helper para validar se uma data é válida
function isValidDate(dateValue: any): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date instanceof Date && !isNaN(date.getTime());
}

// Fetch ROTAER via Workers proxy
export async function fetchROTAER(icao: string): Promise<ROTAERData | null> {
  const icaoUpper = icao.toUpperCase();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(
        `${AISWEB_BASE_URL}/api/rotaer/${icaoUpper}`,
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
          console.debug(`[fetchROTAER] No ROTAER data found for ${icaoUpper}`);
          return null;
        }
        console.warn(`[fetchROTAER] API error for ${icaoUpper}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const parsed = parseROTAERData(data);
      console.debug(`[fetchROTAER] Successfully fetched ROTAER for ${icaoUpper}`);
      return parsed;
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.nome === 'AbortError') {
        console.warn(`[fetchROTAER] Timeout fetching ROTAER for ${icaoUpper}`);
      } else {
        console.warn(`[fetchROTAER] Failed to fetch ROTAER for ${icaoUpper}:`, fetchError);
      }
      return null;
    }
  } catch (error) {
    console.error(`[fetchROTAER] Unexpected error for ${icaoUpper}:`, error);
    return null;
  }
}

// Parse ROTAER data from DECEA XML-like JSON format
function parseROTAERData(rawData: any): ROTAERData | null {
  if (!rawData) return null;

  try {
    // Extract main airport data (can be wrapped or direct)
    const airport = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!airport) return null;

    // Parse pistas (runways)
    const runways: ROTAERData['runways'] = [];
    const runwaysData = airport.runways?.runway;
    if (runwaysData) {
      const rwyArray = Array.isArray(runwaysData) ? runwaysData : [runwaysData];
      rwyArray.forEach((rwy: any) => {
        if (rwy?.ident) {
          runways.push({
            designator: String(rwy.ident),
            length: parseInt(rwy.length?.['#text'] || rwy.length || '0'),
            width: parseInt(rwy.width?.['#text'] || rwy.width || '0'),
            surface: String(rwy.surface?.['#text'] || rwy.surface || 'UNKN'),
            strength: String(rwy.surface_c?.['#text'] || ''),
            lighting: !!rwy.lights,
          } as any);
        }
      });
    }

    // Parse frequências (frequencies)
    const frequencies: ROTAERData['frequencies'] = [];
    const servicesData = airport.services?.service;
    if (servicesData) {
      const serviceArray = Array.isArray(servicesData) ? servicesData : [servicesData];
      serviceArray.forEach((service: any) => {
        if (service['@_type'] === 'COM' && service.freqs) {
          const freqArray = Array.isArray(service.freqs.freq)
            ? service.freqs.freq
            : [service.freqs.freq];
          freqArray.forEach((freq: any) => {
            if (freq) {
              frequencies.push({
                type: service.tipo || 'Unknown',
                frequency: String(freq['#text'] || freq || ''),
              });
            }
          });
        }
      });
    }

    // Parse navaids
    const navaids: ROTAERData['navaids'] = [];
    const serviceArray = Array.isArray(servicesData) ? servicesData : [servicesData];
    if (serviceArray) {
      serviceArray.forEach((service: any) => {
        if (service['@_type'] === 'NAV' && service.tipo) {
          navaids.push({
            type: service.tipo || 'UNKNOWN',
            identifier: service.ident || '',
            frequency: String(service.freq || ''),
          });
        }
      });
    }

    // Parse serviços
    const services = {
      fuel: false,
      fuelTypes: [] as string[],
      hangar: false,
      maintenance: false,
      customs: false,
    };

    if (serviceArray) {
      serviceArray.forEach((service: any) => {
        if (service['@_type'] === 'AirportSuppliesService' && service.fuel) {
          services.fuel = true;
          const fuelSpan = service.fuel.span?.['#text'] || '';
          services.fuelTypes = fuelSpan.split(' ').filter((f: string) => f && f.length < 5);
        }
        if (service['@_type'] === 'AircraftGroundService') {
          services.maintenance = true;
        }
      });
    }

    // Build ROTAERData
    return {
      icao: (airport.AeroCode || airport.loc || airport.icao || 'UNKN').toUpperCase(),
      name: airport.nome || airport.aero || '',
      city: airport.cidade || '',
      state: airport.uf || airport.state || '',
      country: 'BR',
      type: airport.tipo || 'AD',
      coordinates: {
        lat: parseFloat(airport.lat || airport.latitude || '0'),
        lng: parseFloat(airport.lng || airport.longitude || '0'),
      },
      elevation: parseInt(airport.altFt || airport.elevation || '0'),
      runways,
      frequencies,
      navaids,
      services,
      operatingHours: airport.operatingHours || '24H',
      restrictions: extractRestrictions(airport),
      contact: {
        phone: extractContact(airport, 'phone'),
        email: extractContact(airport, 'email'),
      },
    };
  } catch (error) {
    console.error('[parseROTAERData] Error parsing ROTAER:', error);
    return null;
  }
}

// Helper para extrair restrições dos remarks
function extractRestrictions(airport: any): string[] {
  const restrictions: string[] = [];
  const rmkText = airport.rmk?.rmkText;

  if (rmkText) {
    const rmkArray = Array.isArray(rmkText) ? rmkText : [rmkText];
    rmkArray.forEach((remark: any) => {
      const text = remark['#text'] || '';
      if (text && (text.includes('PRB') || text.includes('OBS') || text.includes('LIMIT'))) {
        restrictions.push(text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      }
    });
  }

  return restrictions;
}

// Helper para extrair contato
function extractContact(airport: any, type: 'phone' | 'email'): string | undefined {
  const rmkText = airport.rmk?.rmkText;
  if (!rmkText) return undefined;

  const rmkArray = Array.isArray(rmkText) ? rmkText : [rmkText];
  const pattern = type === 'phone' ? /(\d{2})\s?(\d{4})-?(\d{4})/ : /[\w\.-]+@[\w\.-]+\.\w+/;

  for (const remark of rmkArray) {
    const text = remark['#text'] || '';
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
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
      if (fetchError instanceof Error && fetchError.nome === 'AbortError') {
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
      `Altitude ${baseAlt}ft conflita com: ${conflictingRestrictions.map(r => r.nome).join(', ')}`
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
