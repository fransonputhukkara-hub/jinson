export type UserRole = 
  | 'platform_admin'
  | 'installer_partner'
  | 'company_owner'
  | 'company_admin'
  | 'branch_manager'
  | 'employee';

export type DeviceManufacturer = 'Hikvision' | 'eSSL' | 'ZKTeco' | 'Generic';
export type DeviceConnectionMethod = 'ISAPI' | 'Push_SDK' | 'TCP_IP' | 'Cloud_Proxy';
export type DeviceStatus = 'connected' | 'disconnected' | 'not_configured' | 'simulated' | 'not_yet_verified';
export type PunchEventType = 'check_in' | 'check_out' | 'break_start' | 'break_end' | 'overtime_start' | 'overtime_end' | 'unknown';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday' | 'weekly_off';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PayrollStatus = 'draft' | 'review' | 'approved' | 'locked';

export interface Organization {
  id: string;
  name: string;
  code: string;
  timezone: string; // e.g., 'Asia/Kolkata'
  currency: string; // e.g., 'INR'
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  branch_id?: string;
  name: string;
  code: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  assigned_branch_id?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  branch_id: string;
  department_id?: string;
  employee_code: string; // App Employee ID (e.g., JCF-001)
  first_name: string;
  last_name: string;
  display_name: string;
  email?: string;
  phone?: string;
  designation: string;
  joining_date: string;
  employment_status: 'active' | 'probation' | 'resigned' | 'terminated' | 'on_leave';
  is_active: boolean;
  shift_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceDevice {
  id: string;
  organization_id: string;
  branch_id: string;
  device_name: string;
  manufacturer: DeviceManufacturer;
  model: string; // e.g. 'DS-K1T320MFWX'
  serial_number: string;
  ip_address?: string;
  port?: number;
  connection_method: DeviceConnectionMethod;
  status: DeviceStatus;
  last_sync_at?: string;
  last_error?: string;
  firmware_version?: string;
  supported_capabilities: string[];
  created_at: string;
  updated_at: string;
}

export interface DeviceEmployeeMapping {
  id: string;
  organization_id: string;
  device_id: string;
  employee_id: string;
  device_user_id: string; // Hardware ID on Hikvision/eSSL (e.g. "101")
  card_no?: string;
  is_enrolled_face: boolean;
  is_enrolled_fingerprint: boolean;
  is_enrolled_card: boolean;
  is_active_on_device: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceEvent {
  id: string;
  organization_id: string;
  device_id?: string;
  employee_id?: string;
  device_user_id: string;
  event_time: string; // ISO timestamp
  event_type: PunchEventType;
  verification_mode: 'face' | 'fingerprint' | 'card' | 'password' | 'manual' | 'unknown';
  is_processed: boolean;
  event_serial_no?: number;
  device_event_uid?: string;
  is_unmapped_user?: boolean;
  raw_payload?: Record<string, unknown>;
  created_at: string;
}

export interface AttendanceCorrection {
  id: string;
  organization_id: string;
  employee_id: string;
  target_date: string;
  requested_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  correction_type: 'missing_in' | 'missing_out' | 'late_waive' | 'overtime_adjust' | 'full_override';
  original_summary?: Record<string, unknown>;
  adjusted_summary: Record<string, unknown>;
  reason: string;
  decision_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryStructure {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeSalaryAssignment {
  id: string;
  organization_id: string;
  employee_id: string;
  basic_monthly: number;
  hra_monthly: number;
  special_allowance_monthly: number;
  conveyance_monthly: number;
  effective_from: string;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  status: PayrollStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  approved_by?: string;
  locked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  organization_id: string;
  employee_id: string;
  payable_days: number;
  present_days: number;
  leave_days: number;
  absent_days: number;
  basic_pay: number;
  hra_pay: number;
  allowances_pay: number;
  incentives_pay: number;
  overtime_pay: number;
  late_deductions: number;
  unpaid_leave_deductions: number;
  advance_deductions: number;
  gross_pay: number;
  net_pay: number;
  calculation_breakdown: Record<string, unknown>;
  created_at: string;
}

export interface Payslip {
  id: string;
  organization_id: string;
  payroll_item_id: string;
  employee_id: string;
  period_label: string;
  disbursement_date?: string;
  is_published: boolean;
  created_at: string;
}

export interface AttendanceDailySummary {
  id: string;
  organization_id: string;
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  first_check_in?: string;
  last_check_out?: string;
  total_work_minutes: number;
  total_break_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  is_late: boolean;
  late_minutes: number;
  is_early_departure: boolean;
  early_departure_minutes: number;
  is_missing_checkout: boolean;
  remarks?: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  organization_id: string;
  name: string;
  start_time: string; // HH:mm (e.g., '09:00')
  end_time: string;   // HH:mm (e.g., '18:00')
  late_grace_minutes: number; // e.g., 15
  early_departure_grace_minutes: number;
  half_day_threshold_minutes: number;
  is_night_shift: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity';
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: LeaveRequestStatus;
  approved_by?: string;
  created_at: string;
}

export interface DeviceSyncLog {
  id: string;
  organization_id: string;
  device_id: string;
  status: 'success' | 'failed' | 'in_progress';
  events_pulled: number;
  events_inserted: number;
  error_message?: string;
  sync_duration_ms: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  organization_id: string;
  type: 'unexplained_absence' | 'late_arrival' | 'missing_checkout' | 'device_offline' | 'sync_failed' | 'payroll_approval';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  related_entity_id?: string;
  is_read: boolean;
  created_at: string;
}
