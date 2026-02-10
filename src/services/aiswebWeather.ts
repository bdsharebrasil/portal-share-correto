const AISWEB_API_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

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
}

// Cache simples
const weatherCache: Record<string, { data: AISWebMETARData; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 min

export async function fetchAISWebMETAR(icao: string): Promise<AISWebMETARData | null> {
  const icaoUpper = icao.toUpperCase();
  
  // 1. Verifica Cache
  const cached = weatherCache[icaoUpper];
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  try {
    const response = await fetch(`${AISWEB_API_URL}/api/weather/${icaoUpper}`);
    if (!response.ok) throw new Error('Falha na rede');
    
    const data = await response.json();
    
    const metarData: AISWebMETARData = {
      icao: icaoUpper,
      rawOb: data.rawText || data.raw || '',
      temp: data.temp ?? null,
      dewp: data.dewp ?? null,
      wdir: data.wdir ?? null,
      wspd: data.wspd ?? null,
      wgst: data.wgst ?? null,
      visib: data.visib ?? null,
      flightCategory: data.flightCategory || 'UNKNOWN',
      updatedTime: new Date().toISOString()
    };

    // Guardar no cache
    weatherCache[icaoUpper] = { data: metarData, timestamp: Date.now() };
    return metarData;
  } catch (error) {
    console.error(`[AISWeb] Erro ao buscar ${icaoUpper}:`, error);
    return null;
  }
}
