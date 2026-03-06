/**
 * Velocidades de cruzeiro por modelo de aeronave (em knots)
 * Se o modelo não for encontrado, retorna velocidade padrão
 */
export const AIRCRAFT_SPEEDS: Record<string, { kt: number; name: string }> = {
  'EMB-810D': { kt: 180, name: 'Seneca III' },
  'PA-28-180': { kt: 125, name: 'Cherokee' },
  'MU-300': { kt: 440, name: 'Mitsubishi Diamond' },
  'PA-46R-350T': { kt: 188, name: 'Matrix' },
  'PA-31T': { kt: 240, name: 'Cheyenne II' },
  'PA-46-500TP': { kt: 260, name: 'Meridian' },
  '182T': { kt: 145, name: 'Cessna Skylane' },
  '400A': { kt: 450, name: 'Beechjet 400A' },
  '550': { kt: 370, name: 'Citation II' },
  'PA-34-220T': { kt: 190, name: 'Seneca V' },
  'SR20': { kt: 155, name: 'Cirrus SR20' },
  'SR22': { kt: 185, name: 'Cirrus SR22' },
  'C172': { kt: 122, name: 'Cessna 172' },
  'C182': { kt: 145, name: 'Cessna 182' },
  'C206': { kt: 150, name: 'Cessna 206' },
  'C208': { kt: 175, name: 'Cessna Caravan' },
  'BE58': { kt: 200, name: 'Baron 58' },
  'BE36': { kt: 175, name: 'Bonanza' },
  'PA-28-235': { kt: 130, name: 'Cherokee 235' },
  'EMB-712': { kt: 125, name: 'Tupi' },
  'EMB-711ST': { kt: 165, name: 'Corisco Turbo' },
  'EMB-820C': { kt: 185, name: 'Navajo' },
};

const DEFAULT_SPEED = 150;

/**
 * Busca a velocidade de cruzeiro para o modelo da aeronave
 * Faz match parcial se não encontrar o exato
 */
export function getAircraftSpeed(model: string): number {
  if (!model) return DEFAULT_SPEED;

  const upperModel = model.toUpperCase().trim();

  // Match exato
  for (const [key, val] of Object.entries(AIRCRAFT_SPEEDS)) {
    if (key.toUpperCase() === upperModel) return val.kt;
  }

  // Match parcial - modelo contido na chave ou vice-versa
  for (const [key, val] of Object.entries(AIRCRAFT_SPEEDS)) {
    if (upperModel.includes(key.toUpperCase()) || key.toUpperCase().includes(upperModel)) {
      return val.kt;
    }
  }

  return DEFAULT_SPEED;
}

export const knotsToKmh = (kt: number) => Math.round(kt * 1.852);
