'use client';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  severity: ErrorSeverity;
  timestamp: string;
  source: string;
  context?: Record<string, any>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: string;
  public context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    severity: ErrorSeverity = 'medium',
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      severity: this.severity,
      timestamp: this.timestamp,
      source: this.name,
      context: this.context,
    };
  }

  toString(): string {
    return `[${this.code}] ${this.message} (Status: ${this.statusCode})`;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(400, 'VALIDATION_ERROR', message, 'low', context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super(401, 'AUTHENTICATION_ERROR', message, 'high', context);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context?: Record<string, any>) {
    super(403, 'AUTHORIZATION_ERROR', message, 'medium', context);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(404, 'NOT_FOUND', message, 'low', context);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number, context?: Record<string, any>) {
    super(429, 'RATE_LIMIT', message, 'high', context);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Request timeout', context?: Record<string, any>) {
    super(504, 'TIMEOUT', message, 'high', context);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error', context?: Record<string, any>, originalError?: Error) {
    super(0, 'NETWORK_ERROR', message, 'high', context, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Central error handler
 */
export class ErrorHandler {
  /**
   * Normalize any error to AppError
   */
  static normalize(error: unknown, context?: Record<string, any>): AppError {
    if (error instanceof AppError) {
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }

    if (error instanceof Error) {
      // Timeout error
      if (error.message.toLowerCase().includes('timeout')) {
        return new TimeoutError(error.message, context);
      }

      // Network error
      if (
        error.message.toLowerCase().includes('fetch') ||
        error.message.toLowerCase().includes('network') ||
        error instanceof TypeError
      ) {
        return new NetworkError(error.message, context, error);
      }

      // Generic error
      return new AppError(500, 'UNKNOWN_ERROR', error.message, 'medium', context, error);
    }

    // Unknown error type
    return new AppError(
      500,
      'UNKNOWN_ERROR',
      String(error) || 'Unknown error occurred',
      'medium',
      { originalError: error, ...context }
    );
  }

  /**
   * Log error to console
   */
  static log(error: unknown, context?: Record<string, any>): void {
    const appError = ErrorHandler.normalize(error, context);
    
    const severity = appError.severity;
    const logFn = severity === 'critical' ? console.error : 
                 severity === 'high' ? console.error : 
                 severity === 'medium' ? console.warn : 
                 console.log;

    logFn(
      `[${appError.code}] ${appError.message}`,
      appError.context,
      `(${appError.timestamp})`
    );
  }

  /**
   * Get user-friendly error message (Thai)
   */
  static getUserMessage(error: unknown): string {
    const appError = ErrorHandler.normalize(error);

    const thaiMessages: Record<string, string> = {
      VALIDATION_ERROR: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      AUTHENTICATION_ERROR: 'ต้องเข้าสู่ระบบก่อนสามารถทำรายการนี้ได้',
      AUTHORIZATION_ERROR: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
      NOT_FOUND: 'ไม่พบข้อมูลที่ขอหา',
      RATE_LIMIT: 'ลองใหม่ในเวลาต่อมา (คำขอมากเกินไป)',
      TIMEOUT: 'หมดเวลาการเชื่อมต่อ กรุณาลองใหม่',
      NETWORK_ERROR: 'มีปัญหาการเชื่อมต่อ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต',
      HTTP_ERROR: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์',
      CONFIG_ERROR: 'ไม่สามารถกำหนดค่า API ได้',
      API_ERROR: 'API ส่งคืนข้อผิดพลาด',
      UNKNOWN_ERROR: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    };

    return thaiMessages[appError.code] || `เกิดข้อผิดพลาด: ${appError.message}`;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    const appError = ErrorHandler.normalize(error);
    const retryableCodes = [
      'TIMEOUT',
      'NETWORK_ERROR',
      'RATE_LIMIT',
      'HTTP_ERROR'
    ];
    return retryableCodes.includes(appError.code) || appError.statusCode >= 500;
  }

  /**
   * Get suggested retry delay (ms)
   */
  static getRetryDelay(error: unknown, attempt: number = 1): number {
    const appError = ErrorHandler.normalize(error);

    // Rate limit with Retry-After header would be ideal
    if (appError instanceof RateLimitError && appError.retryAfter) {
      return appError.retryAfter * 1000;
    }

    // Exponential backoff
    const baseDelay = 500;
    const maxDelay = 30000;
    const delay = baseDelay * Math.pow(2, attempt - 1);

    return Math.min(delay, maxDelay);
  }
}
