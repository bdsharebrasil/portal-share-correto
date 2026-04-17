/**
 * Time utility functions for flight operations
 */

export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

export const minutesToTimeString = (minutes: number): string => {
  if (minutes < 0) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const calculateTimeDiff = (startTime: string, endTime: string): number => {
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  
  if (endMin >= startMin) {
    return endMin - startMin;
  } else {
    // Cross midnight
    return (1440 - startMin) + endMin;
  }
};

export const decimalToTimeString = (decimal: number): string => {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const timeStringToDecimal = (timeStr: string): number => {
  const minutes = timeStringToMinutes(timeStr);
  return parseFloat((minutes / 60).toFixed(2));
};

export const decimalToHHMM = (decimal: number): string => {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}h ${minutes}min`;
};

export const decimalToHoursOnly = (decimal: number): string => {
  return decimal.toFixed(1);
};

export const calculateCrewCheckinTime = (acTime: string): string => {
  if (!acTime || !acTime.trim()) return '';
  try {
    const acMin = timeStringToMinutes(acTime);
    const checkinMin = acMin - 30;
    const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;
    return minutesToTimeString(finalMin);
  } catch (e) {
    return '';
  }
};
