import { useMemo } from 'react';
import {
  calculateBlockTime,
  calculateFlightTime,
  calculateDayTime,
  validateTimes,
} from '@/utils/flightTime';
import { calculateFuelConsumption } from '@/utils/calculationUtils';

export interface FlightTimeCalculationResult {
  blockTime: number;
  flightTime: number;
  dayTime: number;
  nightTime: number;
  fuelConsumption: number | null;
  celula: number;
  isValid: boolean;
}

export function useFlightTimeCalculation(
  acTime: string,
  corTime: string,
  depTime: string,
  pouTime: string,
  lastCelula: number = 0,
  fuelConsumptionRate: number | null = null,
  nightTimeInput: number = 0
): FlightTimeCalculationResult | null {
  return useMemo(() => {
    if (!acTime || !corTime) return null;

    try {
      const blockTime = calculateBlockTime(acTime, corTime);
      const flightTime = depTime && pouTime
        ? calculateFlightTime(depTime, pouTime)
        : 0;

      const isValid = validateTimes(blockTime, flightTime);
      if (!isValid) {
        console.warn(`⚠️ blockTime (${blockTime}) < flightTime (${flightTime})`);
      }

      const nightTime = Math.min(nightTimeInput, flightTime);
      const dayTime = calculateDayTime(flightTime, nightTime);
      const fuelConsumption = fuelConsumptionRate
        ? calculateFuelConsumption(blockTime, fuelConsumptionRate)
        : null;

      // célula = DEP→POU
      const celula = parseFloat((lastCelula + flightTime).toFixed(2));

      return { blockTime, flightTime, dayTime, nightTime, fuelConsumption, celula, isValid };
    } catch (error) {
      console.error('Erro ao calcular tempos de voo:', error);
      return null;
    }
  }, [acTime, corTime, depTime, pouTime, lastCelula, fuelConsumptionRate, nightTimeInput]);
}

export function useBlockTime(acTime: string, corTime: string): number | null {
  return useMemo(() => {
    if (!acTime || !corTime) return null;
    try { return calculateBlockTime(acTime, corTime); }
    catch { return null; }
  }, [acTime, corTime]);
}

export function useFlightTime(depTime: string, pouTime: string): number | null {
  return useMemo(() => {
    if (!depTime || !pouTime) return null;
    try { return calculateFlightTime(depTime, pouTime); }
    catch { return null; }
  }, [depTime, pouTime]);
}

export function useDayTime(flightTime: number = 0, nightTime: number = 0) {
  return useMemo(() => {
    if (flightTime <= 0) return 0;
    try { return calculateDayTime(flightTime, nightTime); }
    catch { return 0; }
  }, [flightTime, nightTime]);
}