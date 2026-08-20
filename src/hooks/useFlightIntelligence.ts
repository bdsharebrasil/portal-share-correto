import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAISWeb } from './useAISWeb';
import { useSolarData } from './useSolarData';
import { fetchAirportCharts, type ChartData } from '@/services/chartsService';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';
import { calculateDistance, calculateMagneticHeading, parseAerodromeCoordString } from '@/lib/geo';
import { suggestFlightLevel } from '@/lib/flightLevel';
import { calculateMinimumEndurance } from '@/lib/aircraft-speeds';

interface AerodromeCoords {
  icao: string;
  lat: number;
  lon: number;
  name: string;
}

type RouteStatus = 'clear' | 'caution' | 'warning' | 'danger';

export interface FlightIntelligence {
  loading: boolean;
  error: string | null;
  distanceNm: number;
  magneticCourse: number | null;
  notams: Record<string, any[]>;
  routeStatus: RouteStatus;
  criticalCount: number;
  weather: Record<string, AISWebMETARData | null>;
  charts: Record<string, ChartData[]>;
  suggestedRoute: string | null;
  suggestedAltitudeFt: number | null;
  suggestedAltitudeLabel: string | null;
  altitudeSource: 'performance' | 'rpc' | 'heuristic' | null;
  altitudeError: string | null;
  fuelRequiredL: number | null;
  totalFuelL: number | null;
  minimumEnduranceHHMM: string | null;
  isNight: boolean;
  alternates: { icao: string; name: string; distNm: number }[];
}

async function resolveAerodrome(icao: string): Promise<AerodromeCoords | null> {
  if (!icao) return null;
  const { data } = await supabase
    .from('aerodromes')
    .select('designativo, nome, coordenadas')
    .eq('designativo', icao.toUpperCase())
    .maybeSingle();
  const parsed = parseAerodromeCoordString(data?.coordenadas);
  if (!data || !parsed) return null;
  return { icao: data.designativo, name: data.nome, lat: parsed.lat, lon: parsed.lon };
}

function computeRouteStatus(notams: Record<string, any[]>): { status: RouteStatus; criticalCount: number } {
  const all = Object.values(notams).flat();
  const critical = all.filter((notam) => notam.priority === 'critical').length;
  const high = all.filter((notam) => notam.priority === 'high').length;
  if (critical > 0) return { status: 'danger', criticalCount: critical };
  if (high > 0) return { status: 'warning', criticalCount: 0 };
  if (all.length > 0) return { status: 'caution', criticalCount: 0 };
  return { status: 'clear', criticalCount: 0 };
}

