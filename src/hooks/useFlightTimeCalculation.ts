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
 * Usa useMemo para evitar recálculos desnecessários
 *
 * REGRAS IMPLEMENTADAS:
 * - blockTime = AC → COR (tempo total)
 * - flightTime = DEP → POU (tempo efetivo de voo)
 * - VALIDAÇÃO: blockTime >= flightTime
 * - dayTime = flightTime - nightTime (GARANTIDO)
 * - Se nightTime > flightTime, ajusta dayTime para 0
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
    // Se não temos horários mínimos, não calcular
    if (!acTime || !corTime) {
      return null;
    }

    try {
      // Calcular tempo de bloco (AC → COR)
      // Este é o tempo total de operação da aeronave
      const blockTime = calculateBlockTimeCore(acTime, corTime);

      // Calcular tempo de voo (DEP → POU)
      // Este é o tempo efetivamente voando
      const flightTime = depTime && pouTime
        ? calculateFlightTimeCore(depTime, pouTime)
        : 0;

      // VALIDAÇÃO OBRIGATÓRIA: blockTime >= flightTime
      const isValid = validateTimes(blockTime, flightTime);
      if (!isValid) {
        console.warn(`⚠️ Validação falhou: blockTime (${blockTime}) < flightTime (${flightTime})`);
      }

      // Calcular tempo noturno (será passado como parâmetro)
      // O tempo noturno deve ser recebido do cálculo solar ou da entrada do usuário
      const nightTime = Math.min(nightTimeInput, flightTime); // Nunca pode exceder flight time

      // Calcular tempo diurno de forma CONSISTENTE
      // REGRA: day_time + night_hours = flight_time
      const dayTime = calculateDayTimeCore(flightTime, nightTime);

      // Calcular consumo de combustível se disponível
      const fuelConsumption = fuelConsumptionRate
        ? calculateFuelConsumption(blockTime, fuelConsumptionRate)
        : null;

      // Calcular célula da aeronave
      // Célula = célula_anterior + blockTime
      const celula = lastCelula + blockTime;

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
