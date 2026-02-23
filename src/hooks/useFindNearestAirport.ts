import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistanceNM, parseDMSCoordinate } from '@/utils/geoUtils';

export function useFindNearestAirport() {
  const [nearest, setNearest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const findNearest = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      // 1. Tenta a API do Worker primeiro (Raio de 50km)
      const result = await apiClient.getNearbyAirport(latitude, longitude, 50);
      
      if (result?.airports?.length > 0) {
        const first = result.airports[0];
        setNearest({
          airport: { icao: first.icao, name: first.name },
          distance: first.distKm,
        });
        return;
      }
      
      throw new Error("API retornou vazio");

    } catch (err) {
      console.warn("⚠️ API falhou (502/Timeout). Buscando no Supabase...");

      // 2. FALLBACK SUPABASE: Busca todos os aeródromos e calcula a distância no Front
      const { data: aerodromes } = await supabase
        .from('aerodromes')
        .select('designativo, name, coordenadas');

      if (aerodromes) {
        let closest = null;
        let minDistance = Infinity;

        aerodromes.forEach(aero => {
          const aeroCoords = parseDMSCoordinate(aero.coordenadas);
          if (aeroCoords) {
            const dist = calculateDistanceNM(latitude, longitude, aeroCoords.lat, aeroCoords.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closest = aero;
            }
          }
        });

        if (closest) {
          setNearest({
            airport: { icao: closest.designativo, name: closest.name },
            distance: minDistance * 1.852, // Converte NM para Km
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { nearest, loading, findNearest };
}