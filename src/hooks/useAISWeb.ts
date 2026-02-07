import { useState, useCallback, useRef } from 'react';
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

const CACHE_DURATION = 5 * 60 * 1000;

export function useAISWeb() {
  // Estado para renderização
  const [cacheState, setCacheState] = useState<AISWebCache>({
    notams: {},
    rotaer: {},
    restrictions: {},
  });
  
  // Ref para acesso síncrono dentro das funções (evita recriar funções quando o cache muda)
  const cacheRef = useRef<AISWebCache>(cacheState);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper para atualizar tanto o Ref quanto o State
  const updateCache = useCallback((updater: (prev: AISWebCache) => AISWebCache) => {
    setCacheState(prev => {
      const newState = updater(prev);
      cacheRef.current = newState; // Mantém o ref sincronizado
      return newState;
    });
  }, []);

  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
  }, []);

  // 1. Buscar NOTAMs (Agora estável, sem dependência do cacheState)
  const getNOTAMs = useCallback(async (icao: string, forceRefresh = false): Promise<NOTAMData[]> => {
    const icaoUpper = icao.toUpperCase();
    
    // Ler do Ref em vez do State
    const cached = cacheRef.current.notams[icaoUpper];
    if (!forceRefresh && cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    // Não setar loading se for uma chamada interna (para evitar flicker em Promise.all)
    // Mas para chamadas diretas, ok. Vamos controlar isso melhor no validateFlightPlan.
    setLoading(true);
    setError(null);

    try {
      const notams = await fetchAISWebNOTAMs(icaoUpper);
      
      updateCache(prev => ({
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
      throw err; // Re-throw para quem chamou tratar se quiser
    } finally {
      setLoading(false);
    }
  }, [updateCache, isCacheValid]); // Dependências estáveis!

  // 2. Buscar ROTAER
  const getROTAER = useCallback(async (icao: string, forceRefresh = false): Promise<ROTAERData | null> => {
    const icaoUpper = icao.toUpperCase();
    
    const cached = cacheRef.current.rotaer[icaoUpper];
    if (!forceRefresh && cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      const rotaer = await fetchROTAER(icaoUpper);
      
      updateCache(prev => ({
        ...prev,
        rotaer: {
          ...prev.rotaer,
          [icaoUpper]: { data: rotaer, timestamp: Date.now() },
        },
      }));

      return rotaer;
    } catch (err) {
      console.error(err);
      // ROTAER falhando não deve quebrar a app, retorna null
      return null;
    } finally {
      setLoading(false);
    }
  }, [updateCache, isCacheValid]);

  // 3. Buscar Múltiplos NOTAMs (Otimizado para Promise.all)
  const getMultipleNOTAMs = useCallback(async (icaos: string[]): Promise<Record<string, NOTAMData[]>> => {
    setLoading(true);
    const uniqueIcaos = [...new Set(icaos.filter(Boolean))];
    const results: Record<string, NOTAMData[]> = {};

    try {
      await Promise.all(
        uniqueIcaos.map(async (icao) => {
          try {
            // Nota: getNOTAMs gerencia seu próprio loading interno, 
            // mas como estamos num Promise.all, o último a terminar vai setar false.
            results[icao.toUpperCase()] = await getNOTAMs(icao); 
          } catch (e) {
            results[icao.toUpperCase()] = [];
          }
        })
      );
      return results;
    } finally {
      setLoading(false);
    }
  }, [getNOTAMs]);

  // 4. Restrições de Rota (Com hash simples para a chave)
  const getRouteRestrictions = useCallback(async (
    points: Array<{ lat: number; lng: number }>,
    altitude: number,
    forceRefresh = false
  ): Promise<AirspaceRestriction[]> => {
    // Cria uma chave simplificada (ex: primeiros e últimos pontos + length) para economizar memória
    // Ou usa JSON.stringify se a rota não for gigantesca
    const cacheKey = `route-${points.length}-${points[0]?.lat}-${points[points.length-1]?.lat}-${altitude}`;
    
    const cached = cacheRef.current.restrictions[cacheKey];
    if (!forceRefresh && cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    setLoading(true);
    try {
      const restrictions = await checkRouteRestrictions(points, altitude);
      
      updateCache(prev => ({
        ...prev,
        restrictions: {
          ...prev.restrictions,
          [cacheKey]: { data: restrictions, timestamp: Date.now() },
        },
      }));

      return restrictions;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [updateCache, isCacheValid]);

  // 5. Validação (Orquestrador)
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
      const icaos = [origin, destination, alternate].filter(Boolean) as string[];
      
      // Executa em paralelo: NOTAMs e Restrições
      const [notamsData, restrictions] = await Promise.all([
        getMultipleNOTAMs(icaos),
        getRouteRestrictions(route, altitude)
      ]);

      const originStatus = isAerodromeOperational(notamsData[origin.toUpperCase()] || []);
      const destStatus = isAerodromeOperational(notamsData[destination.toUpperCase()] || []);

      // Formata warnings de restrições
      const restrictionWarnings = restrictions
        .filter(r => r.active)
        .map(r => `Área Restrita: ${r.name} (${r.type})`);

      return {
        valid: originStatus.operational && destStatus.operational,
        notams: notamsData,
        originStatus,
        destinationStatus: destStatus,
        restrictions,
        warnings: [
          ...(originStatus.warnings || []),
          ...(destStatus.warnings || []),
          ...restrictionWarnings,
        ],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro na validação do plano';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMultipleNOTAMs, getRouteRestrictions]);

  const clearCache = useCallback(() => {
    const empty = { notams: {}, rotaer: {}, restrictions: {} };
    setCacheState(empty);
    cacheRef.current = empty;
  }, []);

  const getCacheAge = useCallback((icao: string, type: 'notams' | 'rotaer') => {
    const cached = cacheRef.current[type][icao.toUpperCase()];
    if (!cached) return null;
    return Math.floor((Date.now() - cached.timestamp) / 1000 / 60);
  }, []);

  return {
    getNOTAMs,
    getMultipleNOTAMs,
    getROTAER,
    getRouteRestrictions,
    validateFlightPlan,
    clearCache,
    getCacheAge,
    cache: cacheState, // Expor o estado reativo se necessário para UI de debug
    loading,
    error,
  };
}