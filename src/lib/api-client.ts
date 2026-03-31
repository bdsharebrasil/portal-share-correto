// lib/api-client.ts
import { get, set } from 'idb-keyval';
import { API_ENDPOINTS } from '@/config/api';

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

// ─── Timeouts ─────────────────────────────────────────────────────────────────
// A API do DECEA responde entre 4–7s — nunca use menos que 8s
const FETCH_TIMEOUT_MS = 8000;
const WEATHER_TIMEOUT_MS = 15000; // 15s timeout for weather API (API pode ser lenta)

// ─── IDB com timeout (evita travar se IndexedDB estiver corrompido) ───────────
// O IDB pode ficar corrompido/travado e fazer a promise nunca resolver.
// O race com 800ms garante que o fetch continua mesmo se o IDB travar.
const IDB_TIMEOUT_MS = 800;

async function idbGet(key: string): Promise<any> {
  return Promise.race([
    get(key),
    new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), IDB_TIMEOUT_MS)),
  ]);
}

async function idbSet(key: string, value: any): Promise<void> {
  return Promise.race([
    set(key, value),
    new Promise<void>(resolve => setTimeout(resolve, IDB_TIMEOUT_MS)),
  ]).catch(() => { });
}

// ─── fetch com timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
  const timeoutId = setTimeout(() => controller.abort(timeoutErr), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw error.reason instanceof Error ? error.reason : timeoutErr;
    }
    throw error;
  }
}

