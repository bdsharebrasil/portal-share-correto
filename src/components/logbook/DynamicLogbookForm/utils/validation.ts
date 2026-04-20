// utils/validation.ts

/**
 * Valida CPF brasileiro
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Todos os dígitos iguais
  
  // Validar dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ brasileiro
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validar primeiro dígito
  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  // Validar segundo dígito
  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
}

/**
 * Valida email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida telefone brasileiro (10 ou 11 dígitos)
 */
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Valida formato de horário HH:MM
 */
export function validateTime(time: string): boolean {
  if (!time) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Valida formato de data DD/MM/YYYY
 */
export function validateDateBR(date: string): boolean {
  if (!date) return false;
  const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/\d{4}$/;
  if (!dateRegex.test(date)) return false;
  
  const [day, month, year] = date.split('/').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
}

/**
 * Valida formato de data YYYY-MM-DD
 */
export function validateDateISO(date: string): boolean {
  if (!date) return false;
  const dateRegex = /^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!dateRegex.test(date)) return false;
  
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
}

/**
 * Valida código ICAO de aeródromo (4 letras)
 */
export function validateICAO(icao: string): boolean {
  if (!icao) return false;
  const icaoRegex = /^[A-Z]{4}$/;
  return icaoRegex.test(icao.toUpperCase());
}

/**
 * Valida CANAC (6 dígitos)
 */
export function validateCANAC(canac: string): boolean {
  const cleaned = canac.replace(/\D/g, "");
  return cleaned.length === 6;
}

/**
 * Valida matrícula de aeronave brasileira (PT-XXX)
 */
export function validateAircraftRegistration(registration: string): boolean {
  if (!registration) return false;
  const regexBR = /^PT-[A-Z]{3}$/i;
  return regexBR.test(registration.toUpperCase());
}

/**
 * Valida número positivo
 */
export function validatePositiveNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0;
}

/**
 * Valida número inteiro positivo
 */
export function validatePositiveInteger(value: string | number): boolean {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return !isNaN(num) && num >= 0 && Number.isInteger(num);
}

/**
 * Valida range de valores
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Valida minutos (0-59)
 */
export function validateMinutes(minutes: string | number): boolean {
  const num = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
  return validateRange(num, 0, 59);
}

/**
 * Valida horas (0-23)
 */
export function validateHours(hours: string | number): boolean {
  const num = typeof hours === 'string' ? parseInt(hours, 10) : hours;
  return validateRange(num, 0, 23);
}

/**
 * Valida coordenadas (latitude)
 */
export function validateLatitude(lat: number): boolean {
  return validateRange(lat, -90, 90);
}

/**
 * Valida coordenadas (longitude)
 */
export function validateLongitude(lng: number): boolean {
  return validateRange(lng, -180, 180);
}

/**
 * Valida string não vazia
 */
export function validateNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Valida tamanho mínimo de string
 */
export function validateMinLength(value: string, minLength: number): boolean {
  return value.trim().length >= minLength;
}

/**
 * Valida tamanho máximo de string
 */
export function validateMaxLength(value: string, maxLength: number): boolean {
  return value.trim().length <= maxLength;
}

/**
 * Valida URL
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida senha forte (mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número)
 */
export function validateStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Valida percentual (0-100)
 */
export function validatePercentage(value: number): boolean {
  return validateRange(value, 0, 100);
}

/**
 * Valida se o valor é um número válido
 */
export function validateNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && isFinite(num);
}

/**
 * Valida se a data não é no futuro
 */
export function validateNotFutureDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d <= new Date();
}

/**
 * Valida se a data está dentro de um range
 */
export function validateDateRange(
  date: Date | string,
  minDate: Date | string,
  maxDate: Date | string
): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const min = typeof minDate === 'string' ? new Date(minDate) : minDate;
  const max = typeof maxDate === 'string' ? new Date(maxDate) : maxDate;
  
  return d >= min && d <= max;
}

/**
 * Sanitiza string removendo caracteres especiais
 */
export function sanitizeString(str: string): string {
  return str.replace(/[<>]/g, '');
}

/**
 * Valida código de barras EAN-13
 */
export function validateEAN13(barcode: string): boolean {
  const cleaned = barcode.replace(/\D/g, "");
  if (cleaned.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleaned.charAt(i));
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned.charAt(12));
}

/**
 * Objeto com todas as validações para fácil importação
 */
export const validators = {
  cpf: validateCPF,
  cnpj: validateCNPJ,
  email: validateEmail,
  phone: validatePhone,
  time: validateTime,
  dateBR: validateDateBR,
  dateISO: validateDateISO,
  icao: validateICAO,
  canac: validateCANAC,
  aircraftRegistration: validateAircraftRegistration,
  positiveNumber: validatePositiveNumber,
  positiveInteger: validatePositiveInteger,
  range: validateRange,
  minutes: validateMinutes,
  hours: validateHours,
  latitude: validateLatitude,
  longitude: validateLongitude,
  notEmpty: validateNotEmpty,
  minLength: validateMinLength,
  maxLength: validateMaxLength,
  url: validateURL,
  strongPassword: validateStrongPassword,
  percentage: validatePercentage,
  number: validateNumber,
  notFutureDate: validateNotFutureDate,
  dateRange: validateDateRange,
  ean13: validateEAN13,
};