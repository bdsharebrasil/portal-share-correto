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
