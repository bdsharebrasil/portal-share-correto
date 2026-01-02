import { useMemo } from 'react';

export interface Waypoint {
  id?: string;
  icao: string;
  name: string;
  lat: number;
  lng: number;
  type: 'departure' | 'arrival' | 'waypoint';
  altitude?: number;
}

export interface LegInfo {
  from: string;
  to: string;
  distanceNM: number;
  bearing: number;
  estimatedTimeMinutes: number;
}

export interface PerformanceData {
  cruiseSpeedKnots: number;
  fuelBurnLitersPerHour: number;
  serviceAltitude?: number;
  maxAltitude?: number;
}

export const defaultPerformance: PerformanceData = {
  cruiseSpeedKnots: 150,
  fuelBurnLitersPerHour: 50,
  serviceAltitude: 25000,
  maxAltitude: 28000,
};

// Convert degrees to cardinal and numeric bearing
export function formatBearing(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  const normalized = Math.round(bearing) % 360;
  return `${normalized.toString().padStart(3, '0')}°${directions[index]}`;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  return bearing;
}

interface FlightPlanCalcsResult {
  legs: LegInfo[];
  totalDistanceNM: number;
  estimatedTimeMinutes: number;
  estimatedTimeHours: string;
  fuelBurnLiters: number;
  fuelBurnGallons: number;
  cruiseSpeedKnots: number;
}

export function useFlightPlanCalcs(
  waypoints: Waypoint[],
  performance: PerformanceData = defaultPerformance
): FlightPlanCalcsResult {
  return useMemo(() => {
    if (waypoints.length < 2) {
      return {
        legs: [],
        totalDistanceNM: 0,
        estimatedTimeMinutes: 0,
        estimatedTimeHours: '0h 0m',
        fuelBurnLiters: 0,
        fuelBurnGallons: 0,
        cruiseSpeedKnots: performance.cruiseSpeedKnots,
      };
    }

    const legs: LegInfo[] = [];
    let totalDistance = 0;

    // Calculate each leg
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
      const timeMinutes = (distance / performance.cruiseSpeedKnots) * 60;

      legs.push({
        from: from.icao,
        to: to.icao,
        distanceNM: distance,
        bearing,
        estimatedTimeMinutes: timeMinutes,
      });

      totalDistance += distance;
    }

    const totalTimeMinutes = (totalDistance / performance.cruiseSpeedKnots) * 60;
    const hours = Math.floor(totalTimeMinutes / 60);
    const minutes = Math.round(totalTimeMinutes % 60);
    const estimatedTimeHours = `${hours}h ${minutes}m`;

    const fuelBurnLiters = (totalTimeMinutes / 60) * performance.fuelBurnLitersPerHour;
    const fuelBurnGallons = fuelBurnLiters / 3.785; // Convert liters to gallons (US)

    return {
      legs,
      totalDistanceNM: totalDistance,
      estimatedTimeMinutes: totalTimeMinutes,
      estimatedTimeHours,
      fuelBurnLiters,
      fuelBurnGallons,
      cruiseSpeedKnots: performance.cruiseSpeedKnots,
    };
  }, [waypoints, performance]);
}
