-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - REMEDIATION & SECURITY HARDENING
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 4.1: Forward-Only Remediation Migration
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX PAYROLL RUN DELETE TRIGGER (ALLOW DRAFT DELETE, PREVENT LOCKED DELETE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_payroll_lock_immutability()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle DELETE operation
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Cannot delete payroll run: locked payroll periods are permanent and immutable.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Locked payroll runs cannot be deleted. Any corrections must be processed as authorized adjustments.';
    END IF;
    -- For draft, review, or approved runs, permit deletion and return OLD
    RETURN OLD;
  END IF;

  -- Handle UPDATE operation
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Cannot modify or unlock payroll run: locked payroll periods cannot be modified or reverted.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Once locked, payroll status cannot be changed back to draft, review, or approved.';
    END IF;

    -- Automatically record locked_at timestamp upon locking if not provided
    IF NEW.status = 'locked' AND (OLD.status IS DISTINCT FROM 'locked') THEN
      NEW.locked_at := COALESCE(NEW.locked_at, now());
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. CREATE LEAVE REQUESTS TABLE (TENANT-SCOPED & RLS-PROTECTED)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(32) NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'maternity')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(4, 1) NOT NULL DEFAULT 1.0,
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES user_profiles(id),
    decision_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leave requests in their organization"
ON leave_requests FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      -- Owners and Admins can view all leave requests in org
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      -- Branch managers can view leave requests for employees in their branch
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND employee_id IN (
          SELECT id FROM employees 
          WHERE branch_id = auth_user_assigned_branch(organization_id)
        )
      )
      -- Employees can view their own leave requests
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND employee_id = auth_current_employee_id(organization_id)
      )
    )
  )
);

CREATE POLICY "Employees and Managers can apply for leave"
ON leave_requests FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  AND (
    auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin', 'branch_manager')
    OR (
      auth_user_role_in_org(organization_id) = 'employee'
      AND employee_id = auth_current_employee_id(organization_id)
    )
  )
);

CREATE POLICY "Owners Admins and Branch Managers can approve or reject leave"
ON leave_requests FOR UPDATE
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND employee_id IN (
          SELECT id FROM employees 
          WHERE branch_id = auth_user_assigned_branch(organization_id)
        )
      )
    )
  )
);

-- ------------------------------------------------------------------------------
-- 3. COMPOSITE UNIQUE CONSTRAINTS FOR MATHEMATICALLY PROVABLE TENANT ISOLATION
-- ------------------------------------------------------------------------------
-- Ensures composite keys exist so foreign keys can guarantee same-tenant references
ALTER TABLE branches ADD CONSTRAINT uq_branches_id_org UNIQUE (id, organization_id);
ALTER TABLE employees ADD CONSTRAINT uq_employees_id_org UNIQUE (id, organization_id);
ALTER TABLE attendance_devices ADD CONSTRAINT uq_devices_id_org UNIQUE (id, organization_id);
ALTER TABLE payroll_runs ADD CONSTRAINT uq_payroll_runs_id_org UNIQUE (id, organization_id);

