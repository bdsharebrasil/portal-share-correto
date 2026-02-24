import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert decimal hours (e.g. 1.5) to HH:MM string (01:30)
export function formatDecimalHoursToHHMM(value: number | null | undefined) {
  if (value === null || value === undefined || isNaN(Number(value))) return "00:00";
  const totalMinutes = Math.round(Number(value) * 60);
  return formatMinutesToHHMM(totalMinutes);
}

// Convert minutes (e.g. 90) to HH:MM string (01:30)
export function formatMinutesToHHMM(minutes: number | null | undefined) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const paddedHH = String(hh).padStart(2, "0");
  const paddedMM = String(mm).padStart(2, "0");
  return `${paddedHH}:${paddedMM}`;
}

// Parse HH:MM string to decimal hours (e.g. "01:30" -> 1.5)
export function parseHHMMToDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const s = String(value).trim();
  if (s === "") return 0;
  // Accept separators : or . or , or just a number
  if (/^\d+(?:[\.,]\d+)?$/.test(s)) {
    // plain decimal-like string
    return parseFloat(s.replace(',', '.')) || 0;
  }
  const parts = s.split(":");
  if (parts.length === 2) {
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    return hh + mm / 60;
  }
  return 0;
}

// Format number to Brazilian currency format without symbol (e.g. 1234.5 -> "1.234,50")
export function formatBRL(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === 'string' ? parseBRL(value) : Number(value || 0);
  if (isNaN(n)) return "";
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Parse Brazilian formatted currency or common formats to number
export function parseBRL(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  let s = String(value).trim();
  if (s === '') return 0;
  // Remove currency symbol and spaces
  s = s.replace(/[^0-9.,-]/g, '');
  const hasComma = s.indexOf(',') !== -1;
  const hasDot = s.indexOf('.') !== -1;
  if (hasComma && hasDot) {
    // assume dot is thousand separator, comma is decimal
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else if (hasComma && !hasDot) {
    // comma as decimal
    s = s.replace(/,/g, '.');
  } else {
    // dot as decimal or plain integer
    // keep as is
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Convert number to words in Portuguese (Brazil) for currency (reais e centavos)
// Supports values up to billions; intended for receipt/printing uses.
const UNITS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const TEENS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function threeDigitsToWords(n: number) {
  n = Math.max(0, Math.min(999, n));
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let parts: string[] = [];
  if (hundreds > 0) {
    parts.push(HUNDREDS[hundreds]);
  }
  if (remainder >= 10 && remainder < 20) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const tens = Math.floor(remainder / 10);
    const units = remainder % 10;
    if (tens > 0) parts.push(TENS[tens]);
    if (units > 0) parts.push(UNITS[units]);
  }
  return parts.join(' e ');
}

export function numberToCurrencyWordsPtBr(value: number) {
  if (typeof value !== 'number' || isNaN(value)) return '';
  const negative = value < 0;
  const abs = Math.abs(value);
  const integer = Math.floor(abs);
  const cents = Math.round((abs - integer) * 100);

  if (integer === 0 && cents === 0) return 'zero reais';

  const segments = [];
  const billions = Math.floor(integer / 1_000_000_000);
  const millions = Math.floor((integer % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integer % 1_000_000) / 1000);
  const hundreds = integer % 1000;

  if (billions) segments.push(`${threeDigitsToWords(billions)} ${billions === 1 ? 'bilhão' : 'bilhões'}`);
  if (millions) segments.push(`${threeDigitsToWords(millions)} ${millions === 1 ? 'milhão' : 'milhões'}`);
  if (thousands) {
    if (thousands === 1) segments.push('mil');
    else segments.push(`${threeDigitsToWords(thousands)} mil`);
  }
  if (hundreds) segments.push(`${threeDigitsToWords(hundreds)}`);

  const integerPart = segments.filter(Boolean).join(' e ').trim();
  const reais = integer === 1 ? 'real' : 'reais';
  const centsPart = cents > 0 ? `${threeDigitsToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}` : '';

  const parts = [];
  if (integer > 0) parts.push(`${integerPart} ${reais}`.trim());
  if (cents > 0) parts.push(centsPart);

  const result = (negative ? 'menos ' : '') + parts.join(' e ').replace(/\s+/g, ' ').trim();
  return result;
}
