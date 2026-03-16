// utils/calculations.ts

/**
 * Arquivo de cálculos refatorado para usar funções centralizadas.
 * Importa funções principais de src/utils/flightTime.ts
 */

import {
  timeStringToMinutes,
  minutesToDecimalHours,
  decimalHoursToHHMM,
  calculateTimeDifferenceMinutes,
  calculateBlockTime as calculateBlockTimeCore,
  calculateFlightTime as calculateFlightTimeCore,
  calculateDayTime as calculateDayTimeCore,
  validateTimes,
  calculateRunningCelula,
  calculateCelulaAtual,
  calculateCelulaDisponivel,
} from '../../../utils/flightTime';

/**
 * Converte tempo em formato HH:MM para minutos
 * Função mantida por compatibilidade com código existente
 */
export function timeToMinutes(time: string): number {
  return timeStringToMinutes(time);
}

/**
 * Converte minutos para formato HH:MM
 * Função mantida por compatibilidade com código existente
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Converte horas decimais para formato HH:MM
 * Função mantida por compatibilidade com código existente
 */
export function decimalToTime(hours: number): string {
  return decimalHoursToHHMM(hours);
}

/**
 * Calcula tempo de bloco (AC até COR)
 * Usa função centralizada de cálculo
 */
export function calculateBlockTime(acTime: string, corTime: string): number {
  return calculateBlockTimeCore(acTime, corTime);
}

/**
 * Calcula tempo de voo (DEP até POU)
 * Usa função centralizada de cálculo
 */
export function calculateFlightTime(depTime: string, pouTime: string): number {
  return calculateFlightTimeCore(depTime, pouTime);
}

/**
 * Calcula tempo diurno (voo - noturno)
 * Garante: day_time + night_hours = flight_time
 */
export function calculateDayTime(flightTime: number, nightTime: number): number {
  return calculateDayTimeCore(flightTime, nightTime);
}

/**
 * Formata horas para exibição (1.5 -> "1:30")
 */
export function formatHours(hours: number): string {
  return decimalHoursToHHMM(hours);
}

// Re-exportar funções centralizadas para uso direto
export {
  timeStringToMinutes,
  minutesToDecimalHours,
  decimalHoursToHHMM,
  calculateTimeDifferenceMinutes,
  validateTimes,
  calculateRunningCelula,
  calculateCelulaAtual,
  calculateCelulaDisponivel,
};
