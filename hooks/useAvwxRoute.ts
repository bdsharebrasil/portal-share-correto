import { useState, useEffect } from 'react';
import { getAvwxRoute, generateMockRoute, type AvwxRouteData } from '@/services/avwxRouteService';

interface UseAvwxRouteOptions {
  departure?: string;
  destination?: string;
  routeString?: string;
  enabled?: boolean;
}

export function useAvwxRoute({
  departure,
  destination,
  routeString,
  enabled = true,
}: UseAvwxRouteOptions) {
  const [route, setRoute] = useState<AvwxRouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!enabled || !departure) {
      setRoute(null);
      return;
    }

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to fetch from AVWX
        const result = await getAvwxRoute(departure, destination, routeString);

        if (result) {
          setRoute(result);
          setIsOffline(false);
        } else {
          // Fallback to mock route if API fails
          console.warn('AVWX route API failed, using mock data');
          const mockRoute = generateMockRoute(departure, destination || departure);
          setRoute(mockRoute);
          setIsOffline(true);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar rota';
        console.error('Route fetch error:', errorMessage);
        
        // Use mock data on error
        const mockRoute = generateMockRoute(departure, destination || departure);
        setRoute(mockRoute);
        setIsOffline(true);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [departure, destination, routeString, enabled]);

  return {
    route,
    loading,
    error,
    isOffline,
  };
}
