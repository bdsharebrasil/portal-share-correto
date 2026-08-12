// hooks/useFlightIntelligence.ts
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAISWeb } from './useAISWeb';
import { fetchAirportCharts, type ChartData } from '@/services/chartsService';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';
import { calculateDistance, calculateMagneticHeading } from '@/lib/aviation';
import { suggestFlightLevel, calcularRumo } from '@/lib/flightLevel';
import { calculateMinimumEndurance } from '@/lib/aircraft-speeds';

interface AerodromeCoords { icao: string; lat: number; lon: number; nome: string }

type RouteStatus = 'clear' | 'caution' | 'warning' | 'danger';

export interface FlightIntelligence {
  loading: boolean;
  error: string | null;

  // Geometria — fonte única de rumo/distância
  distanceNm: number;
  magneticCourse: number | null;

  // NOTAM + status real (não hardcoded)
  notams: Record<string, any[]>;
  routeStatus: RouteStatus;
  criticalCount: number;

  // Meteorologia dos 3 pontos
  weather: Record<string, AISWebMETARData | null>;

  // Cartas dos 3 pontos (agora inclui alternativa)
  charts: Record<string, ChartData[]>;

  // Rota preferencial — auto-preenche o campo "Rota"
  suggestedRoute: string | null;

  // Altitude: RPC quando há aeronave, fallback heurístico caso contrário
  suggestedAltitudeFt: number | null;
  suggestedAltitudeLabel: string | null;
  altitudeSource: 'rpc' | 'heuristic' | null;

  // Combustível/autonomia — considera noite via useSolarData no futuro
  fuelRequiredL: number | null;
  totalFuelL: number | null;
  minimumEnduranceHHMM: string | null;

  // Alternados sugeridos perto do DESTINO real (não 0,0)
  alternates: { icao: string; name: string; distNm: number }[];
}

async function resolveAerodrome(icao: string): Promise<AerodromeCoords | null> {
  if (!icao) return null;
  const { data } = await supabase
    .from('aerodromes')
    .select('designativo, nome, coordenadas')
    .eq('designativo', icao.toUpperCase())
    .maybeSingle();
  if (!data?.coordenadas) return null;
  // reaproveita o parser que hoje só existe dentro do Step1AircraftInfo
  const parsed = parseAerodromeCoordString(data.coordenadas);
  if (!parsed) return null;
  return { icao: data.designativo, nome: data.nome, lat: parsed.lat, lon: parsed.lon };
}

