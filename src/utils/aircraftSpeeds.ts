/**
 * Velocidades de cruzeiro para planejamento de voo
 * Dados específicos de cada aeronave
 */

export interface AircraftSpeedConfig {
  registration: string;
  model: string;
  cruiseSpeedKnots: number;
  speedCode: string; // Formato ICAO (ex: N0150)
}

export const AIRCRAFT_SPEEDS: Record<string, AircraftSpeedConfig> = {
  'PT-WSR': {
    registration: 'PT-WSR',
    model: 'PIPER SENECA V (PA-34-220T)',
    cruiseSpeedKnots: 150,
    speedCode: 'N0150',
  },
  'PR-MDL': {
    registration: 'PR-MDL',
    model: 'PIPER SENECA V (PA-34-220T)',
    cruiseSpeedKnots: 150,
    speedCode: 'N0150',
  },
  'PT-OJG': {
    registration: 'PT-OJG',
    model: 'CESSNA 550 (Citation II)',
    cruiseSpeedKnots: 370,
    speedCode: 'N0370',
  },
  'PT-OPC': {
    registration: 'PT-OPC',
    model: 'PIPER CHEYENNE II (PA-31T)',
    cruiseSpeedKnots: 260,
    speedCode: 'N0260',
  },
  'PS-AVE': {
    registration: 'PS-AVE',
    model: 'CESSNA 182T',
    cruiseSpeedKnots: 145,
    speedCode: 'N0145',
  },
  'PR-GJM': {
    registration: 'PR-GJM',
    model: 'CIRRUS SR20',
    cruiseSpeedKnots: 155,
    speedCode: 'N0155',
  },
  'PT-JPK': {
    registration: 'PT-JPK',
    model: 'PIPER PA-28-180 (Cherokee)',
    cruiseSpeedKnots: 125,
    speedCode: 'N0125',
  },
  'PT-RVJ': {
    registration: 'PT-RVJ',
    model: 'NEIVA EMB-810D (Seneca)',
    cruiseSpeedKnots: 165,
    speedCode: 'N0165',
  },
  'PP-JCP': {
    registration: 'PP-JCP',
    model: 'MITSUBISHI MU-300 (Diamond I)',
    cruiseSpeedKnots: 450,
    speedCode: 'N0450',
  },
  'PT-TOR': {
    registration: 'PT-TOR',
    model: 'PIPER PA-46R-350T (Malibu Matrix)',
    cruiseSpeedKnots: 213,
    speedCode: 'N0213',
  },
};

/**
 * Obtém a configuração de velocidade para uma aeronave
 */
export function getAircraftSpeed(registration: string): AircraftSpeedConfig | null {
  const upperReg = registration.toUpperCase().trim();
  return AIRCRAFT_SPEEDS[upperReg] || null;
}

/**
 * Obtém a velocidade sugerida para uma aeronave em knots
 */
export function getSuggestedSpeed(registration: string): number {
  const config = getAircraftSpeed(registration);
  return config?.cruiseSpeedKnots || 150; // Default 150 knots
}

/**
 * Obtém o código de velocidade sugerido para uma aeronave
 */
export function getSuggestedSpeedCode(registration: string): string {
  const config = getAircraftSpeed(registration);
  return config?.speedCode || 'N0150';
}

/**
 * Calcula autonomia mínima baseado em tempo estimado
 * RBAC 91: VFR dia = 30 min reserva, VFR noite = 45 min, IFR = 45 min
 */
export function calculateMinimumEndurance(
  estimatedTimeMinutes: number,
  isIFR: boolean = true,
  isNight: boolean = false
): string {
  let reserveMinutes: number;

  if (isIFR) {
    reserveMinutes = 45; // Reserva IFR
  } else if (isNight) {
    reserveMinutes = 45; // Reserva VFR noite
  } else {
    reserveMinutes = 30; // Reserva VFR dia
  }

  // Adicionar 10% de contingência + reserva fixa
  const contingency = Math.ceil(estimatedTimeMinutes * 0.1);
  const totalMinutes = estimatedTimeMinutes + contingency + reserveMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
}
