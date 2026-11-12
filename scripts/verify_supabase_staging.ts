import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

// Preserve shell variables, prefer .env.local over .env, and never commit these files.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface CheckResult {
  suite: string;
  test: string;
  passed: boolean;
  message: string;
  detail?: string;
}

/**
 * Parse only recognized Supabase database URL formats. Direct connections carry
 * the ref in db.<ref>.supabase.co; pooler connections carry it in postgres.<ref>.
 */
export function extractSupabaseProjectRef(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('STAGING_DATABASE_URL must use the postgres or postgresql protocol.');
  }

  const hostname = url.hostname.toLowerCase();
  const directMatch = hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (directMatch) return directMatch[1];

  if (hostname.endsWith('.pooler.supabase.com')) {
    const username = decodeURIComponent(url.username);
    const poolerMatch = username.match(/^postgres\.([a-z0-9]{20})$/);
    if (poolerMatch) return poolerMatch[1];
  }

  throw new Error('Unrecognized Supabase database host. Use a direct db.<project-ref>.supabase.co URL or a Supabase pooler URL with postgres.<project-ref> username.');
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
const TEST_BRANCH_2_ID = 'e0000000-0000-4000-a000-000000000004';
const TEST_EMP_2_ID = 'e0000000-0000-4000-a000-000000000005';
const TEST_ORG_B_ID = 'e0000000-0000-4000-a000-000000000006';
const TEST_BRANCH_B_ID = 'e0000000-0000-4000-a000-000000000007';
const TEST_EMP_B_ID = 'e0000000-0000-4000-a000-000000000008';
const TEST_RLS_USER_ID = 'e0000000-0000-4000-a000-000000000009';
const TEST_OTHER_USER_ID = 'e0000000-0000-4000-a000-00000000000a';
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
  let detectedProjectRef: string;
  let parsedConnectionUrl: URL;
  try {
    parsedConnectionUrl = new URL(stagingUrl);
    detectedProjectRef = extractSupabaseProjectRef(stagingUrl);
  } catch (error) {
    console.error('\n[SAFETY ABORT]: Invalid or unrecognized Supabase connection URL.');
    console.error(error instanceof Error ? error.message : 'URL parsing failed.');
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
  const detectedPort = parsedConnectionUrl.port ? Number(parsedConnectionUrl.port) : 5432;
  if (detectedPort !== 5432) {
    console.error(`\n[SAFETY ABORT]: Port ${detectedPort} is not supported for migration and row-lock verification.`);
    console.error('Use Supabase Direct Connection or Session Pooler on port 5432. Transaction Pooler port 6543 is not supported.');
    process.exit(1);
  }

  console.log('\nConnecting to isolated staging database...');
  const pool = new pg.Pool({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000, // 10s query timeout prevents infinite locks
  });

  const results: CheckResult[] = [];

  // Test tenants use reserved UUIDs and marker codes. Validate both markers before
  // deleting anything, then remove dependent rows explicitly in FK-safe order.
  const cleanupTestData = async (client: pg.PoolClient) => {
    const [primaryTenant, secondaryTenant] = await Promise.all([
      client.query('SELECT code FROM organizations WHERE id = $1', [TEST_ORG_ID]),
      client.query('SELECT code FROM organizations WHERE id = $1', [TEST_ORG_B_ID]),
    ]);
    if (primaryTenant.rowCount && primaryTenant.rows[0].code !== 'ATTENDEASE_STAGING_TEST') {
      throw new Error('Refusing to clean primary test UUID: organization marker does not match.');
    }
    if (secondaryTenant.rowCount && secondaryTenant.rows[0].code !== 'ATTENDEASE_STAGING_TEST_B') {
      throw new Error('Refusing to clean secondary test UUID: organization marker does not match.');
    }
    if (!primaryTenant.rowCount && !secondaryTenant.rowCount) {
      await client.query(
        'DELETE FROM user_profiles WHERE id = ANY($1::uuid[]) AND email = ANY($2::text[])',
        [
          [TEST_RLS_USER_ID, TEST_OTHER_USER_ID],
          ['staging-rls-manager@attendease.invalid', 'staging-rls-coworker@attendease.invalid'],
        ],
      );
      return;
    }

    await client.query('BEGIN');
    try {
      // Locked payroll test runs are intentionally immutable. Temporarily disable
      // only the two named application immutability triggers inside this isolated
      // cleanup transaction; rollback re-enables them automatically on any failure.
      await client.query('ALTER TABLE payroll_items DISABLE TRIGGER trg_payroll_item_lock_integrity');
      await client.query('ALTER TABLE payroll_runs DISABLE TRIGGER trg_prevent_locked_payroll_modification');
      for (const organizationId of [TEST_ORG_ID, TEST_ORG_B_ID]) {
        await client.query('DELETE FROM payslips WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM payroll_items WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM payroll_runs WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM leave_requests WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM attendance_corrections WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM attendance_daily_summaries WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM attendance_events WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM device_employee_mappings WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM device_sync_logs WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM attendance_devices WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM employee_salary_assignments WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM employees WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM departments WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM shifts WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM branches WHERE organization_id = $1', [organizationId]);
      }
      await client.query(
        'DELETE FROM organizations WHERE id = $1 AND code = $2',
        [TEST_ORG_ID, 'ATTENDEASE_STAGING_TEST'],
      );
      await client.query(
        'DELETE FROM organizations WHERE id = $1 AND code = $2',
        [TEST_ORG_B_ID, 'ATTENDEASE_STAGING_TEST_B'],
      );
      await client.query(
        'DELETE FROM user_profiles WHERE id = ANY($1::uuid[]) AND email = ANY($2::text[])',
        [
          [TEST_RLS_USER_ID, TEST_OTHER_USER_ID],
          ['staging-rls-manager@attendease.invalid', 'staging-rls-coworker@attendease.invalid'],
        ],
      );
      await client.query('ALTER TABLE payroll_runs ENABLE TRIGGER trg_prevent_locked_payroll_modification');
      await client.query('ALTER TABLE payroll_items ENABLE TRIGGER trg_payroll_item_lock_integrity');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  };

  const waitForLockWait = async (observer: pg.PoolClient, blockedPid: number, timeoutMs = 7000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await observer.query(
        "SELECT wait_event_type, wait_event FROM pg_stat_activity WHERE pid = $1",
        [blockedPid],
      );
      if (state.rows[0]?.wait_event_type === 'Lock') return state.rows[0];
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`PostgreSQL backend ${blockedPid} did not enter a lock wait within ${timeoutMs}ms.`);
  };

  try {
    // 1. Host Identity & Database Verification
    const client = await pool.connect();
    try {
      const idRes = await client.query("SELECT current_database(), current_user, version(), current_setting('server_version_num')::integer AS server_version_num;");
      const row = idRes.rows[0];
      console.log(`Connected to Database: "${row.current_database}" as User: "${row.current_user}"`);
      console.log(`Engine: ${row.version}`);

      const isPg15Plus = Number(row.server_version_num) >= 150000;
      results.push({
        suite: '1. Connectivity & Environment',
        test: 'PostgreSQL 15+ Compatibility',
        passed: isPg15Plus,
        message: `Version: ${row.version.split(' on ')[0]}`,
      });
    } finally {
      client.release();
    }

    // 2. Migration Execution (forward-only, checksummed, transactional)
    console.log('\n--- Applying verified migrations 000000 through 000008 ---');
    const migrationFiles = [
      '20250101000000_initial_schema.sql',
      '20250101000001_tenant_isolation_rls.sql',
      '20250101000002_security_hardening_and_payroll.sql',
      '20250101000003_locked_payroll_child_integrity.sql',
      '20250101000004_fix_employee_rls_recursion.sql',
      '20250101000005_concurrency_and_schema_hardening.sql',
      '20250101000006_remediation_and_security_hardening.sql',
      '20250101000007_branch_scope_rls_hardening.sql',
      '20250101000008_remaining_tenant_and_payroll_integrity.sql',
    ];

    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

    // Never adopt an existing schema with unknown history. This runner is for a
    // newly-created, isolated staging database only.
    const existingState = await pool.query(`
      SELECT
        to_regclass('public.organizations') IS NOT NULL AS has_organizations,
        to_regclass('attendease_private.attendease_schema_migrations') IS NOT NULL AS has_history
    `);
    if (existingState.rows[0].has_organizations && !existingState.rows[0].has_history) {
      throw new Error('Staging database already contains an organizations table but has no AttendEase migration history. Refusing to guess its schema state.');
    }
    if (!existingState.rows[0].has_history) {
      const otherTables = await pool.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'attendease_schema_migrations'
        LIMIT 1
      `);
      if (otherTables.rowCount) {
        throw new Error(`Staging database is not empty (found public table ${otherTables.rows[0].tablename}). Use a fresh isolated staging project.`);
      }
    }
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS attendease_private AUTHORIZATION postgres;
      REVOKE ALL ON SCHEMA attendease_private FROM PUBLIC, anon, authenticated;
      GRANT USAGE, CREATE ON SCHEMA attendease_private TO postgres;
      CREATE TABLE IF NOT EXISTS attendease_private.attendease_schema_migrations (
        migration_name text PRIMARY KEY,
        checksum_sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      REVOKE ALL ON TABLE attendease_private.attendease_schema_migrations FROM PUBLIC, anon, authenticated, service_role;
      GRANT ALL ON TABLE attendease_private.attendease_schema_migrations TO postgres;
    `);

    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = await pool.query(
        'SELECT checksum_sha256 FROM attendease_private.attendease_schema_migrations WHERE migration_name = $1',
        [file],
      );
      if (prior.rowCount) {
        if (prior.rows[0].checksum_sha256 !== checksum) {
          throw new Error(`Migration checksum mismatch for ${file}. Do not rewrite an already-applied migration.`);
        }
        console.log(`  ↷ Already applied ${file}; checksum verified.`);
        results.push({ suite: '2. Schema Migrations', test: `Migration ${file}`, passed: true, message: 'Already applied; checksum verified.' });
        continue;
      }

      const start = Date.now();
      const migClient = await pool.connect();
      try {
        await migClient.query('BEGIN');
        await migClient.query(sql);
        await migClient.query(
          'INSERT INTO attendease_private.attendease_schema_migrations (migration_name, checksum_sha256) VALUES ($1, $2)',
          [file, checksum],
        );
        await migClient.query('COMMIT');
        const elapsed = Date.now() - start;
        console.log(`  ✓ Applied ${file} (${elapsed}ms)`);
        results.push({
          suite: '2. Schema Migrations',
          test: `Migration ${file}`,
          passed: true,
          message: `Executed transactionally in ${elapsed}ms`,
        });
      } catch (err: any) {
        await migClient.query('ROLLBACK').catch(() => undefined);
        const sanitizedMsg = sanitizeError(err, stagingUrl);
        console.error(`  ✗ Failed ${file}: ${sanitizedMsg}`);
        results.push({ suite: '2. Schema Migrations', test: `Migration ${file}`, passed: false, message: sanitizedMsg });
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
        INSERT INTO organizations (id, name, code) VALUES ('${TEST_ORG_ID}', 'AttendEase Staging Test Organization', 'ATTENDEASE_STAGING_TEST') ON CONFLICT (id) DO NOTHING;
        INSERT INTO branches (id, organization_id, name, code) VALUES ('${TEST_BRANCH_ID}', '${TEST_ORG_ID}', 'Staging Test Branch', 'ATTENDEASE_STAGING_TEST_BRANCH') ON CONFLICT (id) DO NOTHING;
        INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, email, designation, joining_date)
        VALUES ('${TEST_EMP_ID}', '${TEST_ORG_ID}', '${TEST_BRANCH_ID}', 'STG001', 'Test', 'User', 'Test User', 'test@staging.local', 'Engineer', '2026-01-01')
        ON CONFLICT DO NOTHING;
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
        VALUES ('${TEST_RUN_ORD1_ID}', '${TEST_ORG_ID}', '2026-10-01', '2026-10-31', 'October 2026', 'draft');
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
        VALUES ('${TEST_RUN_ORD2_ID}', '${TEST_ORG_ID}', '2026-10-01', '2026-10-31', 'October 2026', 'draft');
        INSERT INTO branches (id, organization_id, name, code) VALUES ('${TEST_BRANCH_2_ID}', '${TEST_ORG_ID}', 'Second Staging Branch', 'ATTENDEASE_STAGING_TEST_BRANCH_2');
        INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, email, designation, joining_date)
        VALUES ('${TEST_EMP_2_ID}', '${TEST_ORG_ID}', '${TEST_BRANCH_2_ID}', 'STG002', 'Branch', 'Two', 'Branch Two', 'branch.two@staging.local', 'Engineer', '2026-01-01');
        INSERT INTO organizations (id, name, code) VALUES ('${TEST_ORG_B_ID}', 'AttendEase Second Staging Tenant', 'ATTENDEASE_STAGING_TEST_B');
        INSERT INTO branches (id, organization_id, name, code) VALUES ('${TEST_BRANCH_B_ID}', '${TEST_ORG_B_ID}', 'Other Tenant Branch', 'ATTENDEASE_STAGING_TEST_B_BRANCH');
        INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, email, designation, joining_date)
        VALUES ('${TEST_EMP_B_ID}', '${TEST_ORG_B_ID}', '${TEST_BRANCH_B_ID}', 'STGB001', 'Other', 'Tenant', 'Other Tenant', 'other.tenant@staging.local', 'Engineer', '2026-01-01');
        INSERT INTO user_profiles (id, email, full_name) VALUES
          ('${TEST_RLS_USER_ID}', 'staging-rls-manager@attendease.invalid', 'Staging RLS Manager'),
          ('${TEST_OTHER_USER_ID}', 'staging-rls-coworker@attendease.invalid', 'Staging RLS Co-worker');
        INSERT INTO organization_members (organization_id, user_id, role, assigned_branch_id) VALUES
          ('${TEST_ORG_ID}', '${TEST_RLS_USER_ID}', 'branch_manager', '${TEST_BRANCH_ID}'),
          ('${TEST_ORG_ID}', '${TEST_OTHER_USER_ID}', 'employee', '${TEST_BRANCH_2_ID}');
        INSERT INTO attendance_daily_summaries (organization_id, employee_id, work_date, status)
        VALUES
          ('${TEST_ORG_ID}', '${TEST_EMP_ID}', '2026-11-01', 'present'),
          ('${TEST_ORG_ID}', '${TEST_EMP_2_ID}', '2026-11-01', 'present'),
          ('${TEST_ORG_B_ID}', '${TEST_EMP_B_ID}', '2026-11-01', 'present');
      `);

      // Test Concurrency Ordering 1:
      // Conn 1 locks parent run (uncommitted). Conn 2 attempts child INSERT.
      // Conn 2 acquires FOR SHARE lock and blocks on Conn 1.
      // When Conn 1 commits, Conn 2 evaluates locked parent and is rejected.
      await conn1.query('BEGIN;');
      await conn2.query('BEGIN;');

      await conn1.query(`UPDATE payroll_runs SET status = 'locked' WHERE id = '${TEST_RUN_ORD1_ID}';`);

      let conn2BlockedAndRejected = false;
      const blockedPid1 = Number((await conn2.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      const conn2Promise = (async () => {
        try {
          await conn2.query(`
            INSERT INTO payroll_items (payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
            VALUES ('${TEST_RUN_ORD1_ID}', '${TEST_ORG_ID}', '${TEST_EMP_ID}', 50000, 45000);
          `);
          await conn2.query('COMMIT;');
          return { committed: true, code: null, message: '' };
        } catch (err: any) {
          await conn2.query('ROLLBACK');
          return { committed: false, code: err.code, message: err.message };
        }
      })();

      await waitForLockWait(conn1, blockedPid1);
      await conn1.query('COMMIT;');
      const ordering1Result = await conn2Promise;
      conn2BlockedAndRejected = !ordering1Result.committed && ordering1Result.code === '23000'
        && ordering1Result.message.includes('locked and immutable');

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
        INSERT INTO payroll_items (payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
        VALUES ('${TEST_RUN_ORD2_ID}', '${TEST_ORG_ID}', '${TEST_EMP_ID}', 55000, 49000);
      `);

      const blockedPid2 = Number((await conn2.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      let conn2WaitOrderVerified = false;
      const conn2LockPromise = (async () => {
        try {
          await conn2.query(`UPDATE payroll_runs SET status = 'locked' WHERE id = '${TEST_RUN_ORD2_ID}';`);
          await conn2.query('COMMIT;');
          return { committed: true };
        } catch (error) {
          await conn2.query('ROLLBACK').catch(() => undefined);
          return { committed: false, error };
        }
      })();

      await waitForLockWait(conn1, blockedPid2);
      conn2WaitOrderVerified = true;
      await conn1.query('COMMIT;');
      const ordering2Result = await conn2LockPromise;
      conn2WaitOrderVerified = conn2WaitOrderVerified && ordering2Result.committed;

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
      // Roll back any open work before returning either connection to the pool.
      await conn1.query('ROLLBACK').catch(() => undefined);
      await conn2.query('ROLLBACK').catch(() => undefined);
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

      // Cleanup is performed once, after every test that depends on the test tenant.
    } finally {
      tzClient.release();
    }

    // 5. Hosted PostgreSQL RLS behavior using synthetic authenticated identities.
    // Exercise the actual policy layer, not a client-side organization filter.
    console.log('\n--- Verifying Tenant, Branch and Profile RLS ---');
    const rlsClient = await pool.connect();
    try {
      await rlsClient.query('BEGIN');
      await rlsClient.query('SET LOCAL ROLE authenticated');
      await rlsClient.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [TEST_RLS_USER_ID]);
      await rlsClient.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");

      const tenantRows = await rlsClient.query(
        'SELECT id FROM organizations WHERE id = ANY($1::uuid[])',
        [[TEST_ORG_ID, TEST_ORG_B_ID]],
      );
      const branchRows = await rlsClient.query(
        'SELECT id FROM branches WHERE id = ANY($1::uuid[])',
        [[TEST_BRANCH_ID, TEST_BRANCH_2_ID, TEST_BRANCH_B_ID]],
      );
      const employeeRows = await rlsClient.query(
        'SELECT id FROM employees WHERE organization_id = ANY($1::uuid[])',
        [[TEST_ORG_ID, TEST_ORG_B_ID]],
      );
      const summaryRows = await rlsClient.query(
        'SELECT employee_id FROM attendance_daily_summaries WHERE organization_id = ANY($1::uuid[])',
        [[TEST_ORG_ID, TEST_ORG_B_ID]],
      );
      const profileRows = await rlsClient.query(
        'SELECT id FROM user_profiles WHERE id = ANY($1::uuid[])',
        [[TEST_RLS_USER_ID, TEST_OTHER_USER_ID]],
      );

      const tenantIsolated = tenantRows.rowCount === 1 && tenantRows.rows[0].id === TEST_ORG_ID;
      const branchScoped = employeeRows.rowCount === 1 && employeeRows.rows[0].id === TEST_EMP_ID;
      const branchDirectoryScoped = branchRows.rowCount === 1 && branchRows.rows[0].id === TEST_BRANCH_ID;
      const summaryScoped = summaryRows.rowCount === 1 && summaryRows.rows[0].employee_id === TEST_EMP_ID;
      const profilePrivate = profileRows.rowCount === 1 && profileRows.rows[0].id === TEST_RLS_USER_ID;

      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Cross-tenant organization isolation',
        passed: tenantIsolated,
        message: tenantIsolated ? 'Authenticated branch manager sees only the assigned organization.' : `Unexpected visible organization count: ${tenantRows.rowCount}`,
      });
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Branch-manager branch directory isolation',
        passed: branchDirectoryScoped,
        message: branchDirectoryScoped ? 'Branch manager sees only the assigned branch.' : `Unexpected visible branch count: ${branchRows.rowCount}`,
      });
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Branch-manager employee isolation',
        passed: branchScoped,
        message: branchScoped ? 'Branch manager sees employees only in the assigned branch.' : `Unexpected visible employee count: ${employeeRows.rowCount}`,
      });
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Branch-manager daily summary isolation',
        passed: summaryScoped,
        message: summaryScoped ? 'Branch manager sees daily summaries only for the assigned branch.' : `Unexpected visible summary count: ${summaryRows.rowCount}`,
      });
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'User profile privacy',
        passed: profilePrivate,
        message: profilePrivate ? 'User can read their own profile but not a co-member profile.' : `Unexpected visible profile count: ${profileRows.rowCount}`,
      });

      await rlsClient.query('SAVEPOINT cross_tenant_write');
      let crossTenantEmployeeWriteDenied = false;
      try {
        await rlsClient.query(
          `INSERT INTO employees (organization_id, branch_id, employee_code, first_name, last_name, display_name, designation, joining_date)
           VALUES ($1, $2, 'STG-BLOCKED', 'Blocked', 'Write', 'Blocked Write', 'Test', '2026-01-01')`,
          [TEST_ORG_B_ID, TEST_BRANCH_B_ID],
        );
      } catch (error: any) {
        crossTenantEmployeeWriteDenied = error.code === '42501';
        await rlsClient.query('ROLLBACK TO SAVEPOINT cross_tenant_write');
      }
      await rlsClient.query('RELEASE SAVEPOINT cross_tenant_write');
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Cross-tenant employee write denied',
        passed: crossTenantEmployeeWriteDenied,
        message: crossTenantEmployeeWriteDenied ? 'Branch manager cannot create an employee in another tenant.' : 'Cross-tenant employee insert was not denied as expected.',
      });

      await rlsClient.query('SAVEPOINT raw_event_write');
      let rawEventWriteDenied = false;
      try {
        await rlsClient.query(
          `INSERT INTO attendance_events (organization_id, employee_id, device_user_id, event_time, event_type)
           VALUES ($1, $2, 'STAGING-UNTRUSTED', now(), 'check_in')`,
          [TEST_ORG_ID, TEST_EMP_ID],
        );
      } catch (error: any) {
        rawEventWriteDenied = error.code === '42501';
        await rlsClient.query('ROLLBACK TO SAVEPOINT raw_event_write');
      }
      await rlsClient.query('RELEASE SAVEPOINT raw_event_write');
      results.push({
        suite: '6. Hosted RLS Isolation',
        test: 'Browser-authenticated raw attendance event insertion denied',
        passed: rawEventWriteDenied,
        message: rawEventWriteDenied ? 'Authenticated client cannot manufacture raw device punches.' : 'Raw attendance event write was not denied as expected.',
      });

      await rlsClient.query('ROLLBACK');
    } catch (error) {
      await rlsClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      rlsClient.release();
    }

    // 7. SET LOCAL hygiene check (does not claim to certify a separate transaction pooler).
    console.log('\n--- Verifying transaction-scoped session-setting cleanup ---');
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
        test: 'Transaction-scoped setting is cleared on commit (same server session)',
        passed: pooledClean,
        message: pooledClean ? 'SET LOCAL cleanly discarded at transaction commit' : 'Session leak detected',
      });
      console.log(`  ✓ Pooling session hygiene passed: ${pooledClean}`);
    } finally {
      poolClient.release();
    }

    // Clean test tenants before declaring the suite successful. The finally
    // block repeats this idempotently as a failure-path safeguard.
    const finalCleanupClient = await pool.connect();
    try {
      await cleanupTestData(finalCleanupClient);
    } finally {
      finalCleanupClient.release();
    }
    results.push({
      suite: '8. Test Data Cleanup',
      test: 'Marked staging test rows and profiles removed',
      passed: true,
      message: 'Reserved synthetic tenant IDs, dependent rows and synthetic profile records were removed.',
    });

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
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error('\nVerification halted with error:');
    console.error(sanitizeError(err, stagingUrl));
    process.exitCode = 1;
  } finally {
    try {
      const cleanupClient = await pool.connect();
      try {
        await cleanupTestData(cleanupClient);
      } finally {
        cleanupClient.release();
      }
    } catch (cleanupError) {
      console.error('CRITICAL: staging test-data cleanup failed:', sanitizeError(cleanupError, stagingUrl));
      process.exitCode = 1;
    }
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStagingVerification().catch((err) => {
    console.error('Staging verification encountered an error:', sanitizeError(err));
    process.exit(1);
  });
}
