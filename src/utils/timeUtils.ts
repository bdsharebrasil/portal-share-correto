/**
 * Converte uma string HH:MM para minutos totais
 */
export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Converte minutos para formato HH:MM
 */
export const minutesToTimeString = (minutes: number): string => {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Calcula a diferença entre dois horários em horas decimais
 */
export const calculateTimeDiff = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return parseFloat((diff / 60).toFixed(2));
};

/**
 * Converte tempo decimal (ex: 1.5) para HH:MM
 */
export const decimalToTimeString = (decimal: number): string => {
  if (!decimal || decimal === 0) return '00:00';
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Converte HH:MM para decimal
 */
export const timeStringToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return parseFloat(((h * 60 + m) / 60).toFixed(2));
};

/**
 * Calcula o tempo de apresentação (30 min antes do AC)
 */
export const calculateCrewCheckinTime = (acTime: string): string => {
  if (!acTime) return '';
  try {
    const [hours, minutes] = acTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes - 30;
    let checkinHours = Math.floor(totalMinutes / 60);
    let checkinMinutes = totalMinutes % 60;

    if (checkinHours < 0) {
      checkinHours += 24;
    }

    return `${String(checkinHours).padStart(2, '0')}:${String(checkinMinutes).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

/**
 * Valida se uma string está no formato HH:MM
 */
export const isValidTimeFormat = (timeStr: string): boolean => {
  const regex = /^\d{2}:\d{2}$/;
  return regex.test(timeStr);
};

/**
 * Calcula horas decimais apenas (ignora minutos)
 */
export const decimalToHoursOnly = (decimal?: number | null): string => {
  if (!decimal || decimal === 0) return '00:00';
  const hours = Math.round(decimal);
  return `${hours.toString().padStart(2, '0')}:00`;
};

/**
 * Calcula tempo em HH:MM a partir de decimal (com validação)
 */
export const decimalToHHMM = (decimal?: number | null): string => {
  if (!decimal || decimal === 0) return '-';
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};