function isCurrentTimeNight(sunrise: string | undefined, sunset: string | undefined): boolean {
  const toMinutes = (value: string | undefined) => {
    const match = value?.match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const sunriseMinutes = toMinutes(sunrise);
  const sunsetMinutes = toMinutes(sunset);
  if (sunriseMinutes === null || sunsetMinutes === null) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes < sunriseMinutes || currentMinutes >= sunsetMinutes;
}

export function useFlightIntelligence(
  origin: string,
  destination: string,
  alternate: string,
  aeronaveId: string | null,
  performanceAeronaveId: string | null,
  flightRule: 'V' | 'I' | 'Y' | 'Z' = 'I',
): FlightIntelligence {
  const { getMultipleNOTAMs, fetchPreferentialRoutes } = useAISWeb();
  const { solarData: originSolar } = useSolarData(origin || null);
  const isNight = useMemo(
    () => isCurrentTimeNight(originSolar?.day?.sunrise, originSolar?.day?.sunset),
    [originSolar],
  );
  const [state, setState] = useState<FlightIntelligence>({
    loading: false,
    error: null,
    distanceNm: 0,
    magneticCourse: null,
    notams: {},
    routeStatus: 'clear',
    criticalCount: 0,
    weather: {},
    charts: {},
    suggestedRoute: null,
    suggestedAltitudeFt: null,
    suggestedAltitudeLabel: null,
    altitudeSource: null,
    altitudeError: null,
    fuelRequiredL: null,
    totalFuelL: null,
    minimumEnduranceHHMM: null,
    isNight: false,
    alternates: [],
  });

  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;

    (async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const icaos = [origin, destination, alternate].filter(Boolean);
        const [aerodromes, notams, route, aircraftResult] = await Promise.all([
          Promise.all(icaos.map(resolveAerodrome)),
          getMultipleNOTAMs(icaos),
          fetchPreferentialRoutes(origin, destination).catch(() => null),
          aeronaveId
            ? (supabase as any)
                .from('aeronave')
                .select('consumo_combustivel, velocidade_cruzeiro, performance_aeronave_id, performance_aeronave(categoria, teto_servico_ft, nivel_cruzeiro_min_ft, nivel_cruzeiro_max_ft, aprovado_rvsm, velocidade_cruzeiro_kt)')
                .eq('id', aeronaveId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const originAd = aerodromes.find((a) => a?.icao === origin.toUpperCase());
        const destinationAd = aerodromes.find((a) => a?.icao === destination.toUpperCase());

        if (!originAd || !destinationAd) {
          throw new Error('Coordenadas não encontradas para origem ou destino — cadastro incompleto de aeródromo.');
        }

        const distanceNm = calculateDistance(originAd.lat, originAd.lon, destinationAd.lat, destinationAd.lon);
        const magneticCourse = calculateMagneticHeading(originAd.lat, originAd.lon, destinationAd.lat, destinationAd.lon);
        const alternates: FlightIntelligence['alternates'] = aerodromes
          .filter((a): a is AerodromeCoords => Boolean(a) && a.icao !== origin.toUpperCase() && a.icao !== destination.toUpperCase())
          .map((a) => ({
            icao: a.icao,
            name: a.name,
            distNm: calculateDistance(destinationAd.lat, destinationAd.lon, a.lat, a.lon),
          }));
        const { status, criticalCount } = computeRouteStatus(notams);
        const [weatherEntries, chartsEntries] = await Promise.all([
          Promise.all(icaos.map(async (icao) => [icao.toUpperCase(), await fetchAISWebMETAR(icao)] as const)),
          Promise.all(icaos.map(async (icao) => [icao.toUpperCase(), await fetchAirportCharts(icao)] as const)),
        ]);
        const aircraft = aircraftResult.data;
        const performance = Array.isArray(aircraft?.performance_aeronave)
          ? aircraft.performance_aeronave[0]
          : aircraft?.performance_aeronave;
        const linkedPerformanceId = performanceAeronaveId || aircraft?.performance_aeronave_id;
        const isIFR = flightRule === 'I' || flightRule === 'Y' || flightRule === 'Z';
        const heuristic = suggestFlightLevel(magneticCourse, flightRule);
        let altitudeFt = heuristic.altitudeFt;
        let altitudeLabel = heuristic.label;
        let altitudeSource: FlightIntelligence['altitudeSource'] = 'heuristic';
        let altitudeError: string | null = null;

        const minimumFt = Number(performance?.nivel_cruzeiro_min_ft);
        const maximumFt = Math.min(Number(performance?.nivel_cruzeiro_max_ft), Number(performance?.teto_servico_ft));
        const performanceIsValid = Boolean(performance && linkedPerformanceId && Number.isFinite(minimumFt) && Number.isFinite(maximumFt) && minimumFt > 0 && maximumFt >= minimumFt);
        if (performanceIsValid) {
          altitudeFt = Math.max(minimumFt, Math.min(maximumFt, altitudeFt));
          altitudeLabel = isIFR
            ? `FL${String(Math.round(altitudeFt / 100)).padStart(3, '0')}`
            : `${altitudeFt} ft`;
          altitudeSource = 'performance';
        } else if (aeronaveId) {
          const { data: rpcAltitude, error: rpcError } = await supabase.rpc('calcular_nivel_voo', {
            p_aeronave_id: aeronaveId,
            p_rumo_magnetico: magneticCourse,
          });
          if (rpcError) altitudeError = 'Nível oficial indisponível; foi usado o nível heurístico da regra semicircular.';
          if (typeof rpcAltitude === 'number' && Number.isFinite(rpcAltitude) && rpcAltitude > 0) {
            altitudeFt = rpcAltitude;
            altitudeLabel = isIFR ? `FL${String(Math.round(rpcAltitude / 100)).padStart(3, '0')}` : `${rpcAltitude} ft`;
            altitudeSource = 'rpc';
          }
        }

        const speedKt = Number(performance?.velocidade_cruzeiro_kt ?? aircraft?.velocidade_cruzeiro ?? 0);
        const burnLph = Number(aircraft?.consumo_combustivel ?? 0);
        const estimatedTimeMinutes = speedKt > 0 ? (distanceNm / speedKt) * 60 : 0;
        const reserveMinutes = isIFR || isNight ? 45 : 30;
        const contingencyMinutes = Math.ceil(estimatedTimeMinutes * 0.1);
        const fuelRequiredL = speedKt > 0 && burnLph > 0 ? (estimatedTimeMinutes / 60) * burnLph : null;
        const totalFuelL = fuelRequiredL === null ? null : fuelRequiredL + ((reserveMinutes + contingencyMinutes) / 60) * burnLph;
        const minimumEnduranceHHMM = speedKt > 0
          ? calculateMinimumEndurance(estimatedTimeMinutes, isIFR, isNight)
          : null;

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          distanceNm,
          magneticCourse,
          notams,
          routeStatus: status,
          criticalCount,
          weather: Object.fromEntries(weatherEntries),
          charts: Object.fromEntries(chartsEntries),
          suggestedRoute: route?.route ?? route?.[0]?.route ?? null,
          suggestedAltitudeFt: altitudeFt,
          suggestedAltitudeLabel: altitudeLabel,
          altitudeSource,
          altitudeError,
          fuelRequiredL,
          totalFuelL,
          minimumEnduranceHHMM,
          isNight,
          alternates,
        });
      } catch (error: any) {
        if (!cancelled) {
          setState((current) => ({ ...current, loading: false, error: error.message ?? 'Erro ao carregar dados do voo' }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, destination, alternate, aeronaveId, performanceAeronaveId, flightRule, isNight, getMultipleNOTAMs, fetchPreferentialRoutes]);

  return state;
}
