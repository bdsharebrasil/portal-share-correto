import { useState, useEffect, useCallback } from 'react';
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

interface MetarResponse {
  result?: string;
  error?: string;
  meta?: {
    timestamp?: string;
  };
}

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds (bem mais frequente)

// Determinar se é dia ou noite (brasília)
function isDayTime(): boolean {
  const now = new Date();
  // Brasília timezone (UTC-3 or UTC-2 during daylight saving)
  const brazilTime = new Date(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  const hours = brazilTime.getHours();

  // Considerar dia entre 6h e 18h
  return hours >= 6 && hours < 18;
}

// Map METAR flight category to weather icon codes (considerar dia/noite)
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

// Parse temperature and dewpoint from METAR
// Format: "23/18" means 23°C, 18°C dewpoint
// Negative temps: "M05/M10" means -5°C, -10°C dewpoint
function parseTemperatureDewpoint(metar: string): { temp: number | null; dewpoint: number | null } {
  // Match both positive and negative temperatures
  // Pattern: (M?\d{2})/(M?\d{2})
  const match = metar.match(/(M?)(\d{2})\/(M?)(\d{2})/);
  if (match) {
    const tempSign = match[1] === 'M' ? -1 : 1;
    const tempValue = parseInt(match[2], 10) * tempSign;

    const dewSign = match[3] === 'M' ? -1 : 1;
    const dewValue = parseInt(match[4], 10) * dewSign;

    return {
      temp: tempValue,
      dewpoint: dewValue,
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

  const setDefaultWeather = useCallback((aerodrome: string = 'SBGR') => {
    // Try to use mock data for the specified aerodrome
    const mockData = METAR_MOCK_DATA[aerodrome.toUpperCase()];

    if (mockData) {
      const { temp, dewp, wdir, wspd, wgst, visib, rawOb } = mockData;
      setWeather({
        temperature: temp,
        dewpoint: dewp,
        windDirection: wdir,
        windSpeed: wspd,
        windGust: wgst,
        visibility: { value: visib, unit: 'SM' },
        flightCategory: 'VFR',
        rawMetar: rawOb,
        location: `${aerodrome.toUpperCase()} (Fallback)`,
        icon: '01d',
        description: 'Dados do servidor indisponíveis - usando dados locais',
      });
    } else {
      // Fallback to generic defaults for unknown aerodromes
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
    let abortController: AbortController | null = null;
    try {
      setLoading(true);

      // Fetch directly from aviationweather.gov API to avoid backend dependency
      const apiUrl = `https://aviationweather.gov/api/data/metar?ids=${aerodrome.toUpperCase()}&format=json`;

      console.log('[METAR] 🌐 Buscando dados direto de aviationweather.gov:', aerodrome);

      // Usar AbortController em vez de timeout
      abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController?.abort(), 10000);

      try {
        const response = await fetch(apiUrl, {
          signal: abortController.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ShareBrasil-App/1.0',
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`[METAR] ❌ HTTP Error: ${response.status} ${response.statusText}`);
          throw new Error(`API error: ${response.status}`);
        }

        const responseData: any = await response.json();

        // The API returns an array with METAR observations
        if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
          console.error('[METAR] ❌ Nenhum dado válido retornado pela API');
          throw new Error('METAR error: Invalid response format');
        }

        const metarObj = responseData[0];
        const metar = metarObj.rawOb || metarObj.raw_text;

        if (!metar) {
          console.error('[METAR] ❌ Sem texto METAR na resposta');
          throw new Error('METAR error: No raw METAR text');
        }

        console.log('[METAR] ✅ Raw METAR recebido:', metar);

        const { temp, dewpoint } = parseTemperatureDewpoint(metar);
        const wind = parseWind(metar);
        const visibility = parseVisibility(metar);

        console.log('[METAR] 📊 Dados parseados:', { temp, dewpoint, wind, visibility });

        if (temp === null) {
          console.warn('[METAR] ⚠️ Temperatura não parseada - usando fallback');
          setDefaultWeather(aerodrome);
          return;
        }

        const flightCategory = getFlightCategory(visibility?.value, visibility?.unit || 'm');
        const description = getMetarDescription(wind, temp, dewpoint);

        const weatherData = {
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
        };

        console.log('[METAR] ✅ Clima atualizado com sucesso!', weatherData);
        setWeather(weatherData);
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            console.warn('[METAR] ⏱️ Timeout na requisição (10s)');
          } else if (fetchError.message.includes('Failed to fetch')) {
            console.warn('[METAR] ❌ Falha ao conectar com API de clima');
            console.warn('[METAR] 💡 Possíveis causas:');
            console.warn('[METAR]   1. Sem conexão de internet');
            console.warn('[METAR]   2. API de clima temporariamente indisponível');
            console.warn('[METAR]   3. Problema de CORS');
          } else {
            console.warn('[METAR] ❌ Erro ao buscar METAR:', fetchError.message);
          }
        }
        console.warn('[METAR] ⚠️ Usando dados locais como fallback');
        setDefaultWeather(aerodrome);
      }
    } catch (error) {
      console.warn('[METAR] ⚠️ Usando dados locais como fallback (outer)');
      setDefaultWeather(aerodrome);
    } finally {
      setLoading(false);
      abortController = null;
    }
  }, [setDefaultWeather]);

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    // Função auxiliar para evitar requisições simultâneas
    const safeFetch = async () => {
      if (isFetching || !isMounted) return;
      isFetching = true;
      try {
        await fetchWeatherFromAvwx('SBGR');
      } finally {
        isFetching = false;
      }
    };

    // Fetch imediato ao montar
    console.log('[METAR] 🚀 Inicializando hook de clima...');
    safeFetch().catch(() => {
      // Erro já foi tratado dentro de safeFetch, apenas prevenindo unhandled rejection
    });

    // Configurar intervalo de atualização (5 minutos)
    const interval = setInterval(() => {
      if (!isFetching) {
        console.log('[METAR] ⏰ Atualizando por intervalo (5 min)...');
        safeFetch().catch(() => {
          // Erro já foi tratado dentro de safeFetch, apenas prevenindo unhandled rejection
        });
      }
    }, UPDATE_INTERVAL);

    // Atualizar quando a aba volta ao foco
    const handleVisibilityChange = () => {
      if (!document.hidden && !isFetching && isMounted) {
        console.log('[METAR] 👁️ Aba ficou visível - refrescando...');
        safeFetch().catch(() => {
          // Erro já foi tratado dentro de safeFetch, apenas prevenindo unhandled rejection
        });
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
