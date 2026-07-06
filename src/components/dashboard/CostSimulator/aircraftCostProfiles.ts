/**
 * aircraftCostProfiles.ts
 *
 * Sistema de classificação e cálculo de custos por TIPO de aeronave
 * (Pistão / Turbo-hélice / Jato) para o Simulador de Custos da Share Brasil.
 *
 * Resolve o problema de somar campos de longo prazo que não se aplicam a
 * todo tipo de motorização (ex.: jato não tem hélice; motor a turbina não
 * usa magneto; seção quente só existe em motor a turbina).
 */

export type TipoAeronave = 'PISTAO' | 'TURBOELICE' | 'JATO';

export const TIPOS_AERONAVE: TipoAeronave[] = ['PISTAO', 'TURBOELICE', 'JATO'];

export const TIPO_AERONAVE_LABELS: Record<TipoAeronave, string> = {
  PISTAO: 'Pistão',
  TURBOELICE: 'Turbo-hélice',
  JATO: 'Jato',
};

/**
 * Performance padrão por tipo — usada apenas como estimativa inicial
 * quando ainda não há dados reais de abastecimento para a aeronave.
 * Valores ilustrativos por categoria, não específicos de modelo.
 */
export const PERFORMANCE_PADRAO: Record<
  TipoAeronave,
  { fuelPerHour: number; cruiseSpeedKmH: number }
> = {
  PISTAO: { fuelPerHour: 45, cruiseSpeedKmH: 280 },
  TURBOELICE: { fuelPerHour: 280, cruiseSpeedKmH: 480 },
  JATO: { fuelPerHour: 620, cruiseSpeedKmH: 750 },
};

export type PrazoCusto = 'curto' | 'medio' | 'longo';

export interface CampoCustoConfig {
  /** Chave correspondente ao campo em FormData */
  id: string;
  label: string;
  prazo: PrazoCusto;
  /** Quais tipos de aeronave usam esse campo no cálculo */
  tiposAplicaveis: TipoAeronave[];
}

export const CAMPOS_CUSTO: CampoCustoConfig[] = [
  // ---- Curto prazo: aplicável a qualquer tipo ----
  { id: 'fuelCost', label: 'Combustível (viagem)', prazo: 'curto', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'pilotDailyRate', label: 'Diária de piloto', prazo: 'curto', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'hotelMealCost', label: 'Hotel/Alimentação', prazo: 'curto', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'landingTaxes', label: 'Taxas de pouso', prazo: 'curto', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'hangarageOutside', label: 'Hangaragem fora da base', prazo: 'curto', tiposAplicaveis: [...TIPOS_AERONAVE] },

  // ---- Médio prazo: aplicável a qualquer tipo ----
  { id: 'fixedHangarage', label: 'Hangaragem fixa', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'crewSalary', label: 'Salário tripulação', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'navigationUpdates', label: 'Atualizações de navegação', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'preventiveMaintenance', label: 'Manutenção preventiva', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'maintenancePerHour', label: 'Manutenção/hora', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'insurance', label: 'Seguro', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'radioTaxes', label: 'Taxas de rádio', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'trainingExams', label: 'Treinamentos/exames', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },
  { id: 'otherCosts', label: 'Outros custos', prazo: 'medio', tiposAplicaveis: [...TIPOS_AERONAVE] },

  // ---- Longo prazo: AQUI a aplicabilidade muda por tipo ----
  {
    id: 'engineOverhaul',
    label: 'Reserva de motor (overhaul)',
    prazo: 'longo',
    tiposAplicaveis: ['PISTAO', 'TURBOELICE', 'JATO'],
  },
  {
    id: 'propellerOverhaul',
    label: 'Reserva de hélice',
    prazo: 'longo',
    tiposAplicaveis: ['PISTAO', 'TURBOELICE'], // jato não tem hélice
  },
  {
    id: 'magnetoOverhaul',
    label: 'Revisão de magneto',
    prazo: 'longo',
    tiposAplicaveis: ['PISTAO'], // só motor a pistão convencional usa magneto
  },
  {
    id: 'turboOverhaul',
    label: 'Seção quente (hot section)',
    prazo: 'longo',
    tiposAplicaveis: ['TURBOELICE', 'JATO'], // exclusivo de motor a turbina
  },
  {
    id: 'alternatorOverhaul',
    label: 'Reserva de alternador/gerador',
    prazo: 'longo',
    tiposAplicaveis: ['PISTAO', 'TURBOELICE', 'JATO'],
  },
  {
    id: 'sixYearMaintenance',
    label: 'Manutenção calendário (6 anos)',
    prazo: 'longo',
    tiposAplicaveis: ['PISTAO', 'TURBOELICE', 'JATO'],
  },
];

