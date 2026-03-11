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
const cacheRef = { current: {} as Record<string, { timestamp: number; data: any }> };

export function useAISWeb() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCacheValid = useCallback((timestamp: number) => Date.now() - timestamp < CACHE_TTL, []);

  const fetchNOTAMs = useCallback(async (icao: string) => {
    const key = `notam-${icao}`;
    if (cacheRef.current[key] && isCacheValid(cacheRef.current[key].timestamp)) return cacheRef.current[key].data;
    const data = await apiClient.getNotam(icao);
    cacheRef.current[key] = { timestamp: Date.now(), data };
    return data;
  }, [isCacheValid]);

  const fetchROTAER = useCallback(async (adep: string, ades: string) => {
    const key = `rotaer-${adep}-${ades}`;
    if (cacheRef.current[key] && isCacheValid(cacheRef.current[key].timestamp)) return cacheRef.current[key].data;
    const data = await apiClient.getPreferentialRoutes(adep, ades);
    cacheRef.current[key] = { timestamp: Date.now(), data };
    return data;
  }, [isCacheValid]);

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
      const nearby: any[] = await apiClient.getNearbyAlternates();
      return nearby
        .map(a => ({
          icao: a.icao,
          name: a.name,
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
    routePoints: FlightPoint[],
    cruiseAltitude = 5000,
    burnPerHour = 32,
    reserveMinutes = 45
  ): Promise<ValidationResult> => {
    setLoading(true); setError(null);
    try {
      const [originNotam, destNotam] = await Promise.all([fetchNOTAMs(origin), fetchNOTAMs(destination)]);
      const [rotaer] = await Promise.all([fetchROTAER(origin, destination)]);

      const originLat = routePoints[0]?.lat || 0;
      const originLon = routePoints[0]?.lng || 0;
      const destLat = routePoints[routePoints.length - 1]?.lat || 0;
      const destLon = routePoints[routePoints.length - 1]?.lng || 0;
      const distanceNm = haversineNm(originLat, originLon, destLat, destLon);

      const { fuelRequired, totalFuel } = calculateFuel(distanceNm, burnPerHour, reserveMinutes);
      const alternates = await fetchAlternates(destLat, destLon);

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
  }, [fetchNOTAMs, fetchROTAER, fetchAlternates, haversineNm, calculateFuel]);

  const clearCache = useCallback(() => { cacheRef.current = {}; }, []);

  return { loading, error, fetchNOTAMs, fetchROTAER, validateFlightPlan, clearCache };
}