import { supabase } from '@/integrations/supabase/client';

// Database of Brazilian airports with coordinates
// Extended with major international airports
const AIRPORT_DATABASE: Record<string, { name: string; lat: number; lng: number }> = {
  // Major Brazilian Airports
  'SBGR': { name: 'São Paulo/Guarulhos', lat: -23.4356, lng: -46.4731 },
  'SBSP': { name: 'São Paulo/Congonhas', lat: -23.6256, lng: -46.4657 },
  'SBRJ': { name: 'Rio de Janeiro/Galeão', lat: -22.8140, lng: -43.2505 },
  'SBRF': { name: 'Recife/Guararapes', lat: -8.1262, lng: -34.9235 },
  'SBSN': { name: 'Salvador/Dois de Julho', lat: -12.9108, lng: -38.3212 },
  'SBCT': { name: 'Curitiba/Afonso Pena', lat: -25.5245, lng: -49.1758 },
  'SBBR': { name: 'Brasília/Presidente Juscelino Kubitschek', lat: -15.8597, lng: -47.8789 },
  'SBAM': { name: 'Manaus/Coronel Edvard Gomes', lat: -3.0264, lng: -60.0495 },
  'SBVT': { name: 'Vitória/Eugenio de Barros', lat: -20.2582, lng: -40.2895 },
  'SBAR': { name: 'Aracaju/Santa Maria', lat: -10.3306, lng: -36.9961 },
  'SBMG': { name: 'Belo Horizonte/Confins', lat: -19.7245, lng: -43.9722 },
  'SBKP': { name: 'Campinas/Viracopos', lat: -23.0075, lng: -47.1445 },
  'SBGF': { name: 'Goiânia/Santa Genoveva', lat: -16.6114, lng: -49.2200 },
  'SBCD': { name: 'Cuiabá/Marechal Rondon', lat: -15.8519, lng: -56.1157 },
  'SBCY': { name: 'Cypriano Benevides (Belém)', lat: -1.3803, lng: -48.4769 },
  'SBPF': { name: 'Porto Velho/Governador Jorge Teixeira', lat: -8.7615, lng: -63.9033 },
  'SBMN': { name: 'Manaus/Ponta Pelada', lat: -3.8383, lng: -60.0048 },
  'SBEG': { name: 'Manaus/Eduardo Gomes', lat: -3.0264, lng: -60.0495 },
  'SBUA': { name: 'Boa Vista/Atlair de Oliveira Gomes', lat: 2.8489, lng: -60.6948 },
  'SBIL': { name: 'Ilhéus/Bahia', lat: -14.7883, lng: -39.0333 },
  'SBUL': { name: 'Uberlândia/Tenente Coronel Av. Cesar Semame', lat: -18.8847, lng: -48.2258 },
  'SBRP': { name: 'Ribeirão Preto/Leite Leme', lat: -21.1342, lng: -47.5804 },
  'SBLO': { name: 'Londrina/Governador Jorge Teixeira', lat: -23.3336, lng: -51.1306 },
  'SBMA': { name: 'Maceió/Zumbi dos Palmares', lat: -9.5054, lng: -35.7915 },
  'SBFZ': { name: 'Fortaleza/Pinto Martins', lat: -3.7759, lng: -38.5323 },
  'SBNT': { name: 'Natal/Augusto Severo', lat: -5.9122, lng: -35.3475 },
  'SBJU': { name: 'João Pessoa/Presidente Castro Pinto', lat: -7.1456, lng: -34.9283 },
  'SBMO': { name: 'Maceió/Zumbi dos Palmares', lat: -9.5054, lng: -35.7915 },
  'SBTT': { name: 'Teresina/Senador Petrônio Portela', lat: -5.0514, lng: -42.8228 },
  'SBSF': { name: 'São Luís/Marechal Cunha Machado', lat: -2.5911, lng: -44.2344 },
  'SBCE': { name: 'Congonhas (São Paulo)', lat: -23.6256, lng: -46.4657 },
  'SBRG': { name: 'Rio Grande do Sul/Salgado Filho', lat: -29.1944, lng: -51.1797 },
  'SBPJ': { name: 'Pelotas/Bartolomeu de Gusmão', lat: -28.3238, lng: -52.3803 },
  'SBPA': { name: 'Porto Alegre/Salgado Filho', lat: -29.9944, lng: -51.1711 },
  'SBSC': { name: 'Santa Catarina/Hercílio Luz', lat: -27.5848, lng: -48.5579 },
  'SBPK': { name: 'Pampulha', lat: -19.8537, lng: -43.9507 },
  'SBRD': { name: 'Rondonópolis', lat: -16.5860, lng: -54.7250 },
  'SBFL': { name: 'Florianópolis', lat: -27.6703, lng: -48.5525 },
  'SBJV': { name: 'Joinville', lat: -26.2242, lng: -48.7972 },
  'SBNF': { name: 'Navegantes', lat: -26.8794, lng: -48.6514 },
  'SBCF': { name: 'Confins', lat: -19.6339, lng: -43.9689 },
  'SBGL': { name: 'Galeão', lat: -22.8089, lng: -43.2436 },
  'SBSV': { name: 'Salvador', lat: -12.9086, lng: -38.3225 },
  'SBCG': { name: 'Campo Grande', lat: -20.4686, lng: -54.6725 },
  'SBTE': { name: 'Teresina', lat: -5.0597, lng: -42.8236 },
  'SBSL': { name: 'São Luís', lat: -2.5853, lng: -44.2342 },
  'SBBE': { name: 'Belém', lat: -1.3792, lng: -48.4764 },
  'SBMQ': { name: 'Macapá', lat: 0.0508, lng: -51.0722 },
  
  // Regional Airports
  'SBMD': { name: 'Maringá/Silvio Name Jr.', lat: -23.2252, lng: -51.4161 },
  'SBWA': { name: 'Brasília/Washington Luís', lat: -15.8597, lng: -47.8789 },
  'SBVG': { name: 'Viracopos', lat: -23.0075, lng: -47.1445 },
  
  // International
  'KMIA': { name: 'Miami International', lat: 25.7959, lng: -80.2870 },
  'KJFK': { name: 'New York JFK', lat: 40.6413, lng: -73.7781 },
  'KORD': { name: 'Chicago O\'Hare', lat: 41.9742, lng: -87.9073 },
  'KDFW': { name: 'Dallas/Fort Worth', lat: 32.8975, lng: -97.0382 },
  'KLAX': { name: 'Los Angeles', lat: 33.9425, lng: -118.4081 },
  'EGLL': { name: 'London Heathrow', lat: 51.4700, lng: -0.4543 },
  'LFPG': { name: 'Paris Charles de Gaulle', lat: 49.0097, lng: 2.5479 },
  'LEMD': { name: 'Madrid Barajas', lat: 40.4719, lng: -3.5626 },
  'EDDF': { name: 'Frankfurt', lat: 50.0379, lng: 8.5622 },
  'SKBO': { name: 'Bogotá', lat: 4.7213, lng: -74.1479 },
  'MDPC': { name: 'Ciudad de Panamá', lat: 8.9824, lng: -79.5199 },
  'MMMX': { name: 'Mexico City', lat: 19.4361, lng: -99.0724 },
  'AVSM': { name: 'San Isidro (Buenos Aires)', lat: -34.8152, lng: -58.4949 },
  'SCEL': { name: 'Santiago', lat: -33.3928, lng: -70.7852 },
};

export interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lng: number;
}

// Helper function to parse coordinates from string format
function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null;
  
  // Format: S23°32'00" W046°38'00" or similar
  const match = coordStr.match(/([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i);
  if (match) {
    const lat = (parseInt(match[2]) + parseInt(match[3]) / 60 + parseInt(match[4]) / 3600) * (match[1].toUpperCase() === 'S' ? -1 : 1);
    const lng = (parseInt(match[6]) + parseInt(match[7]) / 60 + parseInt(match[8]) / 3600) * (match[5].toUpperCase() === 'W' ? -1 : 1);
    return { lat, lng };
  }
  
  // Format: -23.5333, -46.6333
  const decimalMatch = coordStr.match(/([-\d.]+),?\s*([-\d.]+)/);
  if (decimalMatch) {
    return { lat: parseFloat(decimalMatch[1]), lng: parseFloat(decimalMatch[2]) };
  }
  
  return null;
}

/**
 * Fetch airport coordinates by ICAO code
 * First tries local database, then falls back to Supabase aerodromes table
 */
export async function getAirportCoordinates(icao: string): Promise<AirportInfo | null> {
  const upperIcao = icao.toUpperCase().trim();
  
  // Check local database first
  if (AIRPORT_DATABASE[upperIcao]) {
    const airport = AIRPORT_DATABASE[upperIcao];
    return {
      icao: upperIcao,
      name: airport.name,
      lat: airport.lat,
      lng: airport.lng,
    };
  }
  
  // Try to fetch from Supabase aerodromes table
  try {
    const { data, error } = await supabase
      .from('aerodromes')
      .select('designativo, name, coordenadas')
      .eq('designativo', upperIcao)
      .single();
    
    if (!error && data && data.coordenadas) {
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
  } catch (err) {
    console.error('Error fetching airport from database:', err);
  }
  
  // Return null if not found
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
 * Search airports by name or ICAO (local database only for speed)
 */
export function searchAirports(query: string): AirportInfo[] {
  const lowerQuery = query.toLowerCase();
  
  return Object.entries(AIRPORT_DATABASE)
    .filter(([icao, airport]) => 
      icao.toLowerCase().includes(lowerQuery) ||
      airport.name.toLowerCase().includes(lowerQuery)
    )
    .map(([icao, airport]) => ({
      icao,
      name: airport.name,
      lat: airport.lat,
      lng: airport.lng,
    }))
    .slice(0, 10);
}
