import { 
  AttendanceDailySummary, 
  AttendanceEvent, 
  AttendanceStatus, 
  PunchEventType, 
  Shift,
  AttendanceCorrection
} from '../types/database.types';

export interface WorkInterval {
  inTime: string;
  outTime: string;
  durationMinutes: number;
}

export interface BreakInterval {
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  isPaid: boolean;
}

export interface AttendanceCalculationOptions {
  organizationTimezone?: string;
  paidBreakMinutes?: number;
  overtimeGraceMinutes?: number;
  customOvertimeThresholdMinutes?: number;
  waiveLateArrival?: boolean;
  manualOverrideHours?: number;
}

export interface AttendanceEngineResult {
  summary: AttendanceDailySummary;
  workIntervals: WorkInterval[];
  breakIntervals: BreakInterval[];
  warnings: string[];
  explanation: string;
}

/**
 * Converts a time string "HH:mm" into minutes from start of day (0 to 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Robustly parses an ISO timestamp in an explicit organization timezone.
 * Returns wall-clock date string, hour, minute, second, and minutes from midnight.
 * Does not depend on the browser or host operating system's local timezone.
 */
export function parseTimeInTimezone(isoString: string, timeZone = 'UTC'): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  minutesFromMidnight: number;
  dateString: string;
} {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return {
      year: 1970,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      minutesFromMidnight: 0,
      dateString: '1970-01-01',
    };
  }

  // Use Intl.DateTimeFormat to compute exact localized wall-clock components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // Handle 24:00 boundary
  const minute = parseInt(get('minute'), 10);
  const second = parseInt(get('second'), 10);

  const minutesFromMidnight = hour * 60 + minute;
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    minutesFromMidnight,
    dateString,
  };
}

/**
 * Backward-compatible helper returning minutes from midnight in organization timezone.
 */
export function getMinutesFromMidnight(isoString: string, timeZone = 'UTC'): number {
  return parseTimeInTimezone(isoString, timeZone).minutesFromMidnight;
}

/**
 * Deduplicates attendance punch events deterministically:
 * 1. Checks device_event_uid or event_serial_no if present.
 * 2. If rapid successive scans occur (e.g. employee lingering at terminal camera),
 *    only debounce when BOTH the device_user_id AND the event_type match within debounceWindowSeconds.
 * 3. Does NOT discard legitimate alternating punches (e.g., check_in followed quickly by break_start or check_out).
 */
export function deduplicatePunches(
  punches: AttendanceEvent[], 
  debounceWindowSeconds = 60
): AttendanceEvent[] {
  if (punches.length <= 1) return [...punches];

  // 1. Deduplicate by device_event_uid if present
  const uidSeen = new Set<string>();
  const serialSeen = new Set<string>();
  const uidFiltered: AttendanceEvent[] = [];

  for (const p of punches) {
    if (p.device_event_uid) {
      if (uidSeen.has(p.device_event_uid)) continue;
      uidSeen.add(p.device_event_uid);
    }
    if (p.device_id && p.event_serial_no != null) {
      const serialKey = `${p.device_id}-${p.event_serial_no}`;
      if (serialSeen.has(serialKey)) continue;
      serialSeen.add(serialKey);
    }
    uidFiltered.push(p);
  }

  // 2. Sort chronologically
  const sorted = [...uidFiltered].sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
  );

  // 3. Debounce identical event types for the same user within window
  const result: AttendanceEvent[] = [];

  for (const punch of sorted) {
    if (result.length === 0) {
      result.push(punch);
      continue;
    }

    const prevSameType = [...result]
      .reverse()
      .find(p => p.device_user_id === punch.device_user_id && p.event_type === punch.event_type);

    if (prevSameType) {
      const diffSeconds = (new Date(punch.event_time).getTime() - new Date(prevSameType.event_time).getTime()) / 1000;
      if (diffSeconds < debounceWindowSeconds) {
        // Redundant duplicate scan of the same action within debounce window
        continue;
      }
    }

    result.push(punch);
  }

  return result;
}

/**
 * Calculates a single employee's daily attendance summary from chronological punch events.
 */
