import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data em formato ISO (YYYY-MM-DD) ou ISO datetime para pt-BR
 * Trata corretamente o problema de timezone do JavaScript
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
    
    // Para datetime ISO, parse direto
    const date = new Date(dateStr);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', dateStr, error);
    return 'Data inválida';
  }
};

/**
 * Calcula a idade baseada na data de nascimento
 */
export const calculateAge = (birthDateStr?: string | null): number | null => {
  if (!birthDateStr) return null;
  
  try {
    // Se for apenas data (YYYY-MM-DD)
    if (birthDateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
      const [year, month, day] = birthDateStr.split('-').map(Number);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    }
    
    // Para datetime ISO
    const birthDate = new Date(birthDateStr);
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
 */
export const formatMonthShort = (dateStr?: string | null): string => {
  if (!dateStr) return '';

  try {
    // Se for apenas data (YYYY-MM-DD)
    if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return format(date, 'MMM', { locale: ptBR });
    }

    const date = new Date(dateStr);
    return format(date, 'MMM', { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar mês:', dateStr, error);
    return '';
  }
};
