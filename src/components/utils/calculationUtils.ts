import { timeStringToMinutes, calculateTimeDiff } from './timeUtils';

/**
 * Calcula distância entre dois pontos usando Haversine
 * Retorna distância em milhas náuticas
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3440.065; // Raio da Terra em milhas náuticas
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calcula o custo por parceiro com suporte a rateio
 */
export const calculateCostPerPartner = (
  totalCost: number,
  isEqualSplit: boolean,
  partnersCount: number
): number => {
  if (!isEqualSplit || partnersCount === 0) {
    return totalCost;
  }
  return parseFloat((totalCost / partnersCount).toFixed(2));
};

/**
 * Calcula as horas diurnas e noturnas
 * Usa simplificação: Sunrise 06:00, Sunset 18:00
 */
export const calculateDayNightTimes = (entry: {
  dep_time: string;
  pou_time: string;
  total_time?: number;
}) => {
  if (!entry.dep_time || !entry.pou_time) {
    return { day_time: 0, night_time: 0 };
  }

  const flightStartMin = timeStringToMinutes(entry.dep_time);
  const flightEndMin = timeStringToMinutes(entry.pou_time);
  const sunriseMin = 360; // 06:00
  const sunsetMin = 1080; // 18:00

  let nightTimeMinutes = 0;
  const flightDurationMin = (entry.total_time || 0) * 60;

  if (flightStartMin < sunriseMin || flightEndMin > sunsetMin) {
    if (flightStartMin < sunriseMin) {
      nightTimeMinutes += Math.min(sunriseMin - flightStartMin, flightDurationMin);
    }
    if (flightEndMin > sunsetMin) {
      nightTimeMinutes += Math.min(
        flightEndMin - sunsetMin,
        flightDurationMin - nightTimeMinutes
      );
    }
  }

  const nightHours = parseFloat((nightTimeMinutes / 60).toFixed(2));
  const dayHours = parseFloat(((entry.total_time || 0) - nightHours).toFixed(2));

  return { day_time: dayHours, night_time: nightHours };
};

/**
 * Calcula diárias com base na regra: fora da base = 1 diária
 */
export const calculateDailyAllowanceForEntry = (
  entry: any,
  baseAerodrome: string,
  allEntries: any[] = []
): number => {
  if (!baseAerodrome) return 0;

  const origin = entry.departure_aerodrome;
  const destination = entry.arrival_aerodrome;

  // Rateio igual não tem diária
  if (entry.is_equal_split) {
    return 0;
  }

  // Empréstimo não tem diária
  if (entry.is_loan) {
    return 0;
  }

  // Saída da base sem volta = 0 diárias
  if (origin === baseAerodrome && destination !== baseAerodrome) {
    return 0;
  }

  // Chegada na base vindo de fora = 1 diária
  if (destination === baseAerodrome && origin !== baseAerodrome) {
    return 1;
  }

  // Voo completamente fora da base
  if (origin !== baseAerodrome && destination !== baseAerodrome) {
    const sortedEntries = [...allEntries].sort(
      (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const currentIndex = sortedEntries.findIndex(
      (e) =>
        e.id === entry.id ||
        (e.entry_date === entry.entry_date &&
          e.departure_aerodrome === entry.departure_aerodrome &&
          e.arrival_aerodrome === entry.arrival_aerodrome)
    );

    if (currentIndex === -1 || currentIndex === 0) {
      return 0;
    }

    const currentEntry = sortedEntries[currentIndex];
    const previousEntry = sortedEntries[currentIndex - 1];

    const currentDate = new Date(currentEntry.entry_date);
    const previousDate = new Date(previousEntry.entry_date);

    if (currentDate.toDateString() !== previousDate.toDateString()) {
      return 1;
    }

    return 0;
  }

  return 0;
};

/**
 * Calcula as horas de bloco (AC até COR)
 */
export const calculateBlockTime = (acTime: string, corTime: string): number => {
  return calculateTimeDiff(acTime, corTime);
};

/**
 * Calcula o tempo de voo (DEP até POU)
 */
export const calculateFlightTime = (depTime: string, pouTime: string): number => {
  return calculateTimeDiff(depTime, pouTime);
};

/**
 * Calcula consumo de combustível baseado em tempo de bloco
 */
export const calculateFuelConsumption = (
  blockTime: number,
  fuelConsumptionRate: number
): number => {
  return parseFloat((blockTime * fuelConsumptionRate).toFixed(2));
};

/**
 * Valida se o tempo de voo é válido
 */
export const isValidFlightTime = (flightTime: number): boolean => {
  return flightTime > 0 && flightTime < 24;
};

/**
 * Calcula horas IFR efetivas (não pode exceder tempo de voo)
 */
export const validateIFRHours = (
  ifrHours: number,
  flightTime: number
): number => {
  return Math.min(ifrHours, flightTime);
};