export function calculateDailySummary(
  organizationId: string,
  employeeId: string,
  workDate: string, // 'YYYY-MM-DD'
  punches: AttendanceEvent[],
  shift: Shift,
  isOnApprovedLeave = false,
  isHoliday = false,
  isWeeklyOff = false,
  options: AttendanceCalculationOptions = {}
): AttendanceDailySummary {
  const timezone = options.organizationTimezone || 'UTC';
  const paidBreakMinutes = options.paidBreakMinutes ?? 0;
  const overtimeGrace = options.overtimeGraceMinutes ?? 30;

  // Base summary structure
  const summary: AttendanceDailySummary = {
    id: `summary-${employeeId}-${workDate}`,
    organization_id: organizationId,
    employee_id: employeeId,
    work_date: workDate,
    total_work_minutes: 0,
    total_break_minutes: 0,
    overtime_minutes: 0,
    status: 'absent',
    is_late: false,
    late_minutes: 0,
    is_early_departure: false,
    early_departure_minutes: 0,
    is_missing_checkout: false,
    is_approved: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isWeeklyOff) {
    summary.status = 'weekly_off';
    summary.remarks = 'Weekly Off';
    return summary;
  }

  if (isHoliday) {
    summary.status = 'holiday';
    summary.remarks = 'Official Holiday';
    return summary;
  }

  if (isOnApprovedLeave) {
    summary.status = 'on_leave';
    summary.remarks = 'Approved Leave';
    return summary;
  }

  // Deduplicate punches
  const cleanPunches = deduplicatePunches(punches);

  if (cleanPunches.length === 0) {
    summary.status = 'absent';
    summary.remarks = 'No biometric punch events recorded';
    return summary;
  }

  // Sort ascending by timestamp
  cleanPunches.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

  // Shift expected start/end in minutes from midnight
  const shiftStartMins = timeStringToMinutes(shift.start_time);
  let shiftEndMins = timeStringToMinutes(shift.end_time);
  const isOvernight = shift.is_night_shift || shiftEndMins < shiftStartMins;
  if (isOvernight && shiftEndMins < shiftStartMins) {
    shiftEndMins += 1440; // Add 24 hours to overnight end
  }
  const scheduledShiftDurationMins = shiftEndMins - shiftStartMins;

  const lateGraceMins = shift.late_grace_minutes || 0;
  const earlyGraceMins = shift.early_departure_grace_minutes || 0;

  // First punch resolution
  const firstPunch = cleanPunches[0];
  summary.first_check_in = firstPunch.event_time;

  // Check late arrival
  const checkInParsed = parseTimeInTimezone(firstPunch.event_time, timezone);
  const checkInMins = checkInParsed.minutesFromMidnight;

  if (checkInMins > shiftStartMins + lateGraceMins && !options.waiveLateArrival) {
    summary.is_late = true;
    summary.late_minutes = checkInMins - shiftStartMins;
  }

  // Case: Only one punch recorded for the day
  if (cleanPunches.length === 1) {
    summary.is_missing_checkout = true;
    summary.status = summary.is_late ? 'late' : 'present';
    summary.total_work_minutes = 0;
    summary.remarks = 'Missing checkout punch - requires manager review';
    return summary;
  }

  // Last punch resolution
  const lastPunch = cleanPunches[cleanPunches.length - 1];
  summary.last_check_out = lastPunch.event_time;

  // Pairing intervals: break vs work
  let totalBreakMins = 0;
  let currentBreakStart: Date | null = null;
  let unpairedBreak = false;

  for (const p of cleanPunches) {
    if (p.event_type === 'break_start') {
      currentBreakStart = new Date(p.event_time);
    } else if (p.event_type === 'break_end') {
      if (currentBreakStart) {
        const breakEnd = new Date(p.event_time);
        const diffMins = Math.max(0, Math.round((breakEnd.getTime() - currentBreakStart.getTime()) / (1000 * 60)));
        totalBreakMins += diffMins;
        currentBreakStart = null;
      } else {
        unpairedBreak = true;
      }
    }
  }

  if (currentBreakStart) {
    unpairedBreak = true;
  }

  summary.total_break_minutes = totalBreakMins;

  // Gross elapsed time between first check-in and last check-out
  const firstTime = new Date(firstPunch.event_time).getTime();
  const lastTime = new Date(lastPunch.event_time).getTime();
  const grossElapsedMinutes = Math.max(0, Math.round((lastTime - firstTime) / (1000 * 60)));

  // Net work time = gross elapsed minutes minus unpaid break minutes
  const unpaidBreakMins = Math.max(0, totalBreakMins - paidBreakMinutes);
  const netWorkMinutes = Math.max(0, grossElapsedMinutes - unpaidBreakMins);
  summary.total_work_minutes = netWorkMinutes;

  // Check early departure
  const checkOutParsed = parseTimeInTimezone(lastPunch.event_time, timezone);
  let checkOutMins = checkOutParsed.minutesFromMidnight;
  if (isOvernight && checkOutMins < shiftStartMins) {
    checkOutMins += 1440;
  }

  if (checkOutMins < shiftEndMins - earlyGraceMins) {
    summary.is_early_departure = true;
    summary.early_departure_minutes = shiftEndMins - checkOutMins;
  }

  // Overtime calculation
  const overtimeThreshold = options.customOvertimeThresholdMinutes ?? (scheduledShiftDurationMins + overtimeGrace);
  if (netWorkMinutes > overtimeThreshold) {
    summary.overtime_minutes = netWorkMinutes - scheduledShiftDurationMins;
  } else if (checkOutMins > shiftEndMins + overtimeGrace) {
    summary.overtime_minutes = checkOutMins - shiftEndMins;
  }

  // Overall status classification
  const halfDayThreshold = shift.half_day_threshold_minutes || 240;
  if (netWorkMinutes < halfDayThreshold) {
    summary.status = 'half_day';
    summary.remarks = `Worked ${netWorkMinutes}m (below half-day threshold of ${halfDayThreshold}m)`;
  } else if (summary.is_late) {
    summary.status = 'late';
    summary.remarks = `Late arrival by ${summary.late_minutes}m`;
  } else {
    summary.status = 'present';
    summary.remarks = 'Regular presence verified';
  }

  if (unpairedBreak) {
    summary.remarks = (summary.remarks ? summary.remarks + '; ' : '') + 'Warning: Unpaired break event';
  }

  return summary;
}

