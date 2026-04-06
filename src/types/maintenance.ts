// Aeronave Types
export interface Aeronave {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  totalHours: number;
  totalCycles: number;
  lastRevisionDate?: string;
  nextRevisionHours?: number;
  status?: string;
}

// Backward compatibility
export type Aircraft = Aeronave;

// Maintenance Item Types
export type MaintenanceStatus = 'expired' | 'urgent' | 'attention' | 'ok';
export type MaintenanceType = 'preventiva' | 'corretiva' | 'programada';
export type IntervalType = 'horas' | 'ciclos' | 'calendario' | 'variavel';

export interface MaintenanceItem {
  id: string;
  aeronaveId: string;
  type: MaintenanceType;
  description: string;
  dueHours?: number;
  dueCycles?: number;
  dueDate?: string;
  currentHours: number;
  currentCycles: number;
  status: MaintenanceStatus;
  interval: string;
  lastDone?: string;
  nextDue: string;
  responsibleMechanic?: string;
  observations?: string;
  intervalType?: IntervalType;
  intervalValue?: number;
}

// Component Types
export interface Component {
  id: string;
  aeronaveId?: string;
  aircraft_id?: string;
  name: string;
  partNumber: string;
  serialNumber: string;
  totalLife: number;
  currentLife: number;
  location: string;
  installedDate: string;
  status: MaintenanceStatus;
  alertPercentage?: number;
  lastInspection?: string;
  nextInspection?: string;
  // Allow DB column names
  [key: string]: any;
}

// RAS (Relatório de Acompanhamento de Serviço) Types
export interface RASPhoto {
  id: string;
  rasId: string;
  url: string;
  description?: string;
  /** @deprecated use description */
  descricao?: string;
  uploadedAt: string;
}

export interface RASCostItem {
  id: string;
  rasId: string;
  description: string;
  /** @deprecated use description */
  descricao?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  category: 'pneu' | 'mao_obra' | 'motor' | 'avionico' | 'outro';
}

export interface RAS {
  id: string;
  aeronaveId: string;
  serviceOrderNumber: string;
  maintenanceCenter: string;
  maintenanceType: 'corretiva' | 'preventiva' | 'revisao';
  responsibleMechanic: string;
  date: string;
  /** @deprecated use date */
  data?: string;
  completionDate?: string;
  description: string;
  /** @deprecated use description */
  descricao?: string;
  inspectionDetails: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  /** @deprecated use status */
  situacao?: string;
  totalCost: number;
  photos: RASPhoto[];
  costItems: RASCostItem[];
  motorHours?: number;
  observations?: string;
  /** @deprecated use observations */
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  // Allow DB field access
  [key: string]: any;
}

// Motor Expense Types
export interface MotorExpense {
  id: string;
  aeronaveId: string;
  motorSide: 'LH' | 'RH' | 'both';
  type: 'overhaul' | 'repair' | 'maintenance' | 'inspection';
  /** @deprecated use type */
  tipo?: string;
  description: string;
  /** @deprecated use description */
  descricao?: string;
  motorHours: number;
  cost: number;
  supplier?: string;
  date: string;
  /** @deprecated use date */
  data?: string;
  observations?: string;
  /** @deprecated use observations */
  observacoes?: string;
  createdAt: string;
}

// Photo Item for uploads
export interface PhotoItem {
  id: string;
  url: string;
  description?: string;
  /** @deprecated use description */
  descricao?: string;
  [key: string]: any;
}

// Financial Summary Types
export interface FinancialSummary {
  aeronaveId: string;
  totalMaintenanceCost: number;
  totalMotorCost: number;
  totalPartsCost: number;
  totalLaborCost: number;
  costByCategory: Record<string, number>;
  monthlyExpenses: MonthlyExpense[];
  yearlyTotal: number;
}

export interface MonthlyExpense {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

// AD and SB Types
export interface AirworthinessDirective {
  id: string;
  aeronaveId: string;
  adNumber: string;
  title: string;
  issueDate: string;
  effectiveDate: string;
  dueDate?: string;
  description: string;
  status: 'pendente' | 'em_progresso' | 'concluido';
  completionDate?: string;
  observations?: string;
  createdAt: string;
}

export interface ServiceBulletin {
  id: string;
  aeronaveId: string;
  sbNumber: string;
  title: string;
  issueDate: string;
  dueDate?: string;
  description: string;
  status: 'pendente' | 'em_progresso' | 'concluido';
  completionDate?: string;
  observations?: string;
  createdAt: string;
}

// Insurance and Certificates Types
export interface InsurancePolicy {
  id: string;
  aeronaveId: string;
  type: string;
  provider: string;
  policyNumber: string;
  expirationDate: string;
  coverage: string;
  premiumValue?: number;
  status: 'ativo' | 'vencido' | 'cancelado';
  createdAt: string;
}

export interface Certification {
  id: string;
  aeronaveId: string;
  type: string;
  issueDate: string;
  expirationDate: string;
  issuer: string;
  certificateNumber: string;
  status: 'valido' | 'vencido';
  createdAt: string;
}
