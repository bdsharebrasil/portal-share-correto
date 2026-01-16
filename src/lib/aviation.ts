// Aviation calculation utilities

// Haversine formula for distance calculation
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
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

// Calculate magnetic heading between two points
export function calculateMagneticHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.cos(dLon);

  let heading = (Math.atan2(y, x) * 180) / Math.PI;
  heading = (heading + 360) % 360;

  // Apply magnetic variation (aproximação para Brasil: -20°)
  const magneticVariation = -20;
  heading = (heading + magneticVariation + 360) % 360;

  return Math.round(heading);
}

// Divide route into segments (30 min or 200 NM)
export function divideRoute(
  points: Array<{ lat: number; lon: number; name: string }>,
  cruiseSpeed: number = 250 // knots
): Array<{
  from: string;
  to: string;
  distance: number;
  heading: number;
  time: number;
}> {
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
    const heading = calculateMagneticHeading(from.lat, from.lon, to.lat, to.lon);
    const time = (distance / cruiseSpeed) * 60; // minutes

    segments.push({
      from: from.name,
      to: to.name,
      distance: Math.round(distance * 10) / 10,
      heading,
      time: Math.round(time),
    });
  }

  return segments;
}

// Fetch METAR data
export async function fetchMETAR(icao: string): Promise<any> {
  try {
    const response = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`,
      {
        headers: {
          "User-Agent": "ShareBrasil-App",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch METAR");
    return await response.json();
  } catch (error) {
    console.error("Error fetching METAR:", error);
    return null;
  }
}

// Fetch TAF data
export async function fetchTAF(icao: string): Promise<any> {
  try {
    const response = await fetch(
      `https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`,
      {
        headers: {
          "User-Agent": "ShareBrasil-App",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch TAF");
    return await response.json();
  } catch (error) {
    console.error("Error fetching TAF:", error);
    return null;
  }
}
