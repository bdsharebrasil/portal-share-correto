// lib/apiClient.ts
import { get, set } from 'idb-keyval';

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const base = AIS_API_BASE_URL.replace(/\/$/, '');
  let ep = endpoint.replace(/^\/+/, '');
  if (ep.startsWith('api/')) ep = ep.replace(/^api\//, '');
  const url = `${base}/${ep}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AIS API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Cache persistente offline (IDB)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
async function cachedFetch(key: string, fetcher: () => Promise<any>) {
  const cached = (await get(key)) as { timestamp: number; data: any } | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  const data = await fetcher();
  await set(key, { timestamp: Date.now(), data });
  return data;
}

export const apiClient = {
  getWeather: (icao: string) =>
    cachedFetch(`weather-${icao.toUpperCase()}`, () => fetchJson(`/weather/${icao.toUpperCase()}`)),

  getNotam: (icao: string) =>
    cachedFetch(`notam-${icao.toUpperCase()}`, () => fetchJson(`/notam/${icao.toUpperCase()}`)),

  getROTAER: (adep: string, ades: string) =>
    cachedFetch(`rotaer-${adep.toUpperCase()}-${ades.toUpperCase()}`, () =>
      fetchJson(`/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`)
    ),

  getInfoTemp: (icao: string) =>
    cachedFetch(`infotemp-${icao.toUpperCase()}`, () => fetchJson(`/infotemp/${icao.toUpperCase()}`)),

  getCharts: (icao: string, especie?: string, tipo?: string) => {
    const params: Record<string, string> = {};
    if (especie) params.especie = especie;
    if (tipo) params.tipo = tipo;
    const query = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    return cachedFetch(`charts-${icao.toUpperCase()}-${query}`, () =>
      fetchJson(`/charts/${icao.toUpperCase()}${query}`)
    );
  },

  getSolar: (icao: string, date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return cachedFetch(`solar-${icao.toUpperCase()}-${query}`, () =>
      fetchJson(`/solar/${icao.toUpperCase()}${query}`)
    );
  },

  getWaypoints: () => cachedFetch('waypoints', () => fetchJson('/waypoints')),

  getPreferentialRoutes: (adep: string, ades: string) =>
    cachedFetch(`routes-${adep.toUpperCase()}-${ades.toUpperCase()}`, () =>
      fetchJson(`/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`)
    ),

  getNearbyAlternates: () => cachedFetch('geiloc-nearby', () => fetchJson('/geiloc/nearby')),
};

export function handleApiError(error: any): string {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'Erro desconhecido na API';
}