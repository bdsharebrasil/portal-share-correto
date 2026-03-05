/**
 * Formata timestamp em formato de hora HH:MM
 */
export const formatTimeFromTimestamp = (timestamp: string): string => {
  if (!timestamp) return '-';
  try {
    if (timestamp.includes('T')) {
      const date = new Date(timestamp);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return timestamp.split(':').slice(0, 2).join(':');
  } catch {
    return timestamp;
  }
};

/**
 * Formata data ISO (YYYY-MM-DD) para DD/MM
 */
export const formatDateFromISO = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  } catch {
    return dateString;
  }
};

/**
 * Formata data ISO completa para DD/MM/YYYY
 */
export const formatFullDateFromISO = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

/**
 * Encurta nome do cliente (primeiras 5 letras do primeiro nome)
 */
export const shortenClientName = (fullName?: string): string => {
  if (!fullName) return '-';
  const firstName = fullName.split(' ')[0];
  return firstName.substring(0, 5);
};

/**
 * Formata valores monetários em BRL
 */
export const formatBRL = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Formata número de horas com 2 casas decimais
 */
export const formatHours = (hours: number | null | undefined): string => {
  if (!hours || hours === 0) return '00:00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Formata percentual
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (!value || value === 0) return '0%';
  return `${value.toFixed(1)}%`;
};

/**
 * Obtém o nome do mês em português
 */
export const getMonthName = (monthNumber: number): string => {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return months[monthNumber - 1] || '';
};

/**
 * Formata natureza do voo
 */
export const formatFlightNature = (nature: string | null): string => {
  const natures: Record<string, string> = {
    'AE': 'Aérea/Regular',
    'CQ': 'Cheque',
    'EX': 'Executivo',
    'NR': 'Não Remunerado',
    'RE': 'Retorno/Reposição',
    'PV': 'Privado',
    'SA': 'Serviço Aéreo',
    'TN': 'Teste',
    'TR': 'Traslado',
  };
  return natures[nature || ''] || nature || '-';
};

/**
 * Cria etiqueta de status (ex: "DRAFT", "CONFIRMED")
 */
export const formatEntryStatus = (confirmed: boolean | null): string => {
  return confirmed ? 'CONFIRMADO' : 'RASCUNHO';
};

/**
 * Formata descrição de voo
 */
export const formatFlightDescription = (
  departure: string,
  arrival: string
): string => {
  return `${departure || '-'} → ${arrival || '-'}`;
};

/**
 * Remove caracteres especiais de CPF/CNPJ para exibição
 */
export const formatCPF = (cpf: string | null | undefined): string => {
  if (!cpf) return '-';
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
};

/**
 * Formata CNPJ
 */
export const formatCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return '-';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.substring(0, 2)}.${cleaned.substring(2, 5)}.${cleaned.substring(5, 8)}/${cleaned.substring(8, 12)}-${cleaned.substring(12)}`;
};

/**
 * Formata registro de aeronave (matrícula)
 */
export const formatAircraftRegistration = (registration: string): string => {
  return registration.toUpperCase().trim();
};
