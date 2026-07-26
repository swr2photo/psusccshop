// src/lib/logger.ts
// Centralized Structured Logger for Edge and Node runtimes

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class Logger {
  private isProd = process.env.NODE_ENV === 'production';

  private formatError(err: unknown) {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }
    if (typeof err === 'string') {
      return { message: err };
    }
    return { message: String(err) };
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, err?: unknown) {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
      ...(err ? { error: this.formatError(err) } : {}),
    };

    if (this.isProd) {
      // In production, output single-line structured JSON
      const jsonOutput = JSON.stringify(payload);
      switch (level) {
        case 'error':
          console.error(jsonOutput);
          break;
        case 'warn':
          console.warn(jsonOutput);
          break;
        default:
          console.log(jsonOutput);
          break;
      }
    } else {
      // In development, output human-readable logs
      const timeStr = payload.timestamp.split('T')[1].slice(0, 8);
      const prefix = `[${timeStr}] [${level.toUpperCase()}]`;

      switch (level) {
        case 'error':
          console.error(prefix, message, context || '', err || '');
          break;
        case 'warn':
          console.warn(prefix, message, context || '');
          break;
        case 'debug':
          console.debug(prefix, message, context || '');
          break;
        default:
          console.log(prefix, message, context || '');
          break;
      }
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, err?: unknown, context?: Record<string, unknown>) {
    this.log('error', message, context, err);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();
