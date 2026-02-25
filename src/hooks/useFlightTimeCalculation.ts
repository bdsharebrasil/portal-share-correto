import { useMemo } from 'react';
import {
  calculateBlockTime,
  calculateFlightTime,
  calculateDayNightTimes,
  calculateFuelConsumption,
} from '@/utils/calculationUtils';

export interface FlightTimeCalculationResult {
  blockTime: number;
  flightTime: number;
  dayTime: number;
  nightTime: number;
  fuelConsumption: number | null;
  celula: number;
}

/**
 * Hook customizado para calcular tempos de voo automaticamente
 * 
 * Usa useMemo para evitar recálculos desnecessários
 */
export function useFlightTimeCalculation(
  acTime: string,
  corTime: string,
  depTime: string,
  pouTime: string,
  lastCelula: number = 0,
  fuelConsumptionRate: number | null = null
): FlightTimeCalculationResult | null {
  return useMemo(() => {
    // Se não temos horários mínimos, não calcular
    if (!acTime || !corTime) {
      return null;
    }

    try {
      // Calcular tempo de bloco
      const blockTime = calculateBlockTime(acTime, corTime);

      // Calcular tempo de voo
      const flightTime = depTime && pouTime
        ? calculateFlightTime(depTime, pouTime)
        : 0;

      // Calcular tempos dia/noite
      const { day_time: dayTime, night_time: nightTime } = calculateDayNightTimes({
        dep_time: depTime,
        pou_time: pouTime,
        total_time: blockTime,
      });

      // Calcular consumo de combustível se disponível
      const fuelConsumption = fuelConsumptionRate
        ? calculateFuelConsumption(blockTime, fuelConsumptionRate)
        : null;

      // Calcular célula
      const celula = lastCelula + blockTime;

      return {
        blockTime,
        flightTime,
        dayTime,
        nightTime,
        fuelConsumption,
        celula,
      };
    } catch (error) {
      console.error('Erro ao calcular tempos de voo:', error);
      return null;
    }
  }, [acTime, corTime, depTime, pouTime, lastCelula, fuelConsumptionRate]);
}

/**
 * Hook para calcular apenas o tempo de bloco
 */
export function useBlockTime(acTime: string, corTime: string): number | null {
  return useMemo(() => {
    if (!acTime || !corTime) return null;
    try {
      return calculateBlockTime(acTime, corTime);
    } catch {
      return null;
    }
  }, [acTime, corTime]);
}

/**
 * Hook para calcular apenas o tempo de voo
 */
export function useFlightTime(depTime: string, pouTime: string): number | null {
  return useMemo(() => {
    if (!depTime || !pouTime) return null;
    try {
      return calculateFlightTime(depTime, pouTime);
    } catch {
      return null;
    }
  }, [depTime, pouTime]);
}

/**
 * Hook para calcular tempos dia/noite
 */
export function useDayNightTimes(
  depTime: string,
  pouTime: string,
  blockTime: number = 0
) {
  return useMemo(() => {
    if (!depTime || !pouTime) {
      return { dayTime: 0, nightTime: 0 };
    }
    try {
      return calculateDayNightTimes({
        dep_time: depTime,
        pou_time: pouTime,
        total_time: blockTime,
      });
    } catch {
      return { dayTime: 0, nightTime: 0 };
    }
  }, [depTime, pouTime, blockTime]);
}
