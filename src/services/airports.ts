import { supabase } from '@/integrations/supabase/client';
import { parseAerodromeCoordLatLng } from '@/lib/geo';

export interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lng: number;
}


/**
 * Fetch airport coordinates by ICAO code directly from Supabase
 */
export async function getAirportCoordinates(icao: string): Promise<AirportInfo | null> {
  const upperIcao = icao.toUpperCase().trim();
  try {
    const { data, error } = await supabase
      .from('aerodromes')
      .select('designativo, nome, coordenadas')
      .eq('designativo', upperIcao)
      .single();

    if (error) {
      console.warn(`Airport ${upperIcao} not found in Supabase:`, error);
      return null;
    }

    if (data && data.coordenadas) {
      const coords = parseAerodromeCoordLatLng(data.coordenadas);
      if (coords) {
        return {
          icao: data.designativo,
          name: data.nome,
          lat: coords.lat,
          lng: coords.lng,
        };
      }
    }
  } catch (error) {
    console.warn(`Error fetching airport ${upperIcao} from Supabase:`, error);
  }

  return null;
}

/**
 * Batch fetch airport coordinates
 */
export async function getMultipleAirportCoordinates(icaos: string[]): Promise<Map<string, AirportInfo>> {
  const results = new Map<string, AirportInfo>();
  
  for (const icao of icaos) {
    const info = await getAirportCoordinates(icao);
    if (info) {
      results.set(icao.toUpperCase(), info);
    }
  }
  
  return results;
}

/**
 * Search airports by name or ICAO (Supabase-only)
 */
export async function searchAirports(query: string): Promise<AirportInfo[]> {
  const q = query.toLowerCase();
  const { data, error } = await supabase
    .from('aerodromes')
    .select('designativo, nome, coordenadas')
    .or(`designativo.ilike.%${q}%,nome.ilike.%${q}%`)
    .limit(20);

  if (error) {
    console.warn(`Error searching airports for "${query}":`, error);
    return [];
  }

  const results: AirportInfo[] = [];
  for (const item of data || []) {
    const coords = parseAerodromeCoordLatLng(item.coordenadas);
    if (coords) {
      results.push({
        icao: item.designativo,
        name: item.nome,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  }

  return results;
}
