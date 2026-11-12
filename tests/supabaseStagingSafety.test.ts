import { describe, expect, it } from 'vitest';
import { extractSupabaseProjectRef, redactUrl } from '../scripts/verify_supabase_staging';

const projectRef = 'qczjagiecgypheayjpru';

describe('Supabase staging connection safety helpers', () => {
  it('extracts the project ref from a direct Supabase database hostname', () => {
    expect(
      extractSupabaseProjectRef(
        `postgresql://postgres:encoded%40password@db.${projectRef}.supabase.co:5432/postgres`,
      ),
    ).toBe(projectRef);
  });

  it('extracts the project ref from a Supabase session-pooler username', () => {
    expect(
      extractSupabaseProjectRef(
        `postgresql://postgres.${projectRef}:encoded%40password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      ),
    ).toBe(projectRef);
  });

  it('rejects non-Supabase or unrecognized hosts', () => {
    expect(() =>
      extractSupabaseProjectRef('postgresql://postgres:password@db.example.com:5432/postgres'),
    ).toThrow(/Unrecognized Supabase database host/);
  });

  it('rejects pooler URLs without the exact project-ref username', () => {
    expect(() =>
      extractSupabaseProjectRef(
        'postgresql://postgres:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
      ),
    ).toThrow(/Unrecognized Supabase database host/);
  });

  it('redacts encoded credentials before a connection URL is logged', () => {
    const raw = `postgresql://postgres.${projectRef}:my-secret%40value@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    const redacted = redactUrl(raw);
    expect(redacted).not.toContain('my-secret');
    expect(redacted).toContain('********');
  });
});
