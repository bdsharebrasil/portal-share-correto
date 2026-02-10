import { useState, useEffect, useCallback } from 'react';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';

// Interface compatível com o componente
export interface MetarResponse {
  icao: string;
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | string | null;
  altim?: number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  reportTime: string;
  updatedTime: string;
  source: string;
  taf?: string;
}

export function useWeather(defaultIcao: string = 'SBGR') {
  const [currentIcao, setCurrentIcao] = useState<string>(defaultIcao);
  const [weather, setWeather] = useState<MetarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName] = useState<string | null>(null);

  const fetchWeather = useCallback(async (icao: string) => {
    setLoading(true);
    setError(null);

    try {
      const aisData = await fetchAISWebMETAR(icao);

      if (!aisData) {
        throw new Error("Dados METAR não encontrados para este ICAO.");
      }

      // Converter AISWebMETARData para MetarResponse
      const parsedData: MetarResponse = {
        icao: aisData.icao,
        rawOb: aisData.rawOb,
        temp: aisData.temp,
        dewp: aisData.dewp,
        wdir: aisData.wdir,
        wspd: aisData.wspd,
        wgst: aisData.wgst,
        visib: aisData.visib,
        altim: undefined, // AISWebMETARData não inclui altim processado
        flightCategory: aisData.flightCategory,
        reportTime: aisData.updatedTime || new Date().toISOString(),
        updatedTime: aisData.updatedTime || new Date().toISOString(),
        source: 'AISWEB',
        taf: aisData.taf,
      };

      setWeather(parsedData);
      setCurrentIcao(icao);
    } catch (err: any) {
      console.error('[useWeather] Erro:', err);
      setError(err.message);
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(currentIcao);
    const interval = setInterval(() => fetchWeather(currentIcao), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather, currentIcao]);

  const changeAirport = useCallback((icao: string) => {
    setCurrentIcao(icao);
  }, []);

  return {
    weather,
    loading,
    error,
    refetch: () => fetchWeather(currentIcao),
    locationName,
    currentIcao,
    changeAirport,
  };
}
