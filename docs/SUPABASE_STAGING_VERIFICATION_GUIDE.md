# AttendEase — Isolated Supabase Staging Verification

This procedure is for a newly created, isolated staging Supabase project. It is not a production deployment guide.

## 1. Current safety posture

- Keep `VITE_DEMO_MODE=true` for the deployed Vercel demonstration.
- Never put a database connection string, database password, Supabase service-role key, or Supabase secret key into Vercel browser variables.
- The staging verification runner is a local Node.js script. Run it from a trusted development computer, not in the browser and not in Vercel.
- The runner refuses a non-empty or previously migrated database when it cannot establish its own migration history.
- The runner applies migrations transactionally and records SHA-256 checksums in the non-API-exposed `attendease_private` schema.
- The runner uses a synthetic test tenant with reserved UUIDs. Cleanup temporarily disables only the two named payroll immutability triggers inside one transaction, removes only marked test records, and re-enables the triggers before commit. A failed cleanup transaction is rolled back and reported as failure.
- No production URL or credential should ever be used with this script.

## 2. Supabase connection formats

Open the staging project in Supabase Dashboard and use **Connect → Direct connection → URI** when your network supports IPv6. The direct connection URL normally resembles:

```text
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

If direct IPv6 connectivity is unavailable, choose **Session pooler → URI**. It normally resembles:

```text
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Copy the exact URI from the staging project's dashboard. Do not manually guess the host or username. The verification runner accepts the Supabase direct hostname format and the session-pooler username format on port 5432. It rejects transaction-pooler port 6543 for migrations and row-lock tests.

Do not paste the password or full connection URI into chat, AI prompts, screenshots, GitHub, or Vercel settings.

## 3. Local staging variables (PowerShell)

Use a local terminal in the AttendEase repository. These are server-side database credentials and must remain local:

```powershell
$env:STAGING_DATABASE_URL = "YOUR_STAGING_DATABASE_URI"
$env:EXPECTED_STAGING_PROJECT_REF = "YOUR_EXACT_STAGING_PROJECT_REF"
npm run verify:staging
```

For your existing staging project, the expected project reference previously confirmed from the project URL is:

```text
qczjagiecgypheayjpru
```

Set that value only after you have confirmed that the connection URI belongs to `attendease-staging`.

The script loads `.env.local` before `.env`, while preserving variables already set in the shell. Both files are git-ignored. Do not commit them.

## 4. Frontend Vercel variables — separate from staging credentials

These are only for the Vite browser application when a reviewed live-mode release is ready:

| Variable | Purpose |
|---|---|
| `VITE_DEMO_MODE` | Keep `true` until live-mode testing is complete. |
| `VITE_APP_ENV` | `preview`, `staging`, or `production` for frontend labeling/monitoring. |
| `VITE_SUPABASE_URL` | Supabase project API URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key; legacy `VITE_SUPABASE_ANON_KEY` is also supported. |
| `VITE_SENTRY_DSN` | Optional error-monitoring DSN. |
| `VITE_DEVICE_CONNECTOR_URL` | Optional future branch Edge Connector URL. |

Do not add `STAGING_DATABASE_URL` or `EXPECTED_STAGING_PROJECT_REF` to Vercel. Never use `service_role` or a Supabase secret key in any `VITE_*` variable.

## 5. Migrations applied by the verification runner

The runner applies these nine forward-only migration files in order:

1. `20250101000000_initial_schema.sql` — organizations, branches, memberships, employees, shifts, devices, attendance events, daily summaries and audit-log foundation.
2. `20250101000001_tenant_isolation_rls.sql` — initial RLS enablement, tenant policies and helper functions.
3. `20250101000002_security_hardening_and_payroll.sql` — role and employee policies, attendance corrections, payroll schema and payroll immutability.
4. `20250101000003_locked_payroll_child_integrity.sql` — payroll child-row locking, immutability and reparenting protection.
5. `20250101000004_fix_employee_rls_recursion.sql` — SECURITY DEFINER employee identity/branch helper functions and employee read policy.
6. `20250101000005_concurrency_and_schema_hardening.sql` — native UUID defaults, security-definer function permissions and timestamp hardening.
7. `20250101000006_remediation_and_security_hardening.sql` — leave requests, tenant-composite foreign keys, user-profile protection and role-escalation/audit triggers.
8. `20250101000007_branch_scope_rls_hardening.sql` — branch-scoped reads, employee self-read, profile privacy, raw device-event write restrictions and scoped corrections/leave/device access.

The runner refuses to adopt an existing schema if it finds application tables but cannot find its own migration history. Use a fresh staging database for the first run. Applied migrations are tracked by filename and SHA-256 checksum. A changed checksum for an already-applied migration is an error, not an automatic rewrite.

## 6. What the verification runner tests

- PostgreSQL 15 or later server version.
- Exact project-reference match for the recognized Supabase connection format.
- TLS certificate verification.
- Sequential, transactional application of migrations 000000 through 000008.
- Two independent PostgreSQL connections and both payroll-lock transaction orderings. It observes a real PostgreSQL lock wait using `pg_stat_activity`; it does not treat a fixed delay as proof.
- SQLSTATE and lock outcome for the locked-payroll child insertion.
- `locked_at` timestamp behavior under an Asia/Kolkata session timezone.
- Hosted staging RLS behavior under the `authenticated` role with synthetic request-claim settings: organization, branch, employee, daily-summary and profile read isolation.
- Denial of ordinary authenticated-client inserts into raw attendance events.
- Transaction-local session setting cleanup on the same server session. This is a session-setting hygiene check; it is not a separate certification of transaction-pooler behavior.

The RLS runner uses synthetic identities and request claims. It does not create Supabase Auth users or prove a complete browser sign-in flow. Employee-self RLS and real Auth provisioning must also be tested through the application using authorized staging accounts.

## 7. Expected outcome and stop conditions

A successful run must show every check as PASS and must complete cleanup. Any migration, RLS, concurrency, timezone or cleanup failure means staging verification has failed.

Do not:
- Use production or a project containing real employee/payroll data.
- Disable RLS to make a test pass.
- manually create application tables before running migrations.
- Run this runner against port 6543.
- Enable live payroll or rely on payroll results.
- Claim physical Hikvision/eSSL compatibility from a database test.

After the hosted staging suite passes, separately test Supabase Auth with real synthetic staging users, application workflows, and tenant/branch roles. Test the biometric connector with the physical terminal only after its implementation is ready.
