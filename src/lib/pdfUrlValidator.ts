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
    // Validar URL
    try {
      new URL(url);
    } catch {
      return {
        isValid: false,
        isAccessible: false,
        error: 'URL inválida ou malformada',
      };
    }

    // Tentar HEAD request para validar o arquivo
    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache',
      });

      if (!headResponse.ok) {
        return {
          isValid: false,
          isAccessible: false,
          error: `Servidor respondeu com erro: HTTP ${headResponse.status}`,
        };
      }

      const contentType = headResponse.headers.get('content-type');
      const contentLength = headResponse.headers.get('content-length');

      // Verificar se é um PDF
      if (contentType && !contentType.includes('application/pdf')) {
        return {
          isValid: false,
          isAccessible: true,
          contentType,
          error: `Tipo de arquivo inválido. Esperado: application/pdf, recebido: ${contentType}`,
        };
      }

      // Verificar tamanho mínimo
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size < 100) {
          return {
            isValid: false,
            isAccessible: true,
            contentLength: size,
            error: 'Arquivo muito pequeno para ser um PDF válido',
          };
        }
      }

      return {
        isValid: true,
        isAccessible: true,
        contentType: contentType || undefined,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
      };
    } catch (headError) {
      // Se HEAD falhar, tentar GET com Range header para evitar baixar arquivo inteiro
      try {
        const getResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-1023', // Pedir apenas primeiros 1KB
          },
          mode: 'cors',
          cache: 'no-cache',
        });

        if (!getResponse.ok && getResponse.status !== 206) { // 206 = Partial Content
          return {
            isValid: false,
            isAccessible: false,
            error: `Não foi possível acessar o arquivo (HTTP ${getResponse.status})`,
          };
        }

        const contentType = getResponse.headers.get('content-type');

        // Verificar assinatura do PDF nos primeiros bytes
        const arrayBuffer = await getResponse.arrayBuffer();
        const view = new Uint8Array(arrayBuffer);
        const pdfSignature = String.fromCharCode(...view.slice(0, 4));

        if (pdfSignature !== '%PDF') {
          return {
            isValid: false,
            isAccessible: true,
            contentType: contentType || undefined,
            error: 'Arquivo não é um PDF válido (assinatura inválida)',
          };
        }

        return {
          isValid: true,
          isAccessible: true,
          contentType: contentType || 'application/pdf',
        };
      } catch (getError) {
        return {
          isValid: false,
          isAccessible: false,
          error: 'Não foi possível validar o arquivo PDF',
        };
      }
    }
  } catch (err) {
    return {
      isValid: false,
      isAccessible: false,
      error: `Erro ao validar PDF: ${err instanceof Error ? err.message : 'desconhecido'}`,
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
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.documentoument',
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
