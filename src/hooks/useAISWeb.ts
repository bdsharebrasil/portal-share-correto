// hooks/useAISWeb.ts
import { useState, useCallback, useRef } from 'react'
import { apiClient } from '../lib/api-client'
import { generateFlightBriefing, generateBriefingSummary, type FlightPlanResponse } from '../services/flightBriefing'
import { calculateDistance } from '@/lib/geo'
import { isAerodromeOperational } from '@/lib/aviation'
import type { NOTAMData, RouteValidation } from '@/types/aisweb'

interface FlightPoint { lat: number; lng: number; icao?: string }

const asNotamArray = (raw: any): any[] => {
  const candidates = [
    raw,
    raw?.notam,
    raw?.notams,
    raw?.aisweb?.notam,
    raw?.data,
    raw?.response,
  ];
  const flatten = (value: any): any[] => {
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (value?.item != null) return flatten(value.item);
    if (value?.notam != null) return flatten(value.notam);
    if (value && typeof value === 'object') return [value];
    return [];
  };
  return candidates.flatMap(flatten).filter((entry, index, list) => list.indexOf(entry) === index);
};

const parseNotamDate = (value: any): string => {
  if (value == null || value === '' || String(value).toUpperCase() === 'PERM') return '';
  const text = String(value);
  const compact = text.match(/^(\d{10})$/)?.[1];
  if (compact) {
    const [yy, mm, dd, hh, min] = [compact.slice(0, 2), compact.slice(2, 4), compact.slice(4, 6), compact.slice(6, 8), compact.slice(8, 10)];
    return `20${yy}-${mm}-${dd}T${hh}:${min}:00Z`;
  }
  const date = new Date(text.replace(' ', 'T') + (text.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(text) ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const normalizeNotam = (raw: any, fallbackIcao: string): NOTAMData => {
  const message = String(raw?.message ?? raw?.e ?? raw?.text ?? raw?.descricao ?? '').trim();
  const upperMessage = message.toUpperCase();
  const priority: NOTAMData['priority'] = /AERODROME\\s+CLSD|RWY[^\\n]*CLSD|AIRSPACE[^\\n]*(PROHIB|RESTRICT)/.test(upperMessage)
    ? 'critical'
    : /UNSERVICEABLE|WORK IN PROGRESS|WIP|RESTRICTED|LIMITED/.test(upperMessage)
      ? 'high'
      : 'medium';
  return {
    id: String(raw?.id ?? `${fallbackIcao}-${raw?.n ?? raw?.number ?? Math.random()}`),
    icao: String(raw?.loc ?? raw?.icao ?? fallbackIcao).toUpperCase(),
    number: String(raw?.n ?? raw?.number ?? raw?.cod ?? '—'),
    type: raw?.tp === 'NOTAMR' ? 'NOTAMR' : raw?.tp === 'NOTAMC' ? 'NOTAMC' : 'NOTAM',
    category: String(raw?.cat ?? raw?.category ?? 'AGA'),
    traffic: String(raw?.traffic ?? ''),
    purpose: String(raw?.purpose ?? ''),
    scope: String(raw?.s ?? raw?.scope ?? ''),
    lower: String(raw?.f ?? raw?.lower ?? ''),
    upper: String(raw?.g ?? raw?.upper ?? ''),
    coordinates: raw?.geo ? String(raw.geo) : null,
    radius: raw?.radius != null ? Number(raw.radius) : null,
    message: message || 'Texto do NOTAM não informado pela fonte.',
    startDate: parseNotamDate(raw?.b ?? raw?.startDate ?? raw?.dt),
    endDate: parseNotamDate(raw?.c ?? raw?.endDate),
    schedule: raw?.d ? String(raw.d) : null,
    created: parseNotamDate(raw?.dt ?? raw?.created),
    source: String(raw?.origem ?? raw?.source ?? 'AISWeb/DECEA'),
    priority,
  };
};

const normalizeNotams = (raw: any, icao: string): NOTAMData[] => asNotamArray(raw).map((entry) => normalizeNotam(entry, icao));

const normalizeRotaer = (raw: any, fallbackIcao: string): any => {
  const item = raw?.airport ?? raw?.aerodrome ?? raw?.item?.[0] ?? raw?.item ?? raw?.data?.item?.[0] ?? raw?.data ?? raw;
  const source = item?.aerodrome ?? item?.airport ?? item?.rotaer ?? item ?? {};
  const coordinateSource = source.coordinates ?? source.coordenadas;
  const lat = coordinateSource?.lat ?? coordinateSource?.latitude ?? source.latitude ?? source.lat;
  const lng = coordinateSource?.lng ?? coordinateSource?.lon ?? coordinateSource?.longitude ?? source.longitude ?? source.lng ?? source.lon;
  const toArray = (value: any) => Array.isArray(value) ? value : value ? [value] : [];
  return {
    ...source,
    icao: String(source.icao ?? source.AeroCode ?? source.IcaoCode ?? source.icaoCode ?? fallbackIcao).toUpperCase(),
    name: source.name ?? source.nome ?? source.designacao ?? fallbackIcao,
    city: source.city ?? source.cidade ?? source.municipio,
    state: source.state ?? source.uf ?? source.estado,
    elevation: source.elevation ?? source.elevacao ?? source.altitude ?? source.Elev ?? null,
    coordinates: lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null,
    runways: toArray(source.runways ?? source.pistas ?? source.runway),
    frequencies: toArray(source.frequencies ?? source.frequencias ?? source.frequency),
    restrictions: toArray(source.restrictions ?? source.restricoes ?? source.observacoes),
    contact: source.contact ?? source.contato ?? {
      phone: source.phone ?? source.telefone ?? source.tel,
      email: source.email,
    },
    raw_data: source,
  };
};

type ValidationResult = RouteValidation & {
  distanceNm: number
  fuelRequired: number
  totalFuel: number
  reserveMinutes: number
  alternates: { icao: string; name: string; lat: number; lon: number; distNm: number }[]
  alternate?: string
}

// Resposta enriquecida do getFlightPlan — inclui briefing gerado localmente
export interface FlightPlanResult extends FlightPlanResponse {
  briefing:        string
  briefingSummary: string
}

// ─── Cache config ─────────────────────────────────────────────────────────────

const CACHE_TTL      = 5 * 60 * 1000
const MAX_CACHE_SIZE = 100

const CACHE_KEYS = {
  NOTAM:   (icao: string)               => `notam-${icao.toUpperCase()}`,
  ROTAER:  (icao: string)               => `rotaer-${icao.toUpperCase()}`,
  ROUTES:  (adep: string, ades: string) => `routes-${adep.toUpperCase()}-${ades.toUpperCase()}`,
  WEATHER: (icao: string)               => `weather-${icao.toUpperCase()}`,
  CHARTS:  (icao: string, e = '', t = '') => `charts-${icao.toUpperCase()}-${e}-${t}`,
  SOLAR:   (icao: string, date = 'today') => `solar-${icao.toUpperCase()}-${date}`,
} as const

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAISWeb() {
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<string | null>(null)

  const cacheRef    = useRef<Record<string, { timestamp: number; data: any }>>({})
  const inFlightRef = useRef<Map<string, Promise<any>>>(new Map())

  const isCacheValid = useCallback(
    (timestamp: number) => Date.now() - timestamp < CACHE_TTL,
    []
  )

  const cleanupCache = useCallback(() => {
    const keys = Object.keys(cacheRef.current)
    if (keys.length >= MAX_CACHE_SIZE) {
      const oldest = keys.reduce((prev, curr) =>
        cacheRef.current[curr].timestamp < cacheRef.current[prev].timestamp ? curr : prev
      )
      delete cacheRef.current[oldest]
    }
  }, [])

  const withCache = useCallback(async <T,>(
    cacheKey:    string,
    fetcher:     () => Promise<T>,
    forceRefresh = false
  ): Promise<T> => {
    if (inFlightRef.current.has(cacheKey)) return inFlightRef.current.get(cacheKey)!

    if (
      !forceRefresh &&
      cacheRef.current[cacheKey]?.data !== undefined &&
      isCacheValid(cacheRef.current[cacheKey].timestamp)
    ) {
      return cacheRef.current[cacheKey].data
    }

    const promise = fetcher()
      .then(data => {
        cleanupCache()
        cacheRef.current[cacheKey] = { timestamp: Date.now(), data }
        inFlightRef.current.delete(cacheKey)
        return data
      })
      .catch(err => {
        inFlightRef.current.delete(cacheKey)
        throw err
      })

    inFlightRef.current.set(cacheKey, promise)
    return promise
  }, [isCacheValid, cleanupCache])

  // ── NOTAMs ──────────────────────────────────────────────────────────────────

  const getNOTAMs = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(CACHE_KEYS.NOTAM(icao), async () => normalizeNotams(await apiClient.getNotam(icao), icao), forceRefresh),
  [withCache])

  const getMultipleNOTAMs = useCallback(async (
    icaos:       string[],
    forceRefresh = false
  ): Promise<Record<string, any>> => {
    const result: Record<string, any> = {}
    await Promise.all(
      icaos.map(async (icao) => {
        try {
          result[icao.toUpperCase()] = await getNOTAMs(icao, forceRefresh)
        } catch (err) {
          console.error(`Erro ao buscar NOTAMs para ${icao}:`, err)
          result[icao.toUpperCase()] = []
        }
      })
    )
    return result
  }, [getNOTAMs])

  // ── ROTAER ──────────────────────────────────────────────────────────────────

  const getROTAER = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(CACHE_KEYS.ROTAER(icao), async () => normalizeRotaer(await apiClient.getAerodrome(icao), icao), forceRefresh),
  [withCache])

  // ── Rotas preferenciais ──────────────────────────────────────────────────────

  const fetchPreferentialRoutes = useCallback(async (adep: string, ades: string) =>
    withCache(CACHE_KEYS.ROUTES(adep, ades), () => apiClient.getPreferentialRoutes(adep, ades)),
  [withCache])


  // ── Weather ─────────────────────────────────────────────────────────────────

  const getWeather = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(CACHE_KEYS.WEATHER(icao), () => apiClient.getWeather(icao), forceRefresh),
  [withCache])

  // ── Charts ──────────────────────────────────────────────────────────────────

  const getCharts = useCallback(async (icao: string, especie?: string, tipo?: string) =>
    withCache(CACHE_KEYS.CHARTS(icao, especie, tipo), () => apiClient.getCharts(icao, especie, tipo)),
  [withCache])

  // ── Solar ────────────────────────────────────────────────────────────────────

  const getSolar = useCallback(async (icao: string, date?: string) =>
    withCache(CACHE_KEYS.SOLAR(icao, date), () => apiClient.getSolar(icao, date)),
  [withCache])

  // ── Cálculos de voo ──────────────────────────────────────────────────────────

  const calculateFlight = useCallback(async (params: Parameters<typeof apiClient.flightCalculations>[0]) => {
    setLoading(true)
    setError(null)
    try {
      return await apiClient.flightCalculations(params)
    } catch (err: any) {
      setError(err.message ?? 'Erro no cálculo de voo')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Plano de voo + briefing local ────────────────────────────────────────────
  // Chama /api/flightplan e gera o briefing no frontend via generateFlightBriefing().
  // Não depende de AI Workers — funciona 100% no plano gratuito.

  const getFlightPlan = useCallback(async (
    adep:    string,
    ades:    string,
    speed    = 120,
    burn     = 32,
    reserve  = 45,
  ): Promise<FlightPlanResult> => {
    setLoading(true)
    setError(null)
    try {
      const plan = await apiClient.getFlightPlan(adep, ades, speed, burn, reserve)

      // Briefing gerado localmente — zero latência, zero custo
      const briefing        = generateFlightBriefing(plan)
      const briefingSummary = generateBriefingSummary(plan)

      return { ...plan, briefing, briefingSummary }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao gerar plano de voo')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Helpers locais ────────────────────────────────────────────────────────────

  const calculateFuel = useCallback((distanceNm: number, speedKts: number, burnPerHour: number, reserveMin: number) => {
    if (!Number.isFinite(distanceNm) || distanceNm <= 0 || !Number.isFinite(speedKts) || speedKts <= 0 || !Number.isFinite(burnPerHour) || burnPerHour <= 0) {
      return { fuelRequired: 0, totalFuel: 0 }
    }
    const timeH        = distanceNm / speedKts
    const fuelRequired = timeH * burnPerHour
    const totalFuel    = fuelRequired + (reserveMin / 60) * burnPerHour
    return { fuelRequired, totalFuel }
  }, [])

  const fetchAlternates = useCallback(async (destLat: number, destLon: number, maxAlternates = 3) => {
    try {
      const response = await apiClient.getNearbyAlternates(destLat, destLon)
      const nearby   = response?.alternates ?? response?.nearest ?? []
      return (Array.isArray(nearby) ? nearby : [nearby])
        .filter((a: any) => a?.icao)
        .map((a: any) => ({
          icao:   a.icao,
          name:   a.nome ?? a.icao,
          lat:    a.lat,
          lon:    a.lon,
          distNm: calculateDistance(destLat, destLon, a.lat, a.lon),
        }))
        .sort((a: any, b: any) => a.distNm - b.distNm)
        .slice(0, maxAlternates)
    } catch {
      return []
    }
  }, [])

  // ── Validação de plano de voo ─────────────────────────────────────────────────

  const validateFlightPlan = useCallback(async (
    origin:        string,
    destination:   string,
    routePoints:   FlightPoint[] = [],
    _cruiseAlt     = 5000,
    speedKts       = 120,
    burnPerHour    = 32,
    reserveMinutes = 45,
  ): Promise<ValidationResult> => {
    setLoading(true)
    setError(null)
    try {
      const destLat = routePoints[routePoints.length - 1]?.lat ?? 0
      const destLon = routePoints[routePoints.length - 1]?.lng ?? 0

      const routeIcaos = Array.from(new Set([origin, destination, ...routePoints.map((point) => point.icao ?? '')].filter(Boolean).map((icao) => icao.toUpperCase())))
      const [routeNotams, , alternates] = await Promise.all([
        getMultipleNOTAMs(routeIcaos),
        fetchPreferentialRoutes(origin, destination),
        fetchAlternates(destLat, destLon),
      ])
      const originNotam = routeNotams[origin.toUpperCase()] ?? []
      const destNotam = routeNotams[destination.toUpperCase()] ?? []

      const originLat  = routePoints[0]?.lat ?? 0
      const originLon  = routePoints[0]?.lng ?? 0
      const distanceNm = routePoints.length > 1
        ? routePoints.slice(1).reduce((total, point, index) => total + calculateDistance(routePoints[index].lat, routePoints[index].lng, point.lat, point.lng), 0)
        : calculateDistance(originLat, originLon, destLat, destLon)
      const { fuelRequired, totalFuel } = calculateFuel(distanceNm, speedKts, burnPerHour, reserveMinutes)
      const originStatus = isAerodromeOperational(originNotam as NOTAMData[])
      const destinationStatus = isAerodromeOperational(destNotam as NOTAMData[])
      const allNotams = Object.values(routeNotams).flat() as NOTAMData[]
      const highPriorityCount = allNotams.filter((notam) => notam.priority === 'high').length
      const criticalCount = allNotams.filter((notam) => notam.priority === 'critical').length
      const routeStatus = !originStatus.operational || !destinationStatus.operational || criticalCount > 0
        ? 'danger'
        : highPriorityCount > 0
          ? 'warning'
          : allNotams.length > 0
            ? 'caution'
            : 'clear'
      const warnings = [originStatus.reason, destinationStatus.reason].filter((warning): warning is string => Boolean(warning))

      return {
        valid: originStatus.operational && destinationStatus.operational && routeStatus !== 'danger',
        warnings,
        notams: routeNotams,
        originStatus: originStatus as unknown as { operational: boolean; reason: string; criticalNOTAMs: NOTAMData[]; warnings?: string[] },
        destinationStatus: destinationStatus as unknown as { operational: boolean; reason: string; criticalNOTAMs: NOTAMData[]; warnings?: string[] },

        restrictions: [],
        routeStatus,
        distanceNm,
        fuelRequired,
        totalFuel,
        reserveMinutes,
        alternates,
        alternate: alternates[0]?.icao,
      }
    } catch (err: any) {
      setError(err.message ?? 'Erro ao validar voo')
      return {
        valid:              false,
        warnings:           [err.message ?? 'Erro desconhecido'],
        notams:             {},
        originStatus: { operational: false, reason: null, criticalNOTAMs: [] },
        destinationStatus: { operational: false, reason: null, criticalNOTAMs: [] },
        restrictions: [],
        routeStatus: 'danger',
        distanceNm: 0,
        fuelRequired:       0,
        totalFuel:          0,
        reserveMinutes,
        alternates:         [],
      }
    } finally {
      setLoading(false)
    }
  }, [getMultipleNOTAMs, fetchPreferentialRoutes, fetchAlternates, calculateFuel])

  // ── Cache utils ───────────────────────────────────────────────────────────────

  const clearCache = useCallback(() => {
    cacheRef.current = {}
    inFlightRef.current.clear()
  }, [])

  const getCacheAge = useCallback((icao: string, type: 'notams' | 'rotaer' | 'weather'): number | null => {
    const key =
      type === 'notams'  ? CACHE_KEYS.NOTAM(icao)    :
      type === 'rotaer'  ? CACHE_KEYS.ROTAER(icao)   :
      /* weather */        CACHE_KEYS.WEATHER(icao)
    if (!cacheRef.current[key]) return null
    return Math.floor((Date.now() - cacheRef.current[key].timestamp) / 60_000)
  }, [])

  // Alias de retrocompatibilidade
  const fetchNOTAMs = useCallback((icao: string) => getNOTAMs(icao, false), [getNOTAMs])

  // ─────────────────────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    // NOTAMs
    getNOTAMs,
    getMultipleNOTAMs,
    fetchNOTAMs,            // legado
    // Aeródromo
    getROTAER,
    // Rotas preferenciais
    fetchPreferentialRoutes,
    // Weather
    getWeather,
    // Charts
    getCharts,
    // Solar
    getSolar,
    // Cálculos
    calculateFlight,
    // Plano de voo (com briefing local)
    getFlightPlan,
    // Validação
    validateFlightPlan,
    // Cache
    clearCache,
    getCacheAge,
  }
}
