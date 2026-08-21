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

/**
 * Tabela progressiva mensal do IRRF 2026.
 *
 * A tabela utilizada pela Receita Federal permanece:
 * Até R$ 2.428,80              -> 0%
 * De R$ 2.428,81 a R$ 2.826,65 -> 7,5%
 * De R$ 2.826,66 a R$ 3.751,05 -> 15%
 * De R$ 3.751,06 a R$ 4.664,68 -> 22,5%
 * Acima de R$ 4.664,68         -> 27,5%
 */
const FAIXAS_IRRF_2026 = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  {
    ate: Number.POSITIVE_INFINITY,
    aliquota: 0.275,
    deducao: 908.73,
  },
] as const;

/**
 * Regras da redução mensal do IRRF de 2026.
 */
const REDUCAO_IRRF_2026 = {
  limiteIsencao: 5000,
  limiteReducao: 7350,
  valorFixo: 978.62,
  fator: 0.133145,
} as const;

/**
 * Desconto simplificado mensal de 2026.
 *
 * A Receita Federal informa o limite mensal de R$ 607,20.
 */
const DESCONTO_SIMPLIFICADO_IRRF_2026 = 607.2;

const arredondar = (valor: number) =>
  Math.round((valor + Number.EPSILON) * 100) / 100;

/**
 * Calcula o INSS por faixas marginais, conforme a tabela fornecida pelo usuário.
 */
export function calcularINSS(salarioContribuicao: number): number {
  const base = Math.max(0, Number(salarioContribuicao) || 0);

  let anterior = 0;
  let total = 0;

  for (const faixa of FAIXAS_INSS_2026) {
    const parcela = Math.max(
      0,
      Math.min(base, faixa.ate) - anterior,
    );

    total += parcela * faixa.aliquota;
    anterior = faixa.ate;

    if (base <= faixa.ate) {
      break;
    }
  }

  return arredondar(total);
}

/**
 * Calcula o IRRF pela tabela progressiva mensal de 2026,
 * antes da aplicação da nova redução.
 *
 * @param baseCalculo Base de cálculo após as deduções aplicáveis.
 */
export function calcularIRRFProgressivo2026(
  baseCalculo: number,
): number {
  const base = Math.max(0, Number(baseCalculo) || 0);

  if (base <= 0) {
    return 0;
  }

  for (const faixa of FAIXAS_IRRF_2026) {
    if (base <= faixa.ate) {
      const imposto =
        base * faixa.aliquota - faixa.deducao;

      return arredondar(Math.max(0, imposto));
    }
  }

  return 0;
}

/**
 * Calcula a redução do IRRF mensal de 2026.
 *
 * A regra oficial é:
 *
 * Até R$ 5.000,00:
 *   redução suficiente para zerar o imposto.
 *
 * De R$ 5.000,01 a R$ 7.350,00:
 *   redução = 978,62 - (0,133145 × rendimento tributável)
 *
 * Acima de R$ 7.350,00:
 *   sem redução.
 *
 * A redução nunca pode ultrapassar o imposto calculado.
 */
export function calcularReducaoIRRF2026(
  rendimentoTributavel: number,
  impostoCalculado: number,
): number {
  const rendimento = Math.max(
    0,
    Number(rendimentoTributavel) || 0,
  );

  const imposto = Math.max(
    0,
    Number(impostoCalculado) || 0,
  );

  if (imposto <= 0) {
    return 0;
  }

  /**
   * Até R$ 5.000:
   * o imposto deve resultar em zero.
   */
  if (
    rendimento <= REDUCAO_IRRF_2026.limiteIsencao
  ) {
    return arredondar(imposto);
  }

  /**
   * Entre R$ 5.000,01 e R$ 7.350:
   * redução linear.
   */
  if (
    rendimento <= REDUCAO_IRRF_2026.limiteReducao
  ) {
    const reducao =
      REDUCAO_IRRF_2026.valorFixo -
      REDUCAO_IRRF_2026.fator * rendimento;

    return arredondar(
      Math.min(
        imposto,
        Math.max(0, reducao),
      ),
    );
  }

  /**
   * Acima de R$ 7.350:
   * não existe redução.
   */
  return 0;
}

/**
 * Calcula o IRRF de 2026.
 *
 * rendimentoTributavel:
 *   valor dos rendimentos tributáveis sujeitos à
 *   incidência mensal.
 *
 * baseCalculo:
 *   base efetivamente usada na tabela progressiva,
 *   depois das deduções permitidas.
 */
export function calcularIRRFSimplificado(
  rendimentoTributavel: number,
  baseCalculo: number,
): number {
  const rendimento = Math.max(
    0,
    Number(rendimentoTributavel) || 0,
  );

  const base = Math.max(
    0,
    Number(baseCalculo) || 0,
  );

  /**
   * Calcula primeiro o IR pela tabela progressiva.
   */
  const impostoCalculado =
    calcularIRRFProgressivo2026(base);

  /**
   * Depois aplica a redução de 2026 utilizando
   * o rendimento tributável, e não a base já deduzida.
   */
  const reducao = calcularReducaoIRRF2026(
    rendimento,
    impostoCalculado,
  );

  return arredondar(
    Math.max(
      0,
      impostoCalculado - reducao,
    ),
  );
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
  const salario = Math.max(
    0,
    Number(salarioBase) || 0,
  );

  const valorDia = salario / 30;

  const valorDiasGozo =
    valorDia *
    Math.max(0, Number(diasGozo) || 0);

  const tercoGozo = valorDiasGozo / 3;

  /**
   * Abono pecuniário e seu terço são somados ao valor total,
   * mas não entram na base tributável conforme a regra adotada
   * pelo módulo.
   */
  const valorAbono =
    valorDia *
    Math.max(0, Number(diasVendidos) || 0);

  const tercoAbono = valorAbono / 3;

  /**
   * Somente os dias de gozo + 1/3 entram na base tributável.
   */
  const brutoTributavel =
    valorDiasGozo + tercoGozo;

  const brutoTotal =
    brutoTributavel +
    valorAbono +
    tercoAbono;

  /**
   * INSS calculado somente sobre a parcela tributável.
   */
  const descontoInss =
    calcularINSS(brutoTributavel);

  /**
   * Base do IRRF após o INSS e o desconto simplificado mensal.
   * Como este calculador não recebe dependentes, pensão ou outras
   * deduções legais, o desconto simplificado de R$ 607,20 é a dedução
   * aplicável nesta simulação, conforme a tabela oficial de 2026.
   */
  const baseCalculoIRRF = Math.max(
    0,
    brutoTributavel - descontoInss - DESCONTO_SIMPLIFICADO_IRRF_2026,
  );

  /**
   * A redução usa o rendimento tributável mensal do colaborador.
   * Neste fluxo, o salário-base representa esse rendimento mensal;
   * a tabela progressiva continua usando a base das férias após INSS
   * e desconto simplificado.
   */
  const descontoIrrf =
    calcularIRRFSimplificado(
      salario,
      baseCalculoIRRF,
    );

  const liquido = Math.max(
    0,
    brutoTotal -
      descontoInss -
      descontoIrrf -
      Math.max(
        0,
        Number(descontarAdiantamento) || 0,
      ),
  );

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

export const calcularValorFeriasEsperado =
  calcularValorFerias;
