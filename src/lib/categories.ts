export const CATEGORIAS = [
  "Receita de Serviço",
  "Receita de Aluguel",
  "Receita de Consultoria",
  "Despesa de Funcionário",
  "Despesa de Manutenção",
  "Despesa de Combustível",
  "Despesa de Seguros",
  "Despesa de Serviços",
  "Despesa de Aluguel",
  "Despesa de Utilidades",
  "Despesa de Impostos",
  "Salário",
  "Pagamento de Salário",
  "13º Salário",
  "Férias",
  "Transferência Interna",
  "Outra Despesa",
  "Outro"
];

export const CATEGORIAS_RECEITA = CATEGORIAS.filter(cat => cat.includes("Receita"));
export const CATEGORIAS_DESPESA = CATEGORIAS.filter(cat => cat.includes("Despesa") || cat === "Salário" || cat === "Pagamento de Salário" || cat === "13º Salário" || cat === "Férias" || cat === "Transferência Interna" || cat === "Outro" || cat === "Outra Despesa");
