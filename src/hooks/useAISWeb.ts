// CRIAR NOVO ARQUIVO: hooks/useAISWeb.ts

import { useState, useCallback } from 'react';
import { 
  fetchAISWebNOTAMs, 
  fetchROTAER, 
  checkRouteRestrictions,
  isAerodromeOperational,
  type NOTAMData, 
  type ROTAERData, 
  type AirspaceRestriction 
} from '@/lib/aviation';

interface AISWebCache {
  notams: Record<string, { data: NOTAMData[]; timestamp: number }>;
  rotaer: Record<string, { data: ROTAERData | null; timestamp: number }>;
  restrictions: Record<string, { data: AirspaceRestriction[]; timestamp: number }>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export function useAISWeb() {
  const [cache, setCache] = useState<AISWebCache>({
    notams: {},
    rotaer: {},
    restrictions: {},
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar se cache é válido
  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
  }, []);

  // Buscar NOTAMs
  const getNOTAMs = useCallback(async (icao: string, forceRefresh = false): Promise<NOTAMData[]> => {
    const icaoUpper = icao.toUpperCase();
    
    // Verificar cache
    if (!forceRefresh && cache.notams[icaoUpper] && isCacheValid(cache.notams[icaoUpper].timestamp)) {
      return cache.notams[icaoUpper].data;
    }

    setLoading(true);
    setError(null);

    try {
      const notams = await fetchAISWebNOTAMs(icaoUpper);
      
      // Atualizar cache
      setCache(prev => ({
        ...prev,
        notams: {
          ...prev.notams,
          [icaoUpper]: { data: notams, timestamp: Date.now() },
        },
      }));

      return notams;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao buscar NOTAMs';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cache.notams, isCacheValid]);

  // Buscar múltiplos NOTAMs (origem, destino, alternativa)
  const getMultipleNOTAMs = useCallback(async (icaos: string[]): Promise<Record<string, NOTAMData[]>> => {
    const results: Record<string, NOTAMData[]> = {};
    
    await Promise.all(
      icaos.filter(Boolean).map(async (icao) => {
        try {
          results[icao.toUpperCase()] = await getNOTAMs(icao);
        } catch (err) {
          console.error(`Failed to fetch NOTAMs for ${icao}:`, err);
          results[icao.toUpperCase()] = [];
        }
      })
    );

    return results;
  }, [getNOTAMs]);

  // Buscar ROTAER
  const getROTAER = useCallback(async (icao: string, forceRefresh = false): Promise<ROTAERData | null> => {
    const icaoUpper = icao.toUpperCase();
    
    if (!forceRefresh && cache.rotaer[icaoUpper] && isCacheValid(cache.rotaer[icaoUpper].timestamp)) {
      return cache.rotaer[icaoUpper].data;
    }

    setLoading(true);
    setError(null);

    try {
      const rotaer = await fetchROTAER(icaoUpper);
      
      setCache(prev => ({
        ...prev,
        rotaer: {
          ...prev.rotaer,
          [icaoUpper]: { data: rotaer, timestamp: Date.now() },
        },
      }));

      return rotaer;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao buscar ROTAER';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cache.rotaer, isCacheValid]);

  // Verificar restrições de rota
  const getRouteRestrictions = useCallback(async (
    points: Array<{ lat: number; lng: number }>,
    altitude: number,
    forceRefresh = false
  ): Promise<AirspaceRestriction[]> => {
    const cacheKey = `${points.map(p => `${p.lat},${p.lng}`).join('-')}-${altitude}`;
    
    if (!forceRefresh && cache.restrictions[cacheKey] && isCacheValid(cache.restrictions[cacheKey].timestamp)) {
      return cache.restrictions[cacheKey].data;
    }

    setLoading(true);
    setError(null);

    try {
      const restrictions = await checkRouteRestrictions(points, altitude);
      
      setCache(prev => ({
        ...prev,
        restrictions: {
          ...prev.restrictions,
          [cacheKey]: { data: restrictions, timestamp: Date.now() },
        },
      }));

      return restrictions;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao verificar restrições';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cache.restrictions, isCacheValid]);

  // Validar plano de voo completo
  const validateFlightPlan = useCallback(async (
    origin: string,
    destination: string,
    alternate: string | null,
    route: Array<{ lat: number; lng: number }>,
    altitude: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Buscar NOTAMs de todos os aeródromos
      const icaos = [origin, destination, alternate].filter(Boolean) as string[];
      const notamsData = await getMultipleNOTAMs(icaos);

      // Verificar se aeródromos estão operacionais
      const originStatus = isAerodromeOperational(notamsData[origin.toUpperCase()] || []);
      const destStatus = isAerodromeOperational(notamsData[destination.toUpperCase()] || []);

      // Verificar restrições de rota
      const restrictions = await getRouteRestrictions(route, altitude);

      return {
        valid: originStatus.operational && destStatus.operational,
        notams: notamsData,
        originStatus,
        destinationStatus: destStatus,
        restrictions,
        warnings: [
          ...originStatus.warnings || [],
          ...destStatus.warnings || [],
          ...restrictions.filter(r => r.active).map(r => `Espaço aéreo restrito: ${r.name}`),
        ],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro na validação';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMultipleNOTAMs, getRouteRestrictions]);

  // Limpar cache
  const clearCache = useCallback(() => {
    setCache({ notams: {}, rotaer: {}, restrictions: {} });
  }, []);

  // Verificar se dados estão desatualizados
  const getCacheAge = useCallback((icao: string, type: 'notams' | 'rotaer') => {
    const cached = cache[type][icao.toUpperCase()];
    if (!cached) return null;
    
    const ageMs = Date.now() - cached.timestamp;
    return Math.floor(ageMs / 1000 / 60); // retorna em minutos
  }, [cache]);

  return {
    getNOTAMs,
    getMultipleNOTAMs,
    getROTAER,
    getRouteRestrictions,
    validateFlightPlan,
    clearCache,
    getCacheAge,
    loading,
    error,
  };
}
