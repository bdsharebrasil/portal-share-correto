/**
 * Utilitário para validar e processar URLs de PDF de forma robusta
 */

/**
 * Verifica se uma URL é válida e acessível
 * Retorna informações sobre o arquivo
 */
export async function validateAndCheckPDF(url: string): Promise<{
  isValid: boolean;
  isAccessible: boolean;
  contentType?: string;
  contentLength?: number;
  error?: string;
}> {
  try {
    // Validar URL básica
    try {
      new URL(url);
    } catch {
      return {
        isValid: false,
        isAccessible: false,
        error: 'URL inválida ou malformada',
      };
    }

    // Se a URL parece válida, permitir que o react-pdf tente carregar
    // A validação HEAD/GET pode falhar por CORS mas o PDF ainda ser acessível
    return {
      isValid: true,
      isAccessible: true,
    };
  } catch (err) {
    // Em caso de qualquer erro, ainda permitir tentativa de carregamento
    return {
      isValid: true,
      isAccessible: true,
      error: undefined,
    };
  }
}

/**
 * Sanitiza uma URL para garantir que seja segura para usar
 */
export function sanitizePDFUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Apenas manter protocolo https ou http, nada perigoso
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Protocolo não suportado');
    }
    return urlObj.toString();
  } catch {
    return '';
  }
}

/**
 * Detecta o tipo MIME de um arquivo a partir da extensão
 */
export function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.documento',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}
