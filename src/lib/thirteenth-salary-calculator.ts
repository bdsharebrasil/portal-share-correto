/**
 * Calculadora de Décimo Terceiro Salário - Legislação Brasileira
 * 
 * Regras:
 * 1. Fórmula: (Salário Bruto ÷ 12) × Número de meses trabalhados
 * 2. Cada mês com pelo menos 15 dias trabalhados = 1 avo (1/12)
 * 3. Para salários variáveis: calcular a média dos últimos 12 meses ou período trabalhado
 * 4. Valor líquido: subtrair INSS e Imposto de Renda do valor bruto
 */

export interface ThirteenthCalculationResult {
  grossValue: number;
  inssDiscount: number;
  irDiscount: number;
  netValue: number;
}

/**
 * Calcula o desconto de INSS baseado no salário bruto
 * Alíquota progressiva: 8% a 11% conforme o valor
 */
export function calculateINSSDiscount(salaryBruto: number): number {
  // Limites da tabela INSS (valores aproximados para exemplo)
  // Estes valores devem ser atualizados conforme a tabela oficial
  if (salaryBruto <= 1412.00) {
    return salaryBruto * 0.075;
  } else if (salaryBruto <= 2666.68) {
    return salaryBruto * 0.09;
  } else if (salaryBruto <= 4000.03) {
    return salaryBruto * 0.12;
  } else {
    // Teto de contribuição
    return 4000.03 * 0.12;
  }
}

/**
 * Calcula o desconto de Imposto de Renda (IR) sobre o 13º salário
 * A segunda parcela pode ter IR descontado conforme legislação
 * Alíquota aproximada: 19% para 13º salário
 */
export function calculateIRDiscount(salaryBruto: number): number {
  // Tabela progressiva do IR (valores aproximados)
  // Para fins de cálculo simplificado, usaremos 19% de alíquota média
  if (salaryBruto <= 1903.98) {
    return 0;
  } else if (salaryBruto <= 2826.65) {
    return (salaryBruto - 1903.98) * 0.075;
  } else if (salaryBruto <= 3751.05) {
    return (2826.65 - 1903.98) * 0.075 + (salaryBruto - 2826.65) * 0.15;
  } else if (salaryBruto <= 4664.68) {
    return (2826.65 - 1903.98) * 0.075 + 
           (3751.05 - 2826.65) * 0.15 + 
           (salaryBruto - 3751.05) * 0.225;
  } else {
    return (2826.65 - 1903.98) * 0.075 + 
           (3751.05 - 2826.65) * 0.15 + 
           (4664.68 - 3751.05) * 0.225 + 
           (salaryBruto - 4664.68) * 0.275;
  }
}

/**
 * Calcula o 13º salário completo conforme legislação brasileira
 * 
 * @param baseSalary - Salário bruto mensal do funcionário
 * @param workedMonths - Número de meses trabalhados (1-12)
 * @param averageSalary - Salário médio para casos de variação (opcional)
 * @returns Objeto com valores bruto, descontos (INSS e IR) e líquido
 */
export function calculateThirteenthSalary(
  baseSalary: number,
  workedMonths: number = 12,
  averageSalary?: number
): ThirteenthCalculationResult {
  // Validação de entrada
  if (workedMonths < 1 || workedMonths > 12) {
    throw new Error("Meses trabalhados deve estar entre 1 e 12");
  }

  if (baseSalary < 0) {
    throw new Error("Salário não pode ser negativo");
  }

  // Usar salário médio se fornecido, senão usar salário base
  const salaryForCalculation = averageSalary || baseSalary;

  // Fórmula: (Salário Bruto ÷ 12) × Meses Trabalhados
  const monthlyAvo = salaryForCalculation / 12;
  const grossValue = monthlyAvo * workedMonths;

  // Calcular descontos
  const inssDiscount = calculateINSSDiscount(grossValue);
  const irDiscount = calculateIRDiscount(grossValue);

  // Valor líquido
  const netValue = grossValue - inssDiscount - irDiscount;

  return {
    grossValue: Math.round(grossValue * 100) / 100,
    inssDiscount: Math.round(inssDiscount * 100) / 100,
    irDiscount: Math.round(irDiscount * 100) / 100,
    netValue: Math.round(netValue * 100) / 100,
  };
}

/**
 * Calcula o valor de cada parcela do 13º salário
 * 1ª Parcela: 50% do valor bruto (sem descontos)
 * 2ª Parcela: 50% do valor bruto com descontos de INSS e IR
 * 
 * @param calculation - Resultado do cálculo do 13º salário
 * @returns Objeto com valores das duas parcelas
 */
export function calculateInstallments(calculation: ThirteenthCalculationResult) {
  const firstInstallment = calculation.grossValue * 0.5;
  
  // Segunda parcela recebe o valor proporcional dos descontos
  const totalDiscounts = calculation.inssDiscount + calculation.irDiscount;
  const discountPercentage = calculation.grossValue > 0 
    ? totalDiscounts / calculation.grossValue 
    : 0;
  
  const secondInstallmentGross = calculation.grossValue * 0.5;
  const secondInstallmentDiscounts = secondInstallmentGross * discountPercentage;
  const secondInstallment = secondInstallmentGross - secondInstallmentDiscounts;

  return {
    firstInstallmentGross: Math.round(firstInstallment * 100) / 100,
    secondInstallmentGross: Math.round(secondInstallmentGross * 100) / 100,
    secondInstallmentNet: Math.round(secondInstallment * 100) / 100,
  };
}

/**
 * Calcula a média salarial para salários variáveis
 * Usado em casos de salários com comissão, horas extras variáveis, etc.
 * 
 * @param monthlySalaries - Array com salários dos últimos 12 meses
 * @returns Salário médio
 */
export function calculateAverageSalary(monthlySalaries: number[]): number {
  if (monthlySalaries.length === 0) {
    return 0;
  }

  const sum = monthlySalaries.reduce((acc, salary) => acc + salary, 0);
  return sum / monthlySalaries.length;
}

/**
 * Valida se um mês deve ser contado no cálculo (mínimo 15 dias)
 * 
 * @param daysWorked - Número de dias trabalhados no mês
 * @returns true se deve contar como 1 avo (1/12)
 */
export function isMonthCountable(daysWorked: number): boolean {
  return daysWorked >= 15;
}
