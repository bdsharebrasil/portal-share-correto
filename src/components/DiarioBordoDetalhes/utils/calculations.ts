// utils/calculations.ts

/**
 * Converte tempo em formato HH:MM para minutos
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converte minutos para formato HH:MM
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Converte horas decimais para formato HH:MM
 */
export function decimalToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calcula tempo de bloco (AC até COR)
 */
export function calculateBlockTime(acTime: string, corTime: string): number {
  const acMinutes = timeToMinutes(acTime);
  const corMinutes = timeToMinutes(corTime);
  
  let blockMinutes = corMinutes - acMinutes;
  
  // Se negativo, passou da meia-noite
  if (blockMinutes < 0) {
    blockMinutes += 24 * 60;
  }
  
  return blockMinutes / 60; // Retorna em horas decimais
}

/**
 * Calcula tempo de voo (DEP até POU)
 */
export function calculateFlightTime(depTime: string, pouTime: string): number {
  const depMinutes = timeToMinutes(depTime);
  const pouMinutes = timeToMinutes(pouTime);
  
  let flightMinutes = pouMinutes - depMinutes;
  
  if (flightMinutes < 0) {
    flightMinutes += 24 * 60;
  }
  
  return flightMinutes / 60;
}

/**
 * Calcula tempo diurno (bloco - noturno)
 */
export function calculateDayTime(blockTime: number, nightTime: number): number {
  return Math.max(0, blockTime - nightTime);
}

/**
 * Formata horas para exibição (1.5 -> "1:30")
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}