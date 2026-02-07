import { useState, useEffect, useCallback } from 'react';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';

export interface WeatherData {
  location: string;
  temperature: number;
  dewpoint: number | null;
  windDirection: number | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: { value: number; unit: string } | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  rawMetar: string;
  icon: string;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const updateWeather = useCallback(async (icao: string = 'SBGR') => {
    setLoading(true);
    const data = await fetchAISWebMETAR(icao);
    
    if (data) {
      const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18;
      const daySuffix = isDay ? 'd' : 'n';

      setWeather({
        location: data.icao,
        temperature: data.temp ?? 0,
        dewpoint: data.dewp,
        windDirection: typeof data.wdir === 'number' ? data.wdir : null,
        windSpeed: data.wspd,
        windGust: data.wgst,
        visibility: data.visib ? { value: Number(data.visib), unit: 'm' } : null,
        flightCategory: data.flightCategory,
        rawMetar: data.rawOb,
        icon: data.rawOb.toLowerCase().includes('ts') ? `11${daySuffix}` : `01${daySuffix}`
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    updateWeather();
    const timer = setInterval(() => updateWeather(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [updateWeather]);

  return { weather, loading, updateWeather };
}
