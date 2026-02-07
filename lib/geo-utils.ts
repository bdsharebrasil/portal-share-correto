/**
 * Parses a DMS string coordinate like "47 52 48 W 23 19 55 S"
 * into a decimal { lat, lng } object.
 */
export const parseDMSCoordinate = (coordStr: string): { lat: number; lng: number } | null => {
  try {
    const parts = coordStr.trim().split(/\s+/);
    if (parts.length < 8) return null;

    // Standard expected format: [deg, min, sec, hem, deg, min, sec, hem]
    // Example: "47 52 48 W 23 19 55 S"
    // Longitude is first in the provided data format? "47 52 48 W"
    
    const lonDeg = parseFloat(parts[0]);
    const lonMin = parseFloat(parts[1]);
    const lonSec = parseFloat(parts[2]);
    const lonHem = parts[3].toUpperCase();

    const latDeg = parseFloat(parts[4]);
    const latMin = parseFloat(parts[5]);
    const latSec = parseFloat(parts[6]);
    const latHem = parts[7].toUpperCase();

    let lon = lonDeg + lonMin / 60 + lonSec / 3600;
    if (lonHem === 'W') lon = -lon;

    let lat = latDeg + latMin / 60 + latSec / 3600;
    if (latHem === 'S') lat = -lat;

    return { lat, lng: lon };
  } catch (e) {
    console.error("Error parsing coordinate:", coordStr, e);
    return null;
  }
};

/**
 * Haversine formula to calculate distance between two points in Nautical Miles.
 */
export const calculateDistanceNM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3440.065; // Earth radius in Nautical Miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
};
