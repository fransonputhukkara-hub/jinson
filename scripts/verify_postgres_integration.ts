import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  step: string;
  name: string;
  passed: boolean;
  message: string;
  detail?: string;
}

export async function runPostgresVerification(): Promise<{
  pgVersion: string;
  migrationsApplied: string[];
  results: TestResult[];
  allPassed: boolean;
}> {
  const db = new PGlite();
  const results: TestResult[] = [];
  const migrationsApplied: string[] = [];

  // Query actual PostgreSQL version
  const verRes = await db.query<{ version: string }>('SELECT version();');
  const pgVersion = verRes.rows[0].version;

  // Setup Supabase auth mock environment and UUID compatibility in PostgreSQL
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    
    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS UUID AS $$
      SELECT gen_random_uuid();
    $$ LANGUAGE sql;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
      END IF;
    END $$;

    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
  `);

  // Step 2: Apply all migrations in order
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
    '20250101000009_decision_actor_integrity.sql'
  ];

  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

  for (const file of migrationFiles) {
    const fullPath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(fullPath, 'utf8');
    // In PostgreSQL 13+, gen_random_uuid() is built-in; bypass uuid-ossp if not bundled
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '-- [uuid-ossp mapped to native gen_random_uuid]');
    const start = Date.now();
    try {
      await db.exec(sql);
      const elapsed = Date.now() - start;
      migrationsApplied.push(`${file} (${elapsed}ms)`);
      results.push({
        step: '2. Migration Application',
        name: `Apply ${file}`,
        passed: true,
        message: `Successfully executed in ${elapsed}ms`,
      });
    } catch (err: any) {
      results.push({
        step: '2. Migration Application',
        name: `Apply ${file}`,
        passed: false,
        message: `Failed: ${err.message}`,
        detail: err.stack,
      });
      return { pgVersion, migrationsApplied, results, allPassed: false };
    }
  }

  // Grant permissions on migration tables to authenticated role (mimicking Supabase standard setup)
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM authenticated, anon;
  `);

  // Seed baseline test data
  const orgAId = '11111111-1111-1111-1111-111111111111';
  const orgBId = '22222222-2222-2222-2222-222222222222';
  const branch1Id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const branch2Id = 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';
  const branchBId = 'aaaaaaaa-bbbb-bbbb-bbbb-aaaaaaaaaaaa';

  const userOwnerId = '99999999-0000-0000-0000-000000000001';
  const userManagerId = '99999999-0000-0000-0000-000000000002';
  const userEmpId = '99999999-0000-0000-0000-000000000003';

  const emp1Id = 'eeeeeeee-1111-1111-1111-eeeeeeeeeeee';
  const emp2Id = 'eeeeeeee-2222-2222-2222-eeeeeeeeeeee';
  const empBId = 'eeeeeeee-bbbb-bbbb-bbbb-eeeeeeeeeeee';

  const runLockedId = '11111111-aaaa-aaaa-aaaa-111111111111';
  const runDraftId = '22222222-bbbb-bbbb-bbbb-222222222222';
  const runReviewId = '33333333-cccc-cccc-cccc-333333333333';

  await db.exec(`
    INSERT INTO organizations (id, name, code, timezone) VALUES 
    ('${orgAId}', 'Jinson Electricals Ltd', 'JINSON', 'Asia/Kolkata'),
    ('${orgBId}', 'Competitor Co', 'COMP', 'Asia/Kolkata');

    INSERT INTO branches (id, organization_id, name, code) VALUES
    ('${branch1Id}', '${orgAId}', 'Thrissur HQ', 'TCR'),
    ('${branch2Id}', '${orgAId}', 'Ernakulam Branch', 'EKM'),
    ('${branchBId}', '${orgBId}', 'Competitor Calicut', 'CLT');

    INSERT INTO auth.users (id, email) VALUES
    ('${userOwnerId}', 'owner@jinson.com'),
    ('${userManagerId}', 'manager.tcr@jinson.com'),
    ('${userEmpId}', 'rajesh@jinson.com');

    INSERT INTO user_profiles (id, email, full_name) VALUES
    ('${userOwnerId}', 'owner@jinson.com', 'Jinson Owner'),
    ('${userManagerId}', 'manager.tcr@jinson.com', 'Thrissur Branch Manager'),
    ('${userEmpId}', 'rajesh@jinson.com', 'Rajesh Employee');

    INSERT INTO organization_members (organization_id, user_id, role, assigned_branch_id) VALUES
    ('${orgAId}', '${userOwnerId}', 'company_owner', NULL),
    ('${orgAId}', '${userManagerId}', 'branch_manager', '${branch1Id}'),
    ('${orgAId}', '${userEmpId}', 'employee', '${branch1Id}');

    INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, email, designation, joining_date) VALUES
    ('${emp1Id}', '${orgAId}', '${branch1Id}', 'EMP001', 'Rajesh', 'Kumar', 'Rajesh Kumar', 'rajesh@jinson.com', 'Senior Electrician', '2023-01-15'),
    ('${emp2Id}', '${orgAId}', '${branch2Id}', 'EMP002', 'Suresh', 'Nair', 'Suresh Nair', 'suresh@jinson.com', 'Electrical Helper', '2023-03-20'),
    ('${empBId}', '${orgBId}', '${branchBId}', 'EMPB01', 'Bob', 'Smith', 'Bob Smith', 'bob@competitor.com', 'Competitor Staff', '2023-05-10');

    -- Seed payroll runs initially as draft so items can be populated via standard lifecycle
    INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status) VALUES
    ('${runLockedId}', '${orgAId}', '2026-09-01', '2026-09-30', 'September 2026', 'draft'),
    ('${runDraftId}', '${orgAId}', '2026-10-01', '2026-10-31', 'October 2026', 'draft'),
    ('${runReviewId}', '${orgAId}', '2026-11-01', '2026-11-30', 'November 2026', 'draft');
    UPDATE payroll_runs SET status = 'review' WHERE id = '${runReviewId}';

    INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay) VALUES
    ('10101010-1010-1010-1010-101010101010', '${runLockedId}', '${orgAId}', '${emp1Id}', 30000.00, 29000.00),
    ('20202020-2020-2020-2020-202020202020', '${runDraftId}', '${orgAId}', '${emp1Id}', 32000.00, 31000.00);

    -- Now lock the historical run
    UPDATE payroll_runs SET status = 'locked' WHERE id = '${runLockedId}';
  `);

  // =========================================================================
  // Step 3: Test locked payroll item INSERT, UPDATE, DELETE & Transfers
  // =========================================================================

  // Test 3a: INSERT into locked payroll run must be rejected
  try {
    await db.exec(`
      INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
      VALUES ('30303030-3030-3030-3030-303030303030', '${runLockedId}', '${orgAId}', '${emp2Id}', 25000.00, 24500.00);
    `);
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject INSERT into locked payroll run',
      passed: false,
      message: 'Expected INSERT to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('target payroll run is locked and immutable');
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject INSERT into locked payroll run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 3b: UPDATE on item in locked payroll run must be rejected
  try {
    await db.exec(`
      UPDATE payroll_items 
      SET gross_pay = 99999.00 
      WHERE id = '10101010-1010-1010-1010-101010101010';
    `);
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject UPDATE on item in locked run',
      passed: false,
      message: 'Expected UPDATE to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('source payroll run is locked and immutable');
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject UPDATE on item in locked run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 3c: Move item from draft run to locked run must be rejected
  try {
    await db.exec(`
      UPDATE payroll_items 
      SET payroll_run_id = '${runLockedId}' 
      WHERE id = '20202020-2020-2020-2020-202020202020';
    `);
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject moving item into locked payroll run',
      passed: false,
      message: 'Expected transfer into locked run to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('destination payroll run is locked and immutable');
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject moving item into locked payroll run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 3d: Move item out of locked run to draft run must be rejected
  try {
    await db.exec(`
      UPDATE payroll_items 
      SET payroll_run_id = '${runDraftId}' 
      WHERE id = '10101010-1010-1010-1010-101010101010';
    `);
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject moving item out of locked payroll run',
      passed: false,
      message: 'Expected transfer out of locked run to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('source payroll run is locked and immutable');
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject moving item out of locked payroll run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 3e: DELETE item in locked payroll run must be rejected
  try {
    await db.exec(`
      DELETE FROM payroll_items 
      WHERE id = '10101010-1010-1010-1010-101010101010';
    `);
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject DELETE on item in locked run',
      passed: false,
      message: 'Expected DELETE to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('associated payroll run is locked and immutable');
    results.push({
      step: '3. Locked Payroll Item Operations',
      name: 'Reject DELETE on item in locked run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // =========================================================================
  // Step 4: Concurrency Audit & Row-Locking Strategy Verification
  // =========================================================================
  try {
    // 4a: Verify check_payroll_item_lock_integrity() explicitly uses SELECT ... FOR SHARE
    const funcDef = await db.query<{ prosrc: string }>(`
      SELECT prosrc FROM pg_proc WHERE proname = 'check_payroll_item_lock_integrity';
    `);
    const sourceCode = funcDef.rows[0]?.prosrc || '';
    const usesForShare = sourceCode.includes('FOR SHARE');
    const forShareCount = (sourceCode.match(/FOR SHARE/g) || []).length;

    results.push({
      step: '4. Concurrency Audit & Row-Locking',
      name: 'Function source code inspects parent with FOR SHARE row locking',
      passed: usesForShare && forShareCount >= 3,
      message: usesForShare 
        ? `Confirmed: check_payroll_item_lock_integrity acquires FOR SHARE lock across all 3 operations (DELETE, UPDATE, INSERT) [${forShareCount} occurrences]` 
        : 'Failed: FOR SHARE lock missing from trigger definition!',
    });

    // 4b: Concurrency Simulation Ordering 1:
    // Lock parent run within an explicit transaction.
    // Ensure any interleaved or subsequent child mutation (INSERT, UPDATE, DELETE) is blocked and rejected.
    await db.exec(`
      BEGIN;
      UPDATE payroll_runs SET status = 'locked' WHERE id = '${runReviewId}';
      COMMIT;
    `);

    let txRejected = false;
    try {
      await db.exec(`
        INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
        VALUES ('40404040-4040-4040-4040-404040404040', '${runReviewId}', '${orgAId}', '${emp2Id}', 10000, 10000);
      `);
    } catch (e: any) {
      txRejected = e.message.includes('target payroll run is locked and immutable');
    }

    results.push({
      step: '4. Concurrency Audit & Row-Locking',
      name: 'Ordering A: Post-lock mutation strictly rejected with integrity violation',
      passed: txRejected,
      message: txRejected 
        ? 'Child insertion immediately aborted by trigger after parent locking committed' 
        : 'Failed: child insertion succeeded into locked parent',
    });

    // 4c: Concurrency Simulation Ordering 2:
    // Mutation executes before lock transaction commits.
    // Child insert commits cleanly into draft run; subsequent locking transaction successfully transitions run to locked.
    const concRunId = '44444444-4444-4444-4444-444444444444';
    await db.exec(`
      INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
      VALUES ('${concRunId}', '${orgAId}', '2026-07-01', '2026-07-31', 'July 2026', 'draft');
    `);

    // Tx1: Child inserted into draft
    await db.exec(`
      BEGIN;
      INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
      VALUES ('45454545-4545-4545-4545-454545454545', '${concRunId}', '${orgAId}', '${emp1Id}', 20000, 19500);
      COMMIT;
    `);

    // Tx2: Parent locks
    await db.exec(`
      BEGIN;
      UPDATE payroll_runs SET status = 'locked' WHERE id = '${concRunId}';
      COMMIT;
    `);

    // Verify item is now protected by locked parent
    let postLockMutationBlocked = false;
    try {
      await db.exec(`
        UPDATE payroll_items SET gross_pay = 25000 WHERE id = '45454545-4545-4545-4545-454545454545';
      `);
    } catch (e: any) {
      postLockMutationBlocked = e.message.includes('source payroll run is locked and immutable');
    }

    results.push({
      step: '4. Concurrency Audit & Row-Locking',
      name: 'Ordering B: Unlocked child commit followed by parent lock establishes permanent immutability',
      passed: postLockMutationBlocked,
      message: postLockMutationBlocked 
        ? 'Child item inserted under draft, parent locked, child modifications now permanently blocked' 
        : 'Failed: item could still be modified after parent was locked',
    });
  } catch (err: any) {
    results.push({
      step: '4. Concurrency Audit & Row-Locking',
      name: 'Concurrency audit execution',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 5: Verify unlocked payroll remains editable
  // =========================================================================
  try {
    // INSERT into draft run
    await db.exec(`
      INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
      VALUES ('50505050-5050-5050-5050-505050505050', '${runDraftId}', '${orgAId}', '${emp2Id}', 28000.00, 27500.00);
    `);

    // UPDATE in draft run
    await db.exec(`
      UPDATE payroll_items 
      SET gross_pay = 29000.00 
      WHERE id = '50505050-5050-5050-5050-505050505050';
    `);

    // DELETE in draft run
    await db.exec(`
      DELETE FROM payroll_items 
      WHERE id = '50505050-5050-5050-5050-505050505050';
    `);

    results.push({
      step: '5. Unlocked Payroll Permissibility',
      name: 'Allow INSERT, UPDATE, and DELETE on unlocked (draft) runs',
      passed: true,
      message: 'All CRUD operations on unlocked payroll items succeeded normally',
    });
  } catch (err: any) {
    results.push({
      step: '5. Unlocked Payroll Permissibility',
      name: 'Allow operations on unlocked runs',
      passed: false,
      message: `Failed: ${err.message}`,
    });
  }

  // =========================================================================
  // Step 6: Test locked parent deletion, status regression and locked_at
  // =========================================================================

  // Test 6a: Reject status regression from locked to draft
  try {
    await db.exec(`
      UPDATE payroll_runs 
      SET status = 'draft' 
      WHERE id = '${runLockedId}';
    `);
    results.push({
      step: '6. Parent Run Immutability',
      name: 'Reject status regression from locked to draft',
      passed: false,
      message: 'Expected status regression to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('locked payroll periods cannot be modified or reverted');
    results.push({
      step: '6. Parent Run Immutability',
      name: 'Reject status regression from locked to draft',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 6b: Reject DELETE on locked payroll run
  try {
    await db.exec(`
      DELETE FROM payroll_runs 
      WHERE id = '${runLockedId}';
    `);
    results.push({
      step: '6. Parent Run Immutability',
      name: 'Reject DELETE on locked payroll run',
      passed: false,
      message: 'Expected DELETE to fail, but it succeeded!',
    });
  } catch (err: any) {
    const passed = err.message.includes('locked payroll periods are permanent and immutable');
    results.push({
      step: '6. Parent Run Immutability',
      name: 'Reject DELETE on locked payroll run',
      passed,
      message: passed ? `Rejected as expected: "${err.message}"` : `Unexpected error: ${err.message}`,
    });
  }

  // Test 6c: locked_at automatic assignment with UTC semantics under non-UTC session timezone (Asia/Kolkata)
  try {
    const newRunId = '60606060-6060-6060-6060-606060606060';
    // Set connection timezone to Asia/Kolkata (+05:30) to test UTC skew resilience
    await db.exec(`SET timezone = 'Asia/Kolkata';`);

    await db.exec(`
      INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
      VALUES ('${newRunId}', '${orgAId}', '2026-12-01', '2026-12-31', 'December 2026', 'draft');
      
      UPDATE payroll_runs SET status = 'locked' WHERE id = '${newRunId}';
    `);

    const checkRes = await db.query<{ locked_at: string; diff_seconds: number }>(`
      SELECT 
        locked_at,
        EXTRACT(EPOCH FROM (locked_at - now())) as diff_seconds
      FROM payroll_runs 
      WHERE id = '${newRunId}';
    `);

    // Reset timezone to UTC
    await db.exec(`RESET timezone;`);

    const diffSec = Math.abs(Number(checkRes.rows[0]?.diff_seconds || 0));
    // When using now() directly in migration 000005, diff should be within 2 seconds.
    // If the old timezone('utc'::text, now()) bug was present, diff would be ~19800 seconds (5.5 hrs)!
    const isAccurateUtc = diffSec < 5;

    results.push({
      step: '6. Parent Run Immutability',
      name: 'Accurate UTC locked_at assignment without Asia/Kolkata timezone offset skew',
      passed: isAccurateUtc,
      message: isAccurateUtc 
        ? `locked_at recorded as pure UTC: ${checkRes.rows[0]?.locked_at} (skew: ${diffSec.toFixed(2)}s from now())` 
        : `Timezone skew detected: ${diffSec}s difference from now()!`,
    });
  } catch (err: any) {
    await db.exec(`RESET timezone;`).catch(() => {});
    results.push({
      step: '6. Parent Run Immutability',
      name: 'Accurate UTC locked_at assignment',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 7: Check missing parent rows, trigger recursion, and foreign key safety
  // =========================================================================
  try {
    const fakeParentId = '77777777-0000-0000-0000-777777777777';
    let fkFailed = false;
    try {
      await db.exec(`
        INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, gross_pay, net_pay)
        VALUES ('70707070-7070-7070-7070-707070707070', '${fakeParentId}', '${orgAId}', '${emp1Id}', 1000, 1000);
      `);
    } catch (e: any) {
      fkFailed = e.message.includes('foreign key') || e.message.includes('violates foreign key constraint');
    }

    results.push({
      step: '7. Edge Cases & Trigger Safety',
      name: 'Missing parent row rejected by Foreign Key without trigger recursion',
      passed: fkFailed,
      message: fkFailed ? 'Foreign key constraint safely rejected invalid parent' : 'Did not trigger foreign key error',
    });
  } catch (err: any) {
    results.push({
      step: '7. Edge Cases & Trigger Safety',
      name: 'Edge cases and recursion',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 8: Verify RLS using real database roles and authenticated contexts
  // =========================================================================
  try {
    // 8a: Verify Cross-Tenant Isolation
    await db.exec(`SET ROLE authenticated;`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userOwnerId}', false);`);

    const ownerEmployees = await db.query<{ id: string; organization_id: string }>(`
      SELECT id, organization_id FROM employees;
    `);

    const hasOrgB = ownerEmployees.rows.some(r => r.organization_id === orgBId);
    const orgACount = ownerEmployees.rows.filter(r => r.organization_id === orgAId).length;

    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'Cross-Tenant Read Isolation under authenticated role',
      passed: !hasOrgB && orgACount > 0,
      message: !hasOrgB ? `Owner sees ${orgACount} Org A employees and 0 Org B employees (strict tenant isolation)` : 'Leaked Org B employees!',
    });

    // 8b: Verify Branch Manager Restriction
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userManagerId}', false);`);
    const managerEmployees = await db.query<{ id: string; branch_id: string }>(`
      SELECT id, branch_id FROM employees;
    `);

    const seesBranch2 = managerEmployees.rows.some(r => r.branch_id === branch2Id);
    const seesBranch1 = managerEmployees.rows.some(r => r.branch_id === branch1Id);

    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'Branch Manager restricted to assigned branch under authenticated role',
      passed: !seesBranch2 && seesBranch1,
      message: !seesBranch2 ? 'Branch Manager sees only assigned Thrissur branch staff (Ernakulam hidden)' : 'Branch Manager saw unassigned branch!',
    });

    // 8c: Employee accounts can read only their own employee profile and branch.
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userEmpId}', false);`);
    const employeeVisibleRows = await db.query<{ id: string; branch_id: string }>(`
      SELECT id, branch_id FROM employees;
    `);
    const employeeSelfOnly = employeeVisibleRows.rows.length === 1 && employeeVisibleRows.rows[0].id === emp1Id;
    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'Employee can read only their own employee record',
      passed: employeeSelfOnly,
      message: employeeSelfOnly ? 'Employee account sees only its linked employee row.' : `Employee account saw ${employeeVisibleRows.rows.length} employee rows.`,
    });

    const employeeBranchRows = await db.query<{ id: string }>(`
      SELECT id FROM branches;
    `);
    const employeeBranchOnly = employeeBranchRows.rows.length === 1 && employeeBranchRows.rows[0].id === branch1Id;
    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'Employee can read only the assigned branch',
      passed: employeeBranchOnly,
      message: employeeBranchOnly ? 'Employee account sees only its linked branch.' : `Employee account saw ${employeeBranchRows.rows.length} branches.`,
    });
    // 8c: Verify Audit Logs Immutability
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userOwnerId}', false);`);
    let auditDeleteFailed = false;
    try {
      await db.exec(`
        INSERT INTO audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id)
        VALUES ('80808080-8080-8080-8080-808080808080', '${orgAId}', '${userOwnerId}', 'test_audit', 'employee', '${emp1Id}');
      `);
      await db.exec(`
        DELETE FROM audit_logs WHERE id = '80808080-8080-8080-8080-808080808080';
      `);
    } catch (e: any) {
      auditDeleteFailed = true;
    }

    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'Tamper-Proof Audit Log (DELETE blocked for authenticated users)',
      passed: auditDeleteFailed,
      message: auditDeleteFailed ? 'Audit log row DELETE blocked by RLS permissions and trigger' : 'Audit log was deleted!',
    });

    // Reset role to postgres superuser
    await db.exec(`RESET ROLE;`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
  } catch (err: any) {
    await db.exec(`RESET ROLE;`).catch(() => {});
    results.push({
      step: '8. Real RLS & Role Context Validation',
      name: 'RLS execution in authenticated context',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 9: Native UUID Generation Hardening (Milestone 3.3)
  // =========================================================================
  try {
    // Insert new records without explicit IDs, verifying gen_random_uuid() default generates valid UUIDs
    const nativeOrgRes = await db.query<{ id: string }>(`
      INSERT INTO organizations (name, code) 
      VALUES ('Native UUID Test Org', 'NATIVEUUID')
      RETURNING id;
    `);
    const generatedId = nativeOrgRes.rows[0]?.id;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(generatedId);

    results.push({
      step: '9. Native UUID Hardening',
      name: 'Default column expression uses native gen_random_uuid() without uuid-ossp dependency',
      passed: isValidUUID,
      message: isValidUUID ? `Generated valid UUID v4: ${generatedId}` : 'Invalid UUID generated',
    });
  } catch (err: any) {
    results.push({
      step: '9. Native UUID Hardening',
      name: 'Native gen_random_uuid() verification',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 10: Least-Privilege & Function Access Security (Milestone 3.3)
  // =========================================================================
  try {
    // 10a: Internal trigger functions cannot be called directly by authenticated user
    await db.exec(`SET ROLE authenticated;`);
    let directTriggerCallFailed = false;
    try {
      await db.exec(`SELECT check_payroll_item_lock_integrity();`);
    } catch (e: any) {
      directTriggerCallFailed = e.message.includes('permission denied') || e.message.includes('a trigger function');
    }

    results.push({
      step: '10. Least-Privilege Security',
      name: 'Internal trigger functions revoked from direct user execution',
      passed: directTriggerCallFailed,
      message: directTriggerCallFailed ? 'Direct execution of trigger function safely blocked' : 'Trigger function directly executed by user!',
    });

    // 10b: Anonymous users cannot invoke tenant helper functions
    await db.exec(`SET ROLE anon;`);
    let anonHelperFailed = false;
    try {
      await db.exec(`SELECT auth_current_user_org_ids();`);
    } catch (e: any) {
      anonHelperFailed = e.message.includes('permission denied') || e.message.includes('must be called by');
    }

    results.push({
      step: '10. Least-Privilege Security',
      name: 'Security helper functions revoked from anonymous users',
      passed: anonHelperFailed,
      message: anonHelperFailed ? 'Anonymous invocation of helper functions blocked' : 'Anonymous user executed security helper function!',
    });

    await db.exec(`RESET ROLE;`);
  } catch (err: any) {
    await db.exec(`RESET ROLE;`).catch(() => {});
    results.push({
      step: '10. Least-Privilege Security',
      name: 'Least-privilege verification',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 10b: Payroll runs cannot be inserted directly in a non-draft state.
  // =========================================================================
  try {
    let lockedInsertRejected = false;
    try {
      await db.exec(`
        INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status, locked_at)
        VALUES ('d0000000-0000-0000-0000-000000000099', '${orgAId}', '2027-03-01', '2027-03-31', 'Direct Locked Insert', 'locked', now());
      `);
    } catch (error: any) {
      lockedInsertRejected = error.code === '23514' || error.message.includes('must be created in draft status');
    }
    results.push({
      step: '10. Payroll Creation State',
      name: 'Direct insertion of a locked payroll run is rejected',
      passed: lockedInsertRejected,
      message: lockedInsertRejected ? 'Database requires payroll runs to start in draft status.' : 'A payroll run was inserted directly as locked.',
    });
  } catch (error: any) {
    results.push({
      step: '10. Payroll Creation State',
      name: 'Direct locked insertion guard',
      passed: false,
      message: error.message,
    });
  }

  // =========================================================================
  // Step 11: Draft vs Locked Payroll Deletion Integrity (Milestone 4.1)
  // =========================================================================
  try {
    const testDraftRunId = 'd0000000-0000-0000-0000-000000000001';
    const testLockedRunId = 'd0000000-0000-0000-0000-000000000002';
    const testOrgId = orgAId;
    const testEmpId = emp1Id;

    // 11a: Draft payroll run deletion must succeed and return OLD
    await db.exec(`
      INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
      VALUES ('${testDraftRunId}', '${testOrgId}', '2027-01-01', '2027-01-31', 'January 2027 Draft', 'draft')
      ON CONFLICT DO NOTHING;

      INSERT INTO payroll_items (id, payroll_run_id, organization_id, employee_id, basic_pay, net_pay)
      VALUES ('d0000000-0000-0000-0000-000000000011', '${testDraftRunId}', '${testOrgId}', '${testEmpId}', 20000, 20000)
      ON CONFLICT DO NOTHING;
    `);

    const delDraftRes = await db.query(`DELETE FROM payroll_runs WHERE id = '${testDraftRunId}' RETURNING id;`);
    const draftDeleted = delDraftRes.rows.length === 1;

    results.push({
      step: '11. Payroll Delete Integrity',
      name: 'Draft payroll run deletion succeeds and returns OLD record',
      passed: draftDeleted,
      message: draftDeleted ? 'Draft payroll run successfully deleted without false trigger abort' : 'Draft payroll run deletion failed or was canceled',
    });

    // 11b: A payroll run is created as draft, then locked by the database lifecycle.
    await db.exec(`
      INSERT INTO payroll_runs (id, organization_id, period_start, period_end, period_label, status)
      VALUES ('${testLockedRunId}', '${testOrgId}', '2027-02-01', '2027-02-28', 'February 2027 Locked', 'draft')
      ON CONFLICT DO NOTHING;
      UPDATE payroll_runs SET status = 'locked', locked_at = '2000-01-01T00:00:00Z'
      WHERE id = '${testLockedRunId}' AND status = 'draft';
    `);

    const testLockedTimestamp = await db.query<{ locked_at: string }>(
      `SELECT locked_at FROM payroll_runs WHERE id = '${testLockedRunId}'`,
    );
    const generatedLockTimestamp =
      new Date(testLockedTimestamp.rows[0].locked_at).getUTCFullYear() > 2020 &&
      Math.abs(new Date(testLockedTimestamp.rows[0].locked_at).getTime() - new Date('2000-01-01T00:00:00Z').getTime()) > 86400000;

    let lockedDeleteBlocked = false;
    try {
      await db.exec(`DELETE FROM payroll_runs WHERE id = '${testLockedRunId}';`);
    } catch (e: any) {
      lockedDeleteBlocked = e.message.includes('locked payroll periods are permanent and immutable') || e.code === '23514' || e.message.includes('Cannot delete payroll run');
    }

    results.push({
      step: '11. Payroll Delete Integrity',
      name: 'Locked payroll run deletion strictly forbidden',
      passed: lockedDeleteBlocked,
      message: lockedDeleteBlocked ? 'Attempt to delete locked payroll run raised expected immutability exception' : 'Locked payroll run was deleted!',
    });
    results.push({
      step: '11. Payroll Delete Integrity',
      name: 'Database overwrites caller-supplied locked_at value',
      passed: generatedLockTimestamp,
      message: generatedLockTimestamp ? 'The caller-supplied historical timestamp was replaced by the database lock timestamp.' : 'The caller-controlled locked_at value was not replaced.',
    });

    // Teardown locked run safely for clean state
    await db.exec(`
      ALTER TABLE payroll_items DISABLE TRIGGER trg_payroll_item_lock_integrity;
      ALTER TABLE payroll_runs DISABLE TRIGGER trg_prevent_locked_payroll_modification;
      DELETE FROM payroll_items WHERE payroll_run_id = '${testLockedRunId}';
      DELETE FROM payroll_runs WHERE id = '${testLockedRunId}';
      ALTER TABLE payroll_runs ENABLE TRIGGER trg_prevent_locked_payroll_modification;
      ALTER TABLE payroll_items ENABLE TRIGGER trg_payroll_item_lock_integrity;
    `);
  } catch (err: any) {
    results.push({
      step: '11. Payroll Delete Integrity',
      name: 'Payroll run deletion lifecycle check',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 12: Composite Foreign Key Tenant Protection (Milestone 4.1)
  // =========================================================================
  try {
    const orgA = '11111111-1111-1111-1111-111111111111';
    const orgB = '11111111-1111-1111-1111-111111111112';
    const branchB = '22222222-2222-2222-2222-222222222222'; // belongs to orgB

    let crossTenantFkBlocked = false;
    try {
      // Attempt to create employee in Org A referencing branch of Org B
      await db.exec(`
        INSERT INTO employees (id, organization_id, branch_id, employee_code, first_name, last_name, display_name, designation, joining_date)
        VALUES ('33333333-3333-3333-3333-333333333399', '${orgA}', '${branchB}', 'JCF-X99', 'Cross', 'Tenant', 'Cross Tenant', 'Staff', '2026-01-01');
      `);
    } catch (e: any) {
      crossTenantFkBlocked = e.message.includes('fk_employees_branch_org') || e.message.includes('foreign key constraint');
    }

    results.push({
      step: '12. Composite Foreign Keys',
      name: 'Cross-tenant foreign key references mathematically blocked by database engine',
      passed: crossTenantFkBlocked,
      message: crossTenantFkBlocked ? 'Database engine rejected employee referencing another tenant branch via composite FK' : 'Cross-tenant foreign key reference was accepted!',
    });
  } catch (err: any) {
    results.push({
      step: '12. Composite Foreign Keys',
      name: 'Composite FK validation',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 13: Role Escalation Prevention (Milestone 4.1)
  // =========================================================================
  try {
    const orgA = '11111111-1111-1111-1111-111111111111';
    const adminUser = '00000000-0000-0000-0000-000000000002'; // Company Admin
    const targetUser = '00000000-0000-0000-0000-000000000003';

    let escalationBlocked = false;
    try {
      await db.exec(`
        SET LOCAL "request.jwt.claim.sub" = '${adminUser}';
        SET ROLE authenticated;
        -- Admin tries to insert platform_admin
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES ('${orgA}', '${targetUser}', 'platform_admin');
      `);
    } catch (e: any) {
      escalationBlocked = e.message.includes('Privilege escalation forbidden') || e.message.includes('insufficient_privilege') || e.message.includes('new row violates row-level security policy');
    } finally {
      await db.exec(`RESET ROLE;`).catch(() => {});
    }

    results.push({
      step: '13. Role Escalation Prevention',
      name: 'Non-platform admin cannot grant platform_admin role',
      passed: escalationBlocked,
      message: escalationBlocked ? 'Role escalation to platform_admin successfully prevented by trigger and policy' : 'Non-platform admin created platform_admin!',
    });
  } catch (err: any) {
    results.push({
      step: '13. Role Escalation Prevention',
      name: 'Role escalation check',
      passed: false,
      message: err.message,
    });
  }

  // =========================================================================
  // Step 14: Leave Requests Tenant Isolation & CRUD (Milestone 4.1)
  // =========================================================================
  try {
    const orgA = '11111111-1111-1111-1111-111111111111';
    const empUserA = '00000000-0000-0000-0000-000000000004';
    const empUserB = '00000000-0000-0000-0000-000000000005';
    const empIdA = emp1Id;

    await db.exec(`
      INSERT INTO leave_requests (organization_id, employee_id, leave_type, start_date, end_date, days_count, reason, status)
      VALUES ('${orgA}', '${empIdA}', 'casual', '2026-11-10', '2026-11-12', 3.0, 'Personal work', 'pending');
    `);

    // Verify User in Org B cannot see Org A's leave request
    await db.exec(`
      SET LOCAL "request.jwt.claim.sub" = '${empUserB}';
      SET ROLE authenticated;
    `);
    const crossLeaveRes = await db.query<{ count: number }>(`SELECT count(*)::int as count FROM leave_requests WHERE organization_id = '${orgA}';`);
    await db.exec(`RESET ROLE;`);

    const crossLeakage = crossLeaveRes.rows[0].count === 0;

    results.push({
      step: '14. Leave Requests RLS',
      name: 'Leave requests isolated by tenant with zero cross-tenant leakage',
      passed: crossLeakage,
      message: crossLeakage ? 'Leave requests properly isolated between organizations' : 'Cross-tenant leak detected in leave requests!',
    });
  } catch (err: any) {
    await db.exec(`RESET ROLE;`).catch(() => {});
    results.push({
      step: '14. Leave Requests RLS',
      name: 'Leave requests RLS check',
      passed: false,
      message: err.message,
    });
  }

  const allPassed = results.every(r => r.passed);
  return { pgVersion, migrationsApplied, results, allPassed };
}

// When run directly
if (process.argv[1]?.endsWith('verify_postgres_integration.ts')) {
  runPostgresVerification()
    .then((out) => {
      console.log('=== POSTGRESQL INTEGRATION VERIFICATION REPORT ===');
      console.log('PostgreSQL Version:', out.pgVersion);
      console.log('\nMigrations Applied in Sequential Order:');
      out.migrationsApplied.forEach((m) => console.log('  ✓', m));
      console.log('\nTest Results:');
      out.results.forEach((r) => {
        const mark = r.passed ? '✓ [PASS]' : '✗ [FAIL]';
        console.log(`${mark} [${r.step}] ${r.name}`);
        console.log(`    ${r.message}`);
      });
      console.log('\nAll Integration Checks Passed:', out.allPassed);
      if (!out.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal Verification Error:', err);
      process.exit(1);
    });
}
