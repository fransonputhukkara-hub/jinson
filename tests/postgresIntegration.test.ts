import { describe, it, expect } from 'vitest';
import { runPostgresVerification } from '../scripts/verify_postgres_integration';

describe('Milestone 3.2: PostgreSQL Real Database Integration Verification', () => {
  it('executes all migrations and passes all database integrity and RLS checks in real PostgreSQL', async () => {
    const report = await runPostgresVerification();
    
    expect(report.pgVersion).toContain('PostgreSQL');
    expect(report.migrationsApplied.length).toBeGreaterThanOrEqual(6);
    
    // Ensure all individual database checks passed
    for (const res of report.results) {
      expect(res.passed, `[${res.step}] ${res.name}: ${res.message}`).toBe(true);
    }
    
    expect(report.allPassed).toBe(true);
  }, 30000); // 30s timeout for full WASM Postgres lifecycle
});
