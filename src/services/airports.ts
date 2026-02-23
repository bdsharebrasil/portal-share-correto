import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

export interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Converte coordenadas do formato DMS ou Decimal para objeto { lat, lng }
 */
function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null;

  // Formato DMS: S23°32'20" W46°28'10" ou similar
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

  // Formato Decimal: -23.5389, -46.4697
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
 * Busca coordenadas por ICAO (Tenta Worker, depois Supabase)
 */
export async function getAirportCoordinates(icao: string): Promise<AirportInfo | null> {
  const upperIcao = icao.toUpperCase().trim();

  // 1. Tenta o Worker (Rota de Geiloc que existe no seu api-client)
  try {
    const response = await fetch(`${API_BASE_URL}/api/geiloc?icao=${upperIcao}`);
    if (response.ok) {
      const data = await response.json();
      // Ajuste baseado no retorno real da sua rota de geiloc
      if (data.lat && (data.lon || data.lng)) {
        return {
          icao: upperIcao,
          name: data.name || upperIcao,
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lon || data.lng),
        };
      }
    }
  } catch (error) {
    console.warn(`Worker geiloc falhou para ${upperIcao}, tentando Supabase...`);
  }

  // 2. Fallback para Supabase
  const { data, error } = await supabase
    .from('aerodromes')
    .select('designativo, name, coordenadas')
    .eq('designativo', upperIcao)
    .single();

  if (!error && data) {
    const coords = parseCoordinates(data.coordenadas);
    if (coords) {
      return {
        icao: data.designativo,
        name: data.name,
        lat: coords.lat,
        lng: coords.lng,
      };
    }
  }

  return null;
}

/**
 * BUSCA DE AEROPORTOS (CORRIGIDA)
 * Como o Worker dá 404 na rota de search, usamos o Supabase diretamente.
 */
export async function searchAirports(query: string): Promise<AirportInfo[]> {
  if (!query || query.length < 2) return [];

  const upperQuery = query.toUpperCase();

  try {
    // Buscamos no Supabase por ICAO (designativo) ou Nome
    const { data, error } = await supabase
      .from('aerodromes')
      .select('designativo, name, coordenadas')
      .or(`designativo.ilike.%${upperQuery}%,name.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;

    return (data || []).map(item => {
      const coords = parseCoordinates(item.coordenadas);
      return {
        icao: item.designativo,
        name: item.name,
        lat: coords?.lat || 0,
        lng: coords?.lng || 0
      };
    });
  } catch (error) {
    console.error('Erro ao buscar aeroportos no Supabase:', error);
    return [];
  }
}

/**
 * Busca múltipla (Batch)
 */
export async function getMultipleAirportCoordinates(icaos: string[]): Promise<Map<string, AirportInfo>> {
  const results = new Map<string, AirportInfo>();
  const uniqueIcaos = [...new Set(icaos.map(i => i.toUpperCase()))];
  
  // Para performance, poderíamos fazer um .in() no Supabase aqui
  for (const icao of uniqueIcaos) {
    const info = await getAirportCoordinates(icao);
    if (info) results.set(icao, info);
  }
  
  return results;
}