/**
 * Tabela de contribuição do INSS (empregado) vigente em 2026.
 * Fonte: reajuste divulgado em 01/2026 (Portaria Interministerial MPS/MF).
 * A 4ª faixa (14%) não foi confirmada com a dedução oficial nesta consulta —
 * revise antes de usar para salários acima de R$ 4.354,27. Para a folha atual
 * da Share Brasil (salários ~R$1.500–1.700) isso não é usado.
 */
const FAIXAS_INSS_2026 = [
  { ate: 1621.0, aliquota: 0.075, deducao: 0 },
  { ate: 2902.84, aliquota: 0.09, deducao: 23.66 },
  { ate: 4354.27, aliquota: 0.12, deducao: 110.75 },
  { ate: Infinity, aliquota: 0.14, deducao: 197.84 }, // confirmar oficialmente
];

export function calcularINSS(salarioContribuicao: number): number {
  if (salarioContribuicao <= 0) return 0;
  const faixa = FAIXAS_INSS_2026.find((f) => salarioContribuicao <= f.ate) ?? FAIXAS_INSS_2026.at(-1)!;
  const valor = salarioContribuicao * faixa.aliquota - faixa.deducao;
  return Math.max(0, Number(valor.toFixed(2)));
}

/**
 * IRRF simplificado — isenção até R$ 5.000/mês pela reforma vigente desde
 * jan/2026. Acima disso, os valores precisam ser conferidos na tabela oficial
 * (não incluída aqui por não ser necessária para a folha atual).
 */
export function calcularIRRFSimplificado(baseCalculo: number): number {
  if (baseCalculo <= 5000) return 0;
  return 0; // placeholder — implemente a faixa real se algum salário passar de 5k
}

export interface CalculoFeriasInput {
  salarioBase: number;
  diasGozo: number;
  diasVendidos?: number;
  descontarAdiantamento?: number;
}

export interface CalculoFeriasResultado {
  valorDia: number;
  valorDiasGozo: number;
  tercoGozo: number;
  valorAbono: number;
  tercoAbono: number;
  brutoTributavel: number;
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
  const valorDia = salarioBase / 30;
  const valorDiasGozo = valorDia * diasGozo;
  const tercoGozo = valorDiasGozo / 3;

  // Abono pecuniário (dias vendidos) é isento de INSS e IRRF
  const valorAbono = valorDia * diasVendidos;
  const tercoAbono = valorAbono / 3;

  const brutoTributavel = valorDiasGozo + tercoGozo;
  const brutoTotal = brutoTributavel + valorAbono + tercoAbono;

  const descontoInss = calcularINSS(brutoTributavel);
  const descontoIrrf = calcularIRRFSimplificado(brutoTributavel - descontoInss);

  const liquido = brutoTotal - descontoInss - descontoIrrf - descontarAdiantamento;

  return {
    valorDia: Number(valorDia.toFixed(2)),
    valorDiasGozo: Number(valorDiasGozo.toFixed(2)),
    tercoGozo: Number(tercoGozo.toFixed(2)),
    valorAbono: Number(valorAbono.toFixed(2)),
    tercoAbono: Number(tercoAbono.toFixed(2)),
    brutoTributavel: Number(brutoTributavel.toFixed(2)),
    brutoTotal: Number(brutoTotal.toFixed(2)),
    descontoInss,
    descontoIrrf,
    liquido: Number(liquido.toFixed(2)),
  };
}
