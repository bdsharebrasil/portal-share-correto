import { Aerodrome } from '@/types';
import { getSolarTimes, timeStringToMinutes } from '@/utils/solarUtils';
import { parseDMSCoordinate } from '@/utils/geoUtils';

/**
 * Calcula tempo noturno baseado em cálculos solares reais
 * Implementa regra RBAC: Noite = Sunset + 15min (Crepúsculo Civil) até Sunrise - 15min
 *
 * @param entry Dados do voo contendo ac_time, cor_time, departure_airport, entry_date
 * @param aerodromes Array de aerodromes com coordenadas
 * @returns Object com night_time_minutes e day_time_minutes
 */
export const calculateNightTimeWithSolar = (
  entry: {
    ac_time: string;
    cor_time: string;
    departure_airport: string;
    entry_date: string;
    total_time?: number;
  },
  aerodromes: Aerodrome[]
): { night_time_minutes: number; day_time_minutes: number } => {
  if (!entry.ac_time || !entry.cor_time || !entry.departure_airport || !entry.entry_date) {
    return { night_time_minutes: 0, day_time_minutes: entry.total_time ? entry.total_time * 60 : 0 };
  }

  try {
    // Find departure aerodrome with coordinates
    const depAero = aerodromes?.find(
      a => a.designativo === entry.departure_airport.toUpperCase()
    );

    if (!depAero?.coordenadas) {
      // Se não encontrar aeródromo ou coordenadas, não consegue calcular
      return { night_time_minutes: 0, day_time_minutes: entry.total_time ? entry.total_time * 60 : 0 };
    }

    const coord = parseDMSCoordinate(depAero.coordenadas);
    if (!coord) {
      return { night_time_minutes: 0, day_time_minutes: entry.total_time ? entry.total_time * 60 : 0 };
    }

    // Get solar times for the flight date
    const flightDate = new Date(entry.entry_date);
    const { sunrise, sunset } = getSolarTimes(flightDate, coord.lat, coord.lng);

    // Convert solar times to minutes UTC
    const sunriseMin = sunrise.getUTCHours() * 60 + sunrise.getUTCMinutes();
    const sunsetMin = sunset.getUTCHours() * 60 + sunset.getUTCMinutes();

    // RBAC Rule: Night = Sunset + 15min (Civil Twilight) until Sunrise - 15min
    const nightStart = sunsetMin + 15;
    const nightEnd = sunriseMin - 15 < 0 ? sunriseMin - 15 + 1440 : sunriseMin - 15;

    // Block times (AC to COR)
    const acMin = timeStringToMinutes(entry.ac_time);
    let corMin = timeStringToMinutes(entry.cor_time);
    if (corMin < acMin) {
      corMin += 1440; // Cruzou meia-noite
    }

    // Helper function to calculate overlap between two time intervals
    const calculateOverlap = (start1: number, end1: number, start2: number, end2: number): number => {
      return Math.max(0, Math.min(end1, end2) - Math.max(start1, start2));
    };

    // Night period crosses midnight, so we calculate:
    // 1. Night time before midnight (nightStart until 1440)
    // 2. Night time after midnight (0 until nightEnd)
    // 3. If flight crossed to next day, night period from next day also

    const nightBeforeMidnight = calculateOverlap(acMin, corMin, nightStart, 1440);
    const nightAfterMidnight = calculateOverlap(acMin, corMin, 0, nightEnd);
    const nightNextDay = calculateOverlap(acMin, corMin, nightStart + 1440, 2880);

    let nightMinutes = nightBeforeMidnight + nightAfterMidnight + nightNextDay;

    // Ensure night time doesn't exceed total block time
    const totalBlockTime = corMin - acMin;
    nightMinutes = Math.min(nightMinutes, totalBlockTime);

    // Calculate day time
    const dayTimeMinutes = totalBlockTime - nightMinutes;

    return {
      night_time_minutes: Math.round(nightMinutes),
      day_time_minutes: Math.round(dayTimeMinutes),
    };
  } catch (error) {
    console.error('Erro ao calcular tempo noturno com solar:', error);
    return { night_time_minutes: 0, day_time_minutes: entry.total_time ? entry.total_time * 60 : 0 };
  }
};
