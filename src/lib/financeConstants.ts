export const FinancePayorType = {
  COMPANY: "EMPRESA" as const,
  CLIENT: "CLIENTE" as const,
  PARTNER: "SOCIO" as const,
  THIRD_PARTY: "TERCEIRO_CUSTO" as const,
  UNKNOWN: "OUTRO" as const,
};

export type FinancePayorType = typeof FinancePayorType[keyof typeof FinancePayorType];

export const FinanceMovementGroup = {
  FIXO: "FIXO" as const,
  VARIAVEL: "VARIAVEL" as const,
  EXTRA: "EXTRA" as const,
  REEMBOLSOS: "REEMBOLSOS" as const,
};

export const FinanceCategoryName = {
  PARTNER_DEPOSIT: "Depósito de Sócio" as const,
  PARTNER_INTEREST: "Rendimento Bancário" as const,
  PARTNER_PAYMENT: "Pagamento de Despesa Sócio" as const,
  PARTNER_FUEL: "Abastecimento" as const,
  REEMBOLSO_RATEIO: "REEMBOLSO RATEIO COTISTA" as const,
  TRAVEL_REPORT: "Relatório de Viagem" as const,
  TRAVEL_REPORT_REIMBURSEMENT: "Reembolso Relatório de Viagem" as const,
};
