/**
 * AVWX Route Service
 * 
 * Consumes the AVWX /route endpoint to get optimized flight routes
 * with waypoints, distance, and navigation information
 * 
 * API Docs: https://avwx.rest/api/docs/route
 */

export interface AvwxRouteWaypoint {
  name: string;
  lat: number;
  lon: number;
  distance?: number;
  bearing?: number;
}

export interface AvwxRouteSegment {
  from: string;
  to: string;
  distance: number; // nautical miles
  bearing: number;
  duration?: number; // minutes at standard cruise speed
}

export interface AvwxRouteData {
  departure: string;
  destination: string;
  waypoints: AvwxRouteWaypoint[];
  segments: AvwxRouteSegment[];
  totalDistance: number;
  estimatedDuration: number; // minutes at 250 knots
  alternates?: string[];
  errors?: string[];
}

interface AvwxRouteResponse {
  result: {
    route: string;
    distance: number;
    bearing: number;
    waypoints?: Array<{
      id: string;
      latitude: number;
      longitude: number;
    }>;
  };
  meta?: {
    timestamp: string;
  };
  error?: string;
}

interface AvwxPointResponse {
  result?: {
    icao?: string;
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  error?: string;
}

const AVWX_TOKEN = import.meta.env.VITE_AVWX_API_TOKEN;
const AVWX_BASE_URL = 'https://avwx.rest/api';

/**
 * Parse AVWX route string format
 * Example: "SBGR RJOI RJOJ SBDI" or "SBGR FIR-A-1000 SBDI"
 */
export function parseRouteString(route: string): string[] {
  return route.trim().split(/\s+/).filter(wp => wp.length > 0);
}

/**
 * Get coordinates for a waypoint (ICAO or point code)
 */
export async function getWaypointCoordinates(
  waypoint: string
): Promise<{ name: string; lat: number; lon: number } | null> {
  try {
    // Try as ICAO/airport first
    const response = await fetch(
      `${AVWX_BASE_URL}/station/${waypoint.toUpperCase()}?token=${AVWX_TOKEN}`
    );

    if (response.ok) {
      const data: AvwxPointResponse = await response.json();
      if (data.result?.latitude && data.result?.longitude) {
        return {
          name: data.result.name || data.result.icao || waypoint.toUpperCase(),
          lat: data.result.latitude,
          lon: data.result.longitude,
        };
      }
    }

    // Return null if not found (might be a navigation aid or special point)
    console.warn(`Waypoint not found: ${waypoint}`);
    return null;
  } catch (error) {
    console.error(`Error fetching waypoint ${waypoint}:`, error);
    return null;
  }
}

/**
 * Process AVWX route response and calculate segments
 */
function processAvwxRoute(
  departure: string,
  destination: string,
  waypoints: Array<{ name: string; lat: number; lon: number }>,
  cruiseSpeed: number = 250
): AvwxRouteData {
  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  // Calculate bearing between two points
  function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;
    // Apply magnetic variation for Brazil (approximately -20°)
    bearing = (bearing - 20 + 360) % 360;
    return Math.round(bearing);
  }

  // Build segments
  const segments: AvwxRouteSegment[] = [];
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
    const bearing = calculateBearing(from.lat, from.lon, to.lat, to.lon);
    const duration = (distance / cruiseSpeed) * 60;

    segments.push({
      from: from.name,
      to: to.name,
      distance: Math.round(distance * 10) / 10,
      bearing,
      duration: Math.round(duration),
    });

    totalDistance += distance;
  }

  const estimatedDuration = (totalDistance / cruiseSpeed) * 60;

  return {
    departure: waypoints[0]?.name || departure,
    destination: waypoints[waypoints.length - 1]?.name || destination,
    waypoints,
    segments,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedDuration: Math.round(estimatedDuration),
  };
}

/**
 * Get route from AVWX
 * Input: "SBGR RJOI RJOJ SBDI" or departure + destination
 */
export async function getAvwxRoute(
  departure: string,
  destination?: string | null,
  routeString?: string | null
): Promise<AvwxRouteData | null> {
  try {
    if (!AVWX_TOKEN) {
      throw new Error('AVWX API token não configurado');
    }

    // Build waypoint list from route string or just departure/destination
    const waypoints: Array<{ name: string; lat: number; lon: number }> = [];

    // Parse route if provided, otherwise use departure/destination
    const pointsToFetch = routeString
      ? parseRouteString(routeString)
      : [departure, destination || departure].filter(Boolean);

    // Fetch coordinates for each waypoint
    for (const point of pointsToFetch) {
      const coords = await getWaypointCoordinates(point);
      if (coords) {
        waypoints.push(coords);
      }
    }

    if (waypoints.length < 2) {
      throw new Error(
        `Route requires at least 2 valid waypoints. Found: ${waypoints.length}`
      );
    }

    // Process and return route data
    return processAvwxRoute(
      waypoints[0].name,
      waypoints[waypoints.length - 1].name,
      waypoints
    );
  } catch (error) {
    console.error('Error fetching AVWX route:', error);
    return null;
  }
}

/**
 * Get extended route information including alternates
 */
export async function getAvwxRouteWithAlternates(
  departure: string,
  destination: string,
  alternates?: string[]
): Promise<{
  primary: AvwxRouteData | null;
  alternateRoutes: (AvwxRouteData | null)[];
}> {
  const primary = await getAvwxRoute(departure, destination);

  const alternateRoutes = alternates
    ? await Promise.all(
        alternates.map(alt => getAvwxRoute(departure, alt))
      )
    : [];

  return {
    primary,
    alternateRoutes,
  };
}

/**
 * Mock route data for development/offline use
 */
export function generateMockRoute(
  departure: string,
  destination: string
): AvwxRouteData {
  return {
    departure,
    destination,
    waypoints: [
      {
        name: departure.toUpperCase(),
        lat: -23.4356,
        lon: -46.4731,
      },
      {
        name: `WP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        lat: -22.9068,
        lon: -43.1729,
      },
      {
        name: destination.toUpperCase(),
        lat: -22.9068,
        lon: -43.1729,
      },
    ],
    segments: [
      {
        from: departure.toUpperCase(),
        to: `WP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        distance: 180.5,
        bearing: 135,
        duration: 43,
      },
      {
        from: `WP-${Math.random().toString(36).substring(7).toUpperCase()}`,
        to: destination.toUpperCase(),
        distance: 120.3,
        bearing: 180,
        duration: 29,
      },
    ],
    totalDistance: 300.8,
    estimatedDuration: 72,
  };
}
