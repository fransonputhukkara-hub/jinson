# AttendEase Milestone 4 — Supabase Staging Verification Guide

This guide details the procedure for deploying and validating the AttendEase database schema and security policies on an isolated **Supabase Staging Project** before customer onboarding.

---

## 1. Safety Audit & Production Protection Guarantees

Before executing any operations, the verification runner enforces the following safety barriers:

1. **Mandatory Project Reference Validation (`EXPECTED_STAGING_PROJECT_REF`):**
   - Extracts the Supabase project reference (`postgres.[ref]:...`) from the connection URL.
   - If `EXPECTED_STAGING_PROJECT_REF` is set, verifies that the connection string strictly targets that project reference.
   - Rejects the operation if the reference does not match.

2. **Prohibited Keyword Guard:**
   - Evaluates target hosts and database names against prohibited keywords (`prod`, `production`, `live`, `primary`, `customer`).
   - Aborts immediately if any prohibited keyword is detected.

3. **Strict Credential Redaction:**
   - All connection strings logged or stored during testing mask credentials: `postgresql://user:********@host:port/database`.
   - Error stack traces and messages are scrubbed to prevent password leakage in CI/CD or console output.

4. **Non-Destructive Schema Evolution:**
   - Migrations 000000 through 000005 contain zero `DROP TABLE`, zero `TRUNCATE`, and zero destructive column deletions.
   - All table creations use `CREATE TABLE IF NOT EXISTS`, and function updates use `CREATE OR REPLACE FUNCTION`.

5. **Strict Test Data Scoping & Guaranteed Teardown:**
   - Concurrency and timezone tests only use deterministic test UUIDs (`e0000000-0000-4000-a000-...`).
   - A dedicated `cleanupTestData()` routine runs both before and inside the `finally` block to remove all test rows. No customer or baseline rows are ever touched.

6. **Statement Timeouts & Deadlock Watchdogs:**
   - Connections enforce a 10,000ms statement timeout (`statement_timeout = 10000;`).
   - Concurrency promises use 8,000ms `Promise.race` timeouts to prevent hanging indefinitely.

---

## 2. Environment & Data Isolation Architecture

| Environment | Purpose | Database | State / Credentials |
| :--- | :--- | :--- | :--- |
| **Local / Preview** | UI testing, demos, rapid iteration | In-Memory / PGlite / Demo Mock Store | `VITE_DEMO_MODE=true` (Zero external network dependencies) |
| **Supabase Staging** | Concurrency verification, RLS stress tests, migration rehearsal | Isolated hosted PostgreSQL 15+ Supabase project | `STAGING_DATABASE_URL` configured in `.env.local` |
| **Production** | Live customer operations | Production Supabase instance | **LOCKED & DISABLED** until customer approves policies |

---

## 3. Setting Up the Isolated Supabase Staging Project

