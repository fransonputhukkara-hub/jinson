import { 
  Employee, 
  AttendanceDailySummary, 
  LeaveRequest, 
  PayrollRun, 
  PayrollItem, 
  Payslip 
} from '../types/database.types';

export interface SalaryPolicyConfig {
  daysInMonth: number;
  standardWorkingDays: number;
  lateDeductionPolicy: 'grace_3' | 'flat_150' | 'per_minute' | 'none';
  lateDeductionAmount: number; // e.g. 150 or 200
  lateGraceCount: number;      // e.g. 3
  incentivePolicy: 'collection_commission' | 'fixed_monthly' | 'none';
  fixedIncentiveAmount: number;
  overtimeHourlyRateMultiplier: number; // e.g. 1.0 or 1.5 or 0 (if overtime not paid)
  unpaidLeaveDeductionMethod: 'calendar_days' | 'working_days';
  // Statutory compliance flags (Explicitly non-assumed per customer rules)
  statutoryDeductionsConfirmed: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTaxApplicable: boolean;
}

export const DEFAULT_SALARY_POLICY: SalaryPolicyConfig = {
  daysInMonth: 30,
  standardWorkingDays: 26,
  lateDeductionPolicy: 'grace_3',
  lateDeductionAmount: 200,
  lateGraceCount: 3,
  incentivePolicy: 'collection_commission',
  fixedIncentiveAmount: 1000,
  overtimeHourlyRateMultiplier: 1.0,
  unpaidLeaveDeductionMethod: 'calendar_days',
  statutoryDeductionsConfirmed: false, // Must be confirmed by client
  pfApplicable: false,
  esiApplicable: false,
  professionalTaxApplicable: false,
};

export interface EmployeeBaseSalary {
  basicMonthly: number;
  hraMonthly: number;
  specialAllowanceMonthly: number;
  conveyanceMonthly: number;
}

export interface PayrollCalculationResult {
  payrollRun: Omit<PayrollRun, 'id' | 'created_at' | 'updated_at'>;
  items: Omit<PayrollItem, 'id' | 'payroll_run_id' | 'created_at'>[];
  warnings: string[];
  statutoryNotice: string;
}

/**
 * Currency rounder helper to avoid JavaScript floating point errors.
 * Computes with integer paise (1 INR = 100 paise).
 */
