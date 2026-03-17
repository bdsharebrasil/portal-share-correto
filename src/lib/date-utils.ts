import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data em formato ISO (YYYY-MM-DD) ou ISO datetime para pt-BR
 * Trata corretamente o problema de timezone do JavaScript
 * Também aceita formato DD/MM/YYYY
 */
export const formatDateToBR = (dateStr?: string | null): string => {
  if (!dateStr) return 'N/A';

  try {
    // Se for apenas data (YYYY-MM-DD), parseia como data local
    if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Cria data em timezone local, não UTC
      const date = new Date(year, month - 1, day);
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    }

    // Se for formato DD/MM/YYYY, converte para Date
    if (dateStr.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    }

    // Para datetime ISO, parse direto
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error('Erro ao formatar data: data inválida', dateStr);
      return 'Data inválida';
    }
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', dateStr, error);
    return 'Data inválida';
  }
};

/**
 * Calcula a idade baseada na data de nascimento
 * Aceita formatos: YYYY-MM-DD (ISO), DD/MM/YYYY ou ISO datetime
 */
export const calculateAge = (birthDateStr?: string | null): number | null => {
  if (!birthDateStr) return null;

  try {
    let birthDate: Date;

    // Se for apenas data (YYYY-MM-DD)
    if (birthDateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
      const [year, month, day] = birthDateStr.split('-').map(Number);
      birthDate = new Date(year, month - 1, day);
    }
    // Se for formato DD/MM/YYYY
    else if (birthDateStr.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(birthDateStr)) {
      const [day, month, year] = birthDateStr.split('/').map(Number);
      birthDate = new Date(year, month - 1, day);
    }
    // Para datetime ISO
    else {
      birthDate = new Date(birthDateStr);
    }

    // Validar se a data é válida
    if (isNaN(birthDate.getTime())) {
      console.error('Erro ao calcular idade: data inválida', birthDateStr);
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  } catch (error) {
    console.error('Erro ao calcular idade:', birthDateStr, error);
    return null;
  }
};

/**
 * Formata data de nascimento com idade
 */
export const formatBirthDateWithAge = (birthDateStr?: string | null): string => {
  if (!birthDateStr) return 'N/A';

  const formattedDate = formatDateToBR(birthDateStr);
  const age = calculateAge(birthDateStr);

  if (age === null) return formattedDate;
  return `${formattedDate} (${age} anos)`;
};

/**
 * Retorna apenas o mês abreviado em português
 * Aceita formatos: YYYY-MM-DD (ISO), DD/MM/YYYY ou ISO datetime
 */
export const formatMonthShort = (dateStr?: string | null): string => {
  if (!dateStr) return '';

  try {
    let date: Date;

    // Se for apenas data (YYYY-MM-DD)
    if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, 1);
    }
    // Se for formato DD/MM/YYYY
    else if (dateStr.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/').map(Number);
      date = new Date(year, month - 1, day);
    }
    // Para datetime ISO
    else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) {
      console.error('Erro ao formatar mês: data inválida', dateStr);
      return '';
    }

    return format(date, 'MMM', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar mês:', dateStr, error);
    return '';
  }
};

/**
 * Parse a date-only string (YYYY-MM-DD) without timezone shift.
 * new Date("2026-03-01") → UTC midnight → Feb 28 in Brazil.
 * This creates a local date object to avoid timezone rollback.
 */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // If it's a date-only string (YYYY-MM-DD), parse as local
  if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Otherwise parse as-is
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
