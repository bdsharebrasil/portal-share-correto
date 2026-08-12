// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/config/api';

export interface SolarData {
  day: {
    date: string;
    sunrise: string;
    sunset: string;
    weekDay: number;
    aero: string;
    geo: string;
  };
}

export function useSolarData(icao: string | null) {
  const [solarData, setSolarData] = useState<SolarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolarData = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(
          API_ENDPOINTS.solar(code),
          {
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!response.ok) {
          if (response.status === 404) {
            console.debug(`[useSolarData] No solar data found for ${code}`);
            return;
          }
          console.warn(`[useSolarData] API error for ${code}: ${response.status}`);
          return;
        }

        const data = await response.json();
        setSolarData(data);
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn(`[useSolarData] Timeout fetching solar data for ${code}`);
        } else {
          console.warn(`[useSolarData] Failed to fetch solar data for ${code}:`, fetchError);
        }
      }
    } catch (err) {
      console.error(`[useSolarData] Unexpected error for ${code}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (icao) {
      fetchSolarData(icao);
    }
  }, [icao, fetchSolarData]);

  return { solarData, loading, error };
}
