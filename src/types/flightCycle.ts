export type FlightCycleStatus = 
  | 'planejado' 
  | 'confirmado' 
  | 'em_execucao' 
  | 'concluido' 
  | 'aguardando_despesas' 
  | 'em_cobranca' 
  | 'finalizado';

export interface CrewMember {
  id: string;
  user_id: string | null;
  canac: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
}

export type ExpenseStatus =
  | 'aguardando'
  | 'recebida'
  | 'enviada'
  | 'paga'
  | 'atrasada'
  | 'nao_aplicavel';

export type ExpenseCategory = 'imediata' | 'regulatoria' | 'variavel';

export interface FlightCycle {
  id: string;
  client_id: string | null;
  partner_id: string | null;
  aircraft_id: string | null;
  origin_icao: string;
  destination_icao: string;
  flight_date: string;
  return_date: string | null;
  flight_type: 'ida' | 'ida_volta' | 'pernoite';
  has_overnight: boolean;
  is_controlled_airport: boolean;
  has_private_hangar: boolean;
  flight_duration_hours: number | null;
  status: FlightCycleStatus;
  responsible_user_id: string | null;
  observations: string | null;
  pic_name: string | null;
  sic_name: string | null;
  partner_name: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  // Joined data
  client?: { company_name: string; proprietario: string };
  partner?: { name: string };
  aircraft?: { registration: string; model: string };
  expenses?: FlightExpense[];
}

export interface FlightExpense {
  id: string;
  flight_cycle_id: string;
  expense_type: string;
  expense_category: ExpenseCategory;
  expense_name: string;
  status: ExpenseStatus;
  expected_date: string | null;
  received_date: string | null;
  sent_to_client_date: string | null;
  payment_date: string | null;
  amount: number | null;
  observations: string | null;
  attachment_url: string | null;
  deadline_days: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseDeadlineConfig {
  id: string;
  expense_type: string;
  default_deadline_days: number;
  alert_days_before: number;
}

// Status configurations
export const FLIGHT_STATUS_CONFIG: Record<FlightCycleStatus, { label: string; color: string; bgColor: string }> = {
  planejado: { label: 'Planejado', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  confirmado: { label: 'Confirmado', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  em_execucao: { label: 'Em Execução', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  concluido: { label: 'Concluído', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  aguardando_despesas: { label: 'Aguardando Despesas', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  em_cobranca: { label: 'Em Cobrança', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  finalizado: { label: 'Finalizado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

export const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; icon: string; color: string; bgColor: string }> = {
  aguardando: { label: 'Aguardando', icon: '⏳', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  recebida: { label: 'Recebida', icon: '📋', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  enviada: { label: 'Enviada ao Cliente', icon: '✅', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  paga: { label: 'Paga', icon: '💰', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  atrasada: { label: 'Atrasada', icon: '⚠️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  nao_aplicavel: { label: 'Não Aplicável', icon: '❌', color: 'text-muted-foreground', bgColor: 'bg-muted/20' },
};

export const EXPENSE_TYPES = {
  // Imediatas
  hospedagem: { name: 'Hospedagem', category: 'imediata' as ExpenseCategory },
  alimentacao: { name: 'Alimentação', category: 'imediata' as ExpenseCategory },
  transporte_terrestre: { name: 'Transporte Terrestre', category: 'imediata' as ExpenseCategory },
  combustivel_emergencia: { name: 'Combustível de Emergência', category: 'imediata' as ExpenseCategory },
  diaria_hangar: { name: 'Diária de Hangar', category: 'imediata' as ExpenseCategory },
  // Regulatórias
  tarifa_decea: { name: 'Tarifa DECEA', category: 'regulatoria' as ExpenseCategory },
  tarifa_infraero: { name: 'Tarifa Infraero', category: 'regulatoria' as ExpenseCategory },
  taxa_pouso: { name: 'Taxa de Pouso', category: 'regulatoria' as ExpenseCategory },
  taxa_permanencia: { name: 'Taxa de Permanência', category: 'regulatoria' as ExpenseCategory },
  // Variáveis
  hangar_particular: { name: 'Hangar Particular', category: 'variavel' as ExpenseCategory },
  servicos_rampa: { name: 'Serviços de Rampa', category: 'variavel' as ExpenseCategory },
  outras: { name: 'Outras Despesas', category: 'variavel' as ExpenseCategory },
};
