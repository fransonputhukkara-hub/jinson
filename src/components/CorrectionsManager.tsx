import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  FileEdit, 
  Calendar,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AttendanceCorrection, Employee } from '../types/database.types';

interface CorrectionsManagerProps {
  corrections: AttendanceCorrection[];
  employees: Employee[];
  onApprove: (correctionId: string) => void;
  onReject: (correctionId: string) => void;
  onOpenNewModal: () => void;
}

export const CorrectionsManager: React.FC<CorrectionsManagerProps> = ({
  corrections,
  employees,
  onApprove,
  onReject,
  onOpenNewModal,
}) => {
  const employeeMap = new Map(employees.map(e => [e.id, e]));

  const pendingList = corrections.filter(c => c.status === 'pending');
  const resolvedList = corrections.filter(c => c.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Attendance Corrections &amp; Overrides
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 tabular-nums">
              {pendingList.length} Pending Approval
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manager requests for missing checkouts, forgotten punches, and field visit adjustments.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewModal}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <FileEdit className="w-3.5 h-3.5" />
          <span>New Correction Request</span>
        </button>
      </div>

      {/* Pending Items */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Awaiting Owner Approval ({pendingList.length})
        </h3>

        {pendingList.length === 0 ? (
          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-700">All pending corrections are resolved</p>
            <p className="text-slate-500 mt-0.5">No attendance adjustments currently require review.</p>
          </div>
        ) : (
          pendingList.map(item => {
            const emp = employeeMap.get(item.employee_id);
            const requester = employeeMap.get(item.requested_by);
            const adj = item.adjusted_summary as Record<string, unknown>;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-amber-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {emp?.display_name} ({emp?.employee_code})
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                        {item.correction_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Target Date: <strong>{item.target_date}</strong> · Requested by: {requester?.display_name || 'Branch Manager'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReject(item.id)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(item.id)}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Update Record</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-500 block mb-1">Reason Stated:</span>
                    <p className="text-slate-800 leading-relaxed font-medium">
                      "{item.reason}"
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 text-emerald-950">
                    <span className="font-semibold text-emerald-800 block mb-1">Proposed Adjustment:</span>
                    <div className="space-y-0.5">
                      <div>Status: <strong>Present</strong></div>
                      <div>Out Time: <strong>{adj.last_check_out ? new Date(String(adj.last_check_out)).toLocaleTimeString('en-IN') : '18:15'}</strong></div>
                      <div>Total Work Duration: <strong>{Math.floor(Number(adj.total_work_minutes || 0) / 60)}h {Number(adj.total_work_minutes || 0) % 60}m</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resolved History */}
      {resolvedList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Resolved Corrections History ({resolvedList.length})
          </h3>

          <div className="space-y-2">
            {resolvedList.map(item => {
              const emp = employeeMap.get(item.employee_id);
              const isApproved = item.status === 'approved';

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900">
                      {emp?.display_name} — {item.target_date}
                    </div>
                    <div className="text-slate-500">
                      Type: {item.correction_type} · Reason: {item.reason}
                    </div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md ${
                      isApproved ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {isApproved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      {isApproved ? 'Approved & Applied' : 'Rejected'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
