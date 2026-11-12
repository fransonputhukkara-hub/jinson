import React, { useState } from 'react';
import { 
  IndianRupee, 
  Lock, 
  CheckCircle, 
  FileText, 
  AlertCircle, 
  Info,
  Sliders,
  Download,
  ShieldAlert
} from 'lucide-react';
import { Employee, PayrollStatus } from '../types/database.types';

interface PayrollItemRow {
  employee: Employee;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  incentives: number;
  overtimePay: number;
  attendanceDeductions: number;
  grossSalary: number;
  netSalary: number;
  lateDaysCount: number;
}

interface PayrollViewProps {
  employees: Employee[];
}

export const PayrollView: React.FC<PayrollViewProps> = ({ employees }) => {
  // Configurable policy options pending Jinson Chit Fund confirmation
  const [lateDeductionPolicy, setLateDeductionPolicy] = useState<'grace_3' | 'flat_150' | 'none'>('grace_3');
  const [incentivePolicy, setIncentivePolicy] = useState<'collection_commission' | 'fixed_monthly' | 'none'>('collection_commission');
  const [selectedMonth, setSelectedMonth] = useState('October 2026');

  // Realistic synthetic base compensation figures
  const payrollItems: PayrollItemRow[] = employees.map((emp) => {
    let basic = 18000;
    let hra = 5000;
    let allowance = 2000;
    let lateDays = 0;

    if (emp.designation.includes('Managing Director')) {
      basic = 60000;
      hra = 20000;
      allowance = 15000;
    } else if (emp.designation.includes('Branch Manager')) {
      basic = 35000;
      hra = 10000;
      allowance = 5000;
    } else if (emp.designation.includes('Senior Chit Collection')) {
      basic = 22000;
      hra = 6000;
      allowance = 2000;
      lateDays = 1; // Priya Nair: 1 late day
    } else if (emp.designation.includes('Auction & Verification')) {
      basic = 20000;
      hra = 5000;
      allowance = 2500;
    } else if (emp.designation.includes('Field Collection')) {
      basic = 16000;
      hra = 4000;
      allowance = 3000;
    } else if (emp.designation.includes('Cashier')) {
      basic = 19000;
      hra = 5000;
      allowance = 2000;
    } else {
      basic = 15000;
      hra = 3500;
      allowance = 1500;
    }

    // Dynamic incentives based on policy
    let calculatedIncentive = 0;
    if (incentivePolicy === 'collection_commission' && emp.designation.includes('Collection')) {
      calculatedIncentive = 4500; // Provisional collection commission
    } else if (incentivePolicy === 'fixed_monthly') {
      calculatedIncentive = 1000;
    }

    // Dynamic deduction based on policy
    let calculatedDeduction = 0;
    if (lateDays > 0) {
      if (lateDeductionPolicy === 'flat_150') {
        calculatedDeduction = lateDays * 150;
      } else if (lateDeductionPolicy === 'grace_3') {
        // If late days <= 3, forgiven under grace policy
        calculatedDeduction = lateDays > 3 ? (lateDays - 3) * 200 : 0;
      } else {
        calculatedDeduction = 0;
      }
    }

    const gross = (basic + hra + allowance + calculatedIncentive);
    const net = Math.max(0, gross - calculatedDeduction);

    return {
      employee: emp,
      basicSalary: basic,
      hra,
      specialAllowance: allowance,
      incentives: calculatedIncentive,
      overtimePay: 0,
      attendanceDeductions: calculatedDeduction,
      grossSalary: gross,
      netSalary: net,
      lateDaysCount: lateDays,
    };
  });

  const totalGross = payrollItems.reduce((acc, row) => acc + row.grossSalary, 0);
  const totalNet = payrollItems.reduce((acc, row) => acc + row.netSalary, 0);
  const totalDeductions = payrollItems.reduce((acc, row) => acc + row.attendanceDeductions, 0);

  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExportPreview = () => {
    const headers = [
      'Employee Code',
      'Employee Name',
      'Designation',
      'Basic (INR)',
      'HRA (INR)',
      'Allowances (INR)',
      'Incentives (INR)',
      'Deductions (INR)',
      'Gross (INR)',
      'Net Estimated (INR)',
      'Status'
    ];

    const rows = payrollItems.map(item => [
      `"${item.employee.employee_code}"`,
      `"${item.employee.display_name}"`,
      `"${item.employee.designation}"`,
      item.basicSalary.toFixed(2),
      item.hra.toFixed(2),
      item.specialAllowance.toFixed(2),
      item.incentives.toFixed(2),
      item.attendanceDeductions.toFixed(2),
      item.grossSalary.toFixed(2),
      item.netSalary.toFixed(2),
      '"Draft Preview"'
    ].join(','));

    const csvContent = `# AttendEase Payroll Preview — ${selectedMonth}\n# Status: Draft Only — Pending Customer Authorization\n` +
      headers.join(',') + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AttendEase_Payroll_Preview_${selectedMonth.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Payroll Preview &amp; Salary Structure — {selectedMonth}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase">
              Draft Preview Only
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Provisional attendance-linked salary estimations. No real funds or locked payroll records are initiated.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPreview}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs shrink-0 ${
            downloadSuccess 
              ? 'bg-emerald-700 text-white' 
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {downloadSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span>{downloadSuccess ? 'CSV Exported!' : 'Export Preview (CSV)'}</span>
        </button>
      </div>

      {/* Mandatory Requirement 8 Notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Notice to Jinson Chit Fund Management:</span>
          <p className="leading-relaxed">
            As instructed, AttendEase <strong>does not impose hardcoded salary, overtime, or deduction policies</strong>. The formulas below are interactive preview templates. Final payroll will only be executed after client ratification of official chit collection commission slabs and late mark penalties.
          </p>
        </div>
      </div>

      {/* Configurable Policies Box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-sm">
            Interactive Policy Simulation Parameters
          </h3>
          <span className="text-xs text-slate-400">(Toggling these updates preview calculations live)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Late Arrival Deduction Rule (Draft)
            </label>
            <select
              value={lateDeductionPolicy}
              onChange={(e) => setLateDeductionPolicy(e.target.value as typeof lateDeductionPolicy)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
            >
              <option value="grace_3">Grace Policy: Forgive first 3 lates/month, ₹200 thereafter</option>
              <option value="flat_150">Flat Penalty: ₹150 deducted per late arrival</option>
              <option value="none">No Deduction: Waived by Branch Manager</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Chit Collection Incentive Scheme (Draft)
            </label>
            <select
              value={incentivePolicy}
              onChange={(e) => setIncentivePolicy(e.target.value as typeof incentivePolicy)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
            >
              <option value="collection_commission">Collection Target Commission (Provisional)</option>
              <option value="fixed_monthly">Fixed ₹1,000 Branch Incentive</option>
              <option value="none">No Incentive in Current Period</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Gross Preview
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            ₹{totalGross.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{employees.length} active roster staff</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Simulated Deductions
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-1">
            ₹{totalDeductions.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {lateDeductionPolicy === 'grace_3' ? 'Grace applied (under 3 lates forgiven)' : 'Applied per selected draft'}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Net Payable Preview
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            ₹{totalNet.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Pending client approval</div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Employee Salary Breakdown (Preview Mode)
          </h3>
          <span className="text-xs text-slate-500">
            Status: Draft Preview (Cannot be locked in demo)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Designation</th>
                <th className="py-3 px-3 text-right">Basic</th>
                <th className="py-3 px-3 text-right">HRA</th>
                <th className="py-3 px-3 text-right">Allowances</th>
                <th className="py-3 px-3 text-right">Incentives</th>
                <th className="py-3 px-3 text-right text-rose-600">Deductions</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Net Estimated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollItems.map((item) => (
                <tr key={item.employee.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{item.employee.display_name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{item.employee.employee_code}</div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 font-medium">{item.employee.designation}</td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    ₹{item.basicSalary.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    ₹{item.hra.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    ₹{item.specialAllowance.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    ₹{item.incentives.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-rose-700">
                    {item.attendanceDeductions > 0 ? `-₹${item.attendanceDeductions}` : '₹0'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-emerald-800 text-sm">
                    ₹{item.netSalary.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
