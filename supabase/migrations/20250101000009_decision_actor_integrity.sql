-- =============================================================================
-- AttendEase 000009: Authenticated actor ownership for decisions
-- Forward-only migration. Apply only after migration 000008.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_attendance_decision_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Approved/rejected decisions are terminal. Do not allow a second decision
  -- or edits to the request after it has been decided.
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'A decided request is immutable. Submit a separate correction or adjustment.'
      USING ERRCODE = '55000';
  END IF;

  IF TG_TABLE_NAME = 'attendance_corrections'
     AND NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid attendance correction status transition.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_TABLE_NAME = 'leave_requests'
     AND NEW.status NOT IN ('pending', 'approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid leave request status transition.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('approved', 'rejected') THEN
    -- Ignore caller-supplied approved_by and derive the actor from the verified
    -- Supabase request JWT context.
    NEW.approved_by := auth.uid();
    NEW.updated_at := statement_timestamp();
  ELSIF TG_TABLE_NAME = 'leave_requests' AND NEW.status = 'cancelled' THEN
    NEW.approved_by := NULL;
    NEW.updated_at := statement_timestamp();
  ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'approved_by cannot be edited independently of a decision.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_correction_decision_actor ON attendance_corrections;
CREATE TRIGGER trg_attendance_correction_decision_actor
BEFORE UPDATE ON attendance_corrections
FOR EACH ROW
EXECUTE FUNCTION enforce_attendance_decision_actor();

DROP TRIGGER IF EXISTS trg_leave_request_decision_actor ON leave_requests;
CREATE TRIGGER trg_leave_request_decision_actor
BEFORE UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_attendance_decision_actor();

REVOKE ALL ON FUNCTION enforce_attendance_decision_actor() FROM PUBLIC, anon, authenticated;
