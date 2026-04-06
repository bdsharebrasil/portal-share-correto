/**
 * Utilitários centralizados para emissão de recibos
 * Contém validações, formatações e geração de números
 */

// ============================================================================
// HELPERS DE DATA - TIMEZONE SEGURO
// ============================================================================

/**
 * Parse seguro de data YYYY-MM-DD no timezone local (evita conversão UTC)
 * Exemplo: "2024-12-20" vira Date(2024, 11, 20) em timezone local
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ============================================================================
// TIPOS
// ============================================================================

export type ReceiptType = "pagamento" | "reembolso";

export interface ReceiptFormData {
  dataEmissao: string;
  valor: number;
  servicoDescricao: string;
  pagadorNome: string;
  pagadorDocumento: string;
  pagadorEndereco?: string;
  pagadorCidade?: string;
  pagadorUF?: string;
  receiptType: ReceiptType;
  prazoMaximoQuitacao?: string;
  formaPagamento?: string;
  clienteId?: string;
  aircraftId?: string;
  reembolsoCategoriaId?: string;
  reembolsoValorTotal?: string;
  reembolsoPorcentagem?: string;
  reembolsoBoletoFile?: File | null;
  reembolsoNotaFiscalFile?: File | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface GeneratedReceipt {
  id: string;
  numero_recibo: string;
  usuario_id: string;
  nome_pagador: string;
  documento_pagador: string;
  endereco_pagador?: string;
  cidade_pagador?: string;
  uf_pagador?: string;
  valor: number;
  descricao_servico: string;
  tipo_recibo: ReceiptType;
  data_emissao: string;
  data_max_pagamento?: string;
  forma_pagamento?: string;
  cliente_id?: string;
  url_pdf?: string;
  criado_em: string;
  // Backward compatibility aliases
  receipt_number?: string;
  user_id?: string;
  payer_name?: string;
  payer_document?: string;
  payer_address?: string;
  payer_city?: string;
  payer_uf?: string;
  amount?: number;
  service_description?: string;
  receipt_type?: ReceiptType;
  issue_date?: string;
  max_payment_date?: string;
  payment_method?: string;
  client_id?: string;
  pdf_url?: string;
  created_at?: string;
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida os dados do formulário de recibo
 * @returns Array de erros de validação ou vazio se válido
 */
