-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - CONCURRENCY & SCHEMA HARDENING
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 3.3: Concurrency Audit, UTC Timestamp Semantics & Privilege Hardening
-- ==============================================================================

-- 1. Timestamp UTC Semantics Fix for locked_at
-- Use now() directly rather than timezone('utc'::text, now()) to prevent
-- double-timezone conversion skew when client session has a non-UTC timezone (e.g. Asia/Kolkata).
CREATE OR REPLACE FUNCTION check_payroll_lock_immutability()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent deletion of locked runs
  IF TG_OP = 'DELETE' AND OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot delete payroll run: locked payroll periods are permanent and immutable.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Prevent modification of locked runs or unlocking transitions
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Cannot modify or unlock payroll run: locked payroll periods cannot be modified or reverted.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Once locked, payroll status cannot be changed back to draft, review, or approved.';
    END IF;

    -- If locking the run, record the locked_at timestamp automatically if missing
    IF NEW.status = 'locked' AND (OLD.status IS DISTINCT FROM 'locked') THEN
      NEW.locked_at := COALESCE(NEW.locked_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Native UUID Generation (PostgreSQL 13+ native gen_random_uuid)
-- Eliminates hard dependency on external uuid-ossp extension for all primary keys
CREATE OR REPLACE FUNCTION uuid_generate_v4()
RETURNS UUID
LANGUAGE sql
AS $$
  SELECT gen_random_uuid();
$$;

ALTER TABLE organizations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE branches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE organization_members ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE departments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE shifts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE employees ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE attendance_events ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE attendance_daily_summaries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE device_sync_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE attendance_corrections ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE salary_structures ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE employee_salary_assignments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE payroll_runs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE payroll_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE payslips ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Function Privilege Hardening (Least Privilege Enforcement)
-- Revoke direct EXECUTE on internal triggers from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION check_payroll_item_lock_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION check_payroll_lock_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION prevent_audit_log_tampering() FROM PUBLIC, anon, authenticated;

-- Helper functions: restrict EXECUTE to authenticated, revoke from anon and PUBLIC
REVOKE EXECUTE ON FUNCTION auth_current_user_org_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_current_user_org_ids() TO authenticated;

REVOKE EXECUTE ON FUNCTION auth_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_is_platform_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION auth_user_role_in_org(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_user_role_in_org(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION auth_user_assigned_branch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_user_assigned_branch(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION auth_current_employee_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_current_employee_id(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION auth_current_employee_branch_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_current_employee_branch_id(UUID) TO authenticated;
