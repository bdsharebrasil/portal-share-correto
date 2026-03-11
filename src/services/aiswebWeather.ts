/**
 * AISWeb Weather Service
 * Utilities para parsing e processamento de dados meteorológicos da AISWEB
 *
 * NOTA: O fetch é feito via apiClient.getWeather() que já inclui caching
 * Este service fornece apenas utilitários de parsing
 */

import { apiClient } from '@/lib/api-client';

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

/**
 * Parser de METAR string para extrair dados estruturados
 */
export const parseMetarString = (raw: string) => {
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

/**
 * Determinar categoria de voo a partir do METAR
 */
export const determineFlightCategory = (
  cat: string | undefined,
  visib: number | string | null
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' => {
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

/**
 * Transform dados brutos da API AISWEB em formato estruturado
 */
export const transformAISWebMETAR = (data: any, icao: string): AISWebMETARData => {
  const metarRaw = typeof data.metar === 'string'
    ? data.metar
    : (data.met?.metar?.metar || data.met?.metar?.raw || '');

  const tafRaw = typeof data.taf === 'string'
    ? data.taf
    : (data.met?.taf?.taf || data.met?.taf?.raw || '');

  const loc = data.loc || data.met?.metar?.loc || icao.toUpperCase();

  const parsed = metarRaw ? parseMetarString(metarRaw) : {
    temp: null, dewp: null, wdir: null, wspd: null, wgst: null, visib: null
  };

  return {
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
};

/**
 * @deprecated Use apiClient.getWeather() or useAISWeb().getWeather() instead
 * Wrapper de compatibilidade para código legado
 */
export async function fetchAISWebMETAR(icao: string): Promise<AISWebMETARData | null> {
  try {
    const data = await apiClient.getWeather(icao);
    if (!data) return null;
    return transformAISWebMETAR(data, icao);
  } catch (error) {
    console.error(`[AISWeb] Erro ao buscar ${icao}:`, error);
    return null;
  }
}

