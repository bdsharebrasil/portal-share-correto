/**
 * Serviço unificado para buscar dados meteorológicos via AISWeb API
 * Substitui a API aviationweather.gov para METAR e TAF
 */

const AISWEB_API_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-share.vercel.app';

export interface AISWebMETARData {
  icao: string;
  rawOb: string;
  rawText: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null;
  altim: number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  fltcat?: string;
  reportTime?: string;
  updatedTime?: string;
  source: 'AISWEB' | 'FALLBACK';
  clouds?: Array<{
    cover: string;
    base: number;
  }>;
}

export interface AISWebTAFData {
  icao: string;
  rawTAF: string;
  validTimeFrom: string;
  validTimeTo: string;
  source: 'AISWEB' | 'FALLBACK';
}

// Cache de dados meteorológicos
interface WeatherCache {
  metar: Record<string, { data: AISWebMETARData; timestamp: number }>;
  taf: Record<string, { data: AISWebTAFData; timestamp: number }>;
}

const weatherCache: WeatherCache = {
  metar: {},
  taf: {},
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica se o cache é válido
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

/**
 * Parse temperatura do METAR
 */
function parseTemperature(metar: string): { temp: number | null; dewp: number | null } {
  // Formato: "23/18" ou "M05/M10" (negativo)
  const match = metar.match(/(M?)(\d{2})\/(M?)(\d{2})/);
  if (match) {
    const tempSign = match[1] === 'M' ? -1 : 1;
    const temp = parseInt(match[2], 10) * tempSign;
    const dewSign = match[3] === 'M' ? -1 : 1;
    const dewp = parseInt(match[4], 10) * dewSign;
    return { temp, dewp };
  }
  return { temp: null, dewp: null };
}

/**
 * Parse vento do METAR
 */
function parseWind(metar: string): { wdir: number | string | null; wspd: number | null; wgst: number | null } {
  // Formato: "09015G25KT" ou "VRB05KT"
  const vrbMatch = metar.match(/VRB(\d{2})KT/);
  if (vrbMatch) {
    return {
      wdir: 'VRB',
      wspd: parseInt(vrbMatch[1], 10),
      wgst: null,
    };
  }

  const match = metar.match(/(\d{3})(\d{2})(?:G(\d{2}))?KT/);
  if (match) {
    return {
      wdir: parseInt(match[1], 10),
      wspd: parseInt(match[2], 10),
      wgst: match[3] ? parseInt(match[3], 10) : null,
    };
  }
  return { wdir: null, wspd: null, wgst: null };
}

/**
 * Parse visibilidade do METAR
 */
function parseVisibility(metar: string): string | number | null {
  // Formato SM (statute miles)
  const smMatch = metar.match(/(\d+)SM/);
  if (smMatch) {
    return parseInt(smMatch[1], 10);
  }

  // Formato metros (9999 = CAVOK)
  const mMatch = metar.match(/\s(\d{4})\s/);
  if (mMatch) {
    const val = parseInt(mMatch[1], 10);
    return val >= 9999 ? 'CAVOK' : val;
  }

  if (metar.includes('CAVOK')) {
    return 'CAVOK';
  }

  return null;
}

/**
 * Parse altímetro do METAR
 */
function parseAltimeter(metar: string): number | null {
  // Formato A2992 (inHg)
  const aMatch = metar.match(/A(\d{4})/);
  if (aMatch) {
    return parseInt(aMatch[1], 10) / 100;
  }

  // Formato Q1013 (hPa)
  const qMatch = metar.match(/Q(\d{4})/);
  if (qMatch) {
    const hpa = parseInt(qMatch[1], 10);
    return hpa * 0.02953; // Converter hPa para inHg
  }

  return null;
}

/**
 * Determina a categoria de voo baseado na visibilidade
 */
function getFlightCategory(visib: string | number | null): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' {
  if (visib === null || visib === undefined) return 'UNKNOWN';
  if (visib === 'CAVOK') return 'VFR';

  let visMiles: number;
  if (typeof visib === 'string') {
    visMiles = parseFloat(visib);
  } else if (typeof visib === 'number') {
    // Se valor > 100, provavelmente está em metros
    visMiles = visib > 100 ? visib / 1609.34 : visib;
  } else {
    return 'UNKNOWN';
  }

  if (isNaN(visMiles)) return 'UNKNOWN';
  if (visMiles >= 5) return 'VFR';
  if (visMiles >= 3) return 'MVFR';
  if (visMiles >= 1) return 'IFR';
  return 'LIFR';
}

/**
 * Parse nuvens do METAR
 */
function parseClouds(metar: string): Array<{ cover: string; base: number }> {
  const clouds: Array<{ cover: string; base: number }> = [];
  const cloudRegex = /(FEW|SCT|BKN|OVC)(\d{3})/g;
  let match;

  while ((match = cloudRegex.exec(metar)) !== null) {
    clouds.push({
      cover: match[1],
      base: parseInt(match[2], 10) * 100, // Converter de centenas de pés
    });
  }

  return clouds;
}

/**
 * Buscar METAR via backend/AISWeb
 */
