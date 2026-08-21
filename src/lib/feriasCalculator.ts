/**
 * Tabela progressiva do INSS de 2026 informada para o módulo de folha.
 * O abono pecuniário e o respectivo terço não entram na base do INSS/IRRF.
 */
const FAIXAS_INSS_2026 = [
  { ate: 1621.0, aliquota: 0.075 },
  { ate: 2902.84, aliquota: 0.09 },
  { ate: 4354.27, aliquota: 0.12 },
  { ate: Number.POSITIVE_INFINITY, aliquota: 0.14 },
] as const;

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** Calcula o INSS por faixas marginais, conforme a tabela fornecida pelo usuário. */
export function calcularINSS(salarioContribuicao: number): number {
  const base = Math.max(0, Number(salarioContribuicao) || 0);
  let anterior = 0;
  let total = 0;

  for (const faixa of FAIXAS_INSS_2026) {
    const parcela = Math.max(0, Math.min(base, faixa.ate) - anterior);
    total += parcela * faixa.aliquota;
    anterior = faixa.ate;
    if (base <= faixa.ate) break;
  }

  return arredondar(total);
}

/** A regra recebida estabelece isenção até R$ 5.000,00 em 2026. */
export function calcularIRRFSimplificado(baseCalculo: number): number {
  return Math.max(0, Number(baseCalculo) || 0) <= 5000 ? 0 : 0;
}

export interface CalculoFeriasInput {
  salarioBase: number;
  diasGozo: number;
  diasVendidos?: number;
  descontarAdiantamento?: number;
}

export interface CalculoFeriasResultado {
  valorDia: number;
  diaria: number;
  valorDiasGozo: number;
  tercoGozo: number;
  valorAbono: number;
  tercoAbono: number;
  brutoTributavel: number;
  baseInss: number;
  brutoTotal: number;
  descontoInss: number;
  descontoIrrf: number;
  liquido: number;
}

export function calcularValorFerias({
  salarioBase,
  diasGozo,
  diasVendidos = 0,
  descontarAdiantamento = 0,
}: CalculoFeriasInput): CalculoFeriasResultado {
  const salario = Math.max(0, Number(salarioBase) || 0);
  const valorDia = salario / 30;
  const valorDiasGozo = valorDia * Math.max(0, Number(diasGozo) || 0);
  const tercoGozo = valorDiasGozo / 3;

  // Abono pecuniário (dias vendidos) e seu terço são somados, mas não tributados.
  const valorAbono = valorDia * Math.max(0, Number(diasVendidos) || 0);
  const tercoAbono = valorAbono / 3;
  const brutoTributavel = valorDiasGozo + tercoGozo;
  const brutoTotal = brutoTributavel + valorAbono + tercoAbono;
  const descontoInss = calcularINSS(brutoTributavel);
  const descontoIrrf = calcularIRRFSimplificado(brutoTributavel - descontoInss);
  const liquido = Math.max(0, brutoTotal - descontoInss - descontoIrrf - Math.max(0, Number(descontarAdiantamento) || 0));

  return {
    valorDia: arredondar(valorDia),
    diaria: arredondar(valorDia),
    valorDiasGozo: arredondar(valorDiasGozo),
    tercoGozo: arredondar(tercoGozo),
    valorAbono: arredondar(valorAbono),
    tercoAbono: arredondar(tercoAbono),
    brutoTributavel: arredondar(brutoTributavel),
    baseInss: arredondar(brutoTributavel),
    brutoTotal: arredondar(brutoTotal),
    descontoInss,
    descontoIrrf,
    liquido: arredondar(liquido),
  };
}

export const calcularValorFeriasEsperado = calcularValorFerias;
