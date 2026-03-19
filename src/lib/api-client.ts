// lib/apiClient.ts
import { get, set } from 'idb-keyval';
import { API_ENDPOINTS } from '@/config/api';

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

// Configuração de timeout para fetch
const FETCH_TIMEOUT_MS = 60000; // 60 segundos (cold start do Worker + AISWEB pode ser lento)

// Configuração de retry com backoff exponencial
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 segundo

// Helper para fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutError = new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms`);
  const timeoutId = setTimeout(() => controller.abort(timeoutError), FETCH_TIMEOUT_MS);

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
      throw error.reason instanceof Error ? error.reason : new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

// Helper para retry com backoff exponencial
async function fetchWithRetry(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  try {
    if (retryCount === 0) {
      console.debug(`[API] Iniciando requisição para: ${url}`);
    }
    return await fetchWithTimeout(url, options);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (retryCount < MAX_RETRIES) {
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount); // 1s, 2s, 4s
      console.warn(`[API Retry] Tentativa ${retryCount + 1}/${MAX_RETRIES} falhada para ${url}: ${errorMsg}`);
      console.warn(`[API Retry] Aguardando ${delayMs}ms antes de tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    console.error(`[API] Todas as ${MAX_RETRIES} tentativas falharam para ${url}: ${errorMsg}`);
    throw error;
  }
}

async function fetchJson(endpoint: string, options: RequestInit = {}) {
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
    const res = await fetchWithRetry(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
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

// Cache persistente offline (IDB) com fallback
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
async function cachedFetch(key: string, fetcher: () => Promise<any>) {
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

    // Nenhum fallback disponível, relançar erro
    throw fetchError;
  }
}

export const apiClient = {
  getWeather: (icao: string) =>
    cachedFetch(`weather-${icao.toUpperCase()}`, () => fetchJson(API_ENDPOINTS.weather(icao))),

  getCharts: (icao: string, especie?: string, tipo?: string) =>
    cachedFetch(`charts-${icao.toUpperCase()}-${especie || ''}-${tipo || ''}`, () =>
      fetchJson(API_ENDPOINTS.charts(icao, especie, tipo))
    ),

  getNotam: (icao: string) =>
    cachedFetch(`notam-${icao.toUpperCase()}`, () => fetchJson(API_ENDPOINTS.notam(icao))),

  getPreferentialRoutes: (adep: string, ades: string) =>
    cachedFetch(`routes-${adep.toUpperCase()}-${ades.toUpperCase()}`, () =>
      fetchJson(API_ENDPOINTS.rotaer(adep, ades))
    ),

  getFlightPlan: (adep: string, ades: string, speed = 120, burn = 32, reserve = 45) =>
    fetchJson(API_ENDPOINTS.flightplan(adep, ades, speed, burn, reserve)),

  getNearestAirport: (lat: number, lon: number) =>
    fetchJson(API_ENDPOINTS.nearestAirport(lat, lon)),

  getNearbyAlternates: (lat: number, lon: number) =>
    cachedFetch(`geiloc-nearby-${lat}-${lon}`, () =>
      fetchJson(API_ENDPOINTS.geilocNearby(lat, lon))
    ),
};

export function handleApiError(error: any): string {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'Erro desconhecido na API';
}
