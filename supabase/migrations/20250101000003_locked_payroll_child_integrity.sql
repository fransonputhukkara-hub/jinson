-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - LOCKED PAYROLL INTEGRITY
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 3.1: SEC-01 Child-Table Integrity & Concurrency Hardening
-- ==============================================================================

-- 1. Trigger Function: Enforce immutability on payroll_items with concurrency row-locking
CREATE OR REPLACE FUNCTION check_payroll_item_lock_integrity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_status VARCHAR(32);
  v_dest_status VARCHAR(32);
BEGIN
  -- Case 1: DELETE operation
  IF TG_OP = 'DELETE' THEN
    -- Acquire a shared row lock on the parent payroll run to prevent race conditions
    -- with concurrent locking transactions (UPDATE payroll_runs SET status = 'locked')
    SELECT status INTO v_orig_status 
    FROM payroll_runs 
    WHERE id = OLD.payroll_run_id 
    FOR SHARE;

    IF v_orig_status = 'locked' THEN
      RAISE EXCEPTION 'Cannot delete payroll item: associated payroll run is locked and immutable.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Payroll items belonging to locked periods cannot be deleted. Any adjustments must be processed as an authorized supplementary payroll run.';
    END IF;

    RETURN OLD;
  END IF;

  -- Case 2: UPDATE operation
  IF TG_OP = 'UPDATE' THEN
    -- Check original parent run status with concurrency row lock
    SELECT status INTO v_orig_status 
    FROM payroll_runs 
    WHERE id = OLD.payroll_run_id 
    FOR SHARE;

    IF v_orig_status = 'locked' THEN
      RAISE EXCEPTION 'Cannot update payroll item: source payroll run is locked and immutable.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'Modification of individual compensation records within locked payroll periods is forbidden by audit policy.';
    END IF;

    -- If payroll_run_id is being changed, also check the destination parent run status
    IF NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id THEN
      SELECT status INTO v_dest_status 
      FROM payroll_runs 
      WHERE id = NEW.payroll_run_id 
      FOR SHARE;

      IF v_dest_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot move payroll item: destination payroll run is locked and immutable.'
          USING ERRCODE = 'integrity_constraint_violation',
                DETAIL = 'Items cannot be attached to an already locked payroll period.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Case 3: INSERT operation
  IF TG_OP = 'INSERT' THEN
    -- Acquire shared row lock on target parent run to prevent concurrent commit races
    SELECT status INTO v_dest_status 
    FROM payroll_runs 
    WHERE id = NEW.payroll_run_id 
    FOR SHARE;

    IF v_dest_status = 'locked' THEN
      RAISE EXCEPTION 'Cannot insert payroll item: target payroll run is locked and immutable.'
        USING ERRCODE = 'integrity_constraint_violation',
              DETAIL = 'New records cannot be inserted into locked payroll runs.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Attach trigger to payroll_items
DROP TRIGGER IF EXISTS trg_payroll_item_lock_integrity ON payroll_items;
CREATE TRIGGER trg_payroll_item_lock_integrity
BEFORE INSERT OR UPDATE OR DELETE ON payroll_items
FOR EACH ROW
EXECUTE FUNCTION check_payroll_item_lock_integrity();

-- 3. Enhance parent payroll_runs trigger to explicitly guard against unlock exploits
-- (prevent transitioning from 'locked' back to 'draft', 'review', or 'approved')
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
      NEW.locked_at := COALESCE(NEW.locked_at, timezone('utc'::text, now()));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_payroll_modification ON payroll_runs;
CREATE TRIGGER trg_prevent_locked_payroll_modification
BEFORE UPDATE OR DELETE ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION check_payroll_lock_immutability();