/**
 * Applies an approved manual attendance correction to a daily summary.
 * Returns an immutable updated copy with audit tracking.
 */
export function applyAttendanceCorrection(
  originalSummary: AttendanceDailySummary,
  correction: AttendanceCorrection,
  actorUserId: string
): AttendanceDailySummary {
  const adjusted = { ...originalSummary };

  switch (correction.correction_type) {
    case 'missing_in':
      if (correction.adjusted_summary.first_check_in) {
        adjusted.first_check_in = String(correction.adjusted_summary.first_check_in);
      }
      adjusted.is_late = false;
      adjusted.late_minutes = 0;
      adjusted.status = 'present';
      break;

    case 'missing_out':
      if (correction.adjusted_summary.last_check_out) {
        adjusted.last_check_out = String(correction.adjusted_summary.last_check_out);
      }
      adjusted.is_missing_checkout = false;
      if (typeof correction.adjusted_summary.total_work_minutes === 'number') {
        adjusted.total_work_minutes = correction.adjusted_summary.total_work_minutes;
      }
      adjusted.status = 'present';
      break;

    case 'late_waive':
      adjusted.is_late = false;
      adjusted.late_minutes = 0;
      if (adjusted.status === 'late') {
        adjusted.status = 'present';
      }
      break;

    case 'overtime_adjust':
      if (typeof correction.adjusted_summary.overtime_minutes === 'number') {
        adjusted.overtime_minutes = correction.adjusted_summary.overtime_minutes;
      }
      break;

    case 'full_override':
      Object.assign(adjusted, correction.adjusted_summary);
      break;
  }

  adjusted.is_approved = true;
  adjusted.remarks = `Approved adjustment by ${actorUserId}: ${correction.reason}`;
  adjusted.updated_at = new Date().toISOString();

  return adjusted;
}
