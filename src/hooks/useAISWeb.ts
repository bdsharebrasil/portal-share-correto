// hooks/useAISWeb.ts
import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlightPoint { lat: number; lng: number; }

interface AirspaceRestriction { name: string; type: string; active: boolean; }

interface ValidationResult {
  valid:               boolean;
  warnings:            string[];
  notams:              Record<string, any>;
  originStatus:        any;
  destinationStatus:   any;
  restrictions:        AirspaceRestriction[];
  distanceNm:          number;
  fuelRequired:        number;
  totalFuel:           number;
  reserveMinutes:      number;
  alternates:          { icao: string; name: string; lat: number; lon: number; distNm: number }[];
  alternate?:          string;
}

// ─── Cache config ─────────────────────────────────────────────────────────────

const CACHE_TTL      = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 100;

const CACHE_KEYS = {
  NOTAM:        (icao: string)               => `notam-${icao.toUpperCase()}`,
  ROTAER:       (icao: string)               => `rotaer-${icao.toUpperCase()}`,
  ROUTES:       (adep: string, ades: string) => `routes-${adep.toUpperCase()}-${ades.toUpperCase()}`,
  WEATHER:      (icao: string)               => `weather-${icao.toUpperCase()}`,
  CHARTS:       (icao: string, e = '', t = '') => `charts-${icao.toUpperCase()}-${e}-${t}`,
  SOLAR:        (icao: string, date = 'today') => `solar-${icao.toUpperCase()}-${date}`,
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAISWeb() {
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);

  const cacheRef    = useRef<Record<string, { timestamp: number; data: any }>>({});
  const inFlightRef = useRef<Map<string, Promise<any>>>(new Map());

  const isCacheValid = useCallback(
    (timestamp: number) => Date.now() - timestamp < CACHE_TTL,
    []
  );

  // LRU cleanup quando atinge limite
  const cleanupCache = useCallback(() => {
    const keys = Object.keys(cacheRef.current);
    if (keys.length >= MAX_CACHE_SIZE) {
      const oldest = keys.reduce((prev, curr) =>
        cacheRef.current[curr].timestamp < cacheRef.current[prev].timestamp ? curr : prev
      );
      delete cacheRef.current[oldest];
    }
  }, []);

  // Helper genérico com proteção contra race condition
  const withCache = useCallback(async <T,>(
    cacheKey:     string,
    fetcher:      () => Promise<T>,
    forceRefresh  = false
  ): Promise<T> => {
    // Requisição já em andamento — reutiliza a promise
    if (inFlightRef.current.has(cacheKey)) {
      return inFlightRef.current.get(cacheKey)!;
    }

    // Cache válido
    if (
      !forceRefresh &&
      cacheRef.current[cacheKey]?.data !== undefined &&
      isCacheValid(cacheRef.current[cacheKey].timestamp)
    ) {
      return cacheRef.current[cacheKey].data;
    }

    const promise = fetcher()
      .then(data => {
        cleanupCache();
        cacheRef.current[cacheKey] = { timestamp: Date.now(), data };
        inFlightRef.current.delete(cacheKey);
        return data;
      })
      .catch(err => {
        inFlightRef.current.delete(cacheKey);
        throw err;
      });

    inFlightRef.current.set(cacheKey, promise);
    return promise;
  }, [isCacheValid, cleanupCache]);

  // ── NOTAMs ──────────────────────────────────────────────────────────────────

  const getNOTAMs = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(
      CACHE_KEYS.NOTAM(icao),
      () => apiClient.getNotam(icao),
      forceRefresh
    ),
  [withCache]);

  const getMultipleNOTAMs = useCallback(async (
    icaos:        string[],
    forceRefresh  = false
  ): Promise<Record<string, any>> => {
    const result: Record<string, any> = {};
    await Promise.all(
      icaos.map(async (icao) => {
        try {
          result[icao.toUpperCase()] = await getNOTAMs(icao, forceRefresh);
        } catch (err) {
          console.error(`Erro ao buscar NOTAMs para ${icao}:`, err);
          result[icao.toUpperCase()] = [];
        }
      })
    );
    return result;
  }, [getNOTAMs]);

  // ── ROTAER — dados de um aeródromo ──────────────────────────────────────────
  // Chama /api/rotaer?adep=SBSP (sem ades).
  // NÃO usar para rotas preferenciais — use fetchPreferentialRoutes.
  const getROTAER = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(
      CACHE_KEYS.ROTAER(icao),
      () => apiClient.getAerodrome(icao),
      forceRefresh
    ),
  [withCache]);

  // ── Rotas preferenciais (/api/routes?adep=&ades=) ───────────────────────────
  // Separado de ROTAER — chama endpoint diferente no Worker.
  const fetchPreferentialRoutes = useCallback(async (adep: string, ades: string) =>
    withCache(
      CACHE_KEYS.ROUTES(adep, ades),
      () => apiClient.getPreferentialRoutes(adep, ades)
    ),
  [withCache]);

  // Alias mantido para retrocompatibilidade com código que usa fetchROTAER(adep, ades)
  const fetchROTAER = fetchPreferentialRoutes;

  // ── Weather ─────────────────────────────────────────────────────────────────

  const getWeather = useCallback(async (icao: string, forceRefresh = false) =>
    withCache(
      CACHE_KEYS.WEATHER(icao),
      () => apiClient.getWeather(icao),
      forceRefresh
    ),
  [withCache]);

  // ── Charts ──────────────────────────────────────────────────────────────────

  const getCharts = useCallback(async (
    icao:     string,
    especie?: string,
    tipo?:    string
  ) =>
    withCache(
      CACHE_KEYS.CHARTS(icao, especie, tipo),
      () => apiClient.getCharts(icao, especie, tipo)
    ),
  [withCache]);

  // ── Solar (/api/solar/:icao) ─────────────────────────────────────────────────

  const getSolar = useCallback(async (icao: string, date?: string) =>
    withCache(
      CACHE_KEYS.SOLAR(icao, date),
      () => apiClient.getSolar(icao, date)
    ),
  [withCache]);

  // ── Cálculos de voo (/api/flight-calculations) ───────────────────────────────
  // Sem cache — cálculo é síncrono no Worker, muito rápido.
  const calculateFlight = useCallback(async (params: Parameters<typeof apiClient.flightCalculations>[0]) => {
    setLoading(true);
    setError(null);
    try {
      return await apiClient.flightCalculations(params);
    } catch (err: any) {
      setError(err.message ?? 'Erro no cálculo de voo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Helpers de cálculo local ─────────────────────────────────────────────────

  const haversineNm = useCallback((
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ) => {
    const R     = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat  = toRad(lat2 - lat1);
    const dLon  = toRad(lon2 - lon1);
    const a     =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 0.539957;
  }, []);

  const calculateFuel = useCallback((
    distanceNm:   number,
    burnPerHour:  number,
    reserveMin:   number
  ) => {
    const timeH        = distanceNm / 120;
    const fuelRequired = timeH * burnPerHour;
    const totalFuel    = fuelRequired + (reserveMin / 60) * burnPerHour;
    return { fuelRequired, totalFuel };
  }, []);

  const fetchAlternates = useCallback(async (
    destLat:      number,
    destLon:      number,
    maxAlternates = 3
  ) => {
    try {
      const response = await apiClient.getNearbyAlternates(destLat, destLon);
      const nearby   = response?.alternates ?? response?.nearest ?? [];

      return (Array.isArray(nearby) ? nearby : [nearby])
        .filter((a: any) => a?.icao)
        .map((a: any) => ({
          icao:   a.icao,
          name:   a.name ?? a.icao,
          lat:    a.lat,
          lon:    a.lon,
          distNm: haversineNm(destLat, destLon, a.lat, a.lon),
        }))
        .sort((a: any, b: any) => a.distNm - b.distNm)
        .slice(0, maxAlternates);
    } catch {
      return [];
    }
  }, [haversineNm]);

  // ── Validação de plano de voo ─────────────────────────────────────────────────

  const validateFlightPlan = useCallback(async (
    origin:          string,
    destination:     string,
    routePoints:     FlightPoint[] = [],
    cruiseAltitude   = 5000,
    burnPerHour      = 32,
    reserveMinutes   = 45
  ): Promise<ValidationResult> => {
    setLoading(true);
    setError(null);

    try {
      const destLat = routePoints[routePoints.length - 1]?.lat ?? 0;
      const destLon = routePoints[routePoints.length - 1]?.lng ?? 0;

      // NOTAMs, rotas preferenciais e alternados em paralelo
      const [originNotam, destNotam, , alternates] = await Promise.all([
        getNOTAMs(origin),
        getNOTAMs(destination),
        fetchPreferentialRoutes(origin, destination),
        fetchAlternates(destLat, destLon),
      ]);

      const originLat  = routePoints[0]?.lat ?? 0;
      const originLon  = routePoints[0]?.lng ?? 0;
      const distanceNm = haversineNm(originLat, originLon, destLat, destLon);
      const { fuelRequired, totalFuel } = calculateFuel(distanceNm, burnPerHour, reserveMinutes);

      const originStatus      = { operational: true, warnings: [] as string[] };
      const destinationStatus = { operational: true, warnings: [] as string[] };

      return {
        valid:              originStatus.operational && destinationStatus.operational,
        warnings:           [...originStatus.warnings, ...destinationStatus.warnings],
        notams:             { [origin]: originNotam, [destination]: destNotam },
        originStatus,
        destinationStatus,
        restrictions:       [],
        distanceNm,
        fuelRequired,
        totalFuel,
        reserveMinutes,
        alternates,
        alternate:          alternates[0]?.icao,
      };
    } catch (err: any) {
      setError(err.message ?? 'Erro ao validar voo');
      return {
        valid:              false,
        warnings:           [err.message ?? 'Erro desconhecido'],
        notams:             {},
        originStatus:       { operational: false, warnings: [] },
        destinationStatus:  { operational: false, warnings: [] },
        restrictions:       [],
        distanceNm:         0,
        fuelRequired:       0,
        totalFuel:          0,
        reserveMinutes,
        alternates:         [],
      };
    } finally {
      setLoading(false);
    }
  }, [getNOTAMs, fetchPreferentialRoutes, fetchAlternates, haversineNm, calculateFuel]);

  // ── Cache utils ───────────────────────────────────────────────────────────────

  const clearCache = useCallback(() => {
    cacheRef.current = {};
    inFlightRef.current.clear();
  }, []);

  const getCacheAge = useCallback((icao: string, type: 'notams' | 'rotaer' | 'weather'): number | null => {
    const key =
      type === 'notams'  ? CACHE_KEYS.NOTAM(icao)    :
      type === 'rotaer'  ? CACHE_KEYS.ROTAER(icao)   :
      /* weather */        CACHE_KEYS.WEATHER(icao);

    if (!cacheRef.current[key]) return null;
    return Math.floor((Date.now() - cacheRef.current[key].timestamp) / 60_000);
  }, []);

  // Alias de retrocompatibilidade
  const fetchNOTAMs = useCallback(
    (icao: string) => getNOTAMs(icao, false),
    [getNOTAMs]
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    // NOTAMs
    getNOTAMs,
    getMultipleNOTAMs,
    fetchNOTAMs,          // legado
    // Aeródromo
    getROTAER,
    // Rotas preferenciais
    fetchROTAER,          // legado (alias de fetchPreferentialRoutes)
    fetchPreferentialRoutes,
    // Weather
    getWeather,
    // Charts
    getCharts,
    // Solar
    getSolar,
    // Cálculos
    calculateFlight,
    // Plano de voo
    validateFlightPlan,
    // Cache
    clearCache,
    getCacheAge,
  };
}