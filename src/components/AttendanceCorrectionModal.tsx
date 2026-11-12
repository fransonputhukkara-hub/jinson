import React, { useEffect, useState } from 'react';
import { 
  FileEdit, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { AttendanceCorrection, Employee, AttendanceDailySummary } from '../types/database.types';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  requestedByUserId: string;
  employees: Employee[];
  summaries: AttendanceDailySummary[];
  preSelectedEmployeeId?: string;
  onSubmit: (correction: Omit<AttendanceCorrection, 'id' | 'created_at' | 'updated_at'>) => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  requestedByUserId,
  employees,
  summaries,
  preSelectedEmployeeId,
  onSubmit,
}) => {
  const [employeeId, setEmployeeId] = useState(preSelectedEmployeeId || employees[0]?.id || '');
  const [targetDate, setTargetDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [correctionType, setCorrectionType] = useState<AttendanceCorrection['correction_type']>('missing_out');
  const [proposedCheckIn, setProposedCheckIn] = useState('09:30');
  const [proposedCheckOut, setProposedCheckOut] = useState('18:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (preSelectedEmployeeId) setEmployeeId(preSelectedEmployeeId);
    else if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [preSelectedEmployeeId, employeeId, employees]);

  if (!isOpen) return null;

  const currentSummary = summaries.find(s => s.employee_id === employeeId && s.work_date === targetDate);
  const selectedEmp = employees.find(e => e.id === employeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a specific business reason for this attendance adjustment.');
      return;
    }

    const [inHours, inMins] = proposedCheckIn.split(':').map(Number);
    const [outHours, outMins] = proposedCheckOut.split(':').map(Number);
    const totalMinutes = Math.max(0, (outHours * 60 + outMins) - (inHours * 60 + inMins));

    const adjustedIn = `${targetDate}T${proposedCheckIn}:00+05:30`;
    const adjustedOut = `${targetDate}T${proposedCheckOut}:00+05:30`;

    onSubmit({
      organization_id: organizationId,
      employee_id: employeeId,
      target_date: targetDate,
      requested_by: requestedByUserId,
      status: 'pending',
      correction_type: correctionType,
      original_summary: currentSummary ? { ...currentSummary } : undefined,
      adjusted_summary: {
        status: 'present',
        is_missing_checkout: false,
        first_check_in: adjustedIn,
        last_check_out: adjustedOut,
        total_work_minutes: totalMinutes,
        remarks: `Manual correction: ${reason}`,
      },
      reason: reason.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-700">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Submit Attendance Correction
              </h3>
              <p className="text-xs text-slate-500">
                Audited modification workflow for missed punches or exceptions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Select Employee *</label>
            <select
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.display_name} ({emp.employee_code}) — {emp.designation}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Target Date *</label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Correction Type *</label>
              <select
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value as AttendanceCorrection['correction_type'])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="missing_out">Missing Check-out</option>
                <option value="missing_in">Missing Check-in</option>
                <option value="late_waive">Waive Late Arrival</option>
                <option value="overtime_adjust">Overtime Adjustment</option>
                <option value="full_override">Full Day Override</option>
              </select>
            </div>
          </div>

          {currentSummary && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Current Record on File:</span>
              <div className="flex justify-between text-slate-600">
                <span>First In: {currentSummary.first_check_in ? new Date(currentSummary.first_check_in).toLocaleTimeString('en-IN') : 'None'}</span>
                <span>Last Out: {currentSummary.last_check_out ? new Date(currentSummary.last_check_out).toLocaleTimeString('en-IN') : 'Missing'}</span>
              </div>
              <div className="text-slate-500">
                Status: <strong className="uppercase">{currentSummary.status}</strong>
                {currentSummary.is_missing_checkout && <span className="text-orange-600 font-semibold ml-2">⚠️ Missing checkout</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Verified Check-In Time</label>
              <input
                type="time"
                value={proposedCheckIn}
                onChange={(e) => setProposedCheckIn(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Verified Check-Out Time</label>
              <input
                type="time"
                value={proposedCheckOut}
                onChange={(e) => setProposedCheckOut(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Business Justification / Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder="e.g. Employee was on external collection visit or attended client auction at Ollur..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs shadow-xs"
            >
              Submit for Owner Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
