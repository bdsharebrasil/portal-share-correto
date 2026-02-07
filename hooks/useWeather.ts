import { useState, useEffect, useCallback } from 'react';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';
import { METAR_MOCK_DATA } from '@/data/metarMockData';

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

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Determinar se é dia ou noite (brasília)
function isDayTime(): boolean {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  const hours = brazilTime.getHours();
  return hours >= 6 && hours < 18;
}

// Map METAR flight category to weather icon codes
function getWeatherIconFromMetar(metar: string): string {
  const lower = metar.toLowerCase();
  const isDay = isDayTime();
  const daySuffix = isDay ? 'd' : 'n';

  if (lower.includes('thunderstorm') || lower.includes('ts')) return `11${daySuffix}`;
  if (lower.includes('rain') || lower.includes('ra')) return `10${daySuffix}`;
  if (lower.includes('snow') || lower.includes('sn')) return `13${daySuffix}`;
  if (lower.includes('mist') || lower.includes('br')) return `50${daySuffix}`;
  if (lower.includes('ovc') || lower.includes('bkn')) return `04${daySuffix}`;
  if (lower.includes('sct') || lower.includes('few')) return `02${daySuffix}`;
  return `01${daySuffix}`;
}

// Build description from METAR data
function getMetarDescription(
  wind: { speed: number | null; direction: number | null },
  temp: number | null,
  dewpoint: number | null
): string {
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

// Convert AISWeb METAR to WeatherData
function convertAISWebToWeatherData(data: AISWebMETARData, aerodrome: string): WeatherData {
  const visibility = data.visib
    ? {
        value: typeof data.visib === 'number' ? data.visib : 9999,
        unit: (typeof data.visib === 'number' && data.visib > 100 ? 'm' : 'SM') as 'SM' | 'm',
      }
    : null;

  const windDirection = typeof data.wdir === 'number' ? data.wdir : null;

  return {
    temperature: data.temp ?? 25,
    dewpoint: data.dewp,
    windDirection,
    windSpeed: data.wspd,
    windGust: data.wgst,
    visibility,
    flightCategory: data.flightCategory || 'UNKNOWN',
    rawMetar: data.rawOb,
    location: aerodrome.toUpperCase(),
    icon: getWeatherIconFromMetar(data.rawOb),
    description: getMetarDescription(
      { speed: data.wspd, direction: windDirection },
      data.temp,
      data.dewp
    ),
  };
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const setDefaultWeather = useCallback((aerodrome: string = 'SBGR') => {
    const mockData = METAR_MOCK_DATA[aerodrome.toUpperCase()];

    if (mockData) {
      const { temp, dewp, wdir, wspd, wgst, visib, rawOb } = mockData;
      setWeather({
        temperature: Number(temp),
        dewpoint: Number(dewp),
        windDirection: Number(wdir),
        windSpeed: Number(wspd),
        windGust: wgst ? Number(wgst) : null,
        visibility: { value: Number(visib), unit: 'SM' },
        flightCategory: 'VFR',
        rawMetar: rawOb,
        location: `${aerodrome.toUpperCase()} (Fallback)`,
        icon: '01d',
        description: 'Dados do servidor indisponíveis - usando dados locais',
      });
    } else {
      setWeather({
        temperature: 25,
        dewpoint: 18,
        windDirection: 90,
        windSpeed: 12,
        windGust: null,
        visibility: { value: 10, unit: 'SM' },
        flightCategory: 'VFR',
        rawMetar: '',
        location: `${aerodrome.toUpperCase()}`,
        icon: '01d',
        description: 'Dados indisponíveis',
      });
    }
    setLoading(false);
  }, []);

  const fetchWeatherFromAvwx = useCallback(async (aerodrome: string = 'SBGR') => {
    try {
      setLoading(true);

      console.log('[METAR AISWeb] 🌐 Buscando dados:', aerodrome);

      const metarData = await fetchAISWebMETAR(aerodrome);

      if (!metarData || !metarData.rawOb) {
        console.warn('[METAR AISWeb] ❌ Sem dados METAR');
        setDefaultWeather(aerodrome);
        return;
      }

      console.log('[METAR AISWeb] ✅ Dados recebidos:', metarData.flightCategory);

      const weatherData = convertAISWebToWeatherData(metarData, aerodrome);
      setWeather(weatherData);
    } catch (error) {
      console.warn('[METAR AISWeb] ⚠️ Erro, usando fallback:', error);
      setDefaultWeather(aerodrome);
    } finally {
      setLoading(false);
    }
  }, [setDefaultWeather]);

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const safeFetch = async (retryCount = 0, maxRetries = 3) => {
      if (isFetching || !isMounted) return;
      isFetching = true;
      try {
        await fetchWeatherFromAvwx('SBGR');
        isFetching = false;
      } catch (error) {
        if (retryCount < maxRetries) {
          isFetching = false;
          const delayMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`[METAR] ⏳ Retentando em ${delayMs}ms... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            if (isMounted) {
              safeFetch(retryCount + 1, maxRetries).catch(() => {});
            }
          }, delayMs);
        } else {
          console.log('[METAR] ✅ Máximo de tentativas - usando fallback');
          isFetching = false;
        }
      }
    };

    console.log('[METAR AISWeb] 🚀 Inicializando...');
    safeFetch().catch(() => {});

    const interval = setInterval(() => {
      if (!isFetching) {
        console.log('[METAR] ⏰ Atualizando por intervalo (5 min)...');
        safeFetch().catch(() => {});
      }
    }, UPDATE_INTERVAL);

    const handleVisibilityChange = () => {
      if (!document.hidden && !isFetching && isMounted) {
        console.log('[METAR] 👁️ Aba ficou visível - refrescando...');
        safeFetch().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchWeatherFromAvwx]);

  return { weather, loading, fetchWeatherFromAvwx };
}
