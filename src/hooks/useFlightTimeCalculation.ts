import { useMemo } from 'react';
import {
  calculateBlockTime,
  calculateFlightTime,
  calculateDayTime,
  calculateFuelConsumption,
} from '@/utils/calculationUtils';
import {
  calculateBlockTime as calculateBlockTimeCore,
  calculateFlightTime as calculateFlightTimeCore,
  calculateDayTime as calculateDayTimeCore,
  validateTimes,
} from '@/utils/flightTime';

export interface FlightTimeCalculationResult {
  blockTime: number;
  flightTime: number;
  dayTime: number;
  nightTime: number;
  fuelConsumption: number | null;
  celula: number;
  isValid: boolean;
}

/**
 * Hook customizado para calcular tempos de voo automaticamente
 *
 * REGRAS IMPLEMENTADAS:
 * - blockTime  = AC → COR  (tempo de bloco — salvo em total_time)
 * - flightTime = DEP → POU (tempo de voo  — salvo em "time")
 * - célula     = lastCelula + flightTime  ← CORRETO (DEP→POU)
 * - VALIDAÇÃO: blockTime >= flightTime
 * - dayTime = flightTime - nightTime (GARANTIDO)
 */
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
    if (!acTime || !corTime) {
      return null;
    }

    try {
      // Tempo de bloco: AC → COR (salvo em total_time)
      const blockTime = calculateBlockTimeCore(acTime, corTime);

      // Tempo de voo: DEP → POU (salvo em "time")
      const flightTime = depTime && pouTime
        ? calculateFlightTimeCore(depTime, pouTime)
        : 0;

      // Validação: blockTime deve ser >= flightTime
      const isValid = validateTimes(blockTime, flightTime);
      if (!isValid) {
        console.warn(
          `⚠️ Validação falhou: blockTime (${blockTime}) < flightTime (${flightTime})`
        );
      }

      // Tempo noturno nunca pode exceder o tempo de voo
      const nightTime = Math.min(nightTimeInput, flightTime);

      // Tempo diurno: day_time + night_hours = flight_time
      const dayTime = calculateDayTimeCore(flightTime, nightTime);

      // Consumo de combustível baseado no tempo de bloco
      const fuelConsumption = fuelConsumptionRate
        ? calculateFuelConsumption(blockTime, fuelConsumptionRate)
        : null;

      // ✅ CORRETO: célula usa flightTime (DEP→POU), não blockTime
      const celula = lastCelula + flightTime;

      return {
        blockTime,
        flightTime,
        dayTime,
        nightTime,
        fuelConsumption,
        celula,
        isValid,
      };
    } catch (error) {
      console.error('Erro ao calcular tempos de voo:', error);
      return null;
    }
  }, [acTime, corTime, depTime, pouTime, lastCelula, fuelConsumptionRate, nightTimeInput]);
}

/**
 * Hook para calcular apenas o tempo de bloco (AC → COR)
 */
export function useBlockTime(acTime: string, corTime: string): number | null {
  return useMemo(() => {
    if (!acTime || !corTime) return null;
    try {
      return calculateBlockTimeCore(acTime, corTime);
    } catch {
      return null;
    }
  }, [acTime, corTime]);
}

/**
 * Hook para calcular apenas o tempo de voo (DEP → POU)
 * Este é o valor usado para célula da aeronave
 */
export function useFlightTime(depTime: string, pouTime: string): number | null {
  return useMemo(() => {
    if (!depTime || !pouTime) return null;
    try {
      return calculateFlightTimeCore(depTime, pouTime);
    } catch {
      return null;
    }
  }, [depTime, pouTime]);
}

/**
 * Hook para calcular tempo diurno
 * GARANTE: day_time + night_hours = flight_time
 */
export function useDayTime(
  flightTime: number = 0,
  nightTime: number = 0
) {
  return useMemo(() => {
    if (flightTime <= 0) return 0;
    try {
      return calculateDayTimeCore(flightTime, nightTime);
    } catch {
      return 0;
    }
  }, [flightTime, nightTime]);
}