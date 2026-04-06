import { useState, useCallback } from 'react';
import { API_ENDPOINTS } from '@/config/api';

export interface PreferredRoute {
  route: string;
  level?: string;
  type?: string;
  remarks?: string;
}

const routeCache: Record<string, { data: PreferredRoute[]; timestamp: number }> = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 min

export function usePreferredRoutes() {
  const [routes, setRoutes] = useState<PreferredRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoutes = useCallback(async (adep: string, ades: string) => {
    if (!adep || !ades) {
      setRoutes([]);
      return [];
    }

    const cacheKey = `${adep}-${ades}`;
    const cached = routeCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRoutes(cached.data);
      return cached.data;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.routes(adep.toUpperCase(), ades.toUpperCase()));
      if (!response.ok) {
        setRoutes([]);
        return [];
      }

      const data = await response.json();
      const parsed = parseRoutesResponse(data);
      routeCache[cacheKey] = { data: parsed, timestamp: Date.now() };
      setRoutes(parsed);
      return parsed;
    } catch (err) {
      console.error('[usePreferredRoutes] Error:', err);
      setRoutes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { routes, loading, fetchRoutes };
}

function parseRoutesResponse(data: any): PreferredRoute[] {
  if (!data) return [];

  // Handle different response formats
  const items = data?.routesp?.item ?? data?.item ?? data?.routes ?? data?.data ?? data;
  const arr = Array.isArray(items) ? items : items ? [items] : [];

  return arr
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const route = item.rota?.trim() ?? item.route?.trim() ?? item.Route?.trim() ?? '';
      if (!route) return null;

      return {
        route,
        level: item.nivel?.trim() ?? item.level?.trim() ?? item.fl?.trim() ?? undefined,
        type: item.tipo?.trim() ?? item.tipo?.trim() ?? undefined,
        remarks: item.obs?.trim() ?? item.remarks?.trim() ?? undefined,
      } as PreferredRoute;
    })
    .filter(Boolean) as PreferredRoute[];
}
