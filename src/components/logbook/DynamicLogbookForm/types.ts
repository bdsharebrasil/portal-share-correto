export type FlightCategory = 'cliente' | 'rateio' | 'emprestimo';

export interface FlightFormData {
  entry_date: string;
  departure_airport: string;
  arrival_airport: string;
  ac_time: string;
  departure_time: string;
  pou_time: string;
  cor_time: string;
  crew_checkin_time: string;
  flight_time_hours: string;
  flight_time_minutes: string;
  night_time_hours: string;
  night_time_minutes: string;
  ifr_count: string;
  landings: string;
  fuel_added: string;
  fuel_cell: string;
  distance_nm: string;
  daily_rate: string;
  extras: string;
  remarks: string;
  pic_canac: string;
  sic_canac: string;
  sic_name: string;
  client_id: string;
  client_partner_id: string | null;
  loan_recipient_client_id: string | null;
  loan_recipient_partner_id: string | null;
  is_equal_split: boolean;
  is_loan: boolean;
  flight_nature: string;
  passengers: number;
  cargo_kg: number;
  fuel_type: string;
  fuel_location: string;
  fuel_price_per_liter: number;
  refueled: boolean;
}

export interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
  status: string;
}

export interface Partner {
  id: string;
  name: string;
  cpf?: string;
  share_percentage?: number;
  client_id?: string;
}

export interface ClientData {
  client_id: string;
  share_percentage: number;
  clients: {
    id: string;
    company_name: string;
    proprietario?: string;
  };
}

export interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas?: string;
}

export interface LogbookMonth {
  id: string;
  base_aerodrome: string | null;
  daily_rate: number | null;
  has_daily_rate: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface DynamicLogbookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
  inline?: boolean;
}
