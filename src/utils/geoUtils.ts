/**
 * Formula de Haversine para calcular a distância entre dois pontos.
 * d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)
 */
export const calculateDistanceNM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3440.065; // Raio da Terra em Milhas Náuticas
  const toRad = (v: number) => (v * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Converte DMS (Graus, Minutos, Segundos) para Decimal.
 * Suporta formatos: "23 19 55 S 047 52 48 W" ou com símbolos "23°19'55"S..."
 */
export const parseDMSCoordinate = (coordStr: string): { lat: number; lng: number } | null => {
  if (!coordStr) return null;

  try {
    // Remove símbolos e limpa espaços extras para evitar erro no split
    const cleanStr = coordStr.replace(/[°'"\/]/g, ' ').trim();
    const parts = cleanStr.split(/\s+/);

    if (parts.length < 8) return null;

    // Helper para converter DMS em Decimal
    const toDecimal = (d: string, m: string, s: string, hem: string) => {
      let deg = parseFloat(d) + parseFloat(m) / 60 + parseFloat(s) / 3600;
      if (hem === 'S' || hem === 'W') deg = -deg;
      return deg;
    };

    // ATENÇÃO: Verifique se sua fonte de dados envia LON primeiro ou LAT.
    // O padrão AISWEB costuma ser LATITUDE primeiro. 
    // Ajustei aqui para o padrão LAT (parts 0-3) e LON (parts 4-7).
    const lat = toDecimal(parts[0], parts[1], parts[2], parts[3].toUpperCase());
    const lng = toDecimal(parts[4], parts[5], parts[6], parts[7].toUpperCase());

    return { lat, lng };
  } catch (e) {
    console.error("Erro ao processar coordenada DMS:", coordStr, e);
    return null;
  }
};