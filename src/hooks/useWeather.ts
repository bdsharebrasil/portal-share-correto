import { useState, useEffect, useCallback } from 'react';

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
    setLoading(true);
    setError(null);
    try {
      // Chama a rota do SEU backend
      const response = await fetch(`${BACKEND_URL}/api/weather/metar/${icao}`);
      
      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }

      const data: MetarResponse = await response.json();
      
      // Validação básica se veio dado vazio
      if (!data || !data.rawOb) {
        throw new Error("Dados meteorológicos indisponíveis.");
      }

      setWeather(data);
    } catch (err: any) {
      console.error("Erro ao buscar clima:", err);
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