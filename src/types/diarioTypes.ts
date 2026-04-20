/**
 * Estados da UI
 */
export interface UIState {
  showMonthPicker: boolean;
  showAddForm: boolean;
  showTechnicalStatus: boolean;
  showMaintenanceStatus: boolean;
  showExportDialog: boolean;
  showCloseDialog: boolean;
  editingField: string | null;
  isLoading: boolean;
  isSaving: boolean;
}

/**
 * Estado do período (mês/ano)
 */
export interface PeriodState {
  selectedMonth: number;
  selectedYear: number;
  availableMonths: Array<{ month: number; year: number; id: string }>;
  logbookMonthId: string | null;
}

/**
 * Estado do formulário
 */
export interface FormState {
  newEntry: FlightEntry;
  editingEntryId: string | null;
  flightType: 'cliente' | 'rateio' | 'emprestimo';
  selectedClient: string | null;
  selectedBorrowerClient: string | null;
}

/**
 * Estado da aplicação completa
 */
export interface AppState {
  ui: UIState;
  period: PeriodState;
  form: FormState;
}

/**
 * Entrada de voo
 */
export interface FlightEntry {
  id?: string;
  logbook_month_id?: string | null;
  diario_mes?: string | null;
  aeronave_id?: string;
  entry_date: string;
  data_registro?: string;
  departure_aerodrome: string;
  aerodromo_partida?: string;
  arrival_aerodrome: string;
  aerodromo_chegada?: string;
  crew_checkin_time?: string;
  tripulacao_checkin_hora?: string;
  ac_time: string;
  tempo_ac?: string;
  dep_time: string;
  tempo_dep?: string;
  pou_time: string;
  tempo_pou?: string;
  cor_time: string;
  tempo_cor?: string;
  time?: number;
  tempo_total?: number;
  day_time?: number;
  horas_diurnas?: number;
  night_time?: number;
  night_hours?: number;      // alias usado internamente
  horas_noturnas?: number;
  total_time?: number;
  ifr_time?: number;
  tempo_ifr?: number;
  distance_nm?: number;
  distancia_nm?: number;
  pousos?: number;
  pousos_total?: number;
  fuel_added?: number;
  combustivel_adicionado?: number;
  fuel_liters?: number;
  litros_combustivel?: number;
  celula?: number;
  pic_canac: string;
  sic_canac?: string;
  sic_name?: string;
  pic_name?: string;
  extras?: string;
  voo_para?: string;
  trecho?: string;
  confirmed?: boolean;
  confirmado?: boolean;
  confirmado_em?: string;
  confirmado_por?: string;
  remarks?: string;
  ocorrencias?: string;
  occurrences?: string;
  discrepancies?: string;
  discrepancias?: string;
  acoes_corretivas?: string;
  // Campos de cliente/empréstimo
  client_id?: string;
  clientes_id?: string;
  client_company_name?: string;
  is_equal_split?: boolean;
  divisao_igual?: boolean;
  is_loan?: boolean;
  emprestimo?: boolean;
  loan_recipient_client_id?: string;
  cliente_tomador_emprestimo_id?: string;
  partner_name?: string;
  socios_nome?: string;
  // Campos extras usados no form
  passengers?: number;
  passageiros?: number;
  cargo_kg?: string | number;
  daily_rate?: number;
  tarifa_diaria?: number | string;
  flight_nature?: string;
  natureza_voo?: string;
  // Campos de auditoria
  criado_em?: string;
  criado_por?: string;
  fechado?: boolean;
  fechado_em?: string;
  fechado_por?: string;
  detectado_por?: string;
  // Campos de tripulação
  origem_pic?: string;
  origem_sic?: string;
  socios_cliente_id?: string;
  // Campos adicionais
  celula_tvoo?: number | null;
  consumo_combustivel_voo?: number;
  consumo_combustivel_total?: number;
  numero_sequencial?: number;
}

/**
 * Aeronave
 */
export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  fuel_consumption: number;
  cell_hours_before?: number;
  cell_hours?: number;
  status?: 'ativo' | 'inativo';
}

/**
 * Membro da tripulação
 */
export interface CrewMember {
  id: string;
  canac: string;
  full_name: string;
  status?: 'ativo' | 'inativo';
}

/**
 * Cliente
 */
export interface Client {
  id: string;
  company_name: string;
  proprietario?: string;
  partner_name?: string;
  partner_cpf?: string;
  partner_name2?: string;
  partner_cpf2?: string;
  partner_name3?: string;
  partner_cpf3?: string;
}

/**
 * Aeródromo
 */
export interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas?: string;
}

/**
 * Mês de diário
 */
export interface LogbookMonth {
  id: string;
  aeronave_id: string;
  month: number;
  year: number;
  base_aerodrome?: string;
  daily_rate?: number;
  has_daily_rate?: boolean;
  status?: 'aberto' | 'fechado';
  created_at?: string;
  updated_at?: string;
}

/**
 * Resumo de voo
 */
export interface FlightSummary {
  totalEntries: number;
  totalBlockTime: number;
  totalFlightTime: number;
  totalDayTime: number;
  totalNightTime: number;
  totalDistance: number;
  totalLandings: number;
  totalIFRTime: number;
  averageSpeed: number;
}

/**
 * Ações do reducer
 */
export type AppAction =
  | { type: 'SET_UI_STATE'; payload: Partial<UIState> }
  | { type: 'SET_PERIOD_STATE'; payload: Partial<PeriodState> }
  | { type: 'SET_FORM_STATE'; payload: Partial<FormState> }
  | { type: 'RESET_FORM' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean };

/**
 * Constantes de tipos de voo
 */
export const FLIGHT_TYPES = {
  CLIENTE: 'cliente',
  RATEIO: 'rateio',
  EMPRESTIMO: 'emprestimo',
} as const;

/**
 * Constantes de natureza de voo
 */
export const FLIGHT_NATURES = [
  'AE',
  'CQ',
  'EX',
  'NR',
  'RE',
  'PV',
  'SA',
  'TN',
  'TR',
] as const;

/**
 * Tipos de voo para rateio
 */
export interface SplitFlightType {
  code: string;
  label: string;
  description: string;
}

export const SPLIT_FLIGHT_TYPES: SplitFlightType[] = [
  {
    code: 'CQ',
    label: 'CQ - Cheque (Voo de Verificação)',
    description: 'Rateio igual entre sócios',
  },
  {
    code: 'TR',
    label: 'TR - Traslado (Ferry/Posicionamento)',
    description: 'Rateio igual entre sócios',
  },
  {
    code: 'TN',
    label: 'TN - Teste (Manutenção/Teste)',
    description: 'Rateio igual entre sócios',
  },
];
