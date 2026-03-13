const isDev = import.meta.env.DEV;

type LogLevel = 'info' | 'success' | 'warning' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { level, timestamp, message, data };

    // Armazenar no histórico
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Exibir no console apenas em desenvolvimento
    if (isDev) {
      const styles = {
        info: 'color: #0066cc; font-weight: bold;',
        success: 'color: #22c55e; font-weight: bold;',
        warning: 'color: #eab308; font-weight: bold;',
        error: 'color: #ef4444; font-weight: bold;',
      };

      const prefix = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
      };

      console.log(
        `%c[${level.toUpperCase()}]`,
        styles[level],
        `${prefix[level]} ${message}`,
        data || ''
      );
    }

    // Sempre exibir erros no console
    if (level === 'error') {
      console.error(`[ERROR] ${message}`, data);
    }
  }

  /**
   * Log de informação
   */
  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  /**
   * Log de sucesso
   */
  success(message: string, data?: any) {
    this.log('success', message, data);
  }

  /**
   * Log de aviso
   */
  warning(message: string, data?: any) {
    this.log('warning', message, data);
  }

  /**
   * Log de erro
   */
  error(message: string, error?: any) {
    this.log('error', message, error);
  }

  /**
   * Obtém histórico de logs
   */
  getHistory(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Limpa histórico
   */
  clear() {
    this.logs = [];
  }

  /**
   * Exporta logs como JSON
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Exportar instância única
export const logger = new Logger();

// Helpers para uso rápido
export const logInfo = (msg: string, data?: any) => logger.info(msg, data);
export const logSuccess = (msg: string, data?: any) => logger.success(msg, data);
export const logWarning = (msg: string, data?: any) => logger.warning(msg, data);
export const logError = (msg: string, err?: any) => logger.error(msg, err);