// Extraído do Step1AircraftInfo — deve virar a única implementação (mover pra @/lib/aviation)
function parseAerodromeCoordString(coordStr: string) {
  const dms = coordStr.match(/([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i);
  if (dms) {
    const lat = (+dms[2] + +dms[3] / 60 + +dms[4] / 3600) * (dms[1].toUpperCase() === 'S' ? -1 : 1);
    const lon = (+dms[6] + +dms[7] / 60 + +dms[8] / 3600) * (dms[5].toUpperCase() === 'W' ? -1 : 1);
    return { lat, lon };
  }
  const dec = coordStr.match(/([-\d.]+),?\s*([-\d.]+)/);
  return dec ? { lat: parseFloat(dec[1]), lon: parseFloat(dec[2]) } : null;
}

function computeRouteStatus(notams: Record<string, any[]>): { status: RouteStatus; criticalCount: number } {
  const all = Object.values(notams).flat();
  const critical = all.filter((n) => n.priority === 'critical').length;
  const high = all.filter((n) => n.priority === 'high').length;
  if (critical > 0) return { status: 'danger', criticalCount: critical };
  if (high > 0) return { status: 'warning', criticalCount: 0 };
  if (all.length > 0) return { status: 'caution', criticalCount: 0 };
  return { status: 'clear', criticalCount: 0 };
}

export function useFlightIntelligence(
  origin: string,
  destination: string,
  alternate: string,
  aeronaveId: string | null,
  flightRule: 'V' | 'I' | 'Y' | 'Z' = 'I',
): FlightIntelligence {
  const { getMultipleNOTAMs, fetchPreferentialRoutes } = useAISWeb();
  const [state, setState] = useState<FlightIntelligence>({
    loading: false, error: null, distanceNm: 0, magneticCourse: null,
    notams: {}, routeStatus: 'clear', criticalCount: 0, weather: {}, charts: {},
    suggestedRoute: null, suggestedAltitudeFt: null, suggestedAltitudeLabel: null,
    altitudeSource: null, fuelRequiredL: null, totalFuelL: null,
    minimumEnduranceHHMM: null, alternates: [],
  });

  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const icaos = [origin, destination, alternate].filter(Boolean);

        const [aerodromes, notams, route] = await Promise.all([
          Promise.all(icaos.map(resolveAerodrome)),
          getMultipleNOTAMs(icaos),
          fetchPreferentialRoutes(origin, destination).catch(() => null),
        ]);

        const originAd = aerodromes.find((a) => a?.icao === origin.toUpperCase());
        const destAd = aerodromes.find((a) => a?.icao === destination.toUpperCase());

        if (!originAd || !destAd) {
          throw new Error('Coordenadas não encontradas para origem ou destino — cadastro incompleto de aeródromo.');
        }

        const distanceNm = calculateDistance(originAd.lat, originAd.lon, destAd.lat, destAd.lon);
        const magneticCourse = calcularRumo(originAd.lat, originAd.lon, destAd.lat, destAd.lon);

        // Alternados reais perto do DESTINO, não de (0,0)
        const alternates: FlightIntelligence['alternates'] = aerodromes
          .filter((a): a is AerodromeCoords => !!a && a.icao !== origin.toUpperCase() && a.icao !== destination.toUpperCase())
          .map((a) => ({ icao: a.icao, name: a.nome, distNm: calculateDistance(destAd.lat, destAd.lon, a.lat, a.lon) }));

        const { status, criticalCount } = computeRouteStatus(notams);

        // Weather + charts em paralelo pros 3 pontos
        const [weatherEntries, chartsEntries] = await Promise.all([
          Promise.all(icaos.map(async (i) => [i.toUpperCase(), await fetchAISWebMETAR(i)] as const)),
          Promise.all(icaos.map(async (i) => [i.toUpperCase(), await fetchAirportCharts(i)] as const)),
        ]);

        // Altitude — heurística por enquanto; troque pelo RPC calcular_nivel_voo
        // quando aeronaveId existir (ver useNivelVooSugerido — mesma regra, só
        // que autoritativa por categoria/teto de serviço da aeronave).
        const isIFR = flightRule === 'I' || flightRule === 'Y' || flightRule === 'Z';
        const heuristic = suggestFlightLevel(magneticCourse, flightRule);
        let altitudeFt = heuristic.altitudeFt;
        let altitudeLabel = heuristic.label;
        let altitudeSource: FlightIntelligence['altitudeSource'] = 'heuristic';

        if (aeronaveId) {
          const { data: rpcAlt } = await supabase.rpc('calcular_nivel_voo', {
            p_aeronave_id: aeronaveId,
            p_rumo_magnetico: magneticCourse,
          });
          if (typeof rpcAlt === 'number') {
            altitudeFt = rpcAlt;
            altitudeLabel = isIFR ? `FL${String(Math.round(rpcAlt / 100)).padStart(3, '0')}` : `${rpcAlt} ft`;
            altitudeSource = 'rpc';
          }
        }

        // TODO: plugar useSolarData(origin) aqui pra saber se a partida é
        // noturna e passar isNight correto pro calculateMinimumEndurance.
        const speedKt = 120; // TODO: puxar de performance_aeronave.velocidade_cruzeiro_kt
        const estimatedTimeMinutes = (distanceNm / speedKt) * 60;
        const minimumEnduranceHHMM = calculateMinimumEndurance(estimatedTimeMinutes, isIFR, false);

        if (cancelled) return;
        setState({
          loading: false, error: null,
          distanceNm, magneticCourse,
          notams, routeStatus: status, criticalCount,
          weather: Object.fromEntries(weatherEntries),
          charts: Object.fromEntries(chartsEntries),
          suggestedRoute: route?.route ?? route?.[0]?.route ?? null,
          suggestedAltitudeFt: altitudeFt, suggestedAltitudeLabel: altitudeLabel, altitudeSource,
          fuelRequiredL: null, totalFuelL: null, // TODO: precisa de consumo_lh na performance_aeronave
          minimumEnduranceHHMM, alternates,
        });
      } catch (err: any) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err.message ?? 'Erro ao carregar dados do voo' }));
      }
    })();

    return () => { cancelled = true; };
  }, [origin, destination, alternate, aeronaveId, flightRule]);

  return state;
}