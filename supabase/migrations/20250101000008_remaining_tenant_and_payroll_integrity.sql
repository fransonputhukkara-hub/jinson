-- =============================================================================
-- AttendEase 000008: Remaining tenant relationships and payroll lock timestamp
-- Forward-only migration. Apply only after migration 000007.
-- =============================================================================

-- Add composite uniqueness targets for tenant-owned relationships.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_shifts_id_org') THEN
    ALTER TABLE shifts ADD CONSTRAINT uq_shifts_id_org UNIQUE (id, organization_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_departments_id_org') THEN
    ALTER TABLE departments ADD CONSTRAINT uq_departments_id_org UNIQUE (id, organization_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payroll_items_id_org_employee') THEN
    ALTER TABLE payroll_items ADD CONSTRAINT uq_payroll_items_id_org_employee UNIQUE (id, organization_id, employee_id);
  END IF;
END;
$$;

-- Same-tenant branch assignment for organization members.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_members_assigned_branch_org') THEN
    ALTER TABLE organization_members
      ADD CONSTRAINT fk_members_assigned_branch_org
      FOREIGN KEY (assigned_branch_id, organization_id)
      REFERENCES branches(id, organization_id)
      ON DELETE SET NULL (assigned_branch_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_branch_org') THEN
    ALTER TABLE departments
      ADD CONSTRAINT fk_departments_branch_org
      FOREIGN KEY (branch_id, organization_id)
      REFERENCES branches(id, organization_id)
      ON DELETE SET NULL (branch_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_department_org') THEN
    ALTER TABLE employees
      ADD CONSTRAINT fk_employees_department_org
      FOREIGN KEY (department_id, organization_id)
      REFERENCES departments(id, organization_id)
      ON DELETE SET NULL (department_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_shift_org') THEN
    ALTER TABLE employees
      ADD CONSTRAINT fk_employees_shift_org
      FOREIGN KEY (shift_id, organization_id)
      REFERENCES shifts(id, organization_id)
      ON DELETE SET NULL (shift_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_events_employee_org') THEN
    ALTER TABLE attendance_events
      ADD CONSTRAINT fk_attendance_events_employee_org
      FOREIGN KEY (employee_id, organization_id)
      REFERENCES employees(id, organization_id)
      ON DELETE SET NULL (employee_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_events_device_org') THEN
    ALTER TABLE attendance_events
      ADD CONSTRAINT fk_attendance_events_device_org
      FOREIGN KEY (device_id, organization_id)
      REFERENCES attendance_devices(id, organization_id)
      ON DELETE SET NULL (device_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_device_sync_logs_device_org') THEN
    ALTER TABLE device_sync_logs
      ADD CONSTRAINT fk_device_sync_logs_device_org
      FOREIGN KEY (device_id, organization_id)
      REFERENCES attendance_devices(id, organization_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_salary_assignments_employee_org') THEN
    ALTER TABLE employee_salary_assignments
      ADD CONSTRAINT fk_salary_assignments_employee_org
      FOREIGN KEY (employee_id, organization_id)
      REFERENCES employees(id, organization_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payslips_item_employee_org') THEN
    ALTER TABLE payslips
      ADD CONSTRAINT fk_payslips_item_employee_org
      FOREIGN KEY (payroll_item_id, organization_id, employee_id)
      REFERENCES payroll_items(id, organization_id, employee_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payslips_employee_org') THEN
    ALTER TABLE payslips
      ADD CONSTRAINT fk_payslips_employee_org
      FOREIGN KEY (employee_id, organization_id)
      REFERENCES employees(id, organization_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_corrections_requester_org_member') THEN
    ALTER TABLE attendance_corrections
      ADD CONSTRAINT fk_corrections_requester_org_member
      FOREIGN KEY (organization_id, requested_by)
      REFERENCES organization_members(organization_id, user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_corrections_approver_org_member') THEN
    ALTER TABLE attendance_corrections
      ADD CONSTRAINT fk_corrections_approver_org_member
      FOREIGN KEY (organization_id, approved_by)
      REFERENCES organization_members(organization_id, user_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_actor_org_member') THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT fk_audit_actor_org_member
      FOREIGN KEY (organization_id, actor_user_id)
      REFERENCES organization_members(organization_id, user_id)
      ON DELETE SET NULL (actor_user_id);
  END IF;
END;
$$;

-- A payroll run must be created as draft. The database, not the caller, owns
-- the locked_at timestamp. Locked runs remain permanently immutable.
CREATE OR REPLACE FUNCTION check_payroll_lock_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Payroll runs must be created in draft status.'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.locked_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Cannot delete payroll run: locked payroll periods are permanent and immutable.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Locked payroll runs cannot be deleted. Corrections must use an authorized adjustment workflow.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'Cannot modify or unlock payroll run: locked payroll periods cannot be modified or reverted.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Once locked, payroll status and contents are immutable.';
    END IF;

    IF NEW.status = 'locked' AND OLD.status IS DISTINCT FROM 'locked' THEN
      NEW.locked_at := statement_timestamp();
    ELSIF NEW.status <> 'locked' THEN
      NEW.locked_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_payroll_modification ON payroll_runs;
CREATE TRIGGER trg_prevent_locked_payroll_modification
BEFORE INSERT OR UPDATE OR DELETE ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION check_payroll_lock_immutability();

REVOKE ALL ON FUNCTION check_payroll_lock_immutability() FROM PUBLIC, anon, authenticated;
