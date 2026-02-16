// hooks/useMetrics.ts
import { useMemo } from 'react';
import { FlightEntry, FlightMetrics } from '../types';

export function useMetrics(entries: FlightEntry[]): FlightMetrics {
  return useMemo(() => {
    if (entries.length === 0) {
      return {
        totalFlights: 0,
        totalHours: 0,
        totalDistance: 0,
        totalFuel: 0,
        totalLandings: 0,
        dayHours: 0,
        nightHours: 0,
        ifrHours: 0,
      };
    }

    return entries.reduce(
      (acc, entry) => ({
        totalFlights: acc.totalFlights + 1,
        totalHours: acc.totalHours + (entry.total_time || 0),
        totalDistance: acc.totalDistance + (entry.distance_nm || 0),
        totalFuel: acc.totalFuel + (entry.fuel_added || 0),
        totalLandings: acc.totalLandings + (entry.pousos || 0),
        dayHours: acc.dayHours + (entry.day_time || 0),
        nightHours: acc.nightHours + (entry.night_hours || 0),
        ifrHours: acc.ifrHours + (entry.ifr_time || 0),
      }),
      {
        totalFlights: 0,
        totalHours: 0,
        totalDistance: 0,
        totalFuel: 0,
        totalLandings: 0,
        dayHours: 0,
        nightHours: 0,
        ifrHours: 0,
      }
    );
  }, [entries]);
}