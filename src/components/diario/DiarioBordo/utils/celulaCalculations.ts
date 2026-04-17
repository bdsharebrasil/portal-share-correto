/**
 * Celula (aircraft flight hours) calculation utilities
 */

export const calculateCelulaAtual = (entries: any[], celulaAnterior: number): number => {
  if (!entries || entries.length === 0) {
    return celulaAnterior;
  }

  let totalFlightTime = 0;

  for (const entry of entries) {
    const tempo = entry.total_time || entry.tempo_total || 0;
    totalFlightTime += Number(tempo) || 0;
  }

  return celulaAnterior + totalFlightTime;
};

export const calculateCelulaDisponivel = (celulaProxRevisao: number, celulaAtual: number): number => {
  const difference = celulaProxRevisao - celulaAtual;
  return Math.max(0, difference);
};

export const calculateRunningCelula = (basecelula: number, newFlightTime: number): number => {
  return parseFloat((basecelula + newFlightTime).toFixed(1));
};

export const isCelulaWarning = (celulaDisponivel: number, threshold: number = 50): boolean => {
  return celulaDisponivel <= threshold;
};

export const isCelulaAlert = (celulaDisponivel: number): boolean => {
  return celulaDisponivel <= 0;
};
