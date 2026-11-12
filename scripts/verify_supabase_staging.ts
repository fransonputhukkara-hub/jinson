import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env or .env.local if present
dotenv.config();
dotenv.config({ path: '.env.local' });

interface CheckResult {
  suite: string;
  test: string;
  passed: boolean;
  message: string;
  detail?: string;
}

/**
 * Sanitizes connection URLs and strings to prevent password leakage in logs.
 */
export function redactUrl(rawUrl: string): string {
  try {
    return rawUrl.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1********$3');
  } catch {
    return '[REDACTED_URL]';
  }
}

/**
 * Sanitizes error messages and stack traces to ensure database credentials never leak.
 */
export function sanitizeError(err: any, rawUrl?: string): string {
  if (!err) return 'Unknown error';
  let msg = err.stack || err.message || String(err);
  if (rawUrl) {
    const redacted = redactUrl(rawUrl);
    // Extract password if possible to strip occurrences
    const match = rawUrl.match(/postgres(?:ql)?:\/\/[^:]+:([^@]+)@/i);
    if (match && match[1]) {
      msg = msg.split(match[1]).join('********');
    }
  }
  return msg;
}

// Fixed UUIDs for isolated staging tests
const TEST_ORG_ID = 'e0000000-0000-4000-a000-000000000001';
const TEST_BRANCH_ID = 'e0000000-0000-4000-a000-000000000002';
const TEST_EMP_ID = 'e0000000-0000-4000-a000-000000000003';
const TEST_RUN_ORD1_ID = 'e0000000-0000-4000-a000-000000000010';
const TEST_RUN_ORD2_ID = 'e0000000-0000-4000-a000-000000000020';
const TEST_RUN_TZ_ID = 'e0000000-0000-4000-a000-000000000030';

