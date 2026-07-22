/**
 * Validação de regras de restrição do schema de lancamentos_diario_bordo
 * Baseado em CHECK constraints do PostgreSQL
 */

/**
 * Valores permitidos para natureza_voo
 * CHECK constraint: natureza_voo = ANY (ARRAY[...])
 */
export const ALLOWED_FLIGHT_NATURES = [
  'AE - Aérea/Regular',
  'CQ - Cheque',
  'EX - Executivo',
  'NR - Não Remunerado',
  'RE - Retorno/Reposição',
  'PV - Privado',
  'SA - Serviço Aéreo',
  'TN - Transporte Não Regular/Táxi Aéreo',
  'TR - Traslado',
  'VOO TESTE',
  'EP',
] as const;

export type FlightNature = typeof ALLOWED_FLIGHT_NATURES[number];

/**
 * Valores permitidos para origem_pic
 * CHECK constraint: origem_pic = ANY (ARRAY['tripulacao'::text, 'crew'::text, 'membros_tripulacao'::text])
 */
export const ALLOWED_PIC_SOURCES = ['tripulacao', 'crew', 'membros_tripulacao'] as const;
export type PICSource = typeof ALLOWED_PIC_SOURCES[number];

/**
 * Valores permitidos para origem_sic
 * CHECK constraint: origem_sic = ANY (ARRAY['tripulacao'::text, 'crew'::text, 'membros_tripulacao'::text])
 */
export const ALLOWED_SIC_SOURCES = ['tripulacao', 'crew', 'membros_tripulacao'] as const;
export type SICSource = typeof ALLOWED_SIC_SOURCES[number];

/**
 * Validar se a natureza de voo é válida
 */
export function isValidFlightNature(value: string | null | undefined): value is FlightNature {
  if (!value) return false;
  return ALLOWED_FLIGHT_NATURES.includes(value as any);
}

/**
 * Validar se a origem do PIC é válida
 */
export function isValidPICSource(value: string | null | undefined): value is PICSource {
  if (!value) return false;
  return ALLOWED_PIC_SOURCES.includes(value as any);
}

/**
 * Validar se a origem do SIC é válida
 */
export function isValidSICSource(value: string | null | undefined): value is SICSource {
  if (!value) return false;
  return ALLOWED_SIC_SOURCES.includes(value as any);
}

/**
 * Validar entrada de SIC
 * CHECK constraint: 
 *   (sic_canac IS NULL AND sic_name IS NULL)
 *   OR (sic_canac IS NOT NULL)
 *   OR (sic_name IS NOT NULL AND length(TRIM(sic_name)) > 0)
 */
export function isValidSICEntry(
  sicCanac: string | null | undefined,
  sicName: string | null | undefined
): boolean {
  // Caso 1: Ambos nulos (permitido)
  if (!sicCanac && !sicName) {
    return true;
  }

  // Caso 2: sicCanac preenchido (permitido)
  if (sicCanac) {
    return true;
  }

  // Caso 3: sicName preenchido e não vazio (permitido)
  if (sicName && sicName.trim().length > 0) {
    return true;
  }

  // Qualquer outro caso é inválido
  return false;
}

/**
 * Validar compartilhamento de célula
 * Quando divisao_igual = true, a célula deve ser rateada
 */
export function validateCellDistribution(
  divisaoIgual: boolean,
  celulaValor: number | null | undefined
): boolean {
  if (!divisaoIgual) {
    // Se não é divisão igual, célula pode ser qualquer valor
    return true;
  }

  // Se é divisão igual, célula não deve ser nula
  return celulaValor !== null && celulaValor !== undefined && celulaValor > 0;
}

/**
 * Validar CPF
 * Função auxiliar para validação de sócios
 */
export function isValidCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const cleanCPF = cpf.replace(/[^0-9]/g, '');
  // Schema exige exatamente 11 dígitos
  return cleanCPF.length === 11;
}
