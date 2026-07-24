/**
 * Utilitários do Simulador de Custos.
 * Mantém a matemática isolada dos componentes para facilitar testes e reuso.
 */

export type PilotType = "fixed" | "freelance";

export interface FlightCosts {
  flightTimeHours: number;
  flightTimeMinutes: number;
  distanceNm: number;
  distanceKm: number;
  fuelLiters: number;
  fixed: { crew: number; hangar: number; maintenance: number; total: number };
  variable: { fuel: number; decea: number; infraero: number; total: number };
  grandTotal: number;
  costPerHour: number;
}

export interface CalcFlightParams {
  distanceNm: number;
  cruiseKts: number;
  fuelBurnLph: number;
  mtowKg: number;
  fuelPriceBRL: number;
  annualHours: number;
  pilotType: PilotType;
  /** valor R$/hora quando piloto é freelance ou valor complementar do fixo */
  pilotHourlyBRL: number;
  /** salário mensal médio do piloto fixo (usado quando pilotType === "fixed") */
  fixedPilotMonthlyBRL: number;
  hangarMonthlyBRL: number;
  maintenanceHourlyBRL: number;
}

const R_NM = 3440.065;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDecea(mtowKg: number, distanceNm: number): number {
  const mtowTon = mtowKg / 1000;
  const distanceKm = distanceNm * 1.852;
  const ratePerTonPer100km = 15.8;
  return mtowTon * (distanceKm / 100) * ratePerTonPer100km;
}

function calcInfraero(mtowKg: number): number {
  const mtowTon = mtowKg / 1000;
  let feePerOp: number;
  if (mtowTon < 2) feePerOp = 95;
  else if (mtowTon < 5) feePerOp = 210;
  else if (mtowTon < 10) feePerOp = 480;
  else if (mtowTon < 20) feePerOp = 1100;
  else feePerOp = 2500;
  // pouso + decolagem
  return feePerOp * 2;
}

export function calculateFlightCosts(p: CalcFlightParams): FlightCosts {
  const flightTimeHours = p.distanceNm / Math.max(p.cruiseKts, 1);
  const flightTimeMinutes = Math.round(flightTimeHours * 60);
  const distanceKm = p.distanceNm * 1.852;

  const fuelLiters = p.fuelBurnLph * flightTimeHours;
  const fuelCost = fuelLiters * p.fuelPriceBRL;
  const decea = calcDecea(p.mtowKg, p.distanceNm);
  const infraero = calcInfraero(p.mtowKg);

  // Piloto: fixo = rateio do salário mensal por hora + valor por hora de voo;
  //         freelance = apenas valor por hora de voo.
  const annual = Math.max(p.annualHours, 1);
  const crewCost =
    p.pilotType === "fixed"
      ? ((p.fixedPilotMonthlyBRL * 12) / annual) * flightTimeHours + p.pilotHourlyBRL * flightTimeHours
      : p.pilotHourlyBRL * flightTimeHours;

  const hangarCost = ((p.hangarMonthlyBRL * 12) / annual) * flightTimeHours;
  const maintenanceCost = p.maintenanceHourlyBRL * flightTimeHours;

  const fixedTotal = crewCost + hangarCost + maintenanceCost;
  const variableTotal = fuelCost + decea + infraero;
  const grandTotal = fixedTotal + variableTotal;
  const costPerHour = flightTimeHours > 0 ? grandTotal / flightTimeHours : 0;

  return {
    flightTimeHours,
    flightTimeMinutes,
    distanceNm: Math.round(p.distanceNm),
    distanceKm: Math.round(distanceKm),
    fuelLiters,
    fixed: { crew: crewCost, hangar: hangarCost, maintenance: maintenanceCost, total: fixedTotal },
    variable: { fuel: fuelCost, decea, infraero, total: variableTotal },
    grandTotal,
    costPerHour,
  };
}

export function formatBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0
  );
}

export function formatTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

/**
 * Retorna estimativas de MTOW/hangar/manutenção com base na velocidade de cruzeiro,
 * já que a tabela `aeronave` não guarda todos esses valores. É apenas um ponto
 * de partida — o usuário pode ajustar no formulário.
 */
export function inferAircraftDefaults(cruiseKts: number) {
  if (cruiseKts > 350) {
    return { mtowKg: 7500, hangarMonthlyBRL: 12000, maintenanceHourlyBRL: 700 };
  }
  if (cruiseKts > 250) {
    return { mtowKg: 5500, hangarMonthlyBRL: 8000, maintenanceHourlyBRL: 500 };
  }
  return { mtowKg: 2500, hangarMonthlyBRL: 3500, maintenanceHourlyBRL: 220 };
}

export function aircraftCategory(cruiseKts: number): "Jato" | "Turboélice" | "Pistão" {
  if (cruiseKts > 350) return "Jato";
  if (cruiseKts > 250) return "Turboélice";
  return "Pistão";
}

/**
 * Coordenadas armazenadas em `aerodromes.coordenadas` podem vir em DMS
 * (N23°32'20" W46°28'10") ou decimal. Cobre os dois formatos.
 */
export function parseAerodromeCoords(
  coordStr: string | null | undefined
): { lat: number; lon: number } | null {
  if (!coordStr) return null;
  const dms = coordStr.match(
    /([NS])(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)"?\s*([EW])(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)"?/i
  );
  if (dms) {
    const lat =
      (parseInt(dms[2]) + parseInt(dms[3]) / 60 + parseFloat(dms[4]) / 3600) *
      (dms[1].toUpperCase() === "S" ? -1 : 1);
    const lon =
      (parseInt(dms[6]) + parseInt(dms[7]) / 60 + parseFloat(dms[8]) / 3600) *
      (dms[5].toUpperCase() === "W" ? -1 : 1);
    return { lat, lon };
  }
  const dec = coordStr.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (dec) return { lat: parseFloat(dec[1]), lon: parseFloat(dec[2]) };
  return null;
}
