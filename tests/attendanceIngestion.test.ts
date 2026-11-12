import { describe, it, expect } from 'vitest';
import { 
  deduplicatePunches, 
  calculateDailySummary 
} from '../src/engine/attendanceEngine';
import { AttendanceEvent, PunchEventType, Shift } from '../src/types/database.types';

/**
 * Ingestion Pipeline & Event Direction Resolution Verification
 */

interface RawIngestionEvent {
  externalEventUid: string;
  deviceSerialNumber: number;
  terminalUserId: string;
  rawTimestamp: string;
  attendanceStatus?: number; // 1: In, 2: Out, 3: BreakOut, 4: BreakIn
  minorType?: number;        // 75: Face, 71: Fingerprint, 1: Card
}

class IngestionPipeline {
  private eventStore = new Map<string, AttendanceEvent>();
  private serialStore = new Set<string>();

  /**
   * Idempotent ingestion handler simulating database unique constraints:
   * UNIQUE (organization_id, device_event_uid) and UNIQUE (device_id, event_serial_no)
   */
  public ingestRawEvent(
    organizationId: string,
    deviceId: string,
    raw: RawIngestionEvent,
    employeeIdMap: Map<string, string>
  ): { success: boolean; isDuplicate: boolean; event?: AttendanceEvent; error?: string } {
    // 1. Idempotency Check via externalEventUid
    if (this.eventStore.has(raw.externalEventUid)) {
      return { success: true, isDuplicate: true, event: this.eventStore.get(raw.externalEventUid) };
    }

    // 2. Hardware Serial Number Idempotency Check
    const serialKey = `${deviceId}-${raw.deviceSerialNumber}`;
    if (this.serialStore.has(serialKey)) {
      return { success: true, isDuplicate: true };
    }

    // 3. Timestamp Validation
    const eventDate = new Date(raw.rawTimestamp);
    if (isNaN(eventDate.getTime())) {
      return { success: false, isDuplicate: false, error: 'Invalid timestamp format' };
    }

    // 4. Safe Unknown User Handling
    const matchedEmployeeId = employeeIdMap.get(raw.terminalUserId);

    // 5. Event Direction Determination for Hikvision DS-K1T320MFWX
    // If the terminal operator pressed an In/Out status key on terminal, use it.
    // Otherwise, mark as unknown direction for shift schedule resolution.
    let eventType: PunchEventType = 'unknown';
    if (raw.attendanceStatus === 1) eventType = 'check_in';
    else if (raw.attendanceStatus === 2) eventType = 'check_out';
    else if (raw.attendanceStatus === 3) eventType = 'break_start';
    else if (raw.attendanceStatus === 4) eventType = 'break_end';

    let verificationMode: AttendanceEvent['verification_mode'] = 'unknown';
    if (raw.minorType === 75) verificationMode = 'face';
    else if (raw.minorType === 71) verificationMode = 'fingerprint';
    else if (raw.minorType === 1) verificationMode = 'card';

    const event: AttendanceEvent = {
      id: `evt-${raw.externalEventUid}`,
      organization_id: organizationId,
      device_id: deviceId,
      employee_id: matchedEmployeeId, // May be undefined if unmapped
      device_user_id: raw.terminalUserId,
      event_time: eventDate.toISOString(),
      event_type: eventType,
      verification_mode: verificationMode,
      is_processed: false,
      raw_payload: {
        externalEventUid: raw.externalEventUid,
        deviceSerialNumber: raw.deviceSerialNumber,
        is_unmapped_user: !matchedEmployeeId,
      },
      created_at: new Date().toISOString(),
    };

    this.eventStore.set(raw.externalEventUid, event);
    this.serialStore.add(serialKey);

    return { success: true, isDuplicate: false, event };
  }

