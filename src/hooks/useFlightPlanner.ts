// useFlightPlanner.ts
import { useState, useRef, useCallback } from 'react';
import {  apiClient } from '../lib/api-client';
import { set, get } from 'idb-keyval';

interface FlightPoint {
  lat: number;
  lng: number;
}

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  notams: Record<string, any>;
  originStatus: any;
  destinationStatus: any;
  restrictions: any[];
  distanceNm: number;
  fuelRequired: number;
  totalFuel: number;
  reserveMinutes: number;
  alternates: { icao: string; name: string; lat: number; lon: number; distNm: number }[];
  alternate?: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const CACHE_KEY = 'flightplanner-cache';

interface Cache {
  [key: string]: {
    timestamp: number;
    data: any;
  };
}

export function useFlightPlanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Cache>({});

  // Inicializa cache do IndexedDB
  const initCache = useCallback(async () => {
    try {
      const stored: Cache = (await get(CACHE_KEY)) || {};
      cacheRef.current = stored;
    } catch (err) {
      console.warn('Erro ao carregar cache:', err);
      cacheRef.current = {};
    }
  }, []);

  const saveCache = useCallback(async () => {
    try {
      await set(CACHE_KEY, cacheRef.current);
    } catch (err) {
      console.warn('Erro ao salvar cache:', err);
    }
  }, []);

  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < CACHE_TTL;
  }, []);

  // Busca NOTAMs e ROTAER para ICAOs
  const fetchNotamsAndRotaer = useCallback(
    async (icaos: string[]): Promise<Record<string, any>> => {
      const result: Record<string, any> = {};
      await Promise.all(
        icaos.map(async (icao) => {
          const key = `notam-${icao}`;
          if (cacheRef.current[key] && isCacheValid(cacheRef.current[key].timestamp)) {
            result[icao] = cacheRef.current[key].data;
            return;
          }
          try {
            const [notamData, rotaerData] = await Promise.all([
              apiClient.getNotam(icao),
              apiClient.getPreferentialRoutes(icao, icao) // rotaer
            ]);
            const data = { notam: notamData, rotaer: rotaerData };
            result[icao] = data;
            cacheRef.current[key] = { timestamp: Date.now(), data };
          } catch (err: any) {
            console.error('Erro ao buscar NOTAM/ROTAER', icao, err);
            result[icao] = { notam: [], rotaer: null };
          }
        })
      );
      await saveCache();
      return result;
    },
    [isCacheValid, saveCache]
  );

  // Haversine em NM
  const haversineNm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return km * 0.539957; // converter para NM
  };

  // Calcular combustível total
  const calculateFuel = (distanceNm: number, burnPerHour: number, reserveMin: number) => {
    const timeH = distanceNm / 120; // velocidade padrão 120kt se não passada
    const fuelRequired = timeH * burnPerHour;
    const reserveFuel = (reserveMin / 60) * burnPerHour;
    return { fuelRequired, totalFuel: fuelRequired + reserveFuel };
  };

  // Buscar alternados próximos
  const fetchAlternates = useCallback(
    async (destLat: number, destLon: number, maxAlternates = 3) => {
      try {
        const nearby = await apiClient.getPreferentialRoutes('nearby', ''); // ou endpoint geiloc/nearby
        // Filtrar e calcular distância
        const alternates = nearby
          .map((a: any) => ({
            icao: a.icao,
            name: a.nome,
            lat: a.lat,
            lon: a.lon,
            distNm: haversineNm(destLat, destLon, a.lat, a.lon),
          }))
          .sort((a: any, b: any) => a.distNm - b.distNm)
          .slice(0, maxAlternates);
        return alternates;
      } catch {
        return [];
      }
    },
    []
  );

  // Validação completa
  const validateFlightPlan = useCallback(
    async (
      origin: string,
      destination: string,
      routePoints: FlightPoint[],
      cruiseAltitude = 5000,
      burnPerHour = 32,
      reserveMinutes = 45
    ): Promise<ValidationResult> => {
      setLoading(true);
      setError(null);
      try {
        // 1. Buscar dados
        const icaos = [origin, destination];
        const notamsData = await fetchNotamsAndRotaer(icaos);

        // 2. Distância total (simplificado como origem -> destino direto)
        const originLat = routePoints[0]?.lat || 0;
        const originLon = routePoints[0]?.lng || 0;
        const destLat = routePoints[routePoints.length - 1]?.lat || 0;
        const destLon = routePoints[routePoints.length - 1]?.lng || 0;
        const distanceNm = haversineNm(originLat, originLon, destLat, destLon);

        // 3. Combustível
        const { fuelRequired, totalFuel } = calculateFuel(distanceNm, burnPerHour, reserveMinutes);

        // 4. Alternados
        const alternates = await fetchAlternates(destLat, destLon);

        // 5. Status operacional (simples)
        const originStatus = { operational: true, warnings: [] };
        const destinationStatus = { operational: true, warnings: [] };

        // 6. Restrições e warnings (simplificado)
        const restrictions: any[] = []; // Integrar checagem de ROTAER/áreas restritas se necessário
        const warnings = [
          ...originStatus.warnings,
          ...destinationStatus.warnings,
        ];

        return {
          valid: originStatus.operational && destinationStatus.operational,
          warnings,
          notams: notamsData,
          originStatus,
          destinationStatus,
          restrictions,
          distanceNm,
          fuelRequired,
          totalFuel,
          reserveMinutes,
          alternates,
          alternate: alternates[0]?.icao,
        };
      } catch (err: any) {
        setError(err.message || 'Erro na validação do voo');
        return {
          valid: false,
          warnings: [err.message || 'Erro desconhecido'],
          notams: {},
          originStatus: { operational: false, warnings: [] },
          destinationStatus: { operational: false, warnings: [] },
          restrictions: [],
          distanceNm: 0,
          fuelRequired: 0,
          totalFuel: 0,
          reserveMinutes,
          alternates: [],
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchNotamsAndRotaer, fetchAlternates]
  );

  return {
    loading,
    error,
    initCache,
    validateFlightPlan,
  };
}