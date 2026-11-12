import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '../src/lib/sentry';

describe('Security & Privacy - Sentry PII Sanitizer', () => {
  it('strictly redacts sensitive PII fields (salary, bank, aadhaar, pan, password, biometric)', () => {
    const rawPayload = {
      user_id: 'emp-001',
      employee_name: 'Jinson Varghese',
      basic_salary: 60000,
      monthly_wage: 75000,
      bank_account_no: '123456789012',
      bank_ifsc: 'SBIN0001234',
      aadhaar_number: '1234-5678-9012',
      pan_number: 'ABCDE1234F',
      password_hash: 'argon2id$v=19$m=65536...',
      biometric_template: 'FA4D89E0011234...',
      face_data: 'base64_encoded_raw_vectors...',
      nested: {
        safe_key: 'Safe value',
        tax_id: 'TAX-9988',
        terminal_secret: 'supersecret',
      },
    };

    const sanitized = sanitizeObject(rawPayload) as Record<string, unknown>;

    // Non-sensitive data remains untouched
    expect(sanitized.user_id).toBe('emp-001');
    expect(sanitized.employee_name).toBe('[REDACTED_PII]');

    // Sensitive data is strictly redacted
    expect(sanitized.basic_salary).toBe('[REDACTED_PII]');
    expect(sanitized.monthly_wage).toBe('[REDACTED_PII]');
    expect(sanitized.bank_account_no).toBe('[REDACTED_PII]');
    expect(sanitized.bank_ifsc).toBe('[REDACTED_PII]');
    expect(sanitized.aadhaar_number).toBe('[REDACTED_PII]');
    expect(sanitized.pan_number).toBe('[REDACTED_PII]');
    expect(sanitized.password_hash).toBe('[REDACTED_PII]');
    expect(sanitized.biometric_template).toBe('[REDACTED_PII]');
    expect(sanitized.face_data).toBe('[REDACTED_PII]');

    // Nested redaction
    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.safe_key).toBe('Safe value');
    expect(nested.tax_id).toBe('[REDACTED_PII]');
    expect(nested.terminal_secret).toBe('[REDACTED_PII]');
  });
});
