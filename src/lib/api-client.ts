// lib/api-client.ts
import { get, set } from 'idb-keyval'
import { API_ENDPOINTS } from '@/config/api'
import type { FlightPlanResponse } from '@/services/flightBriefing'

// ─── Timeouts ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000
const WEATHER_TIMEOUT_MS = 27_000

// ─── TTLs de cache (IndexedDB) ────────────────────────────────────────────────

const TTL = {
  weather: 2 * 60 * 1_000,  //  2 min — dados mudam frequentemente
  notam: 30 * 60 * 1_000,  // 30 min
  charts: 60 * 60 * 1_000,  //  1 h
  solar: 24 * 60 * 60 * 1_000, // 24 h — não muda no dia
  rotaer: 30 * 60 * 1_000,
  routes: 60 * 60 * 1_000,
  nearby: 30 * 60 * 1_000,
  default: 5 * 60 * 1_000,  //  5 min — fallback genérico
} as const

// ─── IDB com timeout ──────────────────────────────────────────────────────────

const IDB_TIMEOUT_MS = 800

async function idbGet(key: string): Promise<any> {
  return Promise.race([
    get(key),
    new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), IDB_TIMEOUT_MS)),
  ])
}

async function idbSet(key: string, value: any): Promise<void> {
  Promise.race([
    set(key, value),
    new Promise<void>(resolve => setTimeout(resolve, IDB_TIMEOUT_MS)),
  ]).catch((e) => console.warn('[IDB SET ERROR]', key, e))
}