export function roundToPaise(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates attendance-linked payroll for a given period and employee roster.
 */
export function calculatePayrollPeriod(
  organizationId: string,
  periodStart: string, // 'YYYY-MM-DD'
  periodEnd: string,   // 'YYYY-MM-DD'
  periodLabel: string, // e.g. 'October 2026'
  employees: Employee[],
  salaryAssignments: Map<string, EmployeeBaseSalary>,
  summaries: AttendanceDailySummary[],
  leaveRequests: LeaveRequest[],
  policy: SalaryPolicyConfig = DEFAULT_SALARY_POLICY
): PayrollCalculationResult {
  const warnings: string[] = [];

  if (!policy.statutoryDeductionsConfirmed) {
    warnings.push(
      'Statutory compliance policy (PF, ESI, Professional Tax) has NOT been confirmed by customer management. ' +
      'AttendEase does not guess or assume statutory deduction rates. Calculations reflect attendance earnings and gross compensation only.'
    );
  }

  const items: Omit<PayrollItem, 'id' | 'payroll_run_id' | 'created_at'>[] = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const emp of employees) {
    // 1. Base Compensation
    const salary = salaryAssignments.get(emp.id) || {
      basicMonthly: 18000,
      hraMonthly: 5000,
      specialAllowanceMonthly: 2000,
      conveyanceMonthly: 1000,
    };

    const monthlyFixedGross = roundToPaise(
      salary.basicMonthly + salary.hraMonthly + salary.specialAllowanceMonthly + salary.conveyanceMonthly
    );

    // 2. Attendance & Leave Aggregates
    const empSummaries = summaries.filter(s => s.employee_id === emp.id);
    const presentDays = empSummaries.filter(s => s.status === 'present').length;
    const halfDays = empSummaries.filter(s => s.status === 'half_day').length;
    const lateDays = empSummaries.filter(s => s.is_late || s.status === 'late').length;
    const totalOvertimeMinutes = empSummaries.reduce((sum, s) => sum + (s.overtime_minutes || 0), 0);

    const empLeaves = leaveRequests.filter(l => l.employee_id === emp.id && l.status === 'approved');
    const paidLeaveDays = empLeaves
      .filter(l => l.leave_type !== 'unpaid')
      .reduce((sum, l) => sum + (l.days_count || 0), 0);
    const unpaidLeaveDays = empLeaves
      .filter(l => l.leave_type === 'unpaid')
      .reduce((sum, l) => sum + (l.days_count || 0), 0);

    // Payable days = present + (half_days * 0.5) + paid_leave
    const payableDays = roundToPaise(presentDays + halfDays * 0.5 + paidLeaveDays);
    const absentDays = Math.max(0, policy.standardWorkingDays - payableDays);

    // 3. Pro-rata earnings
    const divisor = policy.unpaidLeaveDeductionMethod === 'working_days' 
      ? policy.standardWorkingDays 
      : policy.daysInMonth;

    const perDayBasic = roundToPaise(salary.basicMonthly / divisor);
    const perDayHra = roundToPaise(salary.hraMonthly / divisor);
    const perDayAllowances = roundToPaise((salary.specialAllowanceMonthly + salary.conveyanceMonthly) / divisor);

    // Calculated base components
    const basicPay = roundToPaise(perDayBasic * payableDays);
    const hraPay = roundToPaise(perDayHra * payableDays);
    const allowancesPay = roundToPaise(perDayAllowances * payableDays);

    // 4. Overtime calculation
    let overtimePay = 0;
    if (policy.overtimeHourlyRateMultiplier > 0 && totalOvertimeMinutes > 0) {
      const hourlyRate = (monthlyFixedGross / divisor) / 8; // Standard 8-hour workday
      const overtimeHours = totalOvertimeMinutes / 60;
      overtimePay = roundToPaise(hourlyRate * overtimeHours * policy.overtimeHourlyRateMultiplier);
    }

    // 5. Incentives
    let incentivesPay = 0;
    if (policy.incentivePolicy === 'collection_commission' && emp.designation.includes('Collection')) {
      // Provisional collection commission pending management slabs
      incentivesPay = 4500;
    } else if (policy.incentivePolicy === 'fixed_monthly') {
      incentivesPay = policy.fixedIncentiveAmount;
    }

    // 6. Deductions: Late arrival
    let lateDeductions = 0;
    if (lateDays > 0) {
      if (policy.lateDeductionPolicy === 'flat_150') {
        lateDeductions = roundToPaise(lateDays * policy.lateDeductionAmount);
      } else if (policy.lateDeductionPolicy === 'grace_3') {
        if (lateDays > policy.lateGraceCount) {
          lateDeductions = roundToPaise((lateDays - policy.lateGraceCount) * policy.lateDeductionAmount);
        }
      }
    }

    // Unpaid leave deductions
    const unpaidLeaveDeductions = roundToPaise(unpaidLeaveDays * (monthlyFixedGross / divisor));
    const advanceDeductions = 0; // Configurable when loan ledger is connected

    // 7. Totals
    const grossPay = roundToPaise(basicPay + hraPay + allowancesPay + incentivesPay + overtimePay);
    const empTotalDeductions = roundToPaise(lateDeductions + unpaidLeaveDeductions + advanceDeductions);
    const netPay = Math.max(0, roundToPaise(grossPay - empTotalDeductions));

    totalGross = roundToPaise(totalGross + grossPay);
    totalDeductions = roundToPaise(totalDeductions + empTotalDeductions);
    totalNet = roundToPaise(totalNet + netPay);

    items.push({
      organization_id: organizationId,
      employee_id: emp.id,
      payable_days: payableDays,
      present_days: presentDays + halfDays * 0.5,
      leave_days: paidLeaveDays,
      absent_days: absentDays,
      basic_pay: basicPay,
      hra_pay: hraPay,
      allowances_pay: allowancesPay,
      incentives_pay: incentivesPay,
      overtime_pay: overtimePay,
      late_deductions: lateDeductions,
      unpaid_leave_deductions: unpaidLeaveDeductions,
      advance_deductions: advanceDeductions,
      gross_pay: grossPay,
      net_pay: netPay,
      calculation_breakdown: {
        divisorUsed: divisor,
        lateDaysRecorded: lateDays,
        overtimeMinutes: totalOvertimeMinutes,
        policySnapshot: { ...policy },
      },
    });
  }

  return {
    payrollRun: {
      organization_id: organizationId,
      period_start: periodStart,
      period_end: periodEnd,
      period_label: periodLabel,
      status: 'draft',
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
    },
    items,
    warnings,
    statutoryNotice: 'Statutory compliance verification required before final disbursement locking.',
  };
}

/**
 * Generates formatted CSV string for payroll export without requiring browser window.alert.
 */
export function generatePayrollCsv(
  periodLabel: string,
  employees: Employee[],
  items: Omit<PayrollItem, 'id' | 'payroll_run_id' | 'created_at'>[]
): string {
  const empMap = new Map(employees.map(e => [e.id, e]));

  const headers = [
    'Employee Code',
    'Employee Name',
    'Designation',
    'Payable Days',
    'Basic (INR)',
    'HRA (INR)',
    'Allowances (INR)',
    'Incentives (INR)',
    'Overtime (INR)',
    'Late Deductions (INR)',
    'Unpaid Leave Deductions (INR)',
    'Gross Pay (INR)',
    'Net Pay (INR)',
    'Status',
  ];

  const rows = items.map(item => {
    const emp = empMap.get(item.employee_id);
    return [
      `"${emp?.employee_code || ''}"`,
      `"${emp?.display_name || ''}"`,
      `"${emp?.designation || ''}"`,
      item.payable_days,
      item.basic_pay.toFixed(2),
      item.hra_pay.toFixed(2),
      item.allowances_pay.toFixed(2),
      item.incentives_pay.toFixed(2),
      item.overtime_pay.toFixed(2),
      item.late_deductions.toFixed(2),
      item.unpaid_leave_deductions.toFixed(2),
      item.gross_pay.toFixed(2),
      item.net_pay.toFixed(2),
      '"Draft Preview"',
    ].join(',');
  });

  return `# AttendEase Payroll Preview — ${periodLabel}\n# Generated: ${new Date().toISOString()}\n# Notice: Client approval required prior to live locking\n` +
    headers.join(',') + '\n' + rows.join('\n');
}
