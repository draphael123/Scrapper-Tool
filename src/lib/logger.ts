/**
 * Structured logging utility
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formatted = this.formatMessage(level, message, context);
    
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
      default:
        console.log(formatted);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error 
        ? {
            name: error.name,
            message: error.message,
            stack: this.isDevelopment ? error.stack : undefined,
          }
        : String(error),
    };
    this.log('error', error instanceof Error ? error.message : String(error), errorContext);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();