// ─── fetch com timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`)
  const timeoutId = setTimeout(() => controller.abort(timeoutErr), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (error: any) {
    if (error.name === 'AbortError') throw error.reason instanceof Error ? error.reason : timeoutErr
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── fetchJson genérico ───────────────────────────────────────────────────────
// Recebe sempre a URL completa montada por API_ENDPOINTS.

async function fetchJson(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  try {
    console.debug(`[API] Fetching: ${url}`)
    const res = await fetchWithTimeout(
      url,
      { headers: { 'Content-Type': 'application/json' }, ...options },
      timeoutMs,
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AIS API error ${res.status}: ${text}`)
    }
    return await res.json()
  } catch (error: any) {
    // Para weather requests, apenas log de debug (fallback para mock será usado)
    const isWeatherRequest = url.includes('/weather/')
    if (isWeatherRequest) {
      console.debug(`[API Weather] Falha ao buscar dados: ${error.message}`)
    } else {
      console.error(`[API Error] ${url}:`, error.message)
    }
    throw error
  }
}

async function fetchJsonPost(url: string, body: Record<string, any>) {
  return fetchJson(url, { method: 'POST', body: JSON.stringify(body) })
}

// ─── Mock data de clima ───────────────────────────────────────────────────────

async function loadMockWeatherData(icao: string) {
  try {
    const { METAR_MOCK_DATA } = await import('@/data/metarMockData')
    const mockData = METAR_MOCK_DATA[icao]
    if (mockData) {
      console.info(`[Mock Data] Usando dados mock para ${icao}`)
      return mockData
    }
  } catch (err) {
    console.warn('[Mock Data] Falha ao carregar mock data:', err)
  }
  return null
}

// ─── Cache persistente via IndexedDB ─────────────────────────────────────────

interface CacheEntry { timestamp: number; data: any }

async function cachedFetch(
  key: string,
  fetcher: () => Promise<any>,
  ttlMs = TTL.default,
  allowMockFallback = false,
): Promise<any> {
  // 1. Cache fresco?
  try {
    const cached = await idbGet(key) as CacheEntry | undefined
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      console.debug(`[Cache HIT] ${key}`)
      return cached.data
    }
  } catch (err) {
    console.warn('[Cache READ ERROR]', key, err)
  }

  // 2. Busca na rede
  try {
    console.debug(`[Cache MISS] Fetching ${key}`)
    const data = await fetcher()
    idbSet(key, { timestamp: Date.now(), data }) // fire-and-forget
    return data
  } catch (fetchError: any) {
    // Apenas log de warn se não for fallback automático
    const isWeatherFail = key.startsWith('weather-')
    if (!isWeatherFail) {
      console.warn(`[Fetch FAILED] ${key}:`, fetchError.message)
    }

    // 3. Stale fallback — devolve dado expirado se existir
    try {
      const stale = await idbGet(key) as CacheEntry | undefined
      if (stale?.data) {
        console.info(`[Cache STALE HIT] ${key}`)
        return stale.data
      }
    } catch { }

    // 4. Mock fallback (só para weather)
    if (allowMockFallback) {
      const icao = key.replace('weather-', '')
      const mockData = await loadMockWeatherData(icao)
      if (mockData) {
        console.debug(`[Mock Fallback] Usando dados mock para ${icao}`)
        return mockData
      }
    }

    throw fetchError
  }
}

// ─── apiClient ────────────────────────────────────────────────────────────────

export const apiClient = {

  // ── Weather (METAR/TAF) ────────────────────────────────────────────────────
  getWeather: (icao: string) => {
    const upperIcao = icao.toUpperCase()
    return cachedFetch(
      `weather-${upperIcao}`,
      () => fetchJson(API_ENDPOINTS.weather(upperIcao), {}, WEATHER_TIMEOUT_MS),
      TTL.weather,
      true, // allowMockFallback
    )
  },

  // ── Charts ─────────────────────────────────────────────────────────────────
  getCharts: (icao: string, especie?: string, tipo?: string) =>
    cachedFetch(
      `charts-${icao.toUpperCase()}-${especie ?? ''}-${tipo ?? ''}`,
      () => fetchJson(API_ENDPOINTS.charts(icao, especie, tipo)),
      TTL.charts,
    ),

  // ── NOTAMs ─────────────────────────────────────────────────────────────────
  getNotam: (icao: string) =>
    cachedFetch(
      `notam-${icao.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.notam(icao)),
      TTL.notam,
    ),

  // ── ROTAER — dados do aeródromo ────────────────────────────────────────────
  getAerodrome: (icao: string) =>
    cachedFetch(
      `rotaer-${icao.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.rotaer(icao, '')),
      TTL.rotaer,
    ),

  // ── Rotas preferenciais ────────────────────────────────────────────────────
  getPreferentialRoutes: (adep: string, ades: string) =>
    cachedFetch(
      `routes-${adep.toUpperCase()}-${ades.toUpperCase()}`,
      () => fetchJson(API_ENDPOINTS.routes(adep, ades)),
      TTL.routes,
    ),

  // ── Solar ──────────────────────────────────────────────────────────────────
  getSolar: (icao: string, date?: string) =>
    cachedFetch(
      `solar-${icao.toUpperCase()}-${date ?? 'today'}`,
      () => fetchJson(API_ENDPOINTS.solar(icao) + (date ? `?date=${date}` : '')),
      TTL.solar,
    ),

  // ── Cálculos de voo (POST) ─────────────────────────────────────────────────
  flightCalculations: (params: {
    distance_nm: number
    speed_kts?: number
    fuel_burn?: number
    reserve_min?: number
    wind_kts?: number
    taxi_min?: number
  }) => fetchJsonPost(API_ENDPOINTS.flightCalculations, params),

  // ── Plano de voo completo ──────────────────────────────────────────────────
  getFlightPlan: (
    adep: string,
    ades: string,
    speed = 120,
    burn = 32,
    reserve = 45,
  ): Promise<FlightPlanResponse> =>
    fetchJson(API_ENDPOINTS.flightplan(adep, ades, speed, burn, reserve)),

  // ── Aeródromo mais próximo ─────────────────────────────────────────────────
  getNearestAirport: (lat: number, lon: number) =>
    cachedFetch(
      `nearest-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      () => fetchJson(API_ENDPOINTS.nearestAirport(lat, lon)),
      TTL.nearby,
    ),

  // ── Alternados próximos ────────────────────────────────────────────────────
  getNearbyAlternates: (lat: number, lon: number) =>
    cachedFetch(
      `geiloc-nearby-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      () => fetchJson(API_ENDPOINTS.geilocNearby(lat, lon)),
      TTL.nearby,
    ),
}

// ─── Error helper ─────────────────────────────────────────────────────────────

export function handleApiError(error: any): string {
  if (error.response?.data?.error) return error.response.data.error
  if (error.message) return error.message
  return 'Erro desconhecido na API'
}
