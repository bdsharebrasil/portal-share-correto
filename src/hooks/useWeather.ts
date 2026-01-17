import { useState, useEffect, useCallback } from 'react';

export interface MetarInfo {
  temperature: number;
  dewpoint: number | null;
  windDirection: number | null; // 0-360 graus
  windSpeed: number | null; // em nós
  windGust: number | null; // em nós
  visibility: {
    value: number;
    unit: 'SM' | 'm'; // Statute Miles ou metros
  } | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';
  rawMetar: string;
}

interface WeatherData extends MetarInfo {
  location: string;
  icon: string;
  description: string;
}

interface MetarResponse {
  result?: string;
  error?: string;
  meta?: {
    timestamp?: string;
  };
}

const AVWX_TOKEN = import.meta.env.VITE_AVWX_API_TOKEN;
const AVWX_BASE_URL = 'https://avwx.rest/api';
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

// Map METAR flight category to weather icon codes
function getWeatherIconFromMetar(metar: string): string {
  const lower = metar.toLowerCase();
  if (lower.includes('thunderstorm') || lower.includes('ts')) return '11d';
  if (lower.includes('rain') || lower.includes('ra')) return '10d';
  if (lower.includes('snow') || lower.includes('sn')) return '13d';
  if (lower.includes('mist') || lower.includes('br')) return '50d';
  if (lower.includes('ovc') || lower.includes('bkn')) return '04d';
  if (lower.includes('sct') || lower.includes('few')) return '02d';
  return '01d';
}

// Parse temperature and dewpoint from METAR
// Format: "23/18" means 23°C, 18°C dewpoint
function parseTemperatureDewpoint(metar: string): { temp: number | null; dewpoint: number | null } {
  const match = metar.match(/(\d{2})\/(\d{2})/);
  if (match) {
    return {
      temp: parseInt(match[1], 10),
      dewpoint: parseInt(match[2], 10),
    };
  }
  return { temp: null, dewpoint: null };
}

// Parse wind from METAR
// Format: "09015G25KT" means wind from 090°, 15 knots, gusting to 25 knots
function parseWind(metar: string): {
  direction: number | null;
  speed: number | null;
  gust: number | null;
} {
  const windMatch = metar.match(/(\d{3})(\d{2})(?:G(\d{2}))?KT/);
  if (windMatch) {
    return {
      direction: parseInt(windMatch[1], 10),
      speed: parseInt(windMatch[2], 10),
      gust: windMatch[3] ? parseInt(windMatch[3], 10) : null,
    };
  }
  return { direction: null, speed: null, gust: null };
}

// Parse visibility from METAR
// Format: "9999" means 10km visibility, or "10SM" means 10 statute miles
function parseVisibility(metar: string): { value: number; unit: 'SM' | 'm' } | null {
  // Try to find SM format (e.g., "10SM")
  const smMatch = metar.match(/(\d+)SM/);
  if (smMatch) {
    return {
      value: parseInt(smMatch[1], 10),
      unit: 'SM',
    };
  }

  // Try to find meters format (e.g., "9999" means 9999 meters)
  const metersMatch = metar.match(/^[A-Z0-9]+ (\d{4})/);
  if (metersMatch) {
    const value = parseInt(metersMatch[1], 10);
    if (value <= 9999) {
      return {
        value,
        unit: 'm',
      };
    }
  }

  return null;
}

// Determine flight category based on visibility and ceiling
function getFlightCategory(visibility: number | null, visUnit: string): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN' {
  if (!visibility) return 'UNKNOWN';

  // Convert to statue miles if needed
  let visMiles = visibility;
  if (visUnit === 'm') {
    visMiles = visibility / 1609.34; // Convert meters to miles
  }

  if (visMiles >= 5) return 'VFR';
  if (visMiles >= 3) return 'MVFR';
  if (visMiles >= 1) return 'IFR';
  return 'LIFR';
}

// Build description from METAR data
function getMetarDescription(wind: { speed: number | null; direction: number | null }, temp: number | null, dewpoint: number | null): string {
  const parts: string[] = [];

  if (wind.speed !== null && wind.direction !== null) {
    parts.push(`Vento ${wind.direction}° a ${wind.speed}kt`);
  }

  if (temp !== null && dewpoint !== null) {
    const spreadMsg = `(diferença: ${temp - dewpoint}°)`;
    parts.push(`${temp}°/${dewpoint}° ${spreadMsg}`);
  } else if (temp !== null) {
    parts.push(`${temp}°C`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'Dados de aeródromo';
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const setDefaultWeather = useCallback(() => {
    setWeather({
      temperature: 25,
      dewpoint: 18,
      windDirection: 90,
      windSpeed: 12,
      windGust: null,
      visibility: { value: 10, unit: 'SM' },
      flightCategory: 'VFR',
      rawMetar: '',
      location: 'São Paulo (SBGR)',
      icon: '01d',
      description: 'Clima estável',
    });
    setLoading(false);
  }, []);

  const fetchWeatherFromAvwx = useCallback(async (aerodrome: string = 'SBGR') => {
    try {
      if (!AVWX_TOKEN) {
        console.warn('AVWX token não configurado');
        setDefaultWeather();
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${AVWX_BASE_URL}/metar/${aerodrome.toUpperCase()}?token=${AVWX_TOKEN}&format=json`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!response.ok) {
        throw new Error(`AVWX API error: ${response.status}`);
      }

      const data: MetarResponse = await response.json();

      if (data.error || !data.result) {
        throw new Error(`METAR error: ${data.error || 'No data'}`);
      }

      const metar = data.result;
      const { temp, dewpoint } = parseTemperatureDewpoint(metar);
      const wind = parseWind(metar);
      const visibility = parseVisibility(metar);

      if (temp === null) {
        setDefaultWeather();
        return;
      }

      const flightCategory = getFlightCategory(visibility?.value, visibility?.unit || 'm');
      const description = getMetarDescription(wind, temp, dewpoint);

      setWeather({
        temperature: temp,
        dewpoint,
        windDirection: wind.direction,
        windSpeed: wind.speed,
        windGust: wind.gust,
        visibility,
        flightCategory,
        rawMetar: metar,
        location: `${aerodrome.toUpperCase()}`,
        icon: getWeatherIconFromMetar(metar),
        description,
      });
    } catch (error) {
      // Identificar se foi timeout
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        console.warn(`Timeout ao buscar METAR de ${aerodrome} - usando dados padrão`);
      } else {
        console.warn('Erro ao buscar METAR do AVWX:', error);
      }
      setDefaultWeather();
    } finally {
      setLoading(false);
    }
  }, [setDefaultWeather]);

  useEffect(() => {
    fetchWeatherFromAvwx('SBGR');

    const interval = setInterval(() => {
      fetchWeatherFromAvwx('SBGR');
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchWeatherFromAvwx]);

  return { weather, loading };
}
