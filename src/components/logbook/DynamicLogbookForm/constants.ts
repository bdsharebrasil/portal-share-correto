export const SPECIAL_FLIGHT_TYPES = [
  {
    value: 'voo_check',
    label: 'Voo de Check',
    description: 'Voo de verificação - rateio igual'
  },
  {
    value: 'translado',
    label: 'Translado',
    description: 'Voo de ferry/posicionamento - rateio igual'
  },
  {
    value: 'voo_teste',
    label: 'Voo de Teste',
    description: 'Voo de manutenção/teste - rateio igual'
  },
] as const;

export const TIME_REGEX = /^\d{2}:\d{2}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const FLIGHT_NATURE_MAP = {
  cliente: 'PV - Privado',
  emprestimo: 'PV - Privado',
  voo_check: 'CQ - Cheque',
  translado: 'TR - Traslado',
  voo_teste: 'TN - Teste',
} as const;

export const DEFAULT_FLIGHT_FORM_DATA = {
  entry_date: '',
  departure_airport: '',
  arrival_airport: '',
  ac_time: '',
  departure_time: '',
  pou_time: '',
  cor_time: '',
  crew_checkin_time: '',
  flight_time_hours: '',
  flight_time_minutes: '',
  night_time_hours: '',
  night_time_minutes: '',
  ifr_count: '',
  landings: '1',
  fuel_added: '',
  fuel_cell: '',
  distance_nm: '',
  daily_rate: '',
  extras: '',
  remarks: '',
  pic_canac: '',
  sic_canac: '',
  sic_name: '',
  client_id: '',
  client_partner_id: null,
  loan_recipient_client_id: null,
  loan_recipient_partner_id: null,
  is_equal_split: false,
  is_loan: false,
  flight_nature: 'PV - Privado',
  passengers: 0,
  cargo_kg: 0,
  fuel_type: '',
  fuel_location: '',
  fuel_price_per_liter: 0,
  refueled: false,
};
