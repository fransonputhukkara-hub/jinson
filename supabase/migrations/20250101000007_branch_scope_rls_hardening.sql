-- =============================================================================
-- AttendEase 000007: Branch-level RLS corrections and client event-ingestion lock
-- Forward-only migration. Apply only after migration 000006.
-- =============================================================================

-- PostgreSQL permissive policies are OR-ed. Remove the original organization-wide
-- employee SELECT policy so it cannot bypass the branch-scoped policy from 000004.
DROP POLICY IF EXISTS "Organization members can view employees in their organization" ON employees;

-- User profile rows contain email and phone. Organization co-members should use
-- employees / memberships for directory information, not read private auth profiles.
DROP POLICY IF EXISTS "Users can view their own profile or co-members" ON user_profiles;
CREATE POLICY "Users can view own profile or platform admins"
ON user_profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR auth_is_platform_admin());

-- Branch managers and employees should not enumerate unrelated branches.
DROP POLICY IF EXISTS "Users can view branches within their organization" ON branches;
CREATE POLICY "Role scoped branch read"
ON branches FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR (
        auth_user_role_in_org(organization_id) IN ('branch_manager', 'employee')
        AND id = auth_user_assigned_branch(organization_id)
      )
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND id = auth_current_employee_branch_id(organization_id)
      )
    )
  )
);

-- Organization membership lookup is self-scoped for ordinary users. Owners/admins
-- retain the ability to administer their organization roster.
DROP POLICY IF EXISTS "Users can view members in their organization" ON organization_members;
CREATE POLICY "Users can view own membership or organization roster admins"
ON organization_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR auth_is_platform_admin()
  OR (
    auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
    AND organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  )
);

-- Shifts and departments can contain branch-specific operational details.
DROP POLICY IF EXISTS "Users can view shifts in their organization" ON shifts;
CREATE POLICY "Role scoped shift read"
ON shifts FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN (
      'company_owner', 'company_admin', 'branch_manager', 'employee'
    )
  )
);

DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
CREATE POLICY "Role scoped department read"
ON departments FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR branch_id IS NULL
      OR branch_id = auth_user_assigned_branch(organization_id)
    )
  )
);

-- Replace the peer-wide employee policy with role-specific access. Managers see
-- their assigned branch; employees see only the row linked to their auth email.
DROP POLICY IF EXISTS "Role-aware employee read access" ON employees;
CREATE POLICY "Role scoped employee read"
ON employees FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND branch_id = auth_user_assigned_branch(organization_id)
      )
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND id = auth_current_employee_id(organization_id)
      )
    )
  )
);

-- Daily attendance summaries must follow the same branch boundary as employees.
DROP POLICY IF EXISTS "Users can view daily summaries in their organization" ON attendance_daily_summaries;
CREATE POLICY "Role scoped daily attendance summary read"
ON attendance_daily_summaries FOR SELECT
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
          SELECT e.id FROM employees e
          WHERE e.organization_id = attendance_daily_summaries.organization_id
            AND e.branch_id = auth_user_assigned_branch(attendance_daily_summaries.organization_id)
        )
      )
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND employee_id = auth_current_employee_id(attendance_daily_summaries.organization_id)
      )
    )
  )
);

-- Raw device events are sensitive source records. Do not permit ordinary
-- authenticated browser clients to create synthetic punches. A future trusted
-- Edge Connector must ingest through a separately authenticated server boundary.
DROP POLICY IF EXISTS "Users can view attendance events in their organization" ON attendance_events;
DROP POLICY IF EXISTS "Authorized connectors can insert attendance events" ON attendance_events;
CREATE POLICY "Role scoped attendance event read"
ON attendance_events FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND (
          (employee_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = attendance_events.employee_id
              AND e.organization_id = attendance_events.organization_id
              AND e.branch_id = auth_user_assigned_branch(attendance_events.organization_id)
          ))
          OR (device_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM attendance_devices d
            WHERE d.id = attendance_events.device_id
              AND d.organization_id = attendance_events.organization_id
              AND d.branch_id = auth_user_assigned_branch(attendance_events.organization_id)
          ))
        )
      )
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND employee_id = auth_current_employee_id(attendance_events.organization_id)
      )
    )
  )
);

