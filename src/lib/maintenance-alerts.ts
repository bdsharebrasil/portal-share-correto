/**
 * Sistema de Alertas de Manutenção Preventiva
 * Calcula automaticamente os níveis de alerta baseado nas horas de voo
 */

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';
export type MaintenanceType = '50h' | '100h' | '150h' | '200h';

export interface MaintenanceConfig {
  maintenanceType: MaintenanceType;
  intervalHours: number;
  alertGreenThreshold: number; // 20-15 horas
  alertYellowThreshold: number; // 15-10 horas
  alertOrangeThreshold: number; // 10-5 horas
  alertRedThreshold: number; // <5 horas
}

export interface MaintenanceStatus {
  maintenanceType: MaintenanceType;
  alertLevel: AlertLevel;
  hoursRemaining: number;
  nextDueHours: number;
  currentHours: number;
  percentComplete: number;
  message: string;
  isOverdue: boolean;
  shouldBlockScheduling: boolean;
}

export interface LastMaintenanceInfo {
  maintenanceType: MaintenanceType;
  performedAtHours: number;
  performedDate: string;
  nextDueHours: number;
}

export const DEFAULT_CONFIGS: Record<MaintenanceType, MaintenanceConfig> = {
  '50h': {
    maintenanceType: '50h',
    intervalHours: 50,
    alertGreenThreshold: 20,
    alertYellowThreshold: 15,
    alertOrangeThreshold: 10,
    alertRedThreshold: 5,
  },
  '100h': {
    maintenanceType: '100h',
    intervalHours: 100,
    alertGreenThreshold: 20,
    alertYellowThreshold: 15,
    alertOrangeThreshold: 10,
    alertRedThreshold: 5,
  },
  '150h': {
    maintenanceType: '150h',
    intervalHours: 150,
    alertGreenThreshold: 30,
    alertYellowThreshold: 20,
    alertOrangeThreshold: 10,
    alertRedThreshold: 5,
  },
  '200h': {
    maintenanceType: '200h',
    intervalHours: 200,
    alertGreenThreshold: 40,
    alertYellowThreshold: 25,
    alertOrangeThreshold: 15,
    alertRedThreshold: 5,
  },
};

/**
 * Calcula a próxima manutenção devida baseado na última manutenção realizada
 */
export function calculateNextMaintenance(
  currentHours: number,
  lastMaintenance: LastMaintenanceInfo | null,
  config: MaintenanceConfig
): number {
  if (!lastMaintenance) {
    // Se nunca foi feita manutenção, calcular a partir de 0
    const interval = config.intervalHours;
    return Math.ceil(currentHours / interval) * interval;
  }

  return lastMaintenance.performedAtHours + config.intervalHours;
}

/**
 * Determina o nível de alerta baseado nas horas restantes
 */
export function getAlertLevel(
  hoursRemaining: number,
  config: MaintenanceConfig
): AlertLevel {
  if (hoursRemaining <= 0) {
    return 'red';
  }
  if (hoursRemaining <= config.alertRedThreshold) {
    return 'red';
  }
  if (hoursRemaining <= config.alertOrangeThreshold) {
    return 'orange';
  }
  if (hoursRemaining <= config.alertYellowThreshold) {
    return 'yellow';
  }
  if (hoursRemaining <= config.alertGreenThreshold) {
    return 'green';
  }
  return 'green';
}

/**
 * Gera a mensagem de alerta apropriada
 */
export function getAlertMessage(
  alertLevel: AlertLevel,
  maintenanceType: MaintenanceType,
  hoursRemaining: number
): string {
  const formattedHours = hoursRemaining.toFixed(1);
  
  switch (alertLevel) {
    case 'green':
      return `Próxima manutenção de ${maintenanceType} em aproximadamente ${formattedHours} horas`;
    case 'yellow':
      return `Atenção: Manutenção de ${maintenanceType} se aproximando - faltam ${formattedHours} horas`;
    case 'orange':
      return `Urgente: Agende a manutenção de ${maintenanceType} - faltam apenas ${formattedHours} horas`;
    case 'red':
      if (hoursRemaining <= 0) {
        return `CRÍTICO: Manutenção de ${maintenanceType} VENCIDA - ${Math.abs(hoursRemaining).toFixed(1)} horas excedidas`;
      }
      return `CRÍTICO: Manutenção de ${maintenanceType} vencendo - ${formattedHours} horas restantes`;
    default:
      return `Manutenção de ${maintenanceType} em ${formattedHours} horas`;
  }
}

/**
 * Calcula o status completo de manutenção para uma aeronave
 */
export function calculateMaintenanceStatus(
  currentHours: number,
  lastMaintenance: LastMaintenanceInfo | null,
  config: MaintenanceConfig
): MaintenanceStatus {
  const nextDueHours = calculateNextMaintenance(currentHours, lastMaintenance, config);
  const hoursRemaining = nextDueHours - currentHours;
  const alertLevel = getAlertLevel(hoursRemaining, config);
  const message = getAlertMessage(alertLevel, config.maintenanceType, hoursRemaining);
  
  // Calcular percentual completo do intervalo
  const intervalStart = lastMaintenance?.performedAtHours || 0;
  const intervalTotal = config.intervalHours;
  const hoursInInterval = currentHours - intervalStart;
  const percentComplete = Math.min(100, Math.max(0, (hoursInInterval / intervalTotal) * 100));

  return {
    maintenanceType: config.maintenanceType,
    alertLevel,
    hoursRemaining,
    nextDueHours,
    currentHours,
    percentComplete,
    message,
    isOverdue: hoursRemaining <= 0,
    shouldBlockScheduling: alertLevel === 'red' && hoursRemaining <= 0,
  };
}

/**
 * Calcula status para múltiplos tipos de manutenção
 */
export function calculateAllMaintenanceStatuses(
  currentHours: number,
  maintenanceRecords: LastMaintenanceInfo[],
  configs: MaintenanceConfig[]
): MaintenanceStatus[] {
  return configs.map(config => {
    const lastMaintenance = maintenanceRecords.find(
      m => m.maintenanceType === config.maintenanceType
    ) || null;
    
    return calculateMaintenanceStatus(currentHours, lastMaintenance, config);
  });
}

/**
 * Verifica se alguma manutenção está bloqueando novos agendamentos
 */
export function hasBlockingMaintenance(statuses: MaintenanceStatus[]): boolean {
  return statuses.some(s => s.shouldBlockScheduling);
}

/**
 * Obtém o status mais crítico
 */
export function getMostCriticalStatus(statuses: MaintenanceStatus[]): MaintenanceStatus | null {
  if (statuses.length === 0) return null;
  
  const priorityOrder: AlertLevel[] = ['red', 'orange', 'yellow', 'green'];
  
  for (const level of priorityOrder) {
    const found = statuses.find(s => s.alertLevel === level);
    if (found) return found;
  }
  
  return statuses[0];
}

/**
 * Cores e estilos para cada nível de alerta
 */
export const ALERT_STYLES: Record<AlertLevel, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  label: string;
  labelPt: string;
}> = {
  green: {
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
    iconColor: 'text-green-400',
    label: 'Informative',
    labelPt: 'Informativo',
  },
  yellow: {
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    iconColor: 'text-yellow-500',
    label: 'Attention',
    labelPt: 'Atenção',
  },
  orange: {
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    iconColor: 'text-orange-500',
    label: 'Urgent',
    labelPt: 'Urgente',
  },
  red: {
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    iconColor: 'text-red-500',
    label: 'Critical',
    labelPt: 'Crítico',
  },
};
