/**
 * Regra semicircular (ICA 100-12) para sugestão automática de nível de cruzeiro.
 * Baseada na proa magnética da perna origem → destino e na regra de voo.
 */

export interface FlightLevelSuggestion {
  /** valor em pés */
  altitudeFt: number;
  /** rótulo (ex.: "FL090" ou "5500 ft") */
  label: string;
  /** alternativas válidas na mesma direção */
  alternatives: Array<{ altitudeFt: number; label: string }>;
  /** explicação da regra aplicada */
  rationale: string;
  /** rota sugerida conforme a regra de voo */
  suggestedRoute: string;
}

const flLabel = (ft: number) => `FL${String(Math.round(ft / 100)).padStart(3, '0')}`;

export function suggestFlightLevel(
  magneticCourse: number,
  flightRule: 'V' | 'I' | 'Y' | 'Z',
  minimumFt = 0,
): FlightLevelSuggestion {
  const course = ((magneticCourse % 360) + 360) % 360;
  const eastbound = course >= 0 && course < 180;
  // Y = IFR na saída, Z = IFR na chegada — em ambos usa-se nível IFR no cruzeiro
  const isIFR = flightRule === 'I' || flightRule === 'Y' || flightRule === 'Z';

  const base = isIFR
    ? (eastbound ? 7000 : 8000) // FL070 / FL080
    : (eastbound ? 5500 : 6500);

  const step = 2000;
  const ladder: number[] = [];
  for (let i = 0; i < 8; i++) ladder.push(base + i * step);

  const altitudeFt = ladder.find((ft) => ft >= minimumFt) ?? base;
  const label = isIFR ? flLabel(altitudeFt) : `${altitudeFt} ft`;

  return {
    altitudeFt,
    label,
    alternatives: ladder
      .filter((ft) => ft !== altitudeFt)
      .slice(0, 4)
      .map((ft) => ({ altitudeFt: ft, label: isIFR ? flLabel(ft) : `${ft} ft` })),
    rationale: `Proa magnética ${String(Math.round(course)).padStart(3, '0')}° (${eastbound ? '000–179°' : '180–359°'}) · ${
      isIFR ? 'IFR: níveis ímpares/pares de mil pés' : 'VFR: mil pés + 500'
    }`,
    suggestedRoute: isIFR ? 'DCT' : 'VFR DCT',
  };
}

/** Formata uma altitude em pés como nível de voo (ex.: 9000 → "FL090"). */
export function formatarFL(altitudeFt: number): string {
  return flLabel(altitudeFt);
}

export { calcularRumo } from '@/lib/geo';
