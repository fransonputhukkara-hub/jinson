# AttendEase — First Staging Organization Owner Setup

This procedure is for the isolated `attendease-staging` Supabase project only. Do not use it against production.

## Prerequisites

1. All nine migrations (000000 through 000008) have been applied successfully to the isolated staging database.
2. The staging CI checks are green.
3. You have confirmed the staging Dashboard project reference is `qczjagiecgypheayjpru`.
4. You have a dedicated owner email address for staging.
5. Demo mode remains enabled in the existing Vercel deployment.

The application does not currently contain a self-service organization onboarding wizard. Its live sign-in flow requires a Supabase Auth account, a matching `user_profiles` row, and exactly one `organization_members` row.

## Step 1 — Create the Auth user

In Supabase Dashboard for `attendease-staging`:

1. Open Authentication → Users.
2. Add a user using the staging owner's email address.
3. Set a strong temporary password, then use the supported password-reset flow to set the owner's own password.
4. Copy the user's UUID from the Auth users table. Do not share the password or any secret key.

Do not create the user by inserting directly into `auth.users`.

## Step 2 — Create the organization, first branch, profile and owner membership

Open SQL Editor in the staging project. Replace the two placeholder values in the block below. Run it once.

- `OWNER_EMAIL`: the exact email used for the Supabase Auth user.
- `OWNER_FULL_NAME`: the owner's display name.
- The example organization and branch codes are `JCF` and `TCR`. Change them only if those codes are already in use in this empty staging project.

```sql
DO $bootstrap$
DECLARE
  v_owner_email text := 'OWNER_EMAIL';
  v_owner_name  text := 'OWNER_FULL_NAME';
  v_user_id     uuid;
  v_org_id      uuid;
  v_branch_id   uuid;
BEGIN
  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(v_owner_email);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for the supplied owner email.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE code = 'JCF') THEN
    RAISE EXCEPTION 'Organization code JCF already exists. Stop and inspect staging data; do not create a duplicate tenant.';
  END IF;

  INSERT INTO public.organizations (name, code, timezone, currency)
  VALUES ('Jinson Chit Fund', 'JCF', 'Asia/Kolkata', 'INR')
  RETURNING id INTO v_org_id;

  INSERT INTO public.branches (
    organization_id, name, code, city, state, country
  )
  VALUES (
    v_org_id, 'Thrissur Main Branch', 'TCR', 'Thrissur', 'Kerala', 'India'
  )
  RETURNING id INTO v_branch_id;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (v_user_id, v_owner_email, v_owner_name);

  INSERT INTO public.organization_members (
    organization_id, user_id, role, assigned_branch_id
  )
  VALUES (v_org_id, v_user_id, 'company_owner', NULL);

  RAISE NOTICE 'Staging organization created: %, first branch: %, owner user: %',
    v_org_id, v_branch_id, v_user_id;
END
$bootstrap$;
```

The owner membership has no assigned branch so the owner can access all branches in that organization. The initial branch is only a staging record; confirm the actual branch list with Jinson before customer use.

## Step 3 — Configure Vercel only for a reviewed live-mode test

Do not change Vercel yet merely because this account exists.

When a reviewed staging frontend test is authorized, use Vercel Preview/branch-scoped environment variables, not Production:

| Variable | Value |
|---|---|
| `VITE_DEMO_MODE` | `false` |
| `VITE_APP_ENV` | `staging` |
| `VITE_SUPABASE_URL` | The staging project's HTTPS API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The staging project's browser-safe publishable key |

The legacy `VITE_SUPABASE_ANON_KEY` variable is also supported by the current code. Prefer the publishable-key variable for a new setup.

Never set `STAGING_DATABASE_URL`, database passwords, `service_role` keys, or Supabase secret keys in Vercel or in any `VITE_*` variable.

## Current functional limitations

Even after sign-in succeeds, the following live workflows remain deliberately unavailable until their server-side transactions or device integrations are completed:

- Payroll calculation, approval, locking and payslips.
- Attendance correction approval/rejection with atomic daily-summary recalculation.
- Leave approval/rejection with attendance recalculation.
- Persistent live shift-rule editing.
- Hardware connectivity tests and biometric attendance synchronization.

A successful owner login is not proof that those workflows are ready for operational use.