-- Device visibility is branch-scoped for branch managers. Device writes remain
-- limited to owners/admins/installers through existing explicit policies.
DROP POLICY IF EXISTS "Organization members can view devices in their organization" ON attendance_devices;
CREATE POLICY "Role scoped attendance device read"
ON attendance_devices FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin', 'installer_partner')
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND branch_id = auth_user_assigned_branch(organization_id)
      )
    )
  )
);

-- Enforce same-tenant ownership for attendance correction employee references.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_corrections_employee_org'
  ) THEN
    ALTER TABLE attendance_corrections
      ADD CONSTRAINT fk_attendance_corrections_employee_org
      FOREIGN KEY (employee_id, organization_id)
      REFERENCES employees(id, organization_id) ON DELETE CASCADE;
  END IF;
END;
$;

-- A requester may create a correction only for their own employee row or
-- another employee within the branch they are assigned to. The actor must be
-- the authenticated user; caller-supplied requested_by cannot impersonate staff.
DROP POLICY IF EXISTS "Branch managers and employees can request corrections" ON attendance_corrections;
CREATE POLICY "Users can request corrections within their employee scope"
ON attendance_corrections FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  AND (
    auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
    OR (
      auth_user_role_in_org(organization_id) = 'branch_manager'
      AND employee_id IN (
        SELECT e.id FROM employees e
        WHERE e.organization_id = attendance_corrections.organization_id
          AND e.branch_id = auth_user_assigned_branch(attendance_corrections.organization_id)
      )
    )
    OR (
      auth_user_role_in_org(organization_id) = 'employee'
      AND employee_id = auth_current_employee_id(attendance_corrections.organization_id)
    )
  )
);

-- Corrections can contain employee attendance details. Restrict reads to the
-- organization owner/admin, the assigned branch manager, or the target employee.
DROP POLICY IF EXISTS "Members can view attendance corrections in org" ON attendance_corrections;
CREATE POLICY "Role scoped attendance correction read"
ON attendance_corrections FOR SELECT
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
          SELECT e.id FROM employees e
          WHERE e.organization_id = attendance_corrections.organization_id
            AND e.branch_id = auth_user_assigned_branch(attendance_corrections.organization_id)
        )
      )
      OR (
        auth_user_role_in_org(organization_id) = 'employee'
        AND employee_id = auth_current_employee_id(attendance_corrections.organization_id)
      )
    )
  )
);

-- Branch managers may only submit leave requests for staff in their assigned branch.
DROP POLICY IF EXISTS "Employees and Managers can apply for leave" ON leave_requests;
CREATE POLICY "Authorized staff can apply for leave in their scope"
ON leave_requests FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
  AND (
    auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
    OR (
      auth_user_role_in_org(organization_id) = 'branch_manager'
      AND employee_id IN (
        SELECT e.id FROM employees e
        WHERE e.organization_id = leave_requests.organization_id
          AND e.branch_id = auth_user_assigned_branch(leave_requests.organization_id)
      )
    )
    OR (
      auth_user_role_in_org(organization_id) = 'employee'
      AND employee_id = auth_current_employee_id(leave_requests.organization_id)
    )
  )
);

-- Device sync diagnostics are restricted to organization admins and the relevant
-- branch manager. No employee-level access is granted to connector diagnostics.
CREATE POLICY "Admins and assigned branch managers can read device sync logs"
ON device_sync_logs FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND (
      auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
      OR (
        auth_user_role_in_org(organization_id) = 'branch_manager'
        AND device_id IN (
          SELECT d.id FROM attendance_devices d
          WHERE d.organization_id = device_sync_logs.organization_id
            AND d.branch_id = auth_user_assigned_branch(device_sync_logs.organization_id)
        )
      )
    )
  )
);

-- Notifications currently have no recipient or branch column. Restrict access to
-- organization owners/admins until recipient-aware notification delivery exists.
DROP POLICY IF EXISTS "Users can view their organization notifications" ON notifications;
CREATE POLICY "Admins can read organization notifications"
ON notifications FOR SELECT
TO authenticated
USING (
  auth_is_platform_admin()
  OR (
    organization_id IN (SELECT organization_id FROM auth_current_user_org_ids())
    AND auth_user_role_in_org(organization_id) IN ('company_owner', 'company_admin')
  )
);

-- Prevent authenticated users from editing their login email directly in the
-- profile table. Authentication email changes must go through Supabase Auth.
REVOKE UPDATE ON user_profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, updated_at) ON user_profiles TO authenticated;

-- The migration itself is deliberately forward-only and must be recorded by the
-- migration runner / Supabase migration history after successful application.
