/**
 * Type definitions for Diario de Bordo module
 */

export interface FlightEntry {
  id?: string;
  entry_date: string;
  pic_canac: string;
  sic_canac: string;
  sic_name?: string;
  crew_checkin_time: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  client_id?: string | null;
  client_partner_id?: string | null;
  loan_recipient_client_id?: string | null;
  loan_recipient_partner_id?: string | null;
  is_equal_split?: boolean;
  is_loan?: boolean;
  ac_time: string;
  dep_time: string;
  pou_time: string;
  cor_time: string;
  total_time: number;
  day_time: number;
  night_hours: number;
  time: number;
  ifr_time: number;
  pousos: number;
  fuel_added: number;
  fuel_liters: number;
  fuel_type: string;
  fuel_location: string;
  fuel_price_per_liter: number;
  refueled: boolean;
  celula: number;
  distance_nm: number;
  passengers: number;
  cargo_kg: number;
  flight_nature: string;
  occurrences: string;
  discrepancies: string;
  corrective_actions: string;
  daily_quantity: number;
}

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status: 'ativa' | 'inativa';
  cell_hours_current?: number;
  [key: string]: any;
}

export interface Crew {
  id: string;
  full_name: string;
  canac: string;
  status: string;
}

export interface Aerodrome {
  id: string;
  designativo: string;
  nome: string;
  coordenadas?: string;
}

export interface Client {
  id: string;
  razao_social: string;
  cnpj?: string;
  client_aircraft?: Array<{ aircraft_id: string; share_percentage: number }>;
}

export interface LogbookMonth {
  id: string;
  aeronave_id: string;
  mes: number;
  ano: number;
  fechado: boolean;
  aerodromo_base: string;
  tem_tarifa_diaria: boolean;
  tarifa_diaria: number;
  celula_anterior_ttotal: number;
  celula_atual_ttotal: number;
  celula_prox_revisao_ttotal: number;
  celula_disponivel_ttotal: number;
}

export interface Partner {
  id: string;
  name: string;
  aircraft_id?: string;
  client_id?: string;
}

export interface PerDiemDetail {
  date: string;
  location: string;
  entryId: string;
}

export interface PerDiemInfo {
  count: number;
  total: number;
  details: PerDiemDetail[];
  byEntry: Record<string, number>;
}

export interface TechnicalStatus {
  last_maintenance_type: string;
  airframe_hours_next_maintenance: string;
  next_maintenance_type: string;
  maintenance_approval_responsible: string;
  crew_records: Array<{ date: string; system: string; discrepancy: string; canac: string }>;
  service_return: Array<{ date: string; corrective_action: string; responsible_canac: string; pic_canac: string }>;
}

export type FlightTypeOption = 'cliente' | 'rateio' | 'emprestimo';

export interface ValidationError {
  field: string;
  message: string;
}
