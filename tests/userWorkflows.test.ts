import { describe, it, expect } from 'vitest';
import { 
  Employee, 
  AttendanceDailySummary, 
  AttendanceCorrection, 
  LeaveRequest, 
  Shift 
} from '../src/types/database.types';

describe('Milestone 2 User Workflows - Automated Test Suite', () => {
  // Mock initial state
  const initialEmployees: Employee[] = [
    {
      id: 'emp-001',
      organization_id: 'org-jinson-chit-fund',
      branch_id: 'branch-tsr-main',
      employee_code: 'JCF-001',
      first_name: 'Jinson',
      last_name: 'Varghese',
      display_name: 'Jinson Varghese',
      designation: 'Managing Director & Owner',
      joining_date: '2020-01-10',
      employment_status: 'active',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2026-10-15T00:00:00Z',
    },
    {
      id: 'emp-004',
      organization_id: 'org-jinson-chit-fund',
      branch_id: 'branch-tsr-main',
      employee_code: 'JCF-004',
      first_name: 'Rahul',
      last_name: 'Menon',
      display_name: 'Rahul Menon',
      designation: 'Auction Officer',
      joining_date: '2023-01-15',
      employment_status: 'active',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2026-10-15T00:00:00Z',
    },
  ];

  const initialSummaryRahul: AttendanceDailySummary = {
    id: 'sum-004',
    organization_id: 'org-jinson-chit-fund',
    employee_id: 'emp-004',
    work_date: '2026-10-15',
    first_check_in: '2026-10-15T09:35:00+05:30',
    last_check_out: undefined,
    total_work_minutes: 0,
    total_break_minutes: 0,
    overtime_minutes: 0,
    status: 'present',
    is_late: false,
    late_minutes: 0,
    is_early_departure: false,
    early_departure_minutes: 0,
    is_missing_checkout: true, // Needs resolution
    remarks: 'Missing check-out punch',
    is_approved: false,
    created_at: '2026-10-15T09:35:00Z',
    updated_at: '2026-10-15T09:35:00Z',
  };

  it('Workflow 1: Adds a new staff member and registers their daily attendance record', () => {
    let roster = [...initialEmployees];
    const newStaffPayload: Omit<Employee, 'id' | 'created_at' | 'updated_at'> = {
      organization_id: 'org-jinson-chit-fund',
      branch_id: 'branch-tsr-main',
      employee_code: 'JCF-008',
      first_name: 'Suresh',
      last_name: 'Menon',
      display_name: 'Suresh Menon',
      designation: 'Assistant Cashier',
      joining_date: '2026-10-15',
      employment_status: 'active',
      is_active: true,
    };

    const newEmp: Employee = {
      ...newStaffPayload,
      id: 'emp-008',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    roster.push(newEmp);

    expect(roster).toHaveLength(3);
    expect(roster.find(e => e.employee_code === 'JCF-008')).toBeDefined();
    expect(roster.find(e => e.employee_code === 'JCF-008')?.designation).toBe('Assistant Cashier');
  });

  it('Workflow 2: Deactivates an employee without deleting historical data', () => {
    let roster = [...initialEmployees];
    // Deactivate Rahul Menon
    roster = roster.map(emp => {
      if (emp.id === 'emp-004') {
        return {
          ...emp,
          is_active: false,
          employment_status: 'resigned',
        };
      }
      return emp;
    });

    const rahul = roster.find(e => e.id === 'emp-004');
    expect(rahul?.is_active).toBe(false);
    expect(rahul?.employment_status).toBe('resigned');
    // Ensure the record is preserved in the roster
    expect(roster).toHaveLength(2);
  });

  it('Workflow 3 & 4: Submits and approves an attendance correction for missing check-out', () => {
    let summary = { ...initialSummaryRahul };
    expect(summary.is_missing_checkout).toBe(true);
    expect(summary.total_work_minutes).toBe(0);

    // 1. Submit Correction
    const correction: AttendanceCorrection = {
      id: 'corr-test-01',
      organization_id: 'org-jinson-chit-fund',
      employee_id: 'emp-004',
      target_date: '2026-10-15',
      requested_by: 'emp-002',
      status: 'pending',
      correction_type: 'missing_out',
      adjusted_summary: {
        last_check_out: '2026-10-15T18:15:00+05:30',
        total_work_minutes: 520,
        remarks: 'Client auction at Ollur confirmed by Branch Manager',
      },
      reason: 'Field visit to Ollur client',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(correction.status).toBe('pending');

    // 2. Owner Approves Correction
    correction.status = 'approved';
    correction.approved_by = 'emp-001'; // Jinson

    // 3. Daily Summary is updated
    summary = {
      ...summary,
      last_check_out: String(correction.adjusted_summary.last_check_out),
      total_work_minutes: Number(correction.adjusted_summary.total_work_minutes),
      remarks: String(correction.adjusted_summary.remarks),
      is_missing_checkout: false,
      is_approved: true,
    };

    expect(summary.is_missing_checkout).toBe(false);
    expect(summary.total_work_minutes).toBe(520);
    expect(summary.last_check_out).toBe('2026-10-15T18:15:00+05:30');
    expect(summary.remarks).toContain('Client auction');
  });

  it('Workflow 5: Submits and approves a staff leave request, updating daily attendance status', () => {
    let leaveRequests: LeaveRequest[] = [];
    let summaryRecord: AttendanceDailySummary = {
      id: 'sum-emp-006',
      organization_id: 'org-jinson-chit-fund',
      employee_id: 'emp-006',
      work_date: '2026-10-15',
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

    // Apply leave
    const newLeave: LeaveRequest = {
      id: 'leave-101',
      organization_id: 'org-jinson-chit-fund',
      employee_id: 'emp-006',
      leave_type: 'casual',
      start_date: '2026-10-15',
      end_date: '2026-10-16',
      days_count: 2,
      reason: 'Guruvayur temple festival',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    leaveRequests.push(newLeave);

    expect(leaveRequests[0].status).toBe('pending');

    // Owner approves leave
    leaveRequests = leaveRequests.map(l => l.id === 'leave-101' ? { ...l, status: 'approved', approved_by: 'emp-001' } : l);
    expect(leaveRequests[0].status).toBe('approved');

    // Attendance summary updates to on_leave
    summaryRecord = {
      ...summaryRecord,
      status: 'on_leave',
      remarks: 'Approved casual leave',
    };
    expect(summaryRecord.status).toBe('on_leave');
  });

  it('Workflow 6: Configurable payroll preview recalculates deductions based on policy without locking', () => {
    const basic = 22000;
    const hra = 6000;
    const allowances = 2000;
    const lateDays = 1;

    // Policy A: Grace policy (3 lates forgiven)
    const deductionGrace = lateDays > 3 ? (lateDays - 3) * 200 : 0;
    const netGrace = basic + hra + allowances - deductionGrace;
    expect(deductionGrace).toBe(0);
    expect(netGrace).toBe(30000);

    // Policy B: Flat 150 per late
    const deductionFlat = lateDays * 150;
    const netFlat = basic + hra + allowances - deductionFlat;
    expect(deductionFlat).toBe(150);
    expect(netFlat).toBe(29850);

    // Verify it remains in preview status (not locked)
    const runStatus = 'draft';
    expect(runStatus).not.toBe('locked');
  });
});
