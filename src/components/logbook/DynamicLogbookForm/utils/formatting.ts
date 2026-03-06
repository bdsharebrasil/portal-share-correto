// utils/formatting.ts

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
 * Formata tempo em formato HH:MM
 */
export function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formata horas decimais para exibição (1.5 → "1h 30m")
 */
export function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formata data para padrão brasileiro (DD/MM/YYYY)
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata data e hora para padrão brasileiro (DD/MM/YYYY HH:MM)
 */
export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDateBR(d);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Formata telefone brasileiro (XX) XXXXX-XXXX
 */
export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  
  return phone;
}

/**
 * Remove formatação de telefone
 */
export function unformatPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formata número com separador de milhares
 */
export function formatNumber(value: number | string, decimals: number = 0): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formata distância em NM (Nautical Miles)
 */
export function formatDistance(nm: number): string {
  return `${formatNumber(nm, 1)} NM`;
}

/**
 * Formata combustível em litros
 */
export function formatFuel(liters: number): string {
  return `${formatNumber(liters, 1)} L`;
}

/**
 * Formata peso em kg
 */
export function formatWeight(kg: number): string {
  return `${formatNumber(kg, 1)} kg`;
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function capitalize(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Trunca texto com reticências
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Formata CANAC (licença de piloto)
 */
export function formatCANAC(canac: string): string {
  if (!canac) return "";
  const cleaned = canac.replace(/\D/g, "");
  if (cleaned.length !== 6) return canac;
  return cleaned.replace(/(\d{3})(\d{3})/, "$1-$2");
}

/**
 * Remove formatação de CANAC
 */
export function unformatCANAC(canac: string): string {
  return canac.replace(/\D/g, "");
}

/**
 * Formata matrícula de aeronave (PT-XXX)
 */
export function formatAircraftRegistration(registration: string): string {
  if (!registration) return "";
  const cleaned = registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length <= 2) return cleaned;
  return `${cleaned.substring(0, 2)}-${cleaned.substring(2)}`;
}

/**
 * Valida e formata código ICAO de aeródromo (4 letras)
 */
export function formatICAO(icao: string): string {
  if (!icao) return "";
  return icao.toUpperCase().replace(/[^A-Z]/g, "").substring(0, 4);
}

/**
 * Formata coordenadas geográficas
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}