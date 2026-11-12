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

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, '[REDACTED_PHONE]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[REDACTED_TAX_ID]')
    .replace(/\b\d{12}\b/g, '[REDACTED_ID]')
    .replace(/(password|passwd|token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 500);
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
    const originalName = error instanceof Error ? error.name : 'UnknownError';
    const safeName = /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(originalName) ? originalName : 'ApplicationError';

    if (this.isEnabled) {
      const win = window as unknown as { Sentry?: { captureException: (e: unknown, ctx: unknown) => void } };
      if (win.Sentry && typeof win.Sentry.captureException === 'function') {
        // Never forward the caller's original Error, message or stack to a third party.
        const safeError = new Error('Application exception captured; original details were suppressed for privacy.');
        safeError.name = safeName;
        win.Sentry.captureException(safeError, {
          tags: sanitizedTags,
          extra: sanitizedExtra,
          level: options?.level || 'error',
        });
        return;
      }
    }

    // Local output also omits the original message and stack.
    console.error('[ErrorMonitor]', {
      name: safeName,
      message: 'Application exception captured; original details were suppressed for privacy.',
      environment: this.environment,
      tags: sanitizedTags,
      extra: sanitizedExtra,
    });
  }
  public captureMessage(message: string, options?: ErrorReportOptions): void {
    const sanitizedExtra = options?.extra ? sanitizeObject(options.extra) : undefined;
    const sanitizedTags = options?.tags ? (sanitizeObject(options.tags) as Record<string, string>) : undefined;
    const safeMessage = sanitizeDiagnosticText(message);

    if (this.isEnabled) {
      const win = window as unknown as { Sentry?: { captureMessage: (m: string, ctx: unknown) => void } };
      if (win.Sentry && typeof win.Sentry.captureMessage === 'function') {
        win.Sentry.captureMessage('Application diagnostic event (message filtered).', {
          tags: sanitizedTags,
          extra: { sanitizedMessage: safeMessage, ...((sanitizedExtra || {}) as Record<string, unknown>) },
          level: options?.level || 'info',
        });
        return;
      }
    }
    console.info(`[ErrorMonitor:${options?.level || 'info'}]`, safeMessage, sanitizedExtra);
  }
}

export const errorMonitor = new SafeLogger();