export function getCamposPorTipo(tipo: TipoAeronave, prazo?: PrazoCusto): CampoCustoConfig[] {
  return CAMPOS_CUSTO.filter(
    (c) => c.tiposAplicaveis.includes(tipo) && (!prazo || c.prazo === prazo)
  );
}

export function isCampoAplicavel(campoId: string, tipo: TipoAeronave): boolean {
  const campo = CAMPOS_CUSTO.find((c) => c.id === campoId);
  // Fail-safe: se o campo não está mapeado, assume aplicável para não zerar
  // custos reais por engano por falta de configuração.
  return campo ? campo.tiposAplicaveis.includes(tipo) : true;
}

// ---------------------------------------------------------------------
// Sugestão automática de tipo a partir do nome do modelo (apenas um
// ponto de partida — sempre exige confirmação do usuário na UI).
// ---------------------------------------------------------------------

const PALAVRAS_CHAVE_TURBOELICE = [
  'king air', 'tbm', 'pc-12', 'pc12', 'caravan', 'kodiak', 'pilatus',
  'turboprop', 'turbo-hélice', 'turbohelice', 'meridian', 'm600',
];

const PALAVRAS_CHAVE_PISTAO = [
  'cessna 172', 'cessna 182', 'cessna 206', 'baron', 'bonanza', 'piper',
  'seneca', 'cirrus', 'mooney', 'archer', 'saratoga', 'malibu',
];

const PALAVRAS_CHAVE_JATO = [
  'phenom', 'citation', 'learjet', 'gulfstream', 'legacy', 'praetor',
  'hawker', 'falcon', 'challenger', 'global', 'lineage', 'eclipse',
  'honda jet', 'hondajet',
];

/** Sugestão de tipo com base no nome do modelo. Retorna null se não reconhecer. */
export function sugerirTipoAeronave(modelo?: string | null): TipoAeronave | null {
  if (!modelo) return null;
  const m = modelo.toLowerCase();
  if (PALAVRAS_CHAVE_JATO.some((p) => m.includes(p))) return 'JATO';
  if (PALAVRAS_CHAVE_TURBOELICE.some((p) => m.includes(p))) return 'TURBOELICE';
  if (PALAVRAS_CHAVE_PISTAO.some((p) => m.includes(p))) return 'PISTAO';
  return null;
}

// ---------------------------------------------------------------------
// Cálculo de custos ciente do tipo de aeronave
// ---------------------------------------------------------------------

export interface CostData {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  total: number;
  hourlyRate: number;
}

/**
 * Recebe o FormData (qualquer shape com os campos numéricos por id) e o
 * tipo de aeronave, e calcula os custos considerando apenas os campos
 * aplicáveis àquele tipo. Mantém o MESMO shape de retorno (CostData) do
 * simulador original, então CostComparison.tsx e usePdfExport continuam
 * funcionando sem nenhuma alteração.
 */
export function calcularCustosPorTipo(
  formData: Record<string, any>,
  tipo: TipoAeronave
): CostData {
  const valor = (id: string): number => {
    if (!isCampoAplicavel(id, tipo)) return 0;
    return Number(formData[id]) || 0;
  };

  const shortTerm =
    valor('fuelCost') +
    valor('pilotDailyRate') * (Number(formData.journeyDays) || 0) +
    valor('hotelMealCost') +
    valor('landingTaxes') +
    valor('hangarageOutside') * (Number(formData.hangarageOutsideDays) || 0);

  const mediumTerm =
    valor('fixedHangarage') +
    valor('crewSalary') +
    valor('navigationUpdates') +
    valor('preventiveMaintenance') +
    valor('maintenancePerHour') *
      (Number(formData.flightTimeRoundTrip) || 0) *
      (Number(formData.monthlyFlights) || 0) +
    valor('insurance') +
    valor('radioTaxes') +
    valor('trainingExams') +
    valor('otherCosts');

  const longTerm =
    valor('engineOverhaul') +
    valor('propellerOverhaul') +
    valor('magnetoOverhaul') +
    valor('turboOverhaul') +
    valor('alternatorOverhaul') +
    valor('sixYearMaintenance');

  const monthlyFlightHours =
    (Number(formData.flightTimeRoundTrip) || 0) * (Number(formData.monthlyFlights) || 0);
  const total = shortTerm + mediumTerm + longTerm;
  const hourlyRate = monthlyFlightHours > 0 ? total / monthlyFlightHours : 0;

  return { shortTerm, mediumTerm, longTerm, total, hourlyRate };
}