export function validateReceiptForm(data: ReceiptFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Data de emissão
  if (!data.dataEmissao?.trim()) {
    errors.push({ field: "dataEmissao", message: "Data de emissão é obrigatória" });
  } else {
    const date = parseLocalDate(data.dataEmissao);
    if (isNaN(date.getTime())) {
      errors.push({ field: "dataEmissao", message: "Data de emissão inválida" });
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date > today) {
        errors.push({ field: "dataEmissao", message: "Data não pode ser no futuro" });
      }
    }
  }

  // Valor
  if (!data.valor || data.valor <= 0) {
    errors.push({ field: "valor", message: "Valor deve ser maior que zero" });
  } else if (data.valor > 999999999.99) {
    errors.push({ field: "valor", message: "Valor máximo excedido" });
  }

  // Descrição do serviço
  if (!data.servicoDescricao?.trim()) {
    errors.push({ field: "servicoDescricao", message: "Descrição do serviço é obrigatória" });
  } else if (data.servicoDescricao.length > 500) {
    errors.push({ field: "servicoDescricao", message: "Descrição não pode exceder 500 caracteres" });
  }

  // Nome do pagador
  if (!data.pagadorNome?.trim()) {
    errors.push({ field: "pagadorNome", message: "Nome do pagador é obrigatório" });
  } else if (data.pagadorNome.length > 150) {
    errors.push({ field: "pagadorNome", message: "Nome do pagador não pode exceder 150 caracteres" });
  }

  // Documento do pagador
  if (!data.pagadorDocumento?.trim()) {
    errors.push({ field: "pagadorDocumento", message: "CPF/CNPJ é obrigatório" });
  } else if (!isValidDocument(data.pagadorDocumento)) {
    errors.push({ field: "pagadorDocumento", message: "CPF/CNPJ inválido" });
  }

  // Endereço (opcional mas se preenchido, validar)
  if (data.pagadorEndereco && data.pagadorEndereco.length > 200) {
    errors.push({ field: "pagadorEndereco", message: "Endereço não pode exceder 200 caracteres" });
  }

  // Cidade (opcional)
  if (data.pagadorCidade && data.pagadorCidade.length > 100) {
    errors.push({ field: "pagadorCidade", message: "Cidade não pode exceder 100 caracteres" });
  }

  // UF (opcional mas se preenchido, validar)
  if (data.pagadorUF) {
    const ufs = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
    if (!ufs.includes(data.pagadorUF.toUpperCase())) {
      errors.push({ field: "pagadorUF", message: "UF inválido" });
    }
  }

  // Tipo de recibo
  if (!["pagamento", "reembolso"].includes(data.receiptType)) {
    errors.push({ field: "receiptType", message: "Tipo de recibo inválido" });
  }

  // Prazo de quitação (opcional se preenchido, validar)
  if (data.prazoMaximoQuitacao) {
    const date = parseLocalDate(data.prazoMaximoQuitacao);
    if (isNaN(date.getTime())) {
      errors.push({ field: "prazoMaximoQuitacao", message: "Data de prazo inválida" });
    } else if (date < parseLocalDate(data.dataEmissao)) {
      errors.push({ field: "prazoMaximoQuitacao", message: "Prazo não pode ser antes da data de emissão" });
    }
  }

  // Forma de pagamento (opcional)
  if (data.formaPagamento && data.formaPagamento.length > 100) {
    errors.push({ field: "formaPagamento", message: "Forma de pagamento não pode exceder 100 caracteres" });
  }

  // Validação de reembolso - campos adicionais para bank_reconciliations
  if (data.receiptType === "reembolso") {
    // Categoria é usada apenas em bank_reconciliations, não validar aqui
    // Os campos abaixo são opcionais no recibo mas serão obrigatórios no reconciliation

    // Valor total da despesa (opcional no recibo, mas se preenchido deve ser válido)
    if (data.reembolsoValorTotal) {
      let valorTotal = 0;
      if (typeof data.reembolsoValorTotal === 'string') {
        valorTotal = parseFloat(data.reembolsoValorTotal.trim().replace(",", "."));
      } else if (typeof data.reembolsoValorTotal === 'number') {
        valorTotal = data.reembolsoValorTotal;
      }

      if (isNaN(valorTotal) || valorTotal <= 0) {
        errors.push({ field: "reembolsoValorTotal", message: "Valor total inválido" });
      }
    }

    // Porcentagem (opcional no recibo, mas se preenchido deve ser válida)
    if (data.reembolsoPorcentagem) {
      let porcentagem = 0;
      if (typeof data.reembolsoPorcentagem === 'string') {
        porcentagem = parseFloat(data.reembolsoPorcentagem.trim().replace(",", "."));
      } else if (typeof data.reembolsoPorcentagem === 'number') {
        porcentagem = data.reembolsoPorcentagem;
      }

      if (isNaN(porcentagem) || porcentagem <= 0 || porcentagem > 100) {
        errors.push({ field: "reembolsoPorcentagem", message: "Porcentagem inválida" });
      }
    }
  }

  return errors;
}

/**
 * Valida se um documento (CPF ou CNPJ) é válido
 * Validação básica de formato
 */
export function isValidDocument(document: string): boolean {
  const cleaned = document.replace(/\D/g, "");

  // CPF deve ter 11 dígitos
  if (cleaned.length === 11) {
    // Validação simples: não aceita todos os dígitos iguais
    if (/^(\d)\1{10}$/.test(cleaned)) return false;
    return true;
  }

  // CNPJ deve ter 14 dígitos
  if (cleaned.length === 14) {
    // Validação simples: não aceita todos os dígitos iguais
    if (/^(\d)\1{13}$/.test(cleaned)) return false;
    return true;
  }

  return false;
}

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Converte um número para palavras em português
 * Usado para gerar o valor por extenso no recibo
 */
