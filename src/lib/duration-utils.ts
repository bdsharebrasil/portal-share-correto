/**
 * Convert decimal hours to HH:MM format
 * @param hours - Decimal hours (e.g., 2.5 = 2 hours 30 minutes)
 * @returns Formatted string in HH:MM format
 */
export const formatFlightDuration = (hours: number | null | undefined): string => {
  if (!hours && hours !== 0) return '';
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  return `${String(wholeHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Convert HH:MM format to decimal hours
 * @param timeString - String in HH:MM format
 * @returns Decimal hours
 */
export const parseFlightDuration = (timeString: string): number | null => {
  if (!timeString) return null;
  
  const parts = timeString.split(':');
  if (parts.length !== 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  return hours + (minutes / 60);
};
