import { describe, it, expect } from 'vitest';
import { 
  calculatePayrollPeriod, 
  generatePayrollCsv, 
  roundToPaise, 
  DEFAULT_SALARY_POLICY, 
  SalaryPolicyConfig,
  EmployeeBaseSalary
} from '../src/engine/payrollEngine';
import { Employee, AttendanceDailySummary, LeaveRequest } from '../src/types/database.types';

describe('Payroll Engine - Financial & Statutory Verification', () => {
  const sampleEmployees: Employee[] = [
    {
      id: 'emp-md',
      organization_id: 'org-jcf',
      branch_id: 'b1',
      employee_code: 'JCF-001',
      first_name: 'Jinson',
      last_name: 'Thomas',
      display_name: 'Jinson Thomas',
      designation: 'Managing Director',
      joining_date: '2020-01-01',
      employment_status: 'active',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'emp-coll',
      organization_id: 'org-jcf',
      branch_id: 'b1',
      employee_code: 'JCF-003',
      first_name: 'Priya',
      last_name: 'Nair',
      display_name: 'Priya Nair',
      designation: 'Senior Chit Collection Agent',
      joining_date: '2023-01-15',
      employment_status: 'active',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const sampleSalaryMap = new Map<string, EmployeeBaseSalary>([
    [
      'emp-md',
      {
        basicMonthly: 60000,
        hraMonthly: 20000,
        specialAllowanceMonthly: 10000,
        conveyanceMonthly: 5000,
      },
    ],
    [
      'emp-coll',
      {
        basicMonthly: 22000,
        hraMonthly: 6000,
        specialAllowanceMonthly: 2000,
        conveyanceMonthly: 1000,
      },
    ],
  ]);

  it('guarantees roundToPaise avoids floating point arithmetic artifacts', () => {
    // Classic JavaScript float imprecision: 0.1 + 0.2 !== 0.3
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(roundToPaise(0.1 + 0.2)).toBe(0.3);
    expect(roundToPaise(1234.5678)).toBe(1234.57);
    expect(roundToPaise(100.004)).toBe(100);
  });

  it('flags warning when statutory deduction policies are unconfirmed by client', () => {
    const unconfirmedPolicy: SalaryPolicyConfig = {
      ...DEFAULT_SALARY_POLICY,
      statutoryDeductionsConfirmed: false,
    };

    const result = calculatePayrollPeriod(
      'org-jcf',
      '2026-10-01',
      '2026-10-31',
      'October 2026',
      sampleEmployees,
      sampleSalaryMap,
      [],
      [],
      unconfirmedPolicy
    );

    expect(result.warnings.some(w => w.includes('Statutory compliance policy'))).toBe(true);
    expect(result.statutoryNotice).toContain('Statutory compliance verification required');
  });

  it('calculates late deductions accurately under grace vs flat penalty policies', () => {
    // Priya has 4 late days in summaries
    const summaries: AttendanceDailySummary[] = [
      {
        id: 's1',
        organization_id: 'org-jcf',
        employee_id: 'emp-coll',
        work_date: '2026-10-01',
        total_work_minutes: 480,
        total_break_minutes: 30,
        overtime_minutes: 0,
        status: 'late',
        is_late: true,
        late_minutes: 20,
        is_early_departure: false,
        early_departure_minutes: 0,
        is_missing_checkout: false,
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        organization_id: 'org-jcf',
        employee_id: 'emp-coll',
        work_date: '2026-10-02',
        total_work_minutes: 480,
        total_break_minutes: 30,
        overtime_minutes: 0,
        status: 'late',
        is_late: true,
        late_minutes: 25,
        is_early_departure: false,
        early_departure_minutes: 0,
        is_missing_checkout: false,
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's3',
        organization_id: 'org-jcf',
        employee_id: 'emp-coll',
        work_date: '2026-10-03',
        total_work_minutes: 480,
        total_break_minutes: 30,
        overtime_minutes: 0,
        status: 'late',
        is_late: true,
        late_minutes: 18,
        is_early_departure: false,
        early_departure_minutes: 0,
        is_missing_checkout: false,
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's4',
        organization_id: 'org-jcf',
        employee_id: 'emp-coll',
        work_date: '2026-10-04',
        total_work_minutes: 480,
        total_break_minutes: 30,
        overtime_minutes: 0,
        status: 'late',
        is_late: true,
        late_minutes: 30,
        is_early_departure: false,
        early_departure_minutes: 0,
        is_missing_checkout: false,
        is_approved: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Policy A: Grace 3 (first 3 forgiven, 4th penalized at 200)
    const gracePolicy: SalaryPolicyConfig = {
      ...DEFAULT_SALARY_POLICY,
      lateDeductionPolicy: 'grace_3',
      lateGraceCount: 3,
      lateDeductionAmount: 200,
    };

    const resGrace = calculatePayrollPeriod(
      'org-jcf',
      '2026-10-01',
      '2026-10-31',
      'October 2026',
      [sampleEmployees[1]],
      sampleSalaryMap,
      summaries,
      [],
      gracePolicy
    );

    // 4 lates - 3 grace = 1 penalized * 200 = 200
    expect(resGrace.items[0].late_deductions).toBe(200);

    // Policy B: Flat 150 per late day (4 * 150 = 600)
    const flatPolicy: SalaryPolicyConfig = {
      ...DEFAULT_SALARY_POLICY,
      lateDeductionPolicy: 'flat_150',
      lateDeductionAmount: 150,
    };

    const resFlat = calculatePayrollPeriod(
      'org-jcf',
      '2026-10-01',
      '2026-10-31',
      'October 2026',
      [sampleEmployees[1]],
      sampleSalaryMap,
      summaries,
      [],
      flatPolicy
    );

    expect(resFlat.items[0].late_deductions).toBe(600);
  });

  it('generates valid RFC 4180 CSV with client notice headers', () => {
    const calc = calculatePayrollPeriod(
      'org-jcf',
      '2026-10-01',
      '2026-10-31',
      'October 2026',
      sampleEmployees,
      sampleSalaryMap,
      [],
      []
    );

    const csv = generatePayrollCsv('October 2026', sampleEmployees, calc.items);

    expect(csv).toContain('Employee Code,Employee Name');
    expect(csv).toContain('"JCF-001","Jinson Thomas"');
    expect(csv).toContain('"JCF-003","Priya Nair"');
    expect(csv).toContain('Notice: Client approval required prior to live locking');
  });
});
