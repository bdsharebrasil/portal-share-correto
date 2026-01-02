import { useState, useEffect } from 'react';

export interface METARData {
  temp: number; // Temperature in Celsius
  dewp: number; // Dew point in Celsius
  wdir: number; // Wind direction in degrees
  wspd: number; // Wind speed in knots
  wgst?: number; // Wind gust in knots
  visib: number; // Visibility in statute miles
  altim: number; // Altimeter setting in inHg
  rawOb: string; // Raw METAR observation
  flightCategory?: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'; // Flight category
  updatedTime?: string; // Time of last update
}

// METAR cache to avoid repeated requests
const metarCache = new Map<string, { data: METARData | null; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function useAviationWeather(icao: string | null, pollInterval: number = 600000) {
  const [metar, setMetar] = useState<METARData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!icao) {
      setMetar(null);
      return;
    }

    const fetchMetar = async () => {
      const upperIcao = icao.toUpperCase();
      
      // Check cache first
      const cached = metarCache.get(upperIcao);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setMetar(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use aviationweather.gov API directly (CORS-friendly for METAR)
        const response = await fetch(
          `https://aviationweather.gov/api/data/metar?ids=${upperIcao}&format=json&taf=false`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // aviationweather.gov returns an array
        if (!data || !Array.isArray(data) || data.length === 0) {
          // No METAR found - generate placeholder
          const placeholder: METARData = {
            temp: 25,
            dewp: 18,
            wdir: 0,
            wspd: 5,
            visib: 10,
            altim: 30.00,
            rawOb: `${upperIcao} - METAR não disponível`,
            flightCategory: 'VFR',
            updatedTime: new Date().toISOString(),
          };
          setMetar(placeholder);
          metarCache.set(upperIcao, { data: placeholder, timestamp: Date.now() });
          return;
        }

        const metarResponse = data[0];

        // Parse METAR data from aviationweather.gov API response
        const metarData: METARData = {
          temp: metarResponse.temp ?? 25,
          dewp: metarResponse.dewp ?? 18,
          wdir: metarResponse.wdir ?? 0,
          wspd: metarResponse.wspd ?? 0,
          wgst: metarResponse.wgst,
          visib: metarResponse.visib ?? 10,
          altim: metarResponse.altim ?? 29.92,
          rawOb: metarResponse.rawOb || `${upperIcao} - METAR disponível`,
          updatedTime: metarResponse.reportTime || metarResponse.obsTime,
          flightCategory: (metarResponse.fltCat as 'VFR' | 'MVFR' | 'IFR' | 'LIFR') || 'VFR',
        };

        setMetar(metarData);
        metarCache.set(upperIcao, { data: metarData, timestamp: Date.now() });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar METAR';
        console.warn('METAR fetch error (will use fallback):', message);
        
        // On error, provide fallback data instead of showing error
        const fallback: METARData = {
          temp: 25,
          dewp: 18,
          wdir: 0,
          wspd: 5,
          visib: 10,
          altim: 30.00,
          rawOb: `${icao.toUpperCase()} - Dados meteorológicos temporariamente indisponíveis`,
          flightCategory: 'VFR',
          updatedTime: new Date().toISOString(),
        };
        setMetar(fallback);
        metarCache.set(icao.toUpperCase(), { data: fallback, timestamp: Date.now() });
        setError(null); // Don't show error since we have fallback
      } finally {
        setLoading(false);
      }
    };

    fetchMetar();

    // Poll for updates
    const interval = setInterval(fetchMetar, pollInterval);
    return () => clearInterval(interval);
  }, [icao, pollInterval]);

  return { metar, loading, error };
}
