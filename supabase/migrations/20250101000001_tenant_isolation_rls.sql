-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - ROW LEVEL SECURITY (RLS) POLICIES
-- Target Database: PostgreSQL 15+ (Supabase)
-- Strict Tenant Isolation Policies
-- ==============================================================================

-- 1. Helper function: Get organization IDs the authenticated user belongs to
CREATE OR REPLACE FUNCTION auth_current_user_org_ids()
RETURNS TABLE (organization_id UUID) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid();
$$;

-- 2. Helper function: Check if current user is platform_admin
CREATE OR REPLACE FUNCTION auth_is_platform_admin()
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND role = 'platform_admin'
  );
$$;

-- 3. Enable RLS on all tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_employee_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES FOR ORGANIZATIONS
-- ==============================================================================

CREATE POLICY "Users can view organizations they belong to"
ON organizations FOR SELECT
TO authenticated
USING (
  id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Platform admins can manage organizations"
ON organizations FOR ALL
TO authenticated
USING (auth_is_platform_admin());

-- ==============================================================================
-- RLS POLICIES FOR BRANCHES
-- ==============================================================================

CREATE POLICY "Users can view branches within their organization"
ON branches FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Company Owners and Admins can manage branches"
ON branches FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = branches.organization_id
      AND organization_members.role IN ('company_owner', 'company_admin', 'platform_admin')
  )
);

-- ==============================================================================
-- RLS POLICIES FOR EMPLOYEES
-- ==============================================================================

CREATE POLICY "Organization members can view employees in their organization"
ON employees FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Owners and Admins can manage employees"
ON employees FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = employees.organization_id
      AND organization_members.role IN ('company_owner', 'company_admin', 'platform_admin')
  )
);

-- ==============================================================================
-- RLS POLICIES FOR ATTENDANCE DEVICES
-- ==============================================================================

CREATE POLICY "Organization members can view devices in their organization"
ON attendance_devices FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Admins and Installers can manage attendance devices"
ON attendance_devices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = attendance_devices.organization_id
      AND organization_members.role IN ('company_owner', 'company_admin', 'installer_partner', 'platform_admin')
  )
);

-- ==============================================================================
-- RLS POLICIES FOR ATTENDANCE EVENTS & SUMMARIES
-- ==============================================================================

CREATE POLICY "Users can view attendance events in their organization"
ON attendance_events FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

CREATE POLICY "Users can view daily summaries in their organization"
ON attendance_daily_summaries FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  OR auth_is_platform_admin()
);

-- Note: Ingestion service role bypasses RLS for raw event inserts, or uses authorized connector credentials
CREATE POLICY "Authorized connectors can insert attendance events"
ON attendance_events FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
);

-- ==============================================================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ==============================================================================

CREATE POLICY "Users can view their organization notifications"
ON notifications FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
);
