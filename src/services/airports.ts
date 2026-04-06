import { supabase } from '@/integrations/supabase/client';

export interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Parse coordinates from various formats stored in Supabase
 */
function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null;

  // Try DMS format: N23°32'20" W46°28'10"
  const dmsMatch = coordStr.match(
    /([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i
  );
  if (dmsMatch) {
    const lat = (
      parseInt(dmsMatch[2]) +
      parseInt(dmsMatch[3]) / 60 +
      parseInt(dmsMatch[4]) / 3600
    ) * (dmsMatch[1].toUpperCase() === 'S' ? -1 : 1);

    const lng = (
      parseInt(dmsMatch[6]) +
      parseInt(dmsMatch[7]) / 60 +
      parseInt(dmsMatch[8]) / 3600
    ) * (dmsMatch[5].toUpperCase() === 'W' ? -1 : 1);

    return { lat, lng };
  }

  // Try decimal format: -23.5389, -46.4697 or -23.5389,-46.4697
  const decimalMatch = coordStr.match(/([-\d.]+)[,\s]+([-\d.]+)/);
  if (decimalMatch) {
    return {
      lat: parseFloat(decimalMatch[1]),
      lng: parseFloat(decimalMatch[2]),
    };
  }

  return null;
}

/**
 * Fetch airport coordinates by ICAO code directly from Supabase
 */
export async function getAirportCoordinates(icao: string): Promise<AirportInfo | null> {
  const upperIcao = icao.toUpperCase().trim();
  try {
    const { data, error } = await supabase
      .from('aerodromes')
      .select('designativo, name, coordenadas')
      .eq('designativo', upperIcao)
      .single();

    if (error) {
      console.warn(`Airport ${upperIcao} not found in Supabase:`, error);
      return null;
    }

    if (data && data.coordenadas) {
      const coords = parseCoordinates(data.coordenadas);
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
    .select('designativo, name, coordenadas')
    .or(`designativo.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(20);

  if (error) {
    console.warn(`Error searching airports for "${query}":`, error);
    return [];
  }

  const results: AirportInfo[] = [];
  for (const item of data || []) {
    const coords = parseCoordinates(item.coordenadas);
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
