import type { SpecialFlightType } from './types';

export const SPECIAL_FLIGHT_TYPES: readonly SpecialFlightType[] = [
  { value: 'voo_check', label: 'Voo de Check', description: 'Voo de verificação - rateio igual' },
  { value: 'translado', label: 'Translado', description: 'Voo de ferry/posicionamento - rateio igual' },
  { value: 'voo_teste', label: 'Voo de Teste', description: 'Voo de manutenção/teste - rateio igual' },
] as const;

export const TIME_REGEX = /^\d{2}:\d{2}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const TIME_FIELDS = [
  { id: 'ac_time', label: 'AC', field: 'ac_time' as const },
  { id: 'dep_time', label: 'DEP', field: 'departure_time' as const },
  { id: 'pou_time', label: 'POU', field: 'pou_time' as const },
  { id: 'cor_time', label: 'COR', field: 'cor_time' as const },
] as const;
