/**
 * Utilitário para logging centralizado de erros relacionados a PDF
 * Ajuda no debugging de problemas com PDFs corrompidos ou inválidos
 */

interface PDFErrorLog {
  timestamp: string;
  type: string;
  url: string;
  fileName: string;
  message: string;
  details?: any;
}

class PDFErrorLogger {
  private logs: PDFErrorLog[] = [];
  private readonly MAX_LOGS = 50;

  logError(type: string, url: string, fileName: string, message: string, details?: any): void {
    const log: PDFErrorLog = {
      timestamp: new Date().toISOString(),
      type,
      url,
      fileName,
      message,
      details,
    };

    this.logs.push(log);

    // Manter apenas os últimos 50 logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Log no console com melhor formatação
    const severity = this.getSeverity(type);
    const icon = this.getIcon(type);

    console.group(`${icon} ${severity} - PDF Error`);
    console.log('Arquivo:', fileName);
    console.log('URL:', url);
    console.log('Mensagem:', message);
    if (details) {
      console.log('Detalhes:', details);
    }
    console.log('Hora:', log.timestamp);
    console.groupEnd();
  }

  logValidationError(url: string, fileName: string, error: string): void {
    this.logError('VALIDATION', url, fileName, `Validação falhou: ${error}`);
  }

  logLoadError(url: string, fileName: string, error: any): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logError('LOAD', url, fileName, `Erro ao carregar: ${message}`, error);
  }

  logStructureError(url: string, fileName: string): void {
    this.logError('STRUCTURE', url, fileName, 'Estrutura de PDF inválida', {
      suggestion: 'O arquivo pode estar corrompido ou não ser um PDF válido',
    });
  }

  private getSeverity(type: string): string {
    const severities: Record<string, string> = {
      'VALIDATION': 'AVISO',
      'LOAD': 'ERRO',
      'STRUCTURE': 'ERRO CRÍTICO',
      'WORKER': 'ERRO CRÍTICO',
      'CORS': 'AVISO',
    };
    return severities[type] || 'ERRO';
  }

  private getIcon(type: string): string {
    const icons: Record<string, string> = {
      'VALIDATION': '⚠️',
      'LOAD': '❌',
      'STRUCTURE': '🔴',
      'WORKER': '⚙️',
      'CORS': '🔒',
    };
    return icons[type] || '❓';
  }

  getLogs(): PDFErrorLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Função para enviar logs ao servidor (para análise)
  async sendLogsToServer(endpoint: string): Promise<boolean> {
    if (this.logs.length === 0) {
      console.log('Nenhum log de PDF para enviar');
      return true;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: this.logs,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        console.log('✅ Logs de PDF enviados com sucesso ao servidor');
        return true;
      } else {
        console.warn('⚠️ Servidor respondeu com erro ao receber logs de PDF:', response.status);
        return false;
      }
    } catch (err) {
      console.error('❌ Erro ao enviar logs de PDF:', err);
      return false;
    }
  }
}

// Exportar instância única
export const pdfLogger = new PDFErrorLogger();
