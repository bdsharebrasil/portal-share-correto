/**
 * Funções utilitárias centralizadas para cálculos de tempo de voo.
 * Segue as regras operacionais padrão de diário de bordo aeronáutico.
 */

/**
 * Converte HH:MM para minutos totais.
 * Exemplo: "09:43" → 583
 */
export function timeStringToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converte minutos para horas decimais.
 * Exemplo: 150 → 2.50
 */
export function minutesToDecimalHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Converte horas decimais para formato HH:MM.
 * Exemplo: 2.70 → "02:42"
 */
export function decimalHoursToHHMM(hours: number): string {
  if (!hours || hours === 0) return '00:00';
  const isNeg = hours < 0;
  const abs = Math.abs(hours);
  const totalMin = Math.round(abs * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const sign = isNeg ? '-' : '';
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calcula a diferença em minutos entre dois horários HH:MM.
 * Se end < start, assume virada de dia (+1440 min).
 */
export function calculateTimeDifferenceMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const startMin = timeStringToMinutes(start);
  const endMin = timeStringToMinutes(end);
  let diff = endMin - startMin;
  if (diff < 0) diff += 1440;
  return diff;
}

/**
 * Calcula o Block Time (Tempo Total) = COR - AC
 * Retorna horas decimais com precisão total (sem arredondamento).
 */
export function calculateBlockTime(acTime: string, corTime: string): number {
  const minutes = calculateTimeDifferenceMinutes(acTime, corTime);
  return minutesToDecimalHours(minutes);
}

/**
 * Calcula o Flight Time (Tempo de Voo) = POU - DEP
 * Retorna horas decimais com precisão total.
 */
export function calculateFlightTime(depTime: string, pouTime: string): number {
  const minutes = calculateTimeDifferenceMinutes(depTime, pouTime);
  return minutesToDecimalHours(minutes);
}

/**
 * Calcula tempo diurno garantindo consistência:
 * day_time = flight_time - night_hours
 * Se negativo, retorna 0.
 */
export function calculateDayTime(flightTime: number, nightHours: number): number {
  return Math.max(0, flightTime - nightHours);
}

/**
 * Valida que total_time >= flight_time
 */
export function validateTimes(totalTime: number, flightTime: number): boolean {
  return totalTime >= flightTime;
}

/**
 * Calcula a célula acumulada progressiva para cada linha do diário.
 * 
 * @param entries - Entradas ordenadas por sequential_number
 * @param celulaAnterior - Célula anterior do mês (do logbook_months)
 * @returns Map de entry.id → célula acumulada
 */
export function calculateRunningCelula(
  entries: Array<{ id: string; total_time: number; sequential_number?: number }>,
  celulaAnterior: number
): Map<string, number> {
  const result = new Map<string, number>();
  
  // Ordenar por sequential_number
  const sorted = [...entries].sort((a, b) => 
    (a.sequential_number || 0) - (b.sequential_number || 0)
  );
  
  let acumulado = celulaAnterior;
  
  for (const entry of sorted) {
    acumulado += (entry.total_time || 0);
    result.set(entry.id, acumulado);
  }
  
  return result;
}

/**
 * Calcula celula_atual do mês.
 * celula_atual = celula_anterior + soma(total_time)
 */
export function calculateCelulaAtual(
  entries: Array<{ total_time: number }>,
  celulaAnterior: number
): number {
  const totalHours = entries.reduce((sum, e) => sum + (e.total_time || 0), 0);
  return celulaAnterior + totalHours;
}

/**
 * Calcula celula_disponivel.
 * celula_disponivel = celula_prox_revisao - celula_atual
 */
export function calculateCelulaDisponivel(
  celulaProxRevisao: number,
  celulaAtual: number
): number {
  return celulaProxRevisao - celulaAtual;
}
