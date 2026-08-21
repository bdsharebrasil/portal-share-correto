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

export const FinanceCategoryId = {
  TRAVEL_REPORT_EXPENSE: "aeab4560-713a-4ed5-912a-d1df4580e638" as const,
  TRAVEL_REPORT_REIMBURSEMENT: "a7555994-103d-4739-96a5-001c3bec1424" as const,
};

export const FinanceGroupName = {
  CLIENT_CASH: "CAIXA CLIENTE" as const,
  TRAVEL_REIMBURSABLE_EXPENSE: "DESPESAS REEMBOLSÁVEIS" as const,
  REIMBURSEMENT_INCOME: "REEMBOLSOS ENTRADAS" as const,
};

export const FinanceCategoryLabel = {
  TRAVEL_REPORT_EXPENSE: "REEMBOLSO RELATORIO DE DESPESA DE VIAGENS",
  TRAVEL_REPORT_RECEIVED: "REEMBOLSO RELATORIO DE DESPESA DE VIAGENS recebido",
} as const;

export const FinanceCategoryName = {
  PARTNER_DEPOSIT: "Depósito de Sócio" as const,
  PARTNER_INTEREST: "Rendimento Bancário" as const,
  PARTNER_PAYMENT: "Pagamento de Despesa Sócio" as const,
  PARTNER_FUEL: "Abastecimento" as const,
  REEMBOLSO_RATEIO: "REEMBOLSO RATEIO COTISTA" as const,
  TRAVEL_REPORT: "Relatório de Viagem" as const,
  TRAVEL_REPORT_REIMBURSEMENT: "Reembolso Relatório de Viagem" as const,
};
