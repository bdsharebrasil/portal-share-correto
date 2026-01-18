import { useState, useCallback, useEffect } from 'react';
import { fetchMETAR, fetchTAF } from '@/lib/aviation';

// Exported as both MetarData and METARData for compatibility
export interface MetarData {
  icaoId?: string;
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null;
  altim: number | null;
  fltcat?: string;
  flightCategory?: string;
  reportTime?: string;
  updatedTime?: string;
  source?: string;
  clouds?: Array<{
    cover: string;
    base: number;
  }>;
}

// Alias for backwards compatibility
export type METARData = MetarData;

export interface TafData {
  icaoId: string;
  rawTAF: string;
  validTimeFrom: string;
  validTimeTo: string;
}

export interface AirportWeather {
  icao: string;
  metar: MetarData | null;
  taf: TafData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para buscar dados meteorológicos de aviação (METAR e TAF)
 * Usa a API oficial da aviationweather.gov
 * 
 * Can be used in two ways:
 * 1. With icao parameter: returns { metar, loading, error } for that specific airport
 * 2. Without parameter: returns { getWeather, getMultipleWeather, weatherCache, clearCache }
 */
export function useAviationWeather(icao?: string) {
  const [weatherCache, setWeatherCache] = useState<Record<string, AirportWeather>>({});
  const [singleAirportState, setSingleAirportState] = useState<{
    metar: MetarData | null;
    loading: boolean;
    error: string | null;
  }>({
    metar: null,
    loading: false,
    error: null,
  });

  const getWeather = useCallback(async (icaoCode: string): Promise<AirportWeather> => {
    if (!icaoCode || icaoCode.length < 4) {
      return { icao: icaoCode, metar: null, taf: null, loading: false, error: 'ICAO inválido' };
    }

    const icaoUpper = icaoCode.toUpperCase();

    // Check cache
    if (weatherCache[icaoUpper] && !weatherCache[icaoUpper].loading) {
      return weatherCache[icaoUpper];
    }

    // Set loading state
    setWeatherCache(prev => ({
      ...prev,
      [icaoUpper]: { icao: icaoUpper, metar: null, taf: null, loading: true, error: null }
    }));

    try {
      // Fetch METAR and TAF in parallel
      const [metarResult, tafResult] = await Promise.all([
        fetchMETAR(icaoUpper),
        fetchTAF(icaoUpper)
      ]);

      const metar = metarResult && metarResult.length > 0 ? metarResult[0] : null;
      const taf = tafResult && tafResult.length > 0 ? tafResult[0] : null;

      const weatherData: AirportWeather = {
        icao: icaoUpper,
        metar,
        taf,
        loading: false,
        error: !metar ? 'METAR não disponível' : null
      };

      setWeatherCache(prev => ({
        ...prev,
        [icaoUpper]: weatherData
      }));

      return weatherData;
    } catch (error) {
      console.error(`Error fetching weather for ${icaoUpper}:`, error);
      const errorData: AirportWeather = {
        icao: icaoUpper,
        metar: null,
        taf: null,
        loading: false,
        error: 'Erro ao buscar dados meteorológicos'
      };

      setWeatherCache(prev => ({
        ...prev,
        [icaoUpper]: errorData
      }));

      return errorData;
    }
  }, [weatherCache]);

  const getMultipleWeather = useCallback(async (icaos: string[]): Promise<Record<string, AirportWeather>> => {
    const results: Record<string, AirportWeather> = {};

    await Promise.all(
      icaos.map(async (icaoCode) => {
        const weather = await getWeather(icaoCode);
        results[icaoCode.toUpperCase()] = weather;
      })
    );

    return results;
  }, [getWeather]);

  const clearCache = useCallback(() => {
    setWeatherCache({});
  }, []);

  // Effect for single airport mode
  useEffect(() => {
    if (!icao) return;

    const icaoUpper = icao.toUpperCase();
    
    setSingleAirportState(prev => ({ ...prev, loading: true, error: null }));

    getWeather(icaoUpper).then(result => {
      setSingleAirportState({
        metar: result.metar,
        loading: false,
        error: result.error,
      });
    });
  }, [icao, getWeather]);

  // If icao is provided, return single airport interface
  if (icao) {
    return {
      metar: singleAirportState.metar,
      loading: singleAirportState.loading,
      error: singleAirportState.error,
      getWeather,
      getMultipleWeather,
      weatherCache,
      clearCache
    };
  }

  // Otherwise return multi-airport interface
  return {
    getWeather,
    getMultipleWeather,
    weatherCache,
    clearCache
  };
}

/**
 * Parse METAR flight category for display
 */
export function getFlightCategoryColor(category: string): string {
  switch (category?.toUpperCase()) {
    case 'VFR':
      return 'text-green-400';
    case 'MVFR':
      return 'text-blue-400';
    case 'IFR':
      return 'text-red-400';
    case 'LIFR':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

export function getFlightCategoryBg(category: string): string {
  switch (category?.toUpperCase()) {
    case 'VFR':
      return 'bg-green-500/20 border-green-500/50';
    case 'MVFR':
      return 'bg-blue-500/20 border-blue-500/50';
    case 'IFR':
      return 'bg-red-500/20 border-red-500/50';
    case 'LIFR':
      return 'bg-purple-500/20 border-purple-500/50';
    default:
      return 'bg-gray-500/20 border-gray-500/50';
  }
}

/**
 * Format wind string from METAR data
 */
export function formatWind(wdir: number | string | null, wspd: number | null, wgst: number | null): string {
  if (wdir === null || wspd === null) return '--';
  const dir = typeof wdir === 'number' ? String(wdir).padStart(3, '0') : wdir;
  const gust = wgst ? `G${wgst}` : '';
  return `${dir}/${wspd}${gust}KT`;
}

/**
 * Format visibility from METAR data
 */
export function formatVisibility(visib: string | number | null): string {
  if (visib === null || visib === undefined) return '--';
  if (typeof visib === 'number') {
    return visib >= 9999 ? 'CAVOK' : `${visib}m`;
  }
  return String(visib);
}
