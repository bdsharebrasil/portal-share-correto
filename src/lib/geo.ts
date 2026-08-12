/**
 * lib/geo.ts — módulo único de geometria aeronáutica.
 *
 * Fonte de verdade para distância, rumo verdadeiro, proa magnética e parsing
 * de coordenadas de aeródromo. Todo o resto do app deve importar daqui
 * (diretamente ou pelos re-exports em @/lib/aviation e @/lib/flightLevel).
 */

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Variação magnética média aproximada para o Brasil (graus). */
export const MAGNETIC_VARIATION_BR = -20;

/** Raio da Terra em milhas náuticas. */
const EARTH_RADIUS_NM = 3440.065;

/** Distância ortodrômica (Haversine) entre dois pontos, em NM. */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Mesma função de `calculateDistance`, com o nome usado no código legado. */
export const calculateDistanceNM = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  Math.round(calculateDistance(lat1, lon1, lat2, lon2) * 10) / 10;

/** Rumo verdadeiro inicial (0–360°) entre dois pontos. */
export function calcularRumo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Proa magnética (rumo verdadeiro + variação magnética), arredondada. */
export function calculateMagneticHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  magneticVariation: number = MAGNETIC_VARIATION_BR,
): number {
  return Math.round((calcularRumo(lat1, lon1, lat2, lon2) + magneticVariation + 360) % 360);
}

export interface LatLon { lat: number; lon: number }

/**
 * Interpreta a string de coordenadas de `aerodromes.coordenadas`.
 * Aceita DMS com símbolos (`S23°26'12" W046°28'26"`), DMS separada por espaços
 * (`46 28 26 W 23 26 12 S`) e decimal (`-23.43,-46.47`).
 */
export function parseAerodromeCoordString(coordStr: string | null | undefined): LatLon | null {
  if (!coordStr) return null;
  const str = coordStr.trim();

  // DMS com símbolos — hemisfério antes dos graus
  const dms = str.match(/([NS])\s*(\d+)[°\s](\d+)['\s](\d+(?:\.\d+)?)"?\s*([EW])\s*(\d+)[°\s](\d+)['\s](\d+(?:\.\d+)?)"?/i);
  if (dms) {
    const lat = (+dms[2] + +dms[3] / 60 + +dms[4] / 3600) * (dms[1].toUpperCase() === 'S' ? -1 : 1);
    const lon = (+dms[6] + +dms[7] / 60 + +dms[8] / 3600) * (dms[5].toUpperCase() === 'W' ? -1 : 1);
    return { lat, lon };
  }

  // DMS separada por espaços — longitude primeiro, hemisfério depois
  const spaced = str.match(
    /^(\d+)\s+(\d+)\s+([\d.]+)\s*([EW])\s+(\d+)\s+(\d+)\s+([\d.]+)\s*([NS])$/i,
  );
  if (spaced) {
    const lon = (+spaced[1] + +spaced[2] / 60 + +spaced[3] / 3600) * (spaced[4].toUpperCase() === 'W' ? -1 : 1);
    const lat = (+spaced[5] + +spaced[6] / 60 + +spaced[7] / 3600) * (spaced[8].toUpperCase() === 'S' ? -1 : 1);
    return { lat, lon };
  }

  // Decimal "lat,lon"
  const dec = str.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (dec) return { lat: parseFloat(dec[1]), lon: parseFloat(dec[2]) };

  return null;
}

/** Igual a `parseAerodromeCoordString`, porém no formato { lat, lng } usado pelo Leaflet. */
export function parseAerodromeCoordLatLng(coordStr: string | null | undefined) {
  const parsed = parseAerodromeCoordString(coordStr);
  return parsed ? { lat: parsed.lat, lng: parsed.lon } : null;
}

/** Compatibilidade com o parser DMS legado (`"47 52 48 W 23 19 55 S"`). */
export const parseDMSCoordinate = (coordStr: string) => parseAerodromeCoordLatLng(coordStr);
