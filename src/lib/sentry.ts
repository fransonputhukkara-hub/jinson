/**
 * Sentry Configuration and Privacy Hardening
 * Strictly filters out PII including salary amounts, bank details, Aadhaar, PAN, passwords, and biometric data.
 */

// PII patterns to sanitize
const SENSITIVE_KEY_PATTERNS = [
  /salary/i,
  /wage/i,
  /bank/i,
  /account_no/i,
  /ifsc/i,
  /aadhaar/i,
  /pan/i,
  /password/i,
  /token/i,
  /secret/i,
  /credential/i,
  /biometric/i,
  /template/i,
  /face_data/i,
  /fingerprint/i,
  /tax_id/i,
];

export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED_PII]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface ErrorReportOptions {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'error' | 'fatal';
}

class SafeLogger {
  private dsn: string;
  private environment: string;
  private isEnabled: boolean;

  constructor() {
    this.dsn = import.meta.env.VITE_SENTRY_DSN || '';
    this.environment = import.meta.env.VITE_APP_ENV || 'development';
    this.isEnabled = Boolean(this.dsn && this.dsn.length > 5);
  }

  public captureException(error: Error | unknown, options?: ErrorReportOptions): void {
    const sanitizedExtra = options?.extra ? sanitizeObject(options.extra) : undefined;
    const sanitizedTags = options?.tags ? (sanitizeObject(options.tags) as Record<string, string>) : undefined;

    if (this.isEnabled) {
      // If external Sentry SDK is linked via CDN or bundle, forward sanitized payload
      const win = window as unknown as { Sentry?: { captureException: (e: unknown, ctx: unknown) => void } };
      if (win.Sentry && typeof win.Sentry.captureException === 'function') {
        win.Sentry.captureException(error, {
          tags: sanitizedTags,
          extra: sanitizedExtra,
          level: options?.level || 'error',
        });
        return;
      }
    }

    // Local development console warning with sanitized payload
    console.error('[ErrorMonitor]', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      environment: this.environment,
      tags: sanitizedTags,
      extra: sanitizedExtra,
    });
  }

  public captureMessage(message: string, options?: ErrorReportOptions): void {
    const sanitizedExtra = options?.extra ? sanitizeObject(options.extra) : undefined;
    if (this.isEnabled) {
      const win = window as unknown as { Sentry?: { captureMessage: (m: string, ctx: unknown) => void } };
      if (win.Sentry && typeof win.Sentry.captureMessage === 'function') {
        win.Sentry.captureMessage(message, {
          tags: options?.tags,
          extra: sanitizedExtra,
          level: options?.level || 'info',
        });
        return;
      }
    }
    console.info(`[ErrorMonitor:${options?.level || 'info'}]`, message, sanitizedExtra);
  }
}

export const errorMonitor = new SafeLogger();
