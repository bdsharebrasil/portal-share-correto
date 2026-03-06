import { useState, useEffect, useCallback } from 'react';
import { getAirportCoordinates, searchAirports, type AirportInfo } from '@/services/airports';

// Common Brazilian airports to search
const COMMON_AIRPORTS = [
  'SBGR', // São Paulo - Guarulhos
  'SBSP', // São Paulo - Congonhas
  'SBPF', // Porto Alegre
  'SBRJ', // Rio de Janeiro - Galeão
  'SBCT', // Curitiba
  'SBRF', // Recife
  'SBSA', // Salvador
  'SBMG', // Belo Horizonte
  'SBMA', // Manaus
  'SBDN', // Brasília
  'SBBS', // Brasília
  'SBPA', // Fortaleza
];

/**
 * Calculate distance between two points using Haversine formula (km)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearestAirport {
  airport: AirportInfo;
  distance: number;
}

export function useFindNearestAirport() {
  const [nearest, setNearest] = useState<NearestAirport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findNearest = useCallback(
    async (latitude: number, longitude: number) => {
      setLoading(true);
      setError(null);

      try {
        // Fetch coordinates for common airports
        const airportPromises = COMMON_AIRPORTS.map((icao) =>
          getAirportCoordinates(icao).catch(() => null)
        );

        const airportsList = await Promise.all(airportPromises);
        const validAirports = airportsList.filter(
          (a) => a !== null
        ) as AirportInfo[];

        if (validAirports.length === 0) {
          throw new Error('Nenhum aeroporto encontrado');
        }

        // Calculate distances and find nearest
        const withDistances = validAirports.map((airport) => ({
          airport,
          distance: calculateDistance(latitude, longitude, airport.lat, airport.lng),
        }));

        const nearest = withDistances.reduce((prev, current) =>
          prev.distance < current.distance ? prev : current
        );

        setNearest(nearest);
      } catch (err: any) {
        console.error('[useFindNearestAirport] Erro:', err);
        setError(err.message || 'Erro ao encontrar aeroporto mais próximo');
        setNearest(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { nearest, loading, error, findNearest };
}