export function numberToCurrencyWords(num: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const inteiro = Math.floor(num);
  const centavos = Math.round((num - inteiro) * 100);

  if (inteiro === 0) {
    return `zero reais${centavos > 0 ? ` e ${centavos} centavos` : ""}`;
  }

  let resultado = `${inteiro} reais`;
  if (centavos > 0) {
    resultado += ` e ${centavos} centavos`;
  }

  return resultado;
}

/**
 * Formata um número para formato de moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata uma data em formato brasileiro
 */
export function formatDate(dateString: string): string {
  try {
    const date = parseLocalDate(dateString);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formata uma data para exibição por extenso
 */
export function formatDateExtended(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-");
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const monthIndex = parseInt(month) - 1;
    return `${day} de ${meses[monthIndex]} de ${year}`;
  } catch {
    return dateString;
  }
}

// ============================================================================
// GERAÇÃO DE NÚMEROS E IDS
// ============================================================================

/**
 * Gera número único de recibo
 * Formato: REC-[PREFIXO]-[NÚMEROS]/[ANO]
 */
export function generateReceiptNumber(clientName?: string): string {
  const today = new Date();
  const year = String(today.getFullYear()).slice(-2);
  const randomNumbers = String(Math.floor(Math.random() * 1000)).padStart(3, "0");

  if (clientName && clientName.trim()) {
    // Extrair 3 primeiras letras do cliente
    const prefix = clientName.substring(0, 3).toUpperCase();
    return `REC-${prefix}-${randomNumbers}/${year}`;
  }

  // Se não houver cliente, gerar número simples
  return `REC-${randomNumbers}/${year}`;
}

/**
 * Limpa caracteres especiais de um documento
 */
export function cleanDocument(document: string): string {
  return document.replace(/\D/g, "");
}

/**
 * Formata CPF ou CNPJ para exibição
 */
export function formatDocument(document: string): string {
  const cleaned = cleanDocument(document);

  if (cleaned.length === 11) {
    // CPF: XXX.XXX.XXX-XX
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }

  if (cleaned.length === 14) {
    // CNPJ: XX.XXX.XXX/XXXX-XX
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }

  return document;
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Extrai o primeiro nome de uma pessoa/empresa
 */
export function getFirstName(name: string): string {
  return name?.split(" ")[0] || "";
}

/**
 * Trunca um texto e adiciona elipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

/**
 * Valida se uma URL é válida
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gera um ID único
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// VALIDAÇÃO DE COMPROVANTE (ARQUIVO)
// ============================================================================

export interface FileValidationError {
  type: 'size' | 'mimeType' | 'general';
  message: string;
}

/**
 * Valida um arquivo de comprovante (imagem ou PDF)
 * @param file - Arquivo a validar
 * @param maxSizeMB - Tamanho máximo em MB (padrão: 10)
 * @returns Array de erros ou vazio se válido
 */
export function validateReceiptFile(file: File | undefined, maxSizeMB: number = 10): FileValidationError[] {
  const errors: FileValidationError[] = [];

  if (!file) {
    errors.push({ type: 'general', message: 'Nenhum arquivo selecionado' });
    return errors;
  }

  // Tipos MIME aceitos
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

  // Validar MIME type
  if (!validMimeTypes.includes(file.tipo)) {
    errors.push({
      type: 'mimeType',
      message: `Tipo de arquivo não suportado. Aceitos: PNG, JPG, GIF, WebP, PDF (recebido: ${file.tipo || 'desconhecido'})`
    });
  }

  // Validar tamanho
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    errors.push({
      type: 'size',
      message: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB (arquivo: ${fileSizeMB.toFixed(2)}MB)`
    });
  }

  // Validar tamanho mínimo (pelo menos 1KB)
  if (file.size < 1024) {
    errors.push({
      type: 'general',
      message: 'Arquivo muito pequeno ou vazio'
    });
  }

  return errors;
}
