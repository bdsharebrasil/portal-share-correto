import { isValidTimeFormat } from '@/utils/timeUtils';

export type FlightType = 'cliente' | 'rateio' | 'emprestimo';

export interface FlightEntry {
  id?: string;
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  crew_checkin_time?: string;
  ac_time: string;
  dep_time: string;
  pou_time: string;
  cor_time: string;
  time?: number;
  day_time?: number;
  night_time?: number;
  total_time?: number;
  ifr_time?: number;
  distance_nm?: number;
  pousos?: number;
  fuel_added?: number;
  fuel_liters?: number;
  celula?: number;
  pic_canac: string;
  sic_canac?: string;
  extras?: string;
  voo_para?: string;
  confirmed?: boolean;
  client_id?: string;
  is_equal_split?: boolean;
  is_loan?: boolean;
  loan_recipient_client_id?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Valida uma entrada de voo completa
 */
export function validateFlightEntry(
  entry: FlightEntry,
  flightType: FlightType
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validações básicas
  validateBasicFields(entry, errors);

  // Validações de hora
  validateTimeFields(entry, errors);

  // Validações específicas por tipo de voo
  if (flightType === 'cliente') {
    validateClientFlight(entry, errors);
  } else if (flightType === 'rateio') {
    validateSplitFlight(entry, errors);
  } else if (flightType === 'emprestimo') {
    validateLoanFlight(entry, errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida campos básicos obrigatórios
 */
function validateBasicFields(entry: FlightEntry, errors: ValidationError[]) {
  if (!entry.entry_date) {
    errors.push({
      field: 'entry_date',
      message: 'Data do voo é obrigatória',
    });
  }

  if (!entry.pic_canac) {
    errors.push({
      field: 'pic_canac',
      message: 'Selecione o PIC (Piloto em Comando)',
    });
  }

  if (!entry.departure_aerodrome) {
    errors.push({
      field: 'departure_aerodrome',
      message: 'Selecione o aeródromo de origem',
    });
  }

  if (!entry.arrival_aerodrome) {
    errors.push({
      field: 'arrival_aerodrome',
      message: 'Selecione o aeródromo de destino',
    });
  }

  if (!entry.pousos || entry.pousos < 1) {
    errors.push({
      field: 'pousos',
      message: 'Número de pousos deve ser pelo menos 1',
    });
  }
}

/**
 * Valida horários
 */
function validateTimeFields(entry: FlightEntry, errors: ValidationError[]) {
  const timeFields = [
    { field: 'ac_time', label: 'AC' },
    { field: 'dep_time', label: 'DEP' },
    { field: 'pou_time', label: 'POU' },
    { field: 'cor_time', label: 'COR' },
  ];

  for (const { field, label } of timeFields) {
    const value = entry[field as keyof FlightEntry];
    if (!value) {
      errors.push({
        field,
        message: `Horário ${label} é obrigatório`,
      });
    } else if (!isValidTimeFormat(value as string)) {
      errors.push({
        field,
        message: `Horário ${label} inválido (use HH:MM)`,
      });
    }
  }
}

/**
 * Validações específicas para voos de cliente
 */
function validateClientFlight(entry: FlightEntry, errors: ValidationError[]) {
  if (!entry.cliente_id) {
    errors.push({
      field: 'client_id',
      message: 'Selecione um cliente',
    });
  }
}

/**
 * Validações específicas para voos de rateio
 */
function validateSplitFlight(entry: FlightEntry, errors: ValidationError[]) {
  if (!entry.is_equal_split) {
    errors.push({
      field: 'is_equal_split',
      message: 'Voo de rateio deve estar marcado como divisão igual',
    });
  }
}

/**
 * Validações específicas para empréstimo
 */
function validateLoanFlight(entry: FlightEntry, errors: ValidationError[]) {
  if (!entry.is_loan) {
    errors.push({
      field: 'is_loan',
      message: 'Voo de empréstimo deve estar marcado',
    });
  }

  if (!entry.cliente_id) {
    errors.push({
      field: 'client_id',
      message: 'Selecione quem está emprestando a aeronave',
    });
  }

  if (!entry.loan_recipient_client_id) {
    errors.push({
      field: 'loan_recipient_client_id',
      message: 'Selecione quem está usando a aeronave emprestada',
    });
  }
}

/**
 * Valida apenas os campos de tempo (para validação parcial)
 */
export function validateTimeFieldsOnly(entry: FlightEntry): ValidationResult {
  const errors: ValidationError[] = [];
  validateTimeFields(entry, errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Valida se há tempo de voo suficiente
 */
export function validateFlightTime(
  depTime: string,
  pouTime: string,
  minHours: number = 0.1
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!depTime || !pouTime) {
    errors.push({
      field: 'flight_time',
      message: 'DEP e POU são obrigatórios para calcular tempo de voo',
    });
    return { isValid: false, errors };
  }

  const [h1, m1] = depTime.split(':').map(Number);
  const [h2, m2] = pouTime.split(':').map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;

  const flightTimeHours = diff / 60;

  if (flightTimeHours < minHours) {
    errors.push({
      field: 'flight_time',
      message: `Tempo de voo deve ser pelo menos ${minHours} horas`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Formata erros de validação para exibição
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => `• ${e.message}`).join('\n');
}
