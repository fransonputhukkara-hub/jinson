-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - SECURITY HARDENING & PAYROLL RLS
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 2 Security Audit & Hardening Migration
-- ==============================================================================

-- 1. Helper function: Get user role within a specific organization
CREATE OR REPLACE FUNCTION auth_user_role_in_org(target_org_id UUID)
RETURNS VARCHAR(50)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role 
  FROM organization_members 
  WHERE user_id = auth.uid() 
    AND organization_id = target_org_id
  LIMIT 1;
$$;

-- 2. Helper function: Get assigned branch for branch managers
CREATE OR REPLACE FUNCTION auth_user_assigned_branch(target_org_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT assigned_branch_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
    AND organization_id = target_org_id
  LIMIT 1;
$$;

-- 3. Helper function: Get employee record linked to current user
CREATE OR REPLACE FUNCTION auth_current_employee_id(target_org_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id 
  FROM employees 
  WHERE organization_id = target_org_id 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
$$;

-- ==============================================================================
-- SECURITY HARDENING: ORGANIZATION MEMBERS & PREVENTING SELF-PROMOTION
-- ==============================================================================

CREATE POLICY "Users can view members in their organization"
ON organization_members FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

-- Only existing Company Owners and Platform Admins can invite or add new members
CREATE POLICY "Owners and Platform Admins can add members"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (
  auth_is_platform_admin()
  OR (
    auth_user_role_in_org(organization_id) = 'company_owner'
    AND role != 'platform_admin' -- Owners cannot create platform admins
  )
  OR (
    auth_user_role_in_org(organization_id) = 'company_admin'
    AND role NOT IN ('company_owner', 'platform_admin') -- Admins cannot create owners
  )
);

-- Users CANNOT modify their own role (prevents self-promotion exploit)
CREATE POLICY "Owners can update members excluding self-demotion/promotion exploits"
ON organization_members FOR UPDATE
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    auth_user_role_in_org(organization_id) = 'company_owner'
    AND user_id != auth.uid() -- Owners modify other staff; ownership transfer requires separate verified flow
  )
);

CREATE POLICY "Owners can remove members"
ON organization_members FOR DELETE
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    auth_user_role_in_org(organization_id) = 'company_owner'
    AND user_id != auth.uid()
  )
);

-- ==============================================================================
-- SECURITY HARDENING: BRANCH MANAGER RESTRICTIONS
-- ==============================================================================

-- Drop existing broad employee select policy and replace with role-aware policy
DROP POLICY IF EXISTS "Organization members can view employees in their organization" ON employees;

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
        AND branch_id = (SELECT branch_id FROM employees WHERE id = auth_current_employee_id(organization_id))
      )
    )
  )
);

-- ==============================================================================
-- SECURITY HARDENING: AUDIT LOGS (TAMPER-PROOF APPEND-ONLY)
-- ==============================================================================

-- Audit logs can be read ONLY by Owners, Admins, and Platform Admins
CREATE POLICY "Admins and Owners can view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

-- Any authenticated action can record an audit log
CREATE POLICY "System and users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

-- STRICTLY FORBID UPDATE AND DELETE on audit_logs (tamper-proof)
-- No UPDATE or DELETE policies are granted, ensuring rows are immutable.

-- ==============================================================================
-- INGESTION HARDENING: HARDWARE IDEMPOTENCY & RAW EVENT UNCOUPLING
-- ==============================================================================

-- Add hardware event serial number and unique external idempotency key
ALTER TABLE attendance_events 
ADD COLUMN IF NOT EXISTS event_serial_no BIGINT,
ADD COLUMN IF NOT EXISTS device_event_uid VARCHAR(128),
ADD COLUMN IF NOT EXISTS is_unmapped_user BOOLEAN NOT NULL DEFAULT false;

-- Create unique index on external device event UID for bulletproof idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_event_uid 
ON attendance_events (organization_id, device_event_uid) 
WHERE device_event_uid IS NOT NULL;

-- Unique constraint for devices providing reliable hardware serial numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_serial_no 
ON attendance_events (device_id, event_serial_no) 
WHERE event_serial_no IS NOT NULL;

-- ==============================================================================
-- ATTENDANCE CORRECTIONS TABLE & WORKFLOW AUDITING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    requested_by UUID NOT NULL REFERENCES user_profiles(id),
    approved_by UUID REFERENCES user_profiles(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    correction_type VARCHAR(32) NOT NULL CHECK (correction_type IN ('missing_in', 'missing_out', 'late_waive', 'overtime_adjust', 'full_override')),
    original_summary JSONB,
    adjusted_summary JSONB NOT NULL,
    reason TEXT NOT NULL,
    decision_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendance corrections in org"
ON attendance_corrections FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
);

CREATE POLICY "Branch managers and employees can request corrections"
ON attendance_corrections FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  AND requested_by = auth.uid()
);

CREATE POLICY "Only Owners and Admins can approve corrections"
ON attendance_corrections FOR UPDATE
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

-- ==============================================================================
-- PAYROLL SCHEMA & IMMUTABILITY ENFORCEMENT
-- ==============================================================================

-- Salary Structures
CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Employee Salary Assignments
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    basic_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hra_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    special_allowance_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    conveyance_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    effective_from DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_emp_active_salary UNIQUE (employee_id, effective_from)
);

-- Payroll Runs
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_label VARCHAR(64) NOT NULL, -- e.g. "October 2026"
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'locked')),
    total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    approved_by UUID REFERENCES user_profiles(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_org_payroll_period UNIQUE (organization_id, period_start, period_end)
);

-- Payroll Items (Individual Employee Payroll Breakdown)
CREATE TABLE IF NOT EXISTS payroll_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    payable_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    present_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    leave_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    absent_days NUMERIC(4, 1) NOT NULL DEFAULT 0.0,
    basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hra_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowances_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    incentives_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    overtime_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    late_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unpaid_leave_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    advance_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    calculation_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_employee_per_payroll_run UNIQUE (payroll_run_id, employee_id)
);

-- Payslips (Employee Published View)
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    period_label VARCHAR(64) NOT NULL,
    disbursement_date DATE,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Payroll Tables
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Payroll RLS Policies
CREATE POLICY "Owners and Admins can view and manage salary assignments"
ON employee_salary_assignments FOR ALL
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

CREATE POLICY "Owners and Admins can manage payroll runs"
ON payroll_runs FOR ALL
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

CREATE POLICY "Owners and Admins can view all payroll items"
ON payroll_items FOR ALL
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

-- Employees can ONLY view their own published payslips
CREATE POLICY "Employees can view only their own published payslips"
ON payslips FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    is_published = true
    AND employee_id = auth_current_employee_id(organization_id)
  )
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

-- Trigger: Prevent modification of locked payroll runs
CREATE OR REPLACE FUNCTION check_payroll_lock_immutability()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot modify or delete a locked payroll run. Locked payroll periods are permanent and immutable. Corrections must be handled via authorized adjustments.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_payroll_modification ON payroll_runs;
CREATE TRIGGER trg_prevent_locked_payroll_modification
BEFORE UPDATE OR DELETE ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION check_payroll_lock_immutability();
