// lib/apiClient.ts
import { get, set } from 'idb-keyval';
import { API_ENDPOINTS } from '@/config/api';

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

// Configuração de timeout para fetch
const FETCH_TIMEOUT_MS = 8000; // 8 segundos

// Helper para fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
      throw new Error(`Request timeout after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const base = AIS_API_BASE_URL.replace(/\/$/, '');
  let ep = endpoint.replace(/^\/+/, '');
  if (ep.startsWith('api/')) ep = ep.replace(/^api\//, '');
  const url = `${base}/${ep}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AIS API error ${res.status}: ${text}`);
    }
    return res.json();
  } catch (error: any) {
    console.error(`[API Error] Failed to fetch ${ep}:`, error.message);
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
