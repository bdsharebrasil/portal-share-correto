import { API_ENDPOINTS } from '@/config/api';

export interface AISWebMETARData {
  icao: string;
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  updatedTime?: string;
  taf?: string;
}

// Cache simples
const weatherCache: Record<string, { data: AISWebMETARData; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 min

// Parser de METAR string para extrair dados
const parseMetarString = (raw: string) => {
  const tempMatch = raw.match(/(M?\d{2})\/(M?\d{2})/);
  const windMatch = raw.match(/(\d{3}|VRB)(\d{2})(G\d{2})?KT/);
  const visibMatch = raw.match(/\s(\d{4})\s/);
  const parseTemp = (t: string) => t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t);

  return {
    temp: tempMatch ? parseTemp(tempMatch[1]) : null,
    dewp: tempMatch ? parseTemp(tempMatch[2]) : null,
    wdir: windMatch ? (windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1])) : null,
    wspd: windMatch ? parseInt(windMatch[2]) : null,
    wgst: windMatch && windMatch[3] ? parseInt(windMatch[3].replace('G', '')) : null,
    visib: visibMatch ? parseInt(visibMatch[1]) : (raw.includes('CAVOK') ? 9999 : null),
  };
};

// Determinar categoria de voo a partir do METAR
const determineFlightCategory = (cat: string | undefined, visib: number | string | null): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' => {
  if (cat) {
    const upper = cat.toUpperCase();
    if (['VFR', 'MVFR', 'IFR', 'LIFR'].includes(upper)) return upper as any;
  }
  if (visib === null) return 'UNKNOWN';
  const v = typeof visib === 'string' ? parseInt(visib) : visib;
  if (v >= 5000) return 'VFR';
  if (v >= 3000) return 'MVFR';
  if (v >= 1000) return 'IFR';
  return 'LIFR';
};

export async function fetchAISWebMETAR(icao: string): Promise<AISWebMETARData | null> {
  const icaoUpper = icao.toUpperCase();
  
  // 1. Verifica Cache
  const cached = weatherCache[icaoUpper];
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  try {
    const response = await fetch(API_ENDPOINTS.weather(icaoUpper));
    if (!response.ok) throw new Error('Falha na rede');
    
    const data = await response.json();
    
    // A API retorna flat: { loc, metar, taf } OU nested: { met: { metar: {...} } }
    // Suportar ambos os formatos
    const metarRaw = typeof data.metar === 'string' 
      ? data.metar 
      : (data.met?.metar?.metar || data.met?.metar?.raw || '');
    
    const tafRaw = typeof data.taf === 'string'
      ? data.taf
      : (data.met?.taf?.taf || data.met?.taf?.raw || '');
    
    const loc = data.loc || data.met?.metar?.loc || icaoUpper;
    
    // Parsear dados do METAR
    const parsed = metarRaw ? parseMetarString(metarRaw) : {
      temp: null, dewp: null, wdir: null, wspd: null, wgst: null, visib: null
    };

    const metarData: AISWebMETARData = {
      icao: loc,
      rawOb: metarRaw,
      temp: parsed.temp,
      dewp: parsed.dewp,
      wdir: parsed.wdir,
      wspd: parsed.wspd,
      wgst: parsed.wgst,
      visib: parsed.visib,
      flightCategory: determineFlightCategory(data.cat || data.met?.metar?.cat, parsed.visib),
      updatedTime: data.date || new Date().toISOString(),
      taf: tafRaw || undefined,
    };

    // Guardar no cache
    weatherCache[icaoUpper] = { data: metarData, timestamp: Date.now() };
    return metarData;
  } catch (error) {
    console.error(`[AISWeb] Erro ao buscar ${icaoUpper}:`, error);
    return null;
  }
}
