export type TravelReportOpen = {
  id: string;
  saldo: number;
  numero_relatorio?: string | null;
  numero_voo?: string | null;
  rota?: string | null;
};

export function getSelectedTravelAllocation(
  relatorios: TravelReportOpen[],
  selectedId: string | null | undefined,
  valorTotal: number,
) {
  if (valorTotal <= 0 || relatorios.length === 0) {
    return {
      alocacoes: [],
      totalAlocado: 0,
      sobra: Number(valorTotal.toFixed(2)),
      selected: null,
      reason: "Nenhum relatório disponível para abatimento.",
    };
  }

  const selected = selectedId ? relatorios.find((relatorio) => relatorio.id === selectedId) ?? null : null;

  if (!selected) {
    return {
      alocacoes: [],
      totalAlocado: 0,
      sobra: Number(valorTotal.toFixed(2)),
      selected: null,
      reason: "Selecione o relatório de viagem para confirmar o abatimento.",
    };
  }

  const alocado = Number(Math.min(valorTotal, selected.saldo).toFixed(2));

  return {
    alocacoes: [{ ...selected, alocado }],
    totalAlocado: alocado,
    sobra: Number((valorTotal - alocado).toFixed(2)),
    selected,
    reason: null,
  };
}