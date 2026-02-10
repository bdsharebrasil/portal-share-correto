import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/config/api';

// 1. Interface de retorno para o seu Componente
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

// 2. Função Auxiliar: Transforma a string "SBGR 100400Z..." em dados legíveis
const parseMetarString = (raw: string) => {
  // Regex para Temperatura e Orvalho (ex: 22/18 ou M02/M05)
  const tempMatch = raw.match(/(M?\d{2})\/(M?\d{2})/);
  // Regex para Vento (ex: 08005KT ou 12015G25KT)
  const windMatch = raw.match(/(\d{3})(\d{2})(G\d{2})?KT/);
  // Regex para Pressão (ex: Q1015)
  const pressMatch = raw.match(/Q(\d{4})/);
  // Regex para Visibilidade (ex: 9999 ou 0500)
  const visibMatch = raw.match(/\s(\d{4})\s/);

  const parseTemp = (t: string) => t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t);

  return {
    temp: tempMatch ? parseTemp(tempMatch[1]) : null,
    dewp: tempMatch ? parseTemp(tempMatch[2]) : null,
    wdir: windMatch ? parseInt(windMatch[1]) : null,
    wspd: windMatch ? parseInt(windMatch[2]) : null,
    wgst: windMatch && windMatch[3] ? parseInt(windMatch[3].replace('G', '')) : null,
    altim: pressMatch ? parseInt(pressMatch[1]) : null,
    visib: visibMatch ? parseInt(visibMatch[1]) : (raw.includes('CAVOK') ? 9999 : null),
  };
};

export function useWeather(defaultIcao: string = 'SBGR') {
  const [weather, setWeather] = useState<MetarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (icao: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = API_ENDPOINTS.weather(icao);
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

      const data = await response.json();

      // Navega na estrutura da AISWEB: data -> met -> metar
      // O seu Worker manda 'aisweb' ou o objeto direto. Ajustamos para ambos:
      const aisData = data.met || data.aisweb?.met;
      const metarObj = aisData?.metar;

      if (!metarObj || !metarObj.metar) {
        throw new Error("Dados METAR não encontrados para este ICAO.");
      }

      // Monta o objeto final processado
      const parsedData: MetarResponse = {
        icao: metarObj.loc || icao.toUpperCase(),
        rawOb: metarObj.metar,
        ...parseMetarString(metarObj.metar),
        flightCategory: (metarObj.cat as any) || 'VFR',
        reportTime: metarObj.date,
        updatedTime: new Date().toISOString(),
        source: 'AISWEB'
      };

      setWeather(parsedData);
    } catch (err: any) {
      console.error('[useWeather] Erro:', err);
      setError(err.message);
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(defaultIcao);
    const interval = setInterval(() => fetchWeather(defaultIcao), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather, defaultIcao]);

  return { weather, loading, error, refetch: () => fetchWeather(defaultIcao) };
}