export type FlightCategory = 'cliente' | 'rateio' | 'emprestimo';

export interface FlightEntry {
  id: string;
  logbook_month_id: string | null;
  aircraft_id: string;
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  flight_nature: string;
  client_id: string | null;
  partner_name: string | null;
  is_equal_split: boolean;
  is_loan: boolean;
  pic_canac: string;
  sic_canac: string | null;
  sic_name: string | null;
  crew_checkin_time: string | null;
  ac_time: string;
  dep_time: string;
  pou_time: string;
  cor_time: string;
  time: number;
  total_time: number;
  day_time: number;
  night_hours: number;
  ifr_time: number;
  pousos: number;
  fuel_added: number;
  fuel_liters: number;
  fuel_type: string | null;
  fuel_location: string | null;
  fuel_price_per_liter: number | null;
  refueled: boolean;
  celula: number;
  distance_nm: number;
  passengers: number;
  cargo_kg: number;
  daily_rate: number | null;
  daily_quantity: number;
  occurrences: string | null;
  discrepancies: string | null;
  corrective_actions: string | null;
  remarks: string | null;
  confirmed: boolean;
  trecho: string;
  sequential_number: number | null;
  created_at: string;
}

export interface LogbookMonth {
  id: string;
  aircraft_id: string;
  month: number;
  year: number;
  status: string;
  is_closed: boolean;
  base_aerodrome: string | null;
  daily_rate: number | null;
  has_daily_rate: boolean;
  celula_anterior: number | null;
  celula_atual: number | null;
  celula_prox_revisao: number | null;
  celula_disponivel: number | null;
  horimetro_inicio: number | null;
  horimetro_final: number | null;
  horimetro_ativo: number | null;
  fuel_consumption: string | null;
  created_at: string;
}

export interface FlightMetrics {
  totalFlights: number;
  totalHours: number;
  totalDistance: number;
  totalFuel: number;
  totalLandings: number;
  dayHours: number;
  nightHours: number;
  ifrHours: number;
}

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
  flight_type: string;
  fuel_liters: string;
}

export interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
  status?: string;
}

export interface Partner {
  id: string;
  name: string;
  cpf?: string | null;
  share_percentage?: number | null;
}

export interface ClientData {
  client_id: string;
  share_percentage: number;
  clients: {
    id: string;
    company_name: string;
    proprietario?: string;
  } | null;
}

export interface SpecialFlightType {
  value: string;
  label: string;
  description: string;
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

export interface FormState {
  loading: boolean;
  saved: boolean;
  step: 1 | 2;
  date: Date | undefined;
  dateText: string;
  departureOpen: boolean;
  arrivalOpen: boolean;
  dailyCount: string;
  baseAerodrome: string | null;
  aircraftDailyRate: number | null;
  flightCategory: FlightCategory;
  specialFlightType: string;
  selectedClient: string;
  clientOpen: boolean;
  selectedBorrowerClient: string;
  borrowerClientOpen: boolean;
  selectedLenderPartner: string | null;
  selectedBorrowerPartner: string | null;
  selectedClientPartner: string | null;
  lenderPartnerModalOpen: boolean;
  borrowerPartnerModalOpen: boolean;
  clientPartnerModalOpen: boolean;
  selectedPic: string;
  selectedSic: string;
  sicName: string;
  picOpen: boolean;
  sicOpen: boolean;
  passengers: string;
  cargoKg: string;
  occurrences: string;
  discrepancies: string;
}