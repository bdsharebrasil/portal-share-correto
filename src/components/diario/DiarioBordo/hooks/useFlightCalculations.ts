import { useState, useEffect, useCallback } from 'react';
import { timeStringToMinutes, minutesToTimeString, calculateTimeDiff } from '@/utils/timeUtils';
import { calculateDistance, calculateDayNightTimes } from '@/utils/calculationUtils';
import { logError } from '@/utils/logger';

interface FlightEntry {
  ac_time?: string;
  cor_time?: string;
  dep_time?: string;
  pou_time?: string;
  departure_aerodrome?: string;
  arrival_aerodrome?: string;
  [key: string]: any;
}

interface CalculatedTimes {
  total_time: number;
  time: number;
  day_time: number;
  night_hours: number;
  distance_nm: number;
  crew_checkin_time: string;
}

export const useFlightCalculations = (
  entries: any[],
  aerodromes: any[],
  lastCelula: number
) => {
  const [calculatedTimes, setCalculatedTimes] = useState<CalculatedTimes>({
    total_time: 0,
    time: 0,
    day_time: 0,
    night_hours: 0,
    distance_nm: 0,
    crew_checkin_time: ''
  });

  // Calculate celula (aircraft flight hours)
  const calculateCelula = useCallback((entry: FlightEntry) => {
    let baseParaCalculo = lastCelula;
    if (entries && entries.length > 0) {
      const celulasExistentes = entries.map((e: any) => Number(e.celula) || 0);
      const ultimaCelulaRegistrada = Math.max(...celulasExistentes);
      if (ultimaCelulaRegistrada > baseParaCalculo) {
        baseParaCalculo = ultimaCelulaRegistrada;
      }
    }

    const flightTime = entry.time || calculateTimeDiff(entry.dep_time, entry.pou_time) || 0;
    const newCelula = parseFloat((baseParaCalculo + flightTime).toFixed(1));
    return newCelula;
  }, [entries, lastCelula]);

  // Calculate times based on aircraft times
  const calculateTimes = useCallback((entry: FlightEntry): CalculatedTimes => {
    try {
      if (!entry.ac_time?.trim() || !entry.cor_time?.trim()) {
        return calculatedTimes;
      }

      const totalTime = calculateTimeDiff(entry.ac_time, entry.cor_time);
      let flightTime = 0;
      if (entry.dep_time?.trim() && entry.pou_time?.trim()) {
        flightTime = calculateTimeDiff(entry.dep_time, entry.pou_time);
      }

      const dayNightResult = calculateDayNightTimes({
        dep_time: entry.dep_time,
        pou_time: entry.pou_time,
        total_time: totalTime
      });

      const checkinTime = calculateCrewCheckinTime(entry.ac_time);

      return {
        total_time: totalTime,
        time: flightTime,
        day_time: dayNightResult.day_time,
        night_hours: dayNightResult.night_time,
        distance_nm: calculatedTimes.distance_nm,
        crew_checkin_time: checkinTime
      };
    } catch (error) {
      logError("Erro ao calcular tempos:", error);
      return calculatedTimes;
    }
  }, [calculatedTimes]);

  // Calculate distance between aerodromes
  const calculateDistanceBetweenAerodromes = useCallback((dep: string, arr: string): number => {
    if (!dep || !arr || aerodromes.length === 0) return 0;

    try {
      const depAero = aerodromes.find((a: any) => a.designativo === dep);
      const arrAero = aerodromes.find((a: any) => a.designativo === arr);
      if (!depAero?.coordenadas || !arrAero?.coordenadas) return 0;

      const [lat1, lon1] = depAero.coordenadas.split(',').map(Number);
      const [lat2, lon2] = arrAero.coordenadas.split(',').map(Number);
      return Math.round(calculateDistance(lat1, lon1, lat2, lon2));
    } catch (e) {
      logError("Erro ao calcular distância", e);
      return 0;
    }
  }, [aerodromes]);

  return {
    calculateTimes,
    calculateCelula,
    calculateDistanceBetweenAerodromes
  };
};

// Helper function to calculate crew check-in time (30 minutes before AC time)
const calculateCrewCheckinTime = (acTime: string): string => {
  if (!acTime || !acTime.trim()) return '';
  try {
    const acMin = timeStringToMinutes(acTime);
    const checkinMin = acMin - 30;
    const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;
    return minutesToTimeString(finalMin);
  } catch (e) {
    logError("Erro ao calcular check-in time", e);
    return '';
  }
};
