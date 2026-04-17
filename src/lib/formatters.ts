/**
 * Formata CPF para padrão brasileiro (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string): string {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Remove formatação do CPF
 */
export function unformatCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Formata CNPJ para padrão brasileiro (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/**
 * Remove formatação do CNPJ
 */
export function unformatCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Formata valor monetário para padrão brasileiro (R$ X.XXX,XX)
 */
export function formatMoney(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

/**
 * Formata percentual com 2 casas decimais
 */
export function formatPercentage(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num.toFixed(2)}%`;
}

/**
 * Formata número com casas decimais opcionais
 */
export function num(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return "0";
  const number = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(number)) return "0";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
