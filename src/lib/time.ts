/**
 * Utilitários para manipulação de tempos em formato decimal e HH:MM
 */

/**
 * Converte horas decimais para formato HH:MM
 * @param decimal - Horas em formato decimal (ex: 2.5 = 2:30)
 * @returns String no formato HH:MM
 */
export const decimalToHHMM = (decimal?: number | null): string => {
  if (!decimal && decimal !== 0) return '—';
  const hours = Math.floor(Math.abs(decimal));
  const minutes = Math.round((Math.abs(decimal) - hours) * 60);
  const sign = decimal < 0 ? '-' : '';
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Converte formato HH:MM para minutos
 * @param timeString - String no formato HH:MM
 * @returns Minutos totais
 */
export const hhmmToMinutes = (timeString?: string): number | null => {
  if (!timeString) return null;
  const parts = timeString.split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

/**
 * Converte minutos para formato HH:MM
 * @param minutes - Número de minutos
 * @returns String no formato HH:MM
 */
export const minutesToHHMM = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Calcula a diferença de horas entre dois horários HH:MM em formato decimal
 * @param inicio - Horário de início no formato HH:MM
 * @param fim - Horário de fim no formato HH:MM
 * @returns Diferença em horas (decimal)
 */
export const diffDecimalHours = (inicio?: string, fim?: string): number => {
  if (!inicio || !fim) return 0;
  
  const inicioMinutos = hhmmToMinutes(inicio) ?? 0;
  const fimMinutos = hhmmToMinutes(fim) ?? 0;
  
  let diff = fimMinutos - inicioMinutos;
  
  // Se o resultado for negativo, assume que é para o dia seguinte
  if (diff < 0) {
    diff += 24 * 60;
  }
  
  return Number((diff / 60).toFixed(2));
};

/**
 * Subtrai minutos de um horário HH:MM
 * @param time - Horário no formato HH:MM
 * @param minutes - Minutos a subtrair
 * @returns String no formato HH:MM
 */
export const subtractMinutesHHMM = (time?: string, minutes: number = 0): string | null => {
  if (!time) return null;
  
  const totalMinutes = hhmmToMinutes(time) ?? 0;
  const result = totalMinutes - minutes;
  
  if (result < 0) return null;
  
  return minutesToHHMM(result);
};

/**
 * Converte tempo PostgreSQL (HH:MM:SS ou string) para formato HH:MM
 * @param pgTime - Tempo em formato PostgreSQL
 * @returns String no formato HH:MM
 */
export const pgTimeToHHMM = (pgTime?: string | null): string => {
  if (!pgTime) return '—';
  
  const parts = pgTime.split(':');
  if (parts.length < 2) return '—';
  
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

/**
 * Soma múltiplos valores decimais de horas
 * @param values - Array de valores em decimal
 * @returns Soma total em decimal
 */
export const sumDecimal = (values: (number | string | null | undefined)[]): number => {
  return values.reduce((sum, val) => {
    const num = typeof val === 'string' ? parseFloat(val) : Number(val ?? 0);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
};
