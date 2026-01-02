// Tab types for CTM Aircraft Detail
export type CTMTab = "os" | "componentes" | "peso" | "ras";

// Maintenance category types
export type MaintenanceCategory = 
  | "TUDO"
  | "PREVENTIVA"
  | "CORRETIVA"
  | "INSPEÇÃO"
  | "MODIFICAÇÃO"
  | "REVISÃO";

// Maintenance category display configuration
export interface MaintenanceCategoryConfig {
  value: MaintenanceCategory;
  label: string;
  color?: string;
  icon?: string;
}

export const MAINTENANCE_CATEGORIES: MaintenanceCategoryConfig[] = [
  { value: "TUDO", label: "Todas" },
  { value: "PREVENTIVA", label: "Preventiva" },
  { value: "CORRETIVA", label: "Corretiva" },
  { value: "INSPEÇÃO", label: "Inspeção" },
  { value: "MODIFICAÇÃO", label: "Modificação" },
  { value: "REVISÃO", label: "Revisão" },
];

// RAS (Relatório de Acompanhamento de Serviço) types
export interface RASPhoto {
  id: string;
  ras_id: string;
  file_path: string;
  file_name?: string;
  photo_url?: string;
  caption?: string;
  created_at: string;
  updated_at?: string;
}

export interface RASItem {
  id: string;
  ras_id: string;
  descricao?: string;
  description?: string;
  item_type?: 'labor' | 'parts' | 'servico' | 'peca';
  quantidade?: number;
  quantity?: number;
  valor_unitario?: number;
  unit_value?: number;
  valor_total?: number;
  total_value?: number;
  part_number?: string;
  serial_number?: string;
  supplier?: string;
  created_at: string;
  updated_at?: string;
}

export interface RASReport {
  id: string;
  aircraft_id: string;
  numero?: string;
  number?: string;
  data_relatorio: string;
  mecanico_responsavel?: string;
  status?: "pendente" | "em_andamento" | "concluido" | "completed";
  observacoes?: string;
  description?: string;
  maintenance_type?: string;
  maintenance_center?: string;
  entry_date?: string;
  exit_date?: string;
  cell_hours_entry?: number;
  cell_hours_exit?: number;
  planned_days?: number;
  effective_days?: number;
  labor_total?: number;
  parts_total?: number;
  grand_total?: number;
  items: RASItem[];
  photos: RASPhoto[];
  created_at: string;
  updated_at?: string;
}

// Component category types
export type ComponentCategory =
  | "motor"
  | "helice"
  | "turbo"
  | "cilindro"
  | "carburador"
  | "magneto"
  | "vela"
  | "gerador"
  | "alternador"
  | "motor_eletrico"
  | "bateria"
  | "hidraulico"
  | "pneumatico"
  | "combustivel"
  | "oleo"
  | "agua"
  | "ar"
  | "avionico"
  | "radio"
  | "transponder"
  | "gps"
  | "autopilot"
  | "luzes"
  | "combustivel_sistema"
  | "freios"
  | "trem_pouso"
  | "asas"
  | "fuselagem"
  | "empenagem"
  | "porta"
  | "janela"
  | "estrutura"
  | "outro";

export interface ComponentCategoryConfig {
  value: ComponentCategory;
  label: string;
}

export const COMPONENT_CATEGORIES: ComponentCategoryConfig[] = [
  { value: "motor", label: "Motor" },
  { value: "helice", label: "Hélice" },
  { value: "turbo", label: "Turbocompressor" },
  { value: "cilindro", label: "Cilindro" },
  { value: "carburador", label: "Carburador" },
  { value: "magneto", label: "Magneto" },
  { value: "vela", label: "Vela de Ignição" },
  { value: "gerador", label: "Gerador" },
  { value: "alternador", label: "Alternador" },
  { value: "motor_eletrico", label: "Motor Elétrico" },
  { value: "bateria", label: "Bateria" },
  { value: "hidraulico", label: "Sistema Hidráulico" },
  { value: "pneumatico", label: "Sistema Pneumático" },
  { value: "combustivel", label: "Sistema de Combustível" },
  { value: "oleo", label: "Sistema de Óleo" },
  { value: "agua", label: "Sistema de Água" },
  { value: "ar", label: "Sistema de Ar" },
  { value: "avionico", label: "Avionics" },
  { value: "radio", label: "Rádio" },
  { value: "transponder", label: "Transponder" },
  { value: "gps", label: "GPS/Navegação" },
  { value: "autopilot", label: "Autopilot" },
  { value: "luzes", label: "Sistema de Luzes" },
  { value: "combustivel_sistema", label: "Alimentação de Combustível" },
  { value: "freios", label: "Sistema de Freios" },
  { value: "trem_pouso", label: "Trem de Pouso" },
  { value: "asas", label: "Asas" },
  { value: "fuselagem", label: "Fuselagem" },
  { value: "empenagem", label: "Empenagem" },
  { value: "porta", label: "Portas" },
  { value: "janela", label: "Janelas" },
  { value: "estrutura", label: "Estrutura" },
  { value: "outro", label: "Outro" },
];

// Component interface
export interface Component {
  id: string;
  aircraft_id: string;
  name: string;
  part_number: string;
  serial_number: string;
  category?: ComponentCategory | null;
  manufacturer?: string | null;
  location?: string | null;
  total_life_hours?: number | null;
  total_life_cycles?: number | null;
  installed_date?: string;
  installed_hours?: number | null;
  installed_cycles?: number | null;
  current_life_hours?: number | null;
  current_life_cycles?: number | null;
  remaining_hours?: number | null;
  remaining_percentage?: number | null;
  status?: string | null;
  observations?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Aircraft types for CTM operations
export interface CTMAircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
  fabricante?: string;
  ano_fabricacao?: number;
  num_serie?: string;
}

// Service Order types
export interface CTMServiceOrder {
  id: string;
  aircraft_id: string;
  numero: string;
  tipo_manutencao: MaintenanceCategory;
  data_criacao: string;
  data_conclusao?: string;
  status: "pendente" | "em_andamento" | "concluido";
  mecanico_responsavel?: string;
  horas_celula?: number;
  total_geral?: number;
  os_oficina?: string;
  observacoes?: string;
  objetivo?: string;
  description?: string;
  assigned_to?: string;
  scheduled_date?: string;
  completion_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

// Component tracking types
export interface AircraftComponent {
  id: string;
  aircraft_id: string;
  nome: string;
  parte_numero?: string;
  data_instalacao: string;
  data_proxima_revisao?: string;
  condicao: "bom" | "regular" | "deficiente";
  observacoes?: string;
}

// Weight and balance types
export interface WeightBalanceEntry {
  id: string;
  aircraft_id: string;
  data: string;
  peso_total?: number;
  cg_posicao?: number;
  observacoes?: string;
}
