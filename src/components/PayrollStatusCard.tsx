import React from 'react';
import { IndianRupee, Lock, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import { PayrollStatus } from '../types/database.types';

interface PayrollStatusCardProps {
  currentPeriod: string; // e.g. "October 2026"
  currentStatus: PayrollStatus;
  eligibleEmployeesCount: number;
  totalGrossEstimate: number;
  previousPeriod: string; // e.g. "September 2026"
  previousStatus: PayrollStatus;
  onOpenPayroll?: () => void;
}

export const PayrollStatusCard: React.FC<PayrollStatusCardProps> = ({
  currentPeriod,
  currentStatus,
  eligibleEmployeesCount,
  totalGrossEstimate,
  previousPeriod,
  previousStatus,
  onOpenPayroll,
}) => {
  const getWorkflowBadge = (status: PayrollStatus) => {
    switch (status) {
      case 'locked':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
            <Lock className="w-3 h-3 text-emerald-700" />
            Locked &amp; Disbursed
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
            <CheckCircle className="w-3 h-3 text-blue-700" />
            Approved by Owner
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            <FileText className="w-3 h-3 text-amber-700" />
            Under Review
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
            <FileText className="w-3 h-3 text-slate-500" />
            Draft (In Progress)
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <IndianRupee className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Payroll Status
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Cycle: {currentPeriod}
              </p>
            </div>
          </div>
          <div>{getWorkflowBadge(currentStatus)}</div>
        </div>

        {/* Workflow steps */}
        <div className="my-3 py-3 border-y border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
            <span>Workflow Stages</span>
            <span className="text-slate-400">Draft → Review → Approved → Locked</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className={`p-1.5 rounded font-semibold ${currentStatus === 'draft' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              1. Draft
            </div>
            <div className={`p-1.5 rounded font-semibold ${currentStatus === 'review' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              2. Review
            </div>
            <div className={`p-1.5 rounded font-semibold ${currentStatus === 'approved' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              3. Approved
            </div>
            <div className={`p-1.5 rounded font-semibold ${currentStatus === 'locked' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              4. Locked
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs sm:text-sm text-slate-600">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Eligible Employees:</span>
            <span className="font-semibold tabular-nums text-slate-900">{eligibleEmployeesCount} staff members</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Estimated Gross (Est):</span>
            <span className="font-mono font-bold tabular-nums text-slate-900">
              ₹{totalGrossEstimate.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Previous Month ({previousPeriod}):</span>
            <span className="text-emerald-700 font-medium">Locked &amp; Reconciled</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onOpenPayroll}
          className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-900 rounded-lg text-xs font-semibold border border-slate-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <span>View Detailed Payroll Register</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
};