// ─── fetchJson genérico ───────────────────────────────────────────────────────
async function fetchJson(
  endpoint: string,
  options: RequestInit = {},
  customTimeout?: number
) {
  let url: string;

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    url = endpoint;
  } else {
    const base = AIS_API_BASE_URL.replace(/\/$/, '');
    let ep = endpoint.replace(/^\/+/, '');
    if (ep.startsWith('api/')) ep = ep.replace(/^api\//, '');
    url = `${base}/${ep}`;
  }

  try {
    console.debug(`[API] Fetching: ${url}`);
    const res = await fetchWithTimeout(
      url,
      { headers: { 'Content-Type': 'application/json' }, ...options },
      customTimeout ?? FETCH_TIMEOUT_MS
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AIS API error ${res.status}: ${text}`);
    }

    return res.json();
  } catch (error: any) {
    console.error(`[API Error] Failed to fetch ${url}:`, error.message);
    throw error;
  }
}

// ─── fetchJson para POST com body JSON ───────────────────────────────────────
async function fetchJsonPost(endpoint: string, body: Record<string, any>) {
  return fetchJson(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── Mock data de clima ───────────────────────────────────────────────────────
async function loadMockWeatherData(icao: string) {
  try {
    const { METAR_MOCK_DATA } = await import('@/data/metarMockData');
    const mockData = METAR_MOCK_DATA[icao];
    if (mockData) {
      console.info(`[Mock Data] Usando dados mock para ${icao}`);
      return mockData;
    }
  } catch (err) {
    console.warn('[Mock Data] Falha ao carregar mock data:', err);
  }
  return null;
}

// ─── Cache persistente via IndexedDB ─────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function cachedFetch(
  key: string,
  fetcher: () => Promise<any>,
  allowMockFallback = false
) {
  // Cache hit — usa idbGet com timeout para não travar
  try {
    const cached = (await idbGet(key)) as { timestamp: number; data: any } | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.debug(`[Cache HIT] ${key}`);
      return cached.data;
    }
  } catch (err) {
    console.warn('[Cache READ ERROR]', key, err);
  }

  // Fetch
  try {
    console.debug(`[Cache MISS] Fetching ${key}`);
    const data = await fetcher();

    // fire-and-forget — não bloqueia o retorno se o IDB travar
    idbSet(key, { timestamp: Date.now(), data });

    return data;
  } catch (fetchError: any) {
    // Stale cache como fallback
    console.warn(`[Cache STALE FALLBACK] Fetcher failed for ${key}`);
    try {
      const stale = (await idbGet(key)) as { timestamp: number; data: any } | undefined;
      if (stale?.data) {
        console.info(`[Cache STALE HIT] ${key}`);
        return stale.data;
      }
    } catch { }

    // Mock data como último recurso (apenas para weather)
    if (allowMockFallback && key.startsWith('weather-')) {
      const icao = key.replace('weather-', '');
      const mockData = await loadMockWeatherData(icao);
      if (mockData) return mockData;
    }

    throw fetchError;
  }
}

// ─── apiClient ────────────────────────────────────────────────────────────────
export const apiClient = {

  // ── Weather (METAR/TAF) ────────────────────────────────────────────────────
  // O Worker já normaliza para { loc, metar: string, taf: string }
  getWeather: async (icao: string) => {
    const upperIcao = icao.toUpperCase();
    const cacheKey = `weather-${upperIcao}`;

    // Cache hit — usa idbGet com timeout para não travar
    try {
      const cached = (await idbGet(cacheKey)) as { timestamp: number; data: any } | undefined;
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.debug(`[Cache HIT] ${cacheKey}`);
        return cached.data;
      }
    } catch (err) {
      console.warn('[Cache READ ERROR]', cacheKey, err);
    }

    // API com timeout generoso (DECEA é lenta)
    try {
      console.debug(`[API] Fetching weather for ${upperIcao}`);
      const data = await fetchJson(API_ENDPOINTS.weather(icao), {}, WEATHER_TIMEOUT_MS);

      // fire-and-forget — não bloqueia o retorno se o IDB travar
      idbSet(cacheKey, { timestamp: Date.now(), data });

      return data;
    } catch (apiError: any) {
      console.warn(`[Weather API Failed] ${upperIcao}: ${apiError.message}`);

      // Mock como fallback — retorna silenciosamente sem erro
      try {
        const mockData = await loadMockWeatherData(upperIcao);
        if (mockData) {
          console.debug(`[Mock Fallback] Using mock data for ${upperIcao}`);
          return mockData;
        }
      } catch (mockError) {
        console.warn(`[Mock Fallback Failed] ${upperIcao}:`, mockError);
      }

      // Retorna objeto vazio em vez de lançar erro
      console.warn(`[Weather] Returning empty data for ${upperIcao}`);
      return { loc: upperIcao, metar: '', taf: '' };
    }
  },

  // ── Charts ─────────────────────────────────────────────────────────────────
  getCharts: (icao: string, especie?: string, tipo?: string) =>
    cachedFetch(
      `charts-${icao.toUpperCase()}-${especie || ''}-${tipo || ''}`,
      () => fetchJson(API_ENDPOINTS.charts(icao, especie, tipo))
    ),

  // ── NOTAMs ─────────────────────────────────────────────────────────────────
  getNotam: (icao: string) =>
    cachedFetch(
      `notam-${icao.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.notam(icao))
    ),

  // ── ROTAER — dados do aeródromo (/api/rotaer?adep=SBSP) ───────────────────
  // Usar quando se quer informações DE UM aeródromo (sem rota).
  getAerodrome: (icao: string) =>
    cachedFetch(
      `rotaer-${icao.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.rotaer(icao, ''))
    ),

  // ── Rotas preferenciais (/api/routes?adep=SBSP&ades=SBBR) ─────────────────
  // Usar quando se quer a rota ATC preferencial entre dois aeródromos.
  // ATENÇÃO: este endpoint é diferente de /api/rotaer.
  getPreferentialRoutes: (adep: string, ades: string) =>
    cachedFetch(
      `routes-${adep.toUpperCase()}-${ades.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.routes(adep, ades))
    ),

  // ── Solar (/api/solar/:icao) ───────────────────────────────────────────────
  getSolar: (icao: string, date?: string) => {
    const key = `solar-${icao.toUpperCase()}-${date ?? 'today'}`;
    const url = API_ENDPOINTS.solar(icao) + (date ? `?date=${date}` : '');
    return cachedFetch(key, () => fetchJson(url));
  },

  // ── Cálculos de voo (/api/flight-calculations POST) ───────────────────────
  flightCalculations: (params: {
    distance_nm: number;
    speed_kts?: number;
    fuel_burn?: number;
    reserve_min?: number;
    wind_kts?: number;
    taxi_min?: number;
  }) => fetchJsonPost(API_ENDPOINTS.flightCalculations, params),

  // ── Plano de voo completo (/api/flightplan) ────────────────────────────────
  getFlightPlan: (adep: string, ades: string, speed = 120, burn = 32, reserve = 45) =>
    fetchJson(API_ENDPOINTS.flightplan(adep, ades, speed, burn, reserve)),

  // ── Aeródromo mais próximo ─────────────────────────────────────────────────
  getNearestAirport: (lat: number, lon: number) =>
    fetchJson(API_ENDPOINTS.nearestAirport(lat, lon)),

  // ── Alternados próximos ────────────────────────────────────────────────────
  getNearbyAlternates: (lat: number, lon: number) =>
    cachedFetch(
      `geiloc-nearby-${lat}-${lon}`,
      () => fetchJson(API_ENDPOINTS.geilocNearby(lat, lon))
    ),
};

// ─── Error helper ─────────────────────────────────────────────────────────────
export function handleApiError(error: any): string {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'Erro desconhecido na API';
}
