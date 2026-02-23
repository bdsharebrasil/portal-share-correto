// utils/timeFormatting.ts

/**
 * Converte horas decimais para formato HH:MM
 * Suporta valores negativos
 */
export function decimalToHM(decimal?: number | null): string {
  if (decimal === null || decimal === undefined || isNaN(decimal)) {
    return '--:--';
  }

  // Determinar se é negativo
  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);

  // Calcular horas e minutos do valor absoluto
  const totalMinutes = Math.round(absDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  // Aplicar sinal se necessário
  const sign = isNegative ? '-' : '';
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Converte horas decimais para formato legível (ex: "2h 30m")
 */
export function decimalToReadable(decimal?: number | null): string {
  if (decimal === null || decimal === undefined || isNaN(decimal)) {
    return '--';
  }

  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);
  
  const h = Math.floor(absDecimal);
  const m = Math.round((absDecimal - h) * 60);
  
  const sign = isNegative ? '-' : '';
  
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}