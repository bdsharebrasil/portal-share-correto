/**
 * Aircraft cruise speeds for flight planning
 * Format: registration -> cruise speed in knots
 */

export interface AircraftSpeedConfig {
  registration: string;
  model: string;
  cruiseSpeedKnots: number;
  speedCode: string; // ICAO format (e.g., "N0150")
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

export function getAircraftSpeed(registration: string): AircraftSpeedConfig | null {
  const upperReg = registration.toUpperCase().trim();
  return AIRCRAFT_SPEEDS[upperReg] || null;
}

export function getSuggestedSpeed(registration: string): number {
  const config = getAircraftSpeed(registration);
  return config?.cruiseSpeedKnots || 150; // Default to 150 kts if not found
}

export function getSuggestedSpeedCode(registration: string): string {
  const config = getAircraftSpeed(registration);
  return config?.speedCode || 'N0150';
}

// Calculate suggested cruise altitude based on distance and direction
// IFR altitude rules: East (0-179°) = odd thousands, West (180-359°) = even thousands
export function getSuggestedAltitude(
  distanceNM: number,
  magneticHeading: number,
  isIFR: boolean = true
): string {
  // Short flights (< 50 NM) - lower altitude
  // Medium flights (50-200 NM) - medium altitude
  // Long flights (> 200 NM) - higher altitude

  let baseAltitude: number;
  if (distanceNM < 50) {
    baseAltitude = 5000;
  } else if (distanceNM < 100) {
    baseAltitude = 7000;
  } else if (distanceNM < 200) {
    baseAltitude = 9000;
  } else if (distanceNM < 300) {
    baseAltitude = 11000;
  } else {
    baseAltitude = 15000;
  }

  if (isIFR) {
    // IFR rules: East = odd (3,5,7,9...), West = even (4,6,8,10...)
    const isEasterly = magneticHeading >= 0 && magneticHeading < 180;

    // Adjust to nearest appropriate thousand
    const thousands = Math.floor(baseAltitude / 1000);
    const isOdd = thousands % 2 === 1;

    if (isEasterly && !isOdd) {
      baseAltitude += 1000; // Make odd for easterly
    } else if (!isEasterly && isOdd) {
      baseAltitude += 1000; // Make even for westerly
    }

    // Return in flight level format for higher altitudes
    if (baseAltitude >= 18000) {
      return `F${Math.floor(baseAltitude / 100)
        .toString()
        .padStart(3, '0')}`;
    }
    return `A${Math.floor(baseAltitude / 100)
      .toString()
      .padStart(3, '0')}`;
  }

  // VFR: add 500 feet
  return `A${Math.floor((baseAltitude + 500) / 100)
    .toString()
    .padStart(3, '0')}`;
}

// Calculate minimum fuel endurance based on flight time + reserves
// RBAC 91: VFR day = 30 min reserve, VFR night = 45 min, IFR = 45 min
export function calculateMinimumEndurance(
  estimatedTimeMinutes: number,
  isIFR: boolean = true,
  isNight: boolean = false
): string {
  let reserveMinutes: number;

  if (isIFR) {
    reserveMinutes = 45; // IFR reserve
  } else if (isNight) {
    reserveMinutes = 45; // VFR night reserve
  } else {
    reserveMinutes = 30; // VFR day reserve
  }

  // Add 10% contingency + fixed reserve
  const contingency = Math.ceil(estimatedTimeMinutes * 0.1);
  const totalMinutes = estimatedTimeMinutes + contingency + reserveMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, '0')}${minutes
    .toString()
    .padStart(2, '0')}`;
}
