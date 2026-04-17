/**
 * Date utility functions for flight operations
 */
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
  return !isNaN(date.getTime());
};

export const formatDateFromISO = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    return '';
  }
};

export const formatTimeFromTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return format(date, 'HH:mm', { locale: ptBR });
  } catch (e) {
    return '';
  }
};

export const getMonthName = (month: number): string => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[Math.max(0, Math.min(11, month - 1))];
};

export const getFirstDayOfMonth = (month: number, year: number): Date => {
  const date = new Date(year, month - 1, 1);
  if (isNaN(date.getTime())) {
    return new Date();
  }
  return date;
};

export const getLastDayOfMonth = (month: number, year: number): Date => {
  const date = new Date(year, month, 0);
  if (isNaN(date.getTime())) {
    return new Date();
  }
  return date;
};

export const formatDateForInput = (date: Date | string): string => {
  try {
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    if (isNaN(dateObj.getTime())) return '';
    return format(dateObj, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
};

export const getPreviousMonth = (month: number, year: number): { month: number; year: number } => {
  if (month === 1) {
    return { month: 12, year: year - 1 };
  }
  return { month: month - 1, year };
};

export const getNextMonth = (month: number, year: number): { month: number; year: number } => {
  if (month === 12) {
    return { month: 1, year: year + 1 };
  }
  return { month: month + 1, year };
};
