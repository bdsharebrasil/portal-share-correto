/**
 * Central exports for Diario de Bordo module
 * This file provides a single point of import for all diario functionality
 */

// Hooks
export {
  useDiarioData,
  useFlightCalculations,
  usePerDiem,
  useCelulaManagement
} from './hooks';

// Utilities
export {
  // Time calculations
  timeStringToMinutes,
  minutesToTimeString,
  calculateTimeDiff,
  decimalToTimeString,
  timeStringToDecimal,
  decimalToHHMM,
  decimalToHoursOnly,
  calculateCrewCheckinTime,
  
  // Celula calculations
  calculateCelulaAtual,
  calculateCelulaDisponivel,
  calculateRunningCelula,
  isCelulaWarning,
  isCelulaAlert,
  
  // Date helpers
  isValidDate,
  formatDateFromISO,
  formatTimeFromTimestamp,
  getMonthName,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  formatDateForInput,
  getPreviousMonth,
  getNextMonth,
  
  // Flight validation
  validateFlightEntry,
  formatValidationErrors,
  hasValidationErrors
} from './utils';

// Types
export type {
  FlightEntry,
  Aircraft,
  Crew,
  Aerodrome,
  Client,
  LogbookMonth,
  Partner,
  PerDiemDetail,
  PerDiemInfo,
  TechnicalStatus,
  FlightTypeOption,
  ValidationError
} from './types';

// Dialogs
export {
  CreateMonthDialog,
  CloseMonthDialog,
  ExportLogbookDialog,
  MaintenanceStatusAlert
} from './dialogs';