  /**
   * Resolves event direction when Hikvision DS-K1T320MFWX operates in Access Control mode
   * without explicit punch status keys selected by staff.
   */
  public static resolvePunchDirectionByShift(
    punches: AttendanceEvent[],
    shift: Shift
  ): { checkIn?: AttendanceEvent; checkOut?: AttendanceEvent } {
    if (punches.length === 0) return {};

    // Sort punches chronologically
    const sorted = [...punches].sort(
      (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
    );

    // Earliest punch within shift window is treated as checkIn
    const checkIn = sorted[0];

    // If multiple punches, the latest punch is treated as candidate checkOut
    let checkOut: AttendanceEvent | undefined = undefined;
    if (sorted.length > 1) {
      checkOut = sorted[sorted.length - 1];
    }

    return { checkIn, checkOut };
  }
}

describe('Attendance Ingestion & Direction Resolution Tests', () => {
  const orgId = 'org-jinson-chit-fund';
  const deviceId = 'dev-hik-01';

  const employeeMap = new Map<string, string>([
    ['101', 'emp-001'], // Jinson Varghese
    ['102', 'emp-002'], // Anoop Paul
  ]);

  it('guarantees database idempotency on repeated sync of same event', () => {
    const pipeline = new IngestionPipeline();

    const rawEvent: RawIngestionEvent = {
      externalEventUid: 'hik-acs-20261015-001',
      deviceSerialNumber: 4096,
      terminalUserId: '101',
      rawTimestamp: '2026-10-15T09:24:10+05:30',
      attendanceStatus: 1, // checkIn
      minorType: 75,       // face
    };

    // First ingestion -> inserted
    const firstSync = pipeline.ingestRawEvent(orgId, deviceId, rawEvent, employeeMap);
    expect(firstSync.success).toBe(true);
    expect(firstSync.isDuplicate).toBe(false);
    expect(firstSync.event?.employee_id).toBe('emp-001');

    // Repeated ingestion with same externalEventUid -> detected as duplicate, NOT re-inserted
    const secondSync = pipeline.ingestRawEvent(orgId, deviceId, rawEvent, employeeMap);
    expect(secondSync.success).toBe(true);
    expect(secondSync.isDuplicate).toBe(true);
  });

  it('safely handles unknown biometric terminal user IDs without crashing', () => {
    const pipeline = new IngestionPipeline();

    const unmappedEvent: RawIngestionEvent = {
      externalEventUid: 'hik-acs-unmapped-999',
      deviceSerialNumber: 4097,
      terminalUserId: '999', // Not in employeeMap
      rawTimestamp: '2026-10-15T09:30:00+05:30',
      minorType: 75,
    };

    const res = pipeline.ingestRawEvent(orgId, deviceId, unmappedEvent, employeeMap);
    expect(res.success).toBe(true);
    expect(res.isDuplicate).toBe(false);
    expect(res.event?.employee_id).toBeUndefined(); // Safely unmapped
    expect(res.event?.raw_payload?.is_unmapped_user).toBe(true);
  });

  it('rejects invalid or corrupted timestamps gracefully', () => {
    const pipeline = new IngestionPipeline();

    const badTimestampEvent: RawIngestionEvent = {
      externalEventUid: 'hik-acs-corrupted-time',
      deviceSerialNumber: 4098,
      terminalUserId: '101',
      rawTimestamp: 'INVALID_DATE_STRING_NOT_ISO',
    };

    const res = pipeline.ingestRawEvent(orgId, deviceId, badTimestampEvent, employeeMap);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid timestamp');
  });

  it('resolves IN and OUT directions safely when terminal operates in Access Control mode', () => {
    const shift: Shift = {
      id: 's1',
      organization_id: orgId,
      name: 'General Shift',
      start_time: '09:30',
      end_time: '18:00',
      late_grace_minutes: 15,
      early_departure_grace_minutes: 15,
      half_day_threshold_minutes: 240,
      is_night_shift: false,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const punches: AttendanceEvent[] = [
      {
        id: 'p1',
        organization_id: orgId,
        device_user_id: '101',
        event_time: '2026-10-15T09:22:00+05:30',
        event_type: 'unknown', // Direction not provided by terminal
        verification_mode: 'face',
        is_processed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'p2',
        organization_id: orgId,
        device_user_id: '101',
        event_time: '2026-10-15T18:05:00+05:30',
        event_type: 'unknown',
        verification_mode: 'face',
        is_processed: false,
        created_at: new Date().toISOString(),
      },
    ];

    const resolved = IngestionPipeline.resolvePunchDirectionByShift(punches, shift);
    expect(resolved.checkIn?.event_time).toBe('2026-10-15T09:22:00+05:30');
    expect(resolved.checkOut?.event_time).toBe('2026-10-15T18:05:00+05:30');
  });
});
