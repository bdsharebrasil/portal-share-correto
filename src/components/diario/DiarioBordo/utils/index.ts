/**
 * Central exports for Diario de Bordo utilities
 */

// Time calculations
export {
  timeStringToMinutes,
  minutesToTimeString,
  calculateTimeDiff,
  decimalToTimeString,
  timeStringToDecimal,
  decimalToHHMM,
  decimalToHoursOnly,
  calculateCrewCheckinTime
} from './timeCalculations';

// Celula calculations
export {
  calculateCelulaAtual,
  calculateCelulaDisponivel,
  calculateRunningCelula,
  isCelulaWarning,
  isCelulaAlert
} from './celulaCalculations';

// Date helpers
export {
  isValidDate,
  formatDateFromISO,
  formatTimeFromTimestamp,
  getMonthName,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  formatDateForInput,
  getPreviousMonth,
  getNextMonth
} from './dateHelpers';

// Flight validation
export {
  validateFlightEntry,
  formatValidationErrors,
  hasValidationErrors,
  type ValidationError
} from './flightValidation';