-- Enforce composite foreign keys to prevent cross-tenant referencing
DO $$
BEGIN
  -- 1. Employees must reference a branch belonging to the SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_branch_org') THEN
    ALTER TABLE employees 
    ADD CONSTRAINT fk_employees_branch_org 
    FOREIGN KEY (branch_id, organization_id) 
    REFERENCES branches(id, organization_id) ON DELETE RESTRICT;
  END IF;

  -- 2. Devices must reference a branch belonging to the SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_devices_branch_org') THEN
    ALTER TABLE attendance_devices 
    ADD CONSTRAINT fk_devices_branch_org 
    FOREIGN KEY (branch_id, organization_id) 
    REFERENCES branches(id, organization_id) ON DELETE RESTRICT;
  END IF;

  -- 3. Device Employee Mappings must reference employee and device from SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapping_employee_org') THEN
    ALTER TABLE device_employee_mappings 
    ADD CONSTRAINT fk_mapping_employee_org 
    FOREIGN KEY (employee_id, organization_id) 
    REFERENCES employees(id, organization_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapping_device_org') THEN
    ALTER TABLE device_employee_mappings 
    ADD CONSTRAINT fk_mapping_device_org 
    FOREIGN KEY (device_id, organization_id) 
    REFERENCES attendance_devices(id, organization_id) ON DELETE CASCADE;
  END IF;

  -- 4. Attendance Daily Summaries must reference employee in SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_summaries_employee_org') THEN
    ALTER TABLE attendance_daily_summaries 
    ADD CONSTRAINT fk_summaries_employee_org 
    FOREIGN KEY (employee_id, organization_id) 
    REFERENCES employees(id, organization_id) ON DELETE CASCADE;
  END IF;

  -- 5. Payroll Items must reference payroll run and employee in SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_items_run_org') THEN
    ALTER TABLE payroll_items 
    ADD CONSTRAINT fk_payroll_items_run_org 
    FOREIGN KEY (payroll_run_id, organization_id) 
    REFERENCES payroll_runs(id, organization_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_items_employee_org') THEN
    ALTER TABLE payroll_items 
    ADD CONSTRAINT fk_payroll_items_employee_org 
    FOREIGN KEY (employee_id, organization_id) 
    REFERENCES employees(id, organization_id) ON DELETE RESTRICT;
  END IF;

  -- 6. Leave Requests must reference employee in SAME organization
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leave_requests_employee_org') THEN
    ALTER TABLE leave_requests 
    ADD CONSTRAINT fk_leave_requests_employee_org 
    FOREIGN KEY (employee_id, organization_id) 
    REFERENCES employees(id, organization_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. USER PROFILES RLS PROTECTION
-- ------------------------------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile or co-members"
ON user_profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR auth_is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM organization_members m1
    JOIN organization_members m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = user_profiles.id
  )
);

CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR auth_is_platform_admin())
WITH CHECK (id = auth.uid() OR auth_is_platform_admin());

-- ------------------------------------------------------------------------------
-- 5. ROLE ESCALATION DATABASE TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_role_escalation_rules()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_is_platform_admin BOOLEAN;
  v_actor_role VARCHAR(50);
BEGIN
  -- If executed without auth context (e.g. system migrations, background workers, or initial setup)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if actor is platform admin
  v_actor_is_platform_admin := auth_is_platform_admin();

  -- If platform admin, allow all role operations
  IF v_actor_is_platform_admin THEN
    RETURN NEW;
  END IF;

  -- Disallow assigning or promoting to platform_admin by non-platform admins
  IF NEW.role = 'platform_admin' THEN
    RAISE EXCEPTION 'Privilege escalation forbidden: only verified platform administrators can assign platform_admin role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- On update: prevent user from promoting or demoting their own role
  IF TG_OP = 'UPDATE' AND NEW.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Self-role modification forbidden: users cannot modify their own authorization level.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Get actor role in target org
  v_actor_role := auth_user_role_in_org(NEW.organization_id);

  IF v_actor_role = 'company_owner' THEN
    -- Owners cannot assign platform_admin (already checked above)
    RETURN NEW;
  ELSIF v_actor_role = 'company_admin' THEN
    -- Admins cannot assign company_owner or platform_admin
    IF NEW.role IN ('company_owner', 'platform_admin') THEN
      RAISE EXCEPTION 'Company admins cannot assign or promote to company_owner role.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Insufficient privilege to modify organization memberships.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_escalation ON organization_members;
CREATE TRIGGER trg_enforce_role_escalation
BEFORE INSERT OR UPDATE ON organization_members
FOR EACH ROW
EXECUTE FUNCTION enforce_role_escalation_rules();

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOG ACTOR INTEGRITY TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_audit_log_actor_integrity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enforce that actor_user_id is derived directly from the authenticated session
  -- unless executed via internal system background worker where auth.uid() is null
  IF auth.uid() IS NOT NULL THEN
    NEW.actor_user_id := auth.uid();
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_audit_actor ON audit_logs;
CREATE TRIGGER trg_enforce_audit_actor
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_log_actor_integrity();

-- ------------------------------------------------------------------------------
-- 7. RLS POLICIES FOR SHIFTS AND DEPARTMENTS
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view shifts in their organization"
ON shifts FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Owners and Admins can manage shifts"
ON shifts FOR ALL
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

CREATE POLICY "Users can view departments in their organization"
ON departments FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Owners and Admins can manage departments"
ON departments FOR ALL
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);
