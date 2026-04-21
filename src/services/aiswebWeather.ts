/**
 * services/aiswebWeather.ts
 *
 * Utilities de parsing e transformação de dados meteorológicos da AISWEB.
 * O fetch em si é feito via apiClient.getWeather() que já cuida de cache e fallback.
 *
 * O Worker normaliza a resposta para:
 *   { loc: string, metar: string, taf: string, _raw: any }
 *
 * Este service transforma esse shape em AISWebMETARData para uso nos componentes.
 */

import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AISWebMETARData {
  icao:           string;
  rawOb:          string;
  temp:           number | null;
  dewp:           number | null;
  wdir:           number | string | null;
  wspd:           number | null;
  wgst:           number | null;
  visib:          string | number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  updatedTime?:   string;
  taf?:           string;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Extrai campos estruturados de uma string METAR bruta.
 *
 * Exemplos cobertos:
 *   "SBSP 191800Z 05008KT 9999 FEW020 25/18 Q1018"
 *   "SBGR 191900Z VRB03KT CAVOK 24/15 Q1019"
 *   "SBSP 191800Z 05008KT 1500 +TSRA BKN010CB 22/19 Q1015"
 */
export const parseMetarString = (raw: string) => {
  const parseTemp = (t: string) =>
    t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t);

  // Temperatura e ponto de orvalho: "25/18" ou "M02/M10"
  const tempMatch  = raw.match(/(M?\d{2})\/(M?\d{2})/);

  // Vento: "05008KT" ou "VRB03KT" ou "05008G15KT"
  const windMatch  = raw.match(/(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT/);

  // Visibilidade: "9999" ou "1500" (metros); CAVOK = 10 000+
  // O METAR DECEA usa 4 dígitos sem espaço após o vento
  const visibMatch = raw.match(/\b(\d{4})\b/);

  return {
    temp:  tempMatch ? parseTemp(tempMatch[1])  : null,
    dewp:  tempMatch ? parseTemp(tempMatch[2])  : null,
    wdir:  windMatch
             ? (windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1]))
             : null,
    wspd:  windMatch ? parseInt(windMatch[2])   : null,
    wgst:  windMatch && windMatch[3] ? parseInt(windMatch[3]) : null,
    visib: visibMatch
             ? parseInt(visibMatch[1])
             : raw.includes('CAVOK') ? 9999 : null,
  };
};

/**
 * Determina a categoria de voo (VFR/MVFR/IFR/LIFR) a partir da visibilidade
 * em metros (padrão ICAO/DECEA).
 *
 * Se a API retornar o campo cat diretamente, ele tem precedência.
 */
export const determineFlightCategory = (
  cat:   string | undefined,
  visib: number | string | null
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' => {
  if (cat) {
    const upper = cat.toUpperCase();
    if (['VFR', 'MVFR', 'IFR', 'LIFR'].includes(upper)) {
      return upper as 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
    }
  }

  if (visib === null) return 'UNKNOWN';

  const v = typeof visib === 'string' ? parseInt(visib) : visib;
  if (isNaN(v))  return 'UNKNOWN';
  if (v >= 5000) return 'VFR';
  if (v >= 3000) return 'MVFR';
  if (v >= 1000) return 'IFR';
  return 'LIFR';
};

/**
 * Transforma a resposta normalizada do Worker em AISWebMETARData.
 *
 * O Worker garante { loc, metar: string, taf: string } mas mantemos
 * os fallbacks para resiliência caso algum campo seja omitido.
 */
export const transformAISWebMETAR = (data: any, icao: string): AISWebMETARData => {
  // ── Extração do METAR bruto ────────────────────────────────────────────────
  // Ordem de precedência (do mais confiável ao mais defensivo):
  //  1. data.metar como string  → Worker já normalizou corretamente
  //  2. data.metar.metar        → shape antigo sem normalização
  //  3. data.metar.raw          → campo raw alternativo
  //  4. data.met?.metar?.metar  → shape sem stripping do nó met
  //  5. data.met?.metar?.raw    → idem, campo raw
  const metarRaw: string =
    (typeof data.metar === 'string'        ? data.metar             : null) ??
    (typeof data.metar?.metar === 'string' ? data.metar.metar       : null) ??
    (typeof data.metar?.raw === 'string'   ? data.metar.raw         : null) ??
    (typeof data.met?.metar?.metar === 'string' ? data.met.metar.metar : null) ??
    (typeof data.met?.metar?.raw === 'string'   ? data.met.metar.raw   : null) ??
    '';

  // ── Extração do TAF bruto ──────────────────────────────────────────────────
  const tafRaw: string =
    (typeof data.taf === 'string'       ? data.taf           : null) ??
    (typeof data.taf?.taf === 'string'  ? data.taf.taf       : null) ??
    (typeof data.taf?.raw === 'string'  ? data.taf.raw       : null) ??
    (typeof data.met?.taf?.taf === 'string' ? data.met.taf.taf : null) ??
    (typeof data.met?.taf?.raw === 'string' ? data.met.taf.raw : null) ??
    '';

  // ── ICAO ───────────────────────────────────────────────────────────────────
  const loc: string =
    data.loc           ??
    data.metar?.loc    ??
    data.met?.metar?.loc ??
    icao.toUpperCase();

  // ── Parse da string METAR ──────────────────────────────────────────────────
  const parsed = metarRaw
    ? parseMetarString(metarRaw)
    : { temp: null, dewp: null, wdir: null, wspd: null, wgst: null, visib: null };

  // ── Categoria de voo ───────────────────────────────────────────────────────
  // O campo cat pode vir direto da AISWEB em alguns shapes
  const catRaw: string | undefined =
    data.cat           ??
    data.met?.metar?.cat ??
    undefined;

  if (!metarRaw) {
    console.debug(`[transformAISWebMETAR] METAR vazio para ${loc}. Usando fallback ou mock data.`);
  }

  return {
    icao:           loc,
    rawOb:          metarRaw,
    temp:           parsed.temp,
    dewp:           parsed.dewp,
    wdir:           parsed.wdir,
    wspd:           parsed.wspd,
    wgst:           parsed.wgst,
    visib:          parsed.visib,
    flightCategory: determineFlightCategory(catRaw, parsed.visib),
    updatedTime:    data.data ?? new Date().toISOString(),
    taf:            tafRaw || undefined,
  };
};

// ─── Fetch principal ──────────────────────────────────────────────────────────

/**
 * Busca e transforma o METAR de um ICAO.
 * Usa apiClient.getWeather() que já cuida de cache IDB e fallback para mock data.
 */
export async function fetchAISWebMETAR(icao: string): Promise<AISWebMETARData | null> {
  try {
    const data = await apiClient.getWeather(icao);
    if (!data) return null;
    return transformAISWebMETAR(data, icao);
  } catch (error) {
    // Log apenas como debug já que o fallback para mock data é esperado
    console.debug(`[AISWeb] Falha ao buscar METAR para ${icao}, usando fallback`);
    return null;
  }
}

/**
 * Verifica se um AISWebMETARData tem dados válidos (não é um placeholder vazio).
 */
export function isValidMETAR(metar: AISWebMETARData | null): boolean {
  return !!metar && metar.rawOb.length > 0;
}
