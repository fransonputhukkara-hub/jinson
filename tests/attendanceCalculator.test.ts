import { describe, it, expect } from 'vitest';
import { 
  deduplicatePunches, 
  calculateDailySummary, 
  timeStringToMinutes 
} from '../src/engine/attendanceEngine';
import { AttendanceEvent, Shift } from '../src/types/database.types';

describe('Attendance Engine - Unit Tests', () => {
  const sampleShift: Shift = {
    id: 'shift-1',
    organization_id: 'org-1',
    name: 'General Shift',
    start_time: '09:30',
    end_time: '18:00',
    late_grace_minutes: 15, // up to 09:45 is on time
    early_departure_grace_minutes: 15,
    half_day_threshold_minutes: 240, // 4 hours
    is_night_shift: false,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  it('correctly converts time strings to minutes from midnight', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('09:30')).toBe(570);
    expect(timeStringToMinutes('18:00')).toBe(1080);
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });

  it('deduplicates multiple punches within a 60-second debounce window', () => {
    const rawPunches: AttendanceEvent[] = [
      {
        id: 'p1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:20:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:20:00Z',
      },
      {
        id: 'p2',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:20:15Z', // 15 seconds later -> DUPLICATE
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:20:15Z',
      },
      {
        id: 'p3',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:20:45Z', // 45 seconds after first -> DUPLICATE
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:20:45Z',
      },
      {
        id: 'p4',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T18:02:00Z', // Evening check-out -> VALID
        event_type: 'check_out',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T18:02:00Z',
      },
    ];

    const deduplicated = deduplicatePunches(rawPunches, 60);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].id).toBe('p1');
    expect(deduplicated[1].id).toBe('p4');
  });

  it('marks attendance as absent when no punches are recorded', () => {
    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      [],
      sampleShift
    );

    expect(summary.status).toBe('absent');
    expect(summary.total_work_minutes).toBe(0);
  });

  it('marks employee as on_leave when approved leave is flagged', () => {
    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      [],
      sampleShift,
      true // isOnApprovedLeave
    );

    expect(summary.status).toBe('on_leave');
  });

  it('detects missing checkout when only one punch is present', () => {
    const singlePunch: AttendanceEvent[] = [
      {
        id: 'p1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:35:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:35:00Z',
      },
    ];

    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      singlePunch,
      sampleShift
    );

    expect(summary.is_missing_checkout).toBe(true);
    expect(summary.total_work_minutes).toBe(0);
    expect(summary.remarks).toContain('Missing checkout');
  });

  it('calculates full day attendance with valid in and out', () => {
    const punches: AttendanceEvent[] = [
      {
        id: 'p1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:20:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:20:00Z',
      },
      {
        id: 'p2',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T18:05:00Z',
        event_type: 'check_out',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T18:05:00Z',
      },
    ];

    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      punches,
      sampleShift
    );

    expect(summary.is_missing_checkout).toBe(false);
    expect(summary.total_work_minutes).toBe(525); // 8 hours 45 min
    expect(summary.first_check_in).toBe('2026-10-15T09:20:00Z');
    expect(summary.last_check_out).toBe('2026-10-15T18:05:00Z');
  });

  it('correctly calculates overnight shifts crossing midnight (e.g. 21:00 to 05:00)', () => {
    const nightShift: Shift = {
      id: 'shift-night',
      organization_id: 'org-1',
      name: 'Night Shift',
      start_time: '21:00',
      end_time: '05:00',
      late_grace_minutes: 15,
      early_departure_grace_minutes: 15,
      half_day_threshold_minutes: 240,
      is_night_shift: true,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Punches: In at 20:55, Out at 05:05 next morning
    const punches: AttendanceEvent[] = [
      {
        id: 'np-1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T20:55:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T20:55:00Z',
      },
      {
        id: 'np-2',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-16T05:05:00Z',
        event_type: 'check_out',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-16T05:05:00Z',
      },
    ];

    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      punches,
      nightShift
    );

    expect(summary.status).toBe('present');
    expect(summary.is_late).toBe(false);
    expect(summary.is_early_departure).toBe(false);
    expect(summary.total_work_minutes).toBe(490); // 8 hours 10 mins
  });

  it('deducts unpaid breaks from total work minutes and flags unpaired breaks', () => {
    const punches: AttendanceEvent[] = [
      {
        id: 'b-1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:30:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:30:00Z',
      },
      {
        id: 'b-2',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T13:00:00Z',
        event_type: 'break_start',
        verification_mode: 'fingerprint',
        is_processed: false,
        created_at: '2026-10-15T13:00:00Z',
      },
      {
        id: 'b-3',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T13:45:00Z', // 45 minute lunch break
        event_type: 'break_end',
        verification_mode: 'fingerprint',
        is_processed: false,
        created_at: '2026-10-15T13:45:00Z',
      },
      {
        id: 'b-4',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T18:00:00Z',
        event_type: 'check_out',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T18:00:00Z',
      },
    ];

    const summary = calculateDailySummary(
      'org-1',
      'emp-1',
      '2026-10-15',
      punches,
      sampleShift,
      false,
      false,
      false,
      { paidBreakMinutes: 0 }
    );

    expect(summary.total_break_minutes).toBe(45);
    // Gross: 09:30 to 18:00 = 510m; Net = 510 - 45 = 465m
    expect(summary.total_work_minutes).toBe(465);
    expect(summary.status).toBe('present');
  });

  it('preserves distinct punch types even when recorded within 60 seconds', () => {
    const rapidPunches: AttendanceEvent[] = [
      {
        id: 'r-1',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:30:00Z',
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:30:00Z',
      },
      {
        id: 'r-2',
        organization_id: 'org-1',
        device_user_id: '101',
        event_time: '2026-10-15T09:30:25Z', // 25s later: employee punched break_start or check_out
        event_type: 'break_start',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T09:30:25Z',
      },
    ];

    const deduplicated = deduplicatePunches(rapidPunches, 60);
    // Must NOT discard r-2 because the event_type is different!
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].event_type).toBe('check_in');
    expect(deduplicated[1].event_type).toBe('break_start');
  });

  it('accurately parses organization timezone Asia/Kolkata regardless of host environment', () => {
    // 04:00:00 UTC is 09:30:00 in Asia/Kolkata (+05:30)
    const kolkataPunches: AttendanceEvent[] = [
      {
        id: 'k-1',
        organization_id: 'org-jcf',
        device_user_id: '101',
        event_time: '2026-10-15T04:00:00Z', // 09:30 IST
        event_type: 'check_in',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T04:00:00Z',
      },
      {
        id: 'k-2',
        organization_id: 'org-jcf',
        device_user_id: '101',
        event_time: '2026-10-15T12:30:00Z', // 18:00 IST
        event_type: 'check_out',
        verification_mode: 'face',
        is_processed: false,
        created_at: '2026-10-15T12:30:00Z',
      },
    ];

    const summary = calculateDailySummary(
      'org-jcf',
      'emp-1',
      '2026-10-15',
      kolkataPunches,
      sampleShift, // 09:30 to 18:00
      false,
      false,
      false,
      { organizationTimezone: 'Asia/Kolkata' }
    );

    expect(summary.is_late).toBe(false);
    expect(summary.is_early_departure).toBe(false);
    expect(summary.total_work_minutes).toBe(510);
    expect(summary.status).toBe('present');
  });
});