### Step 3.1: Provision Staging Project
1. Log into your [Supabase Dashboard](https://app.supabase.com).
2. Click **New Project** and configure:
   - **Name:** `attendease-staging` (do not use generic or production names)
   - **Database Password:** Generate a secure password and store it in your team secrets manager.
   - **Region:** Select the region closest to your intended customer deployment (e.g., `ap-south-1` Mumbai or `ap-southeast-1` Singapore).
   - **Pricing Plan:** Free or Pro tier.

### Step 3.2: Retrieve Connection Strings
Navigate to **Project Settings** → **Database** → **Connection string**:
1. **Direct Connection (Session Mode, Port 5432):**
   ```text
   postgresql://postgres.[project-ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
   *Required for applying schema migrations, running DDL, and multi-connection concurrency lock tests.*

2. **Transaction Pooler Connection (Supavisor / PgBouncer, Port 6543):**
   ```text
   postgresql://postgres.[project-ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   *Used for client application query pooling. Not recommended for DDL migrations.*

---

## 4. Configuring Staging Credentials Locally

Create or edit your local `.env.local` file (which is git-ignored):

```bash
# Isolated Staging Database Connection (Port 5432 required for migrations & lock tests)
STAGING_DATABASE_URL="postgresql://postgres.[project-ref]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Safety verification: verify target matches expected project ref
EXPECTED_STAGING_PROJECT_REF="[project-ref]"

# Optional: Staging REST / Auth API Keys (for client integration testing)
VITE_STAGING_SUPABASE_URL="https://[project-ref].supabase.co"
VITE_STAGING_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 5. Migration Execution Sequence

AttendEase includes six sequential migrations in `/supabase/migrations/`:

| Migration File | Function & Changes |
| :--- | :--- |
| `20250101000000_initial_schema.sql` | Core domain tables (`organizations`, `branches`, `employees`, `attendance_records`, `leave_requests`, `payroll_runs`, `payroll_items`, `audit_logs`). Non-destructive `CREATE TABLE IF NOT EXISTS`. |
| `20250101000001_tenant_isolation_rls.sql` | RLS enablement, tenant/branch isolation policies, initial auth helper functions. |
| `20250101000002_security_hardening_and_payroll.sql` | Search path hardening (`search_path = public`), trigger locks on `payroll_runs` and `payroll_items`, immutable audit log triggers. |
| `20250101000003_locked_payroll_child_integrity.sql` | Row-level locking concurrency (`SELECT ... FOR SHARE`) in `check_payroll_item_lock_integrity()`, preventing parent-child lock race conditions and reparenting attacks. |
| `20250101000004_fix_employee_rls_recursion.sql` | `SECURITY DEFINER` helper functions (`auth_current_employee_id`, `auth_current_employee_branch_id`) to eliminate infinite recursion in employee branch policies. |
| `20250101000005_concurrency_and_schema_hardening.sql` | Universal native `gen_random_uuid()`, UTC timestamp sanitization (`COALESCE(NEW.locked_at, now())`), revoking `PUBLIC`/`anon` EXECUTE grants on SECURITY DEFINER functions. |

---

## 6. Automated Staging Verification Suite

Run the automated verification suite directly from the terminal:

```bash
npm run verify:staging
```

### What the Suite Validates:

1. **Pre-flight & Host Verification:**
   - Detects remote PostgreSQL engine version (PostgreSQL 15+).
   - Validates project reference matches `EXPECTED_STAGING_PROJECT_REF`.
   - Validates connection health and SSL negotiation.

2. **Sequential Schema Migration:**
   - Applies migrations 000000 through 000005 in order.
   - Stops on the first failure and sanitizes all error output.

3. **Deterministic Two-Connection Concurrency Lock Testing:**
   - Opens two concurrent connections (`conn1` and `conn2`) to the remote staging database.
   - **Ordering 1 (Parent Lock precedes Child Mutation):**
     1. `conn1` begins transaction and locks parent run: `UPDATE payroll_runs SET status = 'locked' WHERE id = ...;` (uncommitted).
     2. `conn2` concurrently attempts `INSERT INTO payroll_items ...;`
     3. Because of `SELECT ... FOR SHARE` in `check_payroll_item_lock_integrity()`, `conn2` acquires row lock and blocks on `conn1`.
     4. `conn1` commits.
     5. `conn2` unblocks, immediately inspects parent status, and fails with `23000 integrity_constraint_violation` (`Cannot insert payroll item: target payroll run is locked and immutable`).
   - **Ordering 2 (Child Insertion precedes Parent Lock):**
     1. `conn1` inserts child item (holding `FOR SHARE` on parent row).
     2. `conn2` attempts to lock parent run.
     3. `conn2` waits until `conn1` finishes, ensuring child changes cannot slip into a finalized run post-facto.

4. **UTC Timestamp & Timezone Skew Verification:**
   - Executes locking transactions while setting session timezone to `Asia/Kolkata` (UTC+05:30).
   - Verifies `locked_at` stored timestamp matches true UTC wall-clock time within 5,000ms.

5. **Transaction Pooling Compatibility (Port 6543 / Supavisor):**
   - Verifies all transaction-scoped state relies on `SET LOCAL` rather than persistent session settings, preventing state leakage across connections in pooled mode.

6. **Teardown & Cleanup:**
   - Automatically removes all test rows created under the `e0000000-0000-4000-a000-...` UUID namespace.