export async function fetchAISWebMETAR(icao: string): Promise<AISWebMETARData | null> {
  const icaoUpper = icao.toUpperCase();

  // Verificar cache
  if (weatherCache.metar[icaoUpper] && isCacheValid(weatherCache.metar[icaoUpper].timestamp)) {
    console.log(`[AISWeb METAR] Cache hit para ${icaoUpper}`);
    return weatherCache.metar[icaoUpper].data;
  }

  try {
    console.log(`[AISWeb METAR] Buscando dados para ${icaoUpper}...`);

    const response = await fetch(`${AISWEB_API_URL}/api/weather/metar/${icaoUpper}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[AISWeb METAR] Erro ${response.status} para ${icaoUpper}`);
      return null;
    }

    const data = await response.json();
    const rawMetar = data.rawText || data.rawOb || data.raw || data.metar || '';

    if (!rawMetar) {
      console.warn(`[AISWeb METAR] Sem dados METAR para ${icaoUpper}`);
      return null;
    }

    const { temp, dewp } = parseTemperature(rawMetar);
    const { wdir, wspd, wgst } = parseWind(rawMetar);
    const visib = parseVisibility(rawMetar);
    const altim = parseAltimeter(rawMetar);
    const flightCategory = data.flightCategory || getFlightCategory(visib);
    const clouds = parseClouds(rawMetar);

    const metarData: AISWebMETARData = {
      icao: icaoUpper,
      rawOb: rawMetar,
      rawText: rawMetar,
      temp,
      dewp,
      wdir,
      wspd,
      wgst,
      visib,
      altim,
      flightCategory,
      fltcat: flightCategory,
      reportTime: data.reportTime || data.observationTime,
      updatedTime: new Date().toISOString(),
      source: 'AISWEB',
      clouds,
    };

    // Atualizar cache
    weatherCache.metar[icaoUpper] = {
      data: metarData,
      timestamp: Date.now(),
    };

    console.log(`[AISWeb METAR] ✅ Dados obtidos para ${icaoUpper}:`, metarData.flightCategory);
    return metarData;
  } catch (error) {
    console.error(`[AISWeb METAR] Erro ao buscar ${icaoUpper}:`, error);
    return null;
  }
}

/**
 * Buscar TAF via backend/AISWeb
 */
export async function fetchAISWebTAF(icao: string): Promise<AISWebTAFData | null> {
  const icaoUpper = icao.toUpperCase();

  // Verificar cache
  if (weatherCache.taf[icaoUpper] && isCacheValid(weatherCache.taf[icaoUpper].timestamp)) {
    console.log(`[AISWeb TAF] Cache hit para ${icaoUpper}`);
    return weatherCache.taf[icaoUpper].data;
  }

  try {
    console.log(`[AISWeb TAF] Buscando dados para ${icaoUpper}...`);

    const response = await fetch(`${AISWEB_API_URL}/api/weather/taf/${icaoUpper}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[AISWeb TAF] Erro ${response.status} para ${icaoUpper}`);
      return null;
    }

    const data = await response.json();
    const rawTAF = data.rawText || data.rawTAF || data.raw || data.taf || '';

    if (!rawTAF) {
      console.warn(`[AISWeb TAF] Sem dados TAF para ${icaoUpper}`);
      return null;
    }

    const tafData: AISWebTAFData = {
      icao: icaoUpper,
      rawTAF,
      validTimeFrom: data.validTimeFrom || data.from || '',
      validTimeTo: data.validTimeTo || data.to || '',
      source: 'AISWEB',
    };

    // Atualizar cache
    weatherCache.taf[icaoUpper] = {
      data: tafData,
      timestamp: Date.now(),
    };

    console.log(`[AISWeb TAF] ✅ Dados obtidos para ${icaoUpper}`);
    return tafData;
  } catch (error) {
    console.error(`[AISWeb TAF] Erro ao buscar ${icaoUpper}:`, error);
    return null;
  }
}

/**
 * Buscar múltiplos METARs
 */
export async function fetchMultipleMETARs(icaos: string[]): Promise<Record<string, AISWebMETARData | null>> {
  const results: Record<string, AISWebMETARData | null> = {};

  await Promise.all(
    icaos.filter(Boolean).map(async (icao) => {
      try {
        results[icao.toUpperCase()] = await fetchAISWebMETAR(icao);
      } catch (error) {
        console.error(`[AISWeb] Erro ao buscar METAR para ${icao}:`, error);
        results[icao.toUpperCase()] = null;
      }
    })
  );

  return results;
}

/**
 * Limpar cache de weather
 */
export function clearWeatherCache(): void {
  weatherCache.metar = {};
  weatherCache.taf = {};
  console.log('[AISWeb] Cache de weather limpo');
}

/**
 * Obter idade do cache em minutos
 */
export function getWeatherCacheAge(icao: string, type: 'metar' | 'taf'): number | null {
  const cached = type === 'metar' ? weatherCache.metar[icao.toUpperCase()] : weatherCache.taf[icao.toUpperCase()];
  if (!cached) return null;
  return Math.floor((Date.now() - cached.timestamp) / 1000 / 60);
}
