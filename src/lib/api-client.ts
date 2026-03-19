// lib/apiClient.ts
import { get, set } from 'idb-keyval';
import { API_ENDPOINTS } from '@/config/api';

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

// Configuração de timeout para fetch
const FETCH_TIMEOUT_MS = 8000; // 8 segundos para outros endpoints
const WEATHER_TIMEOUT_MS = 8000; // 8 segundos - API do DECEA responde entre 4-7s

// Configuração de retry - apenas para endpoints não-clima
const MAX_RETRIES = 0; // Sem retry por enquanto, API está instável
const INITIAL_RETRY_DELAY_MS = 500;

// Helper para fetch com timeout customizável
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
  const timeoutId = setTimeout(() => controller.abort(timeoutError), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw error.reason instanceof Error ? error.reason : new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}


async function fetchJson(endpoint: string, options: RequestInit = {}, customTimeout?: number) {
  // Se o endpoint é uma URL completa (começa com http), usar direto
  let url: string;

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    url = endpoint;
  } else {
    // Caso contrário, construir a URL
    const base = AIS_API_BASE_URL.replace(/\/$/, '');
    let ep = endpoint.replace(/^\/+/, '');
    if (ep.startsWith('api/')) ep = ep.replace(/^api\//, '');
    url = `${base}/${ep}`;
  }

  try {
    console.debug(`[API] Fetching: ${url}`);
    const timeoutMs = customTimeout || FETCH_TIMEOUT_MS;
    const res = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    }, timeoutMs);
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

// Função auxiliar para carregar mock data de clima
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

// Cache persistente offline (IDB) com fallback
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
async function cachedFetch(key: string, fetcher: () => Promise<any>, allowMockFallback = false) {
  try {
    const cached = (await get(key)) as { timestamp: number; data: any } | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.debug(`[Cache HIT] ${key}`);
      return cached.data;
    }
  } catch (err) {
    console.warn('[Cache READ ERROR]', key, err);
  }

  try {
    console.debug(`[Cache MISS] Fetching ${key}`);
    const data = await fetcher();

    // Tentar salvar no cache IDB, mas não falhar se não conseguir
    try {
      await set(key, { timestamp: Date.now(), data });
    } catch (err) {
      console.warn('[Cache WRITE ERROR]', key, err);
    }

    return data;
  } catch (fetchError: any) {
    // Se o fetch falhar, tentar usar cache mesmo que expirado
    console.warn(`[Cache STALE FALLBACK] Fetcher failed for ${key}, attempting stale cache`);
    try {
      const staleCache = (await get(key)) as { timestamp: number; data: any } | undefined;
      if (staleCache?.data) {
        console.info(`[Cache STALE HIT] Using stale data for ${key}`);
        return staleCache.data;
      }
    } catch (cacheErr) {
      console.warn('[Cache STALE READ ERROR]', key, cacheErr);
    }

    // Se for uma requisição de clima e permitido fallback, tentar mock data
    if (allowMockFallback && key.startsWith('weather-')) {
      const icao = key.replace('weather-', '');
      const mockData = await loadMockWeatherData(icao);
      if (mockData) {
        return mockData;
      }
    }

    // Nenhum fallback disponível, relançar erro
    throw fetchError;
  }
}

export const apiClient = {
  // Clima com fallback agressivo para mock data
  getWeather: async (icao: string) => {
    const upperIcao = icao.toUpperCase();
    const cacheKey = `weather-${upperIcao}`;

    try {
      // Tentar usar cache válido primeiro
      const cached = (await get(cacheKey)) as { timestamp: number; data: any } | undefined;
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.debug(`[Cache HIT] ${cacheKey}`);
        return cached.data;
      }
    } catch (err) {
      console.warn('[Cache READ ERROR]', cacheKey, err);
    }

    // Tentar API com timeout CURTO
    try {
      console.debug(`[API] Fetching weather for ${upperIcao}`);
      const data = await fetchJson(API_ENDPOINTS.weather(icao), {}, WEATHER_TIMEOUT_MS);

      // Salvar no cache
      try {
        await set(cacheKey, { timestamp: Date.now(), data });
      } catch (err) {
        console.warn('[Cache WRITE ERROR]', cacheKey, err);
      }

      return data;
    } catch (apiError: any) {
      // API falhou, tentar mock data
      console.warn(`[Weather API Failed] ${upperIcao}: ${apiError.message}`);
      const mockData = await loadMockWeatherData(upperIcao);
      if (mockData) {
        return mockData;
      }

      // Nenhum fallback disponível
      throw apiError;
    }
  },

  getCharts: (icao: string, especie?: string, tipo?: string) =>
    cachedFetch(`charts-${icao.toUpperCase()}-${especie || ''}-${tipo || ''}`, () =>
      fetchJson(API_ENDPOINTS.charts(icao, especie, tipo))
    , false),

  getNotam: (icao: string) =>
    cachedFetch(`notam-${icao.toUpperCase()}`, () => fetchJson(API_ENDPOINTS.notam(icao)), false),

  getPreferentialRoutes: (adep: string, ades: string) =>
    cachedFetch(`routes-${adep.toUpperCase()}-${ades.toUpperCase()}`, () =>
      fetchJson(API_ENDPOINTS.rotaer(adep, ades))
    , false),

  getFlightPlan: (adep: string, ades: string, speed = 120, burn = 32, reserve = 45) =>
    fetchJson(API_ENDPOINTS.flightplan(adep, ades, speed, burn, reserve)),

  getNearestAirport: (lat: number, lon: number) =>
    fetchJson(API_ENDPOINTS.nearestAirport(lat, lon)),

  getNearbyAlternates: (lat: number, lon: number) =>
    cachedFetch(`geiloc-nearby-${lat}-${lon}`, () =>
      fetchJson(API_ENDPOINTS.geilocNearby(lat, lon))
    , false),
};

export function handleApiError(error: any): string {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'Erro desconhecido na API';
}
