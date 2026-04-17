/**
 * Flight entry validation utilities
 */

export interface ValidationError {
  field: string;
  message: string;
}

export const validateFlightEntry = (entry: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate basic fields
  if (!entry.entry_date) {
    errors.push({ field: 'entry_date', message: 'Data do voo é obrigatória' });
  }

  if (!entry.departure_aerodrome) {
    errors.push({ field: 'departure_aerodrome', message: 'Aeródromo de partida é obrigatório' });
  }

  if (!entry.arrival_aerodrome) {
    errors.push({ field: 'arrival_aerodrome', message: 'Aeródromo de chegada é obrigatório' });
  }

  if (!entry.pic_canac) {
    errors.push({ field: 'pic_canac', message: 'Piloto em comando (PIC) é obrigatório' });
  }

  if (!entry.ac_time) {
    errors.push({ field: 'ac_time', message: 'Hora de apresentação é obrigatória' });
  }

  if (!entry.cor_time) {
    errors.push({ field: 'cor_time', message: 'Hora de conclusão (Corte) é obrigatória' });
  }

  // Validate times are in format HH:MM
  const timeRegex = /^\d{2}:\d{2}$/;
  if (entry.ac_time && !timeRegex.test(entry.ac_time)) {
    errors.push({ field: 'ac_time', message: 'Formato de hora inválido (use HH:MM)' });
  }

  if (entry.cor_time && !timeRegex.test(entry.cor_time)) {
    errors.push({ field: 'cor_time', message: 'Formato de hora inválido (use HH:MM)' });
  }

  if (entry.dep_time && !timeRegex.test(entry.dep_time)) {
    errors.push({ field: 'dep_time', message: 'Formato de hora inválido (use HH:MM)' });
  }

  if (entry.pou_time && !timeRegex.test(entry.pou_time)) {
    errors.push({ field: 'pou_time', message: 'Formato de hora inválido (use HH:MM)' });
  }

  // Validate client
  if (!entry.client_id && entry.flight_type === 'cliente') {
    errors.push({ field: 'client_id', message: 'Cliente é obrigatório para voos de cliente' });
  }

  // Validate flight nature
  if (!entry.flight_nature) {
    errors.push({ field: 'flight_nature', message: 'Natureza do voo é obrigatória' });
  }

  return errors;
};

export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';
  return errors.map((e) => `${e.field}: ${e.message}`).join('\n');
};

export const hasValidationErrors = (entry: any): boolean => {
  return validateFlightEntry(entry).length > 0;
};
