import { useState, useEffect, useCallback } from 'react';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';

export interface WeatherData {
  location: string;
  temperature: number;
  dewpoint: number | null;
  windDirection: number | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: { value: number; unit: 'SM' | 'm' } | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  rawMetar: string;
  icon: string;
  description: string;
}

const UPDATE_INTERVAL = 5 * 60 * 1000;

function isDayTime(): boolean {
  const hours = new Date(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })).getHours();
  return hours >= 6 && hours < 18;
}

function getWeatherIconFromMetar(metar: string): string {
  const lower = metar.toLowerCase();
  const daySuffix = isDayTime() ? 'd' : 'n';
  if (lower.includes('ts')) return `11${daySuffix}`;
  if (lower.includes('ra')) return `10${daySuffix}`;
  if (lower.includes('ovc') || lower.includes('bkn')) return `04${daySuffix}`;
  if (lower.includes('sct') || lower.includes('few')) return `02${daySuffix}`;
  return `01${daySuffix}`;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = useCallback(async (icao: string = 'SBGR') => {
    try {
      setLoading(true);
      const data = await fetchAISWebMETAR(icao);

      if (data) {
        const weatherData: WeatherData = {
          location: data.icao,
          temperature: data.temp ?? 0,
          dewpoint: data.dewp,
          windDirection: typeof data.wdir === 'number' ? data.wdir : null,
          windSpeed: data.wspd,
          windGust: data.wgst,
          visibility: data.visib ? { 
            value: typeof data.visib === 'number' ? data.visib : 9999, 
            unit: 'm' 
          } : null,
          flightCategory: data.flightCategory,
          rawMetar: data.rawOb,
          icon: getWeatherIconFromMetar(data.rawOb),
          description: `Vento ${data.wdir}° ${data.wspd}kt`
        };
        setWeather(weatherData);
      }
    } catch (error) {
      console.error("Falha ao carregar clima:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather('SBGR');
    const interval = setInterval(() => fetchWeather('SBGR'), UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return { weather, loading, fetchWeather };
}
