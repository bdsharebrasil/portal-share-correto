import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/config/api';

// Interface que espelha exatamente o retorno do seu Backend
export interface MetarResponse {
  icao: string;
  rawOb: string;
  temp: number | null;
  dewp: number | null;
  wdir: number | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | null;
  altim: number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  reportTime: string;
  updatedTime: string;
  source: string;
}

export interface WeatherState {
  data: MetarResponse | null;
  loading: boolean;
  error: string | null;
}

export function useWeather(defaultIcao: string = 'SBGR') {
  const [weather, setWeather] = useState<MetarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (icao: string) => {
    console.log('[METAR AISWeb] 🌐 Buscando dados:', icao);
    setLoading(true);
    setError(null);

    try {
      // Usa a configuração centralizada
      const url = API_ENDPOINTS.weather.metar(icao);
      
      console.log('[AISWeb METAR] Buscando dados para', icao);
      console.log('[AISWeb METAR] URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AISWeb METAR] Erro na resposta:', errorData);
        throw new Error(errorData.error || `Erro: ${response.statusText}`);
      }

      const data: MetarResponse = await response.json();
      
      console.log('[AISWeb METAR] Dados recebidos:', data);
      
      // Validação: checar se há erro no response do backend
      if ('error' in data) {
        console.error('[AISWeb METAR] Sem dados METAR para', icao);
        throw new Error(data.error || 'Dados meteorológicos indisponíveis');
      }
      
      // Validação básica se veio dado vazio
      if (!data || !data.rawOb) {
        console.error('[AISWeb METAR] Sem dados METAR para', icao);
        throw new Error("Dados meteorológicos indisponíveis.");
      }

      console.log('[METAR AISWeb] ✅ Dados carregados com sucesso');
      setWeather(data);
    } catch (err: any) {
      console.error('[METAR AISWeb] ❌ Erro ao buscar clima:', err);
      setError(err.message || "Erro desconhecido");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca inicial e setup do intervalo
  useEffect(() => {
    fetchWeather(defaultIcao);
    
    // Atualiza a cada 5 minutos (300000ms) para respeitar o cache do backend
    const interval = setInterval(() => {
      fetchWeather(defaultIcao);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchWeather, defaultIcao]);

  return { weather, loading, error, refetch: () => fetchWeather(defaultIcao) };
}