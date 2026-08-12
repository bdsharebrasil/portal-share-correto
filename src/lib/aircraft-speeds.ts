/**
 * Helpers de velocidade de cruzeiro e altitude sugerida para o plano de voo.
 *
 * A fonte de verdade da velocidade de cruzeiro por aeronave é a tabela
 * performance_aeronave.velocidade_cruzeiro_kt (Supabase), vinculada via
 * aeronaves.performance_aeronave_id. Este arquivo não guarda mais uma
 * tabela hardcoded por matrícula — isso evitava que trocar a aeronave de
 * uma matrícula, ou cadastrar uma nova, exigisse editar código.
 */

// Formata nós para o speed code ICAO (ex: 150 -> "N0150")
export function formatSpeedCode(knots: number | null | undefined): string {
  const kt = knots ?? 150; // 150kt como fallback se a aeronave ainda não tiver velocidade cadastrada
  return `N${kt.toString().padStart(4, '0')}`;
}

export function getSuggestedSpeed(knots: number | null | undefined): number {
  return knots ?? 150;
}

// Calcula autonomia mínima (RBAC 91): VFR dia = 30min, VFR noite/IFR = 45min + 10% contingência
export function calculateMinimumEndurance(
  estimatedTimeMinutes: number,
  isIFR: boolean = true,
  isNight: boolean = false
): string {
  let reserveMinutes: number;
  if (isIFR) reserveMinutes = 45;
  else if (isNight) reserveMinutes = 45;
  else reserveMinutes = 30;

  const contingency = Math.ceil(estimatedTimeMinutes * 0.1);
  const totalMinutes = estimatedTimeMinutes + contingency + reserveMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
}
