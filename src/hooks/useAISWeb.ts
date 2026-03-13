// hooks/useAISWeb.ts
import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api-client';

interface FlightPoint { lat: number; lng: number; }
interface AirspaceRestriction { name: string; type: string; active: boolean; }

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  notams: Record<string, any>;
  originStatus: any;
  destinationStatus: any;
  restrictions: AirspaceRestriction[];
  distanceNm: number;
  fuelRequired: number;
  totalFuel: number;
  reserveMinutes: number;
  alternates: { icao: string; name: string; lat: number; lon: number; distNm: number }[];
  alternate?: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 100; // Evitar vazamento de memória

// Chaves de cache centralizadas
const CACHE_KEYS = {
  NOTAM: (icao: string) => `notam-${icao.toUpperCase()}`,
  ROTAER: (icao: string) => `rotaer-${icao.toUpperCase()}`,
  ROTAER_ROUTE: (adep: string, ades: string) => `rotaer-${adep.toUpperCase()}-${ades.toUpperCase()}`,
} as const;

export function useAISWeb() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, { timestamp: number; data: any }>>({});
  const inFlightRef = useRef<Map<string, Promise<any>>>(new Map());

  const isCacheValid = useCallback((timestamp: number) => Date.now() - timestamp < CACHE_TTL, []);

  // Helper para limpar cache LRU quando atinge limite
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
    cacheKey: string,
    fetcher: () => Promise<T>,
    forceRefresh = false
  ): Promise<T> => {
    // Se há uma requisição em voo, retorna promise existente
    if (inFlightRef.current.has(cacheKey)) {
      return inFlightRef.current.get(cacheKey)!;
    }

    // Se cache válido e não forçar refresh, retorna cache
    if (!forceRefresh && cacheRef.current[cacheKey]?.data !== undefined &&
        isCacheValid(cacheRef.current[cacheKey].timestamp)) {
      return cacheRef.current[cacheKey].data;
    }

    // Inicia nova requisição
    const promise = fetcher().then(data => {
      cleanupCache();
      cacheRef.current[cacheKey] = { timestamp: Date.now(), data };
      inFlightRef.current.delete(cacheKey);
      return data;
    }).catch(err => {
      inFlightRef.current.delete(cacheKey);
      throw err;
    });

    inFlightRef.current.set(cacheKey, promise);
    return promise;
  }, [isCacheValid, cleanupCache]);

  // Busca NOTAMs de um único ICAO
  const getNOTAMs = useCallback(async (icao: string, forceRefresh = false) => {
    return withCache(
      CACHE_KEYS.NOTAM(icao),
      () => apiClient.getNotam(icao),
      forceRefresh
    );
  }, [withCache]);

  // Busca NOTAMs para múltiplos ICAOs
  const getMultipleNOTAMs = useCallback(async (icaos: string[], forceRefresh = false): Promise<Record<string, any>> => {
    const result: Record<string, any> = {};
    await Promise.all(
      icaos.map(async (icao) => {
        try {
          const data = await getNOTAMs(icao, forceRefresh);
          result[icao.toUpperCase()] = data;
        } catch (err) {
          console.error(`Erro ao buscar NOTAMs para ${icao}:`, err);
          result[icao.toUpperCase()] = [];
        }
      })
    );
    return result;
  }, [getNOTAMs]);

  // Busca dados ROTAER
  const getROTAER = useCallback(async (icao: string, forceRefresh = false) => {
    return withCache(
      CACHE_KEYS.ROTAER(icao),
      () => apiClient.getPreferentialRoutes(icao, icao),
      forceRefresh
    );
  }, [withCache]);

  const fetchROTAER = useCallback(async (adep: string, ades: string) => {
    return withCache(
      CACHE_KEYS.ROTAER_ROUTE(adep, ades),
      () => apiClient.getPreferentialRoutes(adep, ades)
    );
  }, [withCache]);

  const haversineNm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return km * 0.539957;
  }, []);

  const calculateFuel = useCallback((distanceNm: number, burnPerHour: number, reserveMin: number) => {
    const timeH = distanceNm / 120;
    const fuelRequired = timeH * burnPerHour;
    const totalFuel = fuelRequired + (reserveMin / 60) * burnPerHour;
    return { fuelRequired, totalFuel };
  }, []);

  const fetchAlternates = useCallback(async (destLat: number, destLon: number, maxAlternates = 3) => {
    try {
      const response = await apiClient.getNearbyAlternates(destLat, destLon);
      const nearby = response?.nearest || response?.alternates || [];
      return (Array.isArray(nearby) ? nearby : [nearby])
        .filter(a => a && a.icao)
        .map(a => ({
          icao: a.icao,
          name: a.name || a.icao,
          lat: a.lat,
          lon: a.lon,
          distNm: haversineNm(destLat, destLon, a.lat, a.lon),
        }))
        .sort((a, b) => a.distNm - b.distNm)
        .slice(0, maxAlternates);
    } catch {
      return [];
    }
  }, [haversineNm]);

  const validateFlightPlan = useCallback(async (
    origin: string,
    destination: string,
    routePoints: FlightPoint[] = [],
    cruiseAltitude = 5000,
    burnPerHour = 32,
    reserveMinutes = 45
  ): Promise<ValidationResult> => {
    setLoading(true); setError(null);
    try {
      // Executar NOTAMs, ROTAER e alternates em PARALELO
      const [originNotam, destNotam, rotaer, alternates] = await Promise.all([
        getNOTAMs(origin),
        getNOTAMs(destination),
        fetchROTAER(origin, destination),
        fetchAlternates(
          routePoints[routePoints.length - 1]?.lat || 0,
          routePoints[routePoints.length - 1]?.lng || 0
        )
      ]);

      // Calcular distância e combustível
      const originLat = routePoints[0]?.lat || 0;
      const originLon = routePoints[0]?.lng || 0;
      const destLat = routePoints[routePoints.length - 1]?.lat || 0;
      const destLon = routePoints[routePoints.length - 1]?.lng || 0;
      const distanceNm = haversineNm(originLat, originLon, destLat, destLon);
      const { fuelRequired, totalFuel } = calculateFuel(distanceNm, burnPerHour, reserveMinutes);

      const originStatus = { operational: true, warnings: [] };
      const destinationStatus = { operational: true, warnings: [] };
      const restrictions: AirspaceRestriction[] = [];

      return {
        valid: originStatus.operational && destinationStatus.operational,
        warnings: [...originStatus.warnings, ...destinationStatus.warnings],
        notams: { [origin]: originNotam, [destination]: destNotam },
        originStatus, destinationStatus,
        restrictions, distanceNm, fuelRequired, totalFuel,
        reserveMinutes, alternates, alternate: alternates[0]?.icao
      };
    } catch (err: any) {
      setError(err.message || 'Erro ao validar voo');
      return {
        valid: false, warnings: [err.message || 'Erro desconhecido'],
        notams: {}, originStatus: { operational: false, warnings: [] },
        destinationStatus: { operational: false, warnings: [] },
        restrictions: [], distanceNm: 0, fuelRequired: 0, totalFuel: 0,
        reserveMinutes, alternates: []
      };
    } finally { setLoading(false); }
  }, [getNOTAMs, fetchROTAER, fetchAlternates, haversineNm, calculateFuel]);

  const clearCache = useCallback(() => {
    cacheRef.current = {};
    inFlightRef.current.clear();
  }, []);

  const getCacheAge = useCallback((icao: string, type: 'notams' | 'rotaer'): number | null => {
    const key = type === 'notams' ? CACHE_KEYS.NOTAM(icao) : CACHE_KEYS.ROTAER(icao);
    if (!cacheRef.current[key]) return null;
    const ageMs = Date.now() - cacheRef.current[key].timestamp;
    return Math.floor(ageMs / 60000); // Retorna idade em minutos
  }, []);

  // Compatibilidade com código antigo
  const fetchNOTAMs = useCallback((icao: string) => getNOTAMs(icao, false), [getNOTAMs]);

  // Busca dados de weather (METAR) com fallback automático para mock
  const getWeather = useCallback(async (icao: string, forceRefresh = false) => {
    return withCache(
      `weather-${icao.toUpperCase()}`,
      async () => {
        try {
          return await apiClient.getWeather(icao);
        } catch (error: any) {
          // Se a API falhar, tentar usar mock data como fallback
          console.warn(`[useAISWeb] getWeather failed for ${icao}, attempting mock data fallback`, error.message);

          try {
            // Dinamicamente importar mock data
            const { METAR_MOCK_DATA } = await import('@/data/metarMockData');
            const mockData = METAR_MOCK_DATA[icao];

            if (mockData) {
              console.info(`[useAISWeb] Using mock data for ${icao}`);
              return mockData;
            }
          } catch (mockError) {
            console.error(`[useAISWeb] Failed to load mock data for ${icao}:`, mockError);
          }

          // Se nenhum fallback funcionar, relançar o erro original
          throw error;
        }
      },
      forceRefresh
    );
  }, [withCache]);

  // Busca cartas aeronáuticas
  const getCharts = useCallback(async (icao: string, especie?: string, tipo?: string) => {
    const cacheKey = `charts-${icao.toUpperCase()}-${especie || ''}-${tipo || ''}`;
    return withCache(
      cacheKey,
      () => apiClient.getCharts(icao, especie, tipo)
    );
  }, [withCache]);

  return {
    loading,
    error,
    getNOTAMs,
    getMultipleNOTAMs,
    getROTAER,
    getWeather,
    getCharts,
    fetchNOTAMs,
    fetchROTAER,
    validateFlightPlan,
    clearCache,
    getCacheAge,
  };
}