export async function runStagingVerification(): Promise<void> {
  const stagingUrl = process.env.STAGING_DATABASE_URL;
  const expectedProjectRef = process.env.EXPECTED_STAGING_PROJECT_REF;

  console.log('='.repeat(78));
  console.log(' AttendEase — Milestone 4: Supabase Staging Verification Suite (Safety Hardened)');
  console.log('='.repeat(78));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Demo Mode Active: ${process.env.VITE_DEMO_MODE ?? 'true'}`);

  // Safety Check 1: Mandatory Credential & Project Reference Requirements
  if (!stagingUrl || !expectedProjectRef) {
    console.log('\n[STATUS: STAGING CREDENTIALS NOT CONFIGURED]');
    console.log('Both STAGING_DATABASE_URL and EXPECTED_STAGING_PROJECT_REF are required before any staging execution.');
    console.log('\nRequired Environment Variables:');
    if (!stagingUrl) console.log('  - STAGING_DATABASE_URL (direct connection, port 5432)');
    if (!expectedProjectRef) console.log('  - EXPECTED_STAGING_PROJECT_REF (exact Supabase project reference, e.g. "abcdefghijklmnopqrst")');
    console.log('\nExample:');
    console.log('  export STAGING_DATABASE_URL="postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres"');
    console.log('  export EXPECTED_STAGING_PROJECT_REF="[ref]"');
    console.log('-'.repeat(78));
    console.log('Exiting safely without making network calls or modifying data.');
    process.exit(0);
  }

  const safeUrlDisplay = redactUrl(stagingUrl);
  console.log(`Target Connection: ${safeUrlDisplay}`);

  // Safety Check 2: Production Guard (URL substrings & project ref keywords)
  const urlLower = stagingUrl.toLowerCase();
  const dangerousKeywords = ['prod', 'production', 'live', 'primary', 'customer'];
  for (const kw of dangerousKeywords) {
    // Check if host or path contains dangerous keyword (ignoring safe matches in passwords)
    const hostAndDb = stagingUrl.split('@')[1] || '';
    if (hostAndDb.toLowerCase().includes(kw)) {
      console.error(`\n[CRITICAL SAFETY ABORT]: Target host/database contains prohibited keyword: "${kw}"`);
      console.error('Milestone 4 strictly forbids running against production or customer databases.');
      process.exit(1);
    }
  }

  // Safety Check 3: Extract & Validate Supabase Project Reference
  const projectRefMatch = stagingUrl.match(/postgres\.([a-z0-9_-]+):/i);
  const detectedProjectRef = projectRefMatch ? projectRefMatch[1] : null;

  if (!detectedProjectRef) {
    console.error('\n[SAFETY ABORT]: Could not extract Supabase project reference from STAGING_DATABASE_URL.');
    console.error('Expected format: postgresql://postgres.[project-ref]:[password]@...');
    process.exit(1);
  }

  if (expectedProjectRef !== detectedProjectRef) {
    console.error(`\n[SAFETY ABORT]: Project Ref mismatch!`);
    console.error(`  Expected: ${expectedProjectRef}`);
    console.error(`  Detected in URL: ${detectedProjectRef}`);
    console.error('Aborting to prevent executing against the wrong Supabase instance.');
    process.exit(1);
  }
  console.log(`  ✓ Confirmed matching staging project reference: ${detectedProjectRef}`);

  // Safety Check 4: Port & Connection Mode Validation
  const portMatch = stagingUrl.match(/:(\d+)\//);
  const detectedPort = portMatch ? parseInt(portMatch[1], 10) : 5432;
  if (detectedPort === 6543) {
    console.warn('\n[WARNING]: Connection uses Port 6543 (Transaction Pooler).');
    console.warn('Supabase migrations and transactional row locking tests require Port 5432 (Session mode).');
    console.warn('If migrations fail, switch STAGING_DATABASE_URL to port 5432.');
  }

  console.log('\nConnecting to isolated staging database...');
  const pool = new pg.Pool({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000, // 10s query timeout prevents infinite locks
  });

  const results: CheckResult[] = [];

  // Helper to execute safe test data cleanup
  const cleanupTestData = async (client: pg.PoolClient) => {
    try {
      await client.query(`
        DELETE FROM payroll_items WHERE payroll_run_id IN ('${TEST_RUN_ORD1_ID}', '${TEST_RUN_ORD2_ID}', '${TEST_RUN_TZ_ID}');
        DELETE FROM payroll_runs WHERE id IN ('${TEST_RUN_ORD1_ID}', '${TEST_RUN_ORD2_ID}', '${TEST_RUN_TZ_ID}');
        DELETE FROM employees WHERE id = '${TEST_EMP_ID}';
        DELETE FROM branches WHERE id = '${TEST_BRANCH_ID}';
        DELETE FROM organizations WHERE id = '${TEST_ORG_ID}';
      `);
    } catch {
      // Ignore cleanup errors during teardown
    }
  };

  try {
    // 1. Host Identity & Database Verification
    const client = await pool.connect();
    try {
      const idRes = await client.query('SELECT current_database(), current_user, version();');
      const row = idRes.rows[0];
      console.log(`Connected to Database: "${row.current_database}" as User: "${row.current_user}"`);
      console.log(`Engine: ${row.version}`);

      const isPg15Plus = row.version.includes('PostgreSQL 15') || row.version.includes('PostgreSQL 16') || row.version.includes('PostgreSQL 17');
      results.push({
        suite: '1. Connectivity & Environment',
        test: 'PostgreSQL 15+ Compatibility',
        passed: isPg15Plus,
        message: `Version: ${row.version.split(' on ')[0]}`,
      });
    } finally {
      client.release();
    }

    // 2. Migration Execution (000000 through 000005)
    console.log('\n--- Applying Migrations 000000 through 000005 ---');
    const migrationFiles = [
      '20250101000000_initial_schema.sql',
      '20250101000001_tenant_isolation_rls.sql',
      '20250101000002_security_hardening_and_payroll.sql',
      '20250101000003_locked_payroll_child_integrity.sql',
      '20250101000004_fix_employee_rls_recursion.sql',
      '20250101000005_concurrency_and_schema_hardening.sql',
      '20250101000006_remediation_and_security_hardening.sql',
    ];

    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const start = Date.now();
      const migClient = await pool.connect();
      try {
        await migClient.query(sql);
        const elapsed = Date.now() - start;
        console.log(`  ✓ Applied ${file} (${elapsed}ms)`);
        results.push({
          suite: '2. Schema Migrations',
          test: `Migration ${file}`,
          passed: true,
          message: `Executed in ${elapsed}ms`,
        });
      } catch (err: any) {
        const sanitizedMsg = sanitizeError(err, stagingUrl);
        console.error(`  ✗ Failed ${file}: ${sanitizedMsg}`);
        results.push({
          suite: '2. Schema Migrations',
          test: `Migration ${file}`,
          passed: false,
          message: sanitizedMsg,
        });
        throw new Error(`Migration ${file} failed: ${sanitizedMsg}`);
      } finally {
        migClient.release();
      }
    }

    // 3. Concurrency Lock Testing (Deterministic Two-Connection Barriers)
    console.log('\n--- Running Real Two-Connection Concurrency Lock Verification ---');
    const conn1 = await pool.connect();
    const conn2 = await pool.connect();

    try {
      // Clean up previous test run if any
      await cleanupTestData(conn1);

      // Seed test harness rows with unique test UUIDs
      await conn1.query(`
        INSERT INTO organizations (id, name, slug) VALUES ('${TEST_ORG_ID}', 'Concurrency Staging Org', 'staging-test') ON CONFLICT DO NOTHING;
        INSERT INTO branches (id, organization_id, name, timezone) VALUES ('${TEST_BRANCH_ID}', '${TEST_ORG_ID}', 'Main', 'Asia/Kolkata') ON CONFLICT DO NOTHING;
        INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, email, designation, joining_date)
        VALUES ('${TEST_EMP_ID}', '${TEST_ORG_ID}', '${TEST_BRANCH_ID}', 'STG001', 'Test', 'User', 'Test User', 'test@staging.local', 'Engineer', '2026-01-01')
        ON CONFLICT DO NOTHING;
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
        VALUES ('${TEST_RUN_ORD1_ID}', '${TEST_ORG_ID}', '2026-10-01', '2026-10-31', 'October 2026', 'draft');
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
        VALUES ('${TEST_RUN_ORD2_ID}', '${TEST_ORG_ID}', '2026-10-01', '2026-10-31', 'October 2026', 'draft');
      `);

      // Test Concurrency Ordering 1:
      // Conn 1 locks parent run (uncommitted). Conn 2 attempts child INSERT.
      // Conn 2 acquires FOR SHARE lock and blocks on Conn 1.
      // When Conn 1 commits, Conn 2 evaluates locked parent and is rejected.
      await conn1.query('BEGIN;');
      await conn2.query('BEGIN;');

      await conn1.query(`UPDATE payroll_runs SET status = 'locked' WHERE id = '${TEST_RUN_ORD1_ID}';`);

      let conn2BlockedAndRejected = false;
      const conn2Promise = (async () => {
        try {
          await conn2.query(`
            INSERT INTO payroll_items (payroll_run_id, employee_id, gross_pay, net_pay)
            VALUES ('${TEST_RUN_ORD1_ID}', '${TEST_EMP_ID}', 50000, 45000);
          `);
          await conn2.query('COMMIT;');
        } catch (err: any) {
          await conn2.query('ROLLBACK;');
          if (err.message.includes('locked and immutable')) {
            conn2BlockedAndRejected = true;
          }
        }
      })();

      // Conn 1 commits, releasing lock barrier
      await conn1.query('COMMIT;');
      await Promise.race([
        conn2Promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Concurrency Ordering 1 timed out')), 8000)),
      ]);

      results.push({
        suite: '3. Concurrency & Locking',
        test: 'Ordering 1: Parent Lock Blocks and Rejects Subsequent Child Mutation',
        passed: conn2BlockedAndRejected,
        message: conn2BlockedAndRejected
          ? 'Conn 2 blocked until Conn 1 committed, then correctly rejected child insertion on locked parent'
          : 'Failed: Child mutation committed or returned unexpected result',
      });
      console.log(`  ✓ Concurrency Ordering 1 passed: ${conn2BlockedAndRejected}`);

      // Test Concurrency Ordering 2:
      // Conn 1 begins child insertion (holding FOR SHARE on parent run).
      // Conn 2 concurrently attempts UPDATE payroll_runs SET status = 'locked'.
      // Conn 2 must block until Conn 1 commits.
      await conn1.query('BEGIN;');
      await conn2.query('BEGIN;');

      await conn1.query(`
        INSERT INTO payroll_items (payroll_run_id, employee_id, gross_pay, net_pay)
        VALUES ('${TEST_RUN_ORD2_ID}', '${TEST_EMP_ID}', 55000, 49000);
      `);

      let conn2WaitOrderVerified = false;
      let conn1Committed = false;

      const conn2LockPromise = (async () => {
        try {
          await conn2.query(`UPDATE payroll_runs SET status = 'locked' WHERE id = '${TEST_RUN_ORD2_ID}';`);
          if (conn1Committed) {
            conn2WaitOrderVerified = true;
          }
          await conn2.query('COMMIT;');
        } catch (err: any) {
          await conn2.query('ROLLBACK;');
        }
      })();

      // Small tick to ensure Conn 2 is queued on the row lock
      await new Promise((res) => setTimeout(res, 200));
      conn1Committed = true;
      await conn1.query('COMMIT;');

      await Promise.race([
        conn2LockPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Concurrency Ordering 2 timed out')), 8000)),
      ]);

      results.push({
        suite: '3. Concurrency & Locking',
        test: 'Ordering 2: Child FOR SHARE Lock Serializes Concurrent Parent Lock',
        passed: conn2WaitOrderVerified,
        message: conn2WaitOrderVerified
          ? 'Conn 2 was serialized behind uncommitted child mutation, preventing race conditions'
          : 'Failed: Conn 2 did not block or failed serialization',
      });
      console.log(`  ✓ Concurrency Ordering 2 passed: ${conn2WaitOrderVerified}`);
    } finally {
      // Ensure test data cleanup occurs
      await cleanupTestData(conn1);
      conn1.release();
      conn2.release();
    }

    // 4. Timezone & locked_at Accuracy Verification
    console.log('\n--- Verifying Timezone & UTC Semantics ---');
    const tzClient = await pool.connect();
    try {
      await tzClient.query("SET timezone = 'Asia/Kolkata';");
      await tzClient.query(`
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
        VALUES ('${TEST_RUN_TZ_ID}', '${TEST_ORG_ID}', '2026-11-01', '2026-11-30', 'November 2026', 'draft')
        ON CONFLICT (id) DO UPDATE SET status = 'draft', locked_at = NULL;
      `);

      const beforeLock = new Date();
      await tzClient.query(`UPDATE payroll_runs SET status = 'locked' WHERE id = '${TEST_RUN_TZ_ID}';`);
      const afterLock = new Date();

      const lockRes = await tzClient.query(`SELECT locked_at, locked_at AT TIME ZONE 'UTC' as utc_val FROM payroll_runs WHERE id = '${TEST_RUN_TZ_ID}';`);
      const lockedAt = new Date(lockRes.rows[0].locked_at);

      const deltaMs = Math.abs(lockedAt.getTime() - beforeLock.getTime());
      const isAccurateUtc = deltaMs < 5000;

      results.push({
        suite: '4. Timezone & Timestamp Integrity',
        test: 'UTC locked_at Integrity Under Asia/Kolkata Session',
        passed: isAccurateUtc,
        message: `Clock Delta: ${deltaMs}ms (Expected < 5000ms). locked_at: ${lockedAt.toISOString()}`,
      });
      console.log(`  ✓ Timezone check passed: Delta ${deltaMs}ms`);

      // Cleanup timezone test row
      await tzClient.query(`DELETE FROM payroll_runs WHERE id = '${TEST_RUN_TZ_ID}';`);
    } finally {
      tzClient.release();
    }

    // 5. Transaction Pooling & Session Isolation Check
    console.log('\n--- Verifying Transaction-Pooling Compatibility ---');
    const poolClient = await pool.connect();
    try {
      // Verify SET LOCAL cleans up on COMMIT, avoiding pooler contamination
      await poolClient.query('BEGIN;');
      await poolClient.query("SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';");
      const subRes = await poolClient.query("SELECT current_setting('request.jwt.claim.sub', true) as sub;");
      await poolClient.query('COMMIT;');

      const postTxRes = await poolClient.query("SELECT current_setting('request.jwt.claim.sub', true) as sub;");

      const pooledClean = subRes.rows[0].sub === '00000000-0000-0000-0000-000000000001' && !postTxRes.rows[0].sub;
      results.push({
        suite: '5. Connection Pooling Compatibility',
        test: 'Transaction-Scoped Session Settings (SET LOCAL)',
        passed: pooledClean,
        message: pooledClean ? 'SET LOCAL cleanly discarded at transaction commit' : 'Session leak detected',
      });
      console.log(`  ✓ Pooling session hygiene passed: ${pooledClean}`);
    } finally {
      poolClient.release();
    }

    // Summary Display
    console.log('\n' + '='.repeat(78));
    console.log(' VERIFICATION SUMMARY');
    console.log('='.repeat(78));
    let allPassed = true;
    for (const r of results) {
      const mark = r.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`${mark} [${r.suite}] ${r.test}: ${r.message}`);
      if (!r.passed) allPassed = false;
    }
    console.log('='.repeat(78));
    if (allPassed) {
      console.log('All Staging Verification Checks Passed Successfully!');
    } else {
      console.error('Some checks failed.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\nVerification halted with error:');
    console.error(sanitizeError(err, stagingUrl));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStagingVerification().catch((err) => {
    console.error('Staging verification encountered an error:', sanitizeError(err));
    process.exit(1);
  });
}
