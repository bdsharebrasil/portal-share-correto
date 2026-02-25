// Aircraft Types
export interface Aircraft {
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

// Maintenance Item Types
export type MaintenanceStatus = 'expired' | 'urgent' | 'attention' | 'ok';
export type MaintenanceType = 'preventiva' | 'corretiva' | 'programada';
export type IntervalType = 'horas' | 'ciclos' | 'calendario' | 'variavel';

export interface MaintenanceItem {
  id: string;
  aircraftId: string;
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
  aircraftId: string;
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
}

// RAS (Relatório de Acompanhamento de Serviço) Types
export interface RASPhoto {
  id: string;
  rasId: string;
  url: string;
  description?: string;
  uploadedAt: string;
}

export interface RASCostItem {
  id: string;
  rasId: string;
  description: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  category: 'pneu' | 'mao_obra' | 'motor' | 'avionico' | 'outro';
}

export interface RAS {
  id: string;
  aircraftId: string;
  serviceOrderNumber: string;
  maintenanceCenter: string;
  maintenanceType: 'corretiva' | 'preventiva' | 'revisao';
  responsibleMechanic: string;
  date: string;
  completionDate?: string;
  description: string;
  inspectionDetails: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  totalCost: number;
  photos: RASPhoto[];
  costItems: RASCostItem[];
  motorHours?: number;
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

// Motor Expense Types
export interface MotorExpense {
  id: string;
  aircraftId: string;
  motorSide: 'LH' | 'RH' | 'both';
  type: 'overhaul' | 'repair' | 'maintenance' | 'inspection';
  description: string;
  motorHours: number;
  cost: number;
  supplier?: string;
  date: string;
  observations?: string;
  createdAt: string;
}

// Financial Summary Types
export interface FinancialSummary {
  aircraftId: string;
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
  aircraftId: string;
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
  aircraftId: string;
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
  aircraftId: string;
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
  aircraftId: string;
  type: string;
  issueDate: string;
  expirationDate: string;
  issuer: string;
  certificateNumber: string;
  status: 'valido' | 'vencido';
  createdAt: string;
}
