-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - FIX EMPLOYEE RLS RECURSION
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 3.2: SEC-02 Fix infinite recursion in employees RLS policy
-- ==============================================================================

-- 1. Helper function: Get employee ID for authenticated user with row_security = off
CREATE OR REPLACE FUNCTION auth_current_employee_id(target_org_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT id 
  FROM employees 
  WHERE organization_id = target_org_id 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
$$;

-- 2. Helper function: Get employee branch ID with row_security = off to eliminate recursion
CREATE OR REPLACE FUNCTION auth_current_employee_branch_id(target_org_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT branch_id 
  FROM employees 
  WHERE organization_id = target_org_id 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
$$;

-- 3. Replace recursive employee SELECT policy with non-recursive function call
DROP POLICY IF EXISTS "Role-aware employee read access" ON employees;

CREATE POLICY "Role-aware employee read access"
ON employees FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      -- Owners and Admins can view all branches
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      -- Branch managers can ONLY view employees within their assigned branch
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND branch_id = auth_user_assigned_branch(organization_id)
      )
      -- Employees can view peers in same branch
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND branch_id = auth_current_employee_branch_id(organization_id)
      )
    )
  )
);

-- 4. Audit Log Immutability Hardening: Explicit trigger preventing any UPDATE or DELETE
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM authenticated, anon;

CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and tamper-proof: UPDATE and DELETE operations are forbidden.'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_tampering();
