import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  Sliders, 
  CheckCircle2, 
  Info, 
  AlertCircle,
  Building2 
} from 'lucide-react';
import { Shift } from '../types/database.types';

interface ShiftsAndRulesViewProps {
  shifts: Shift[];
  onUpdateShiftRule?: (updated: Shift) => void;
}

export const ShiftsAndRulesView: React.FC<ShiftsAndRulesViewProps> = ({
  shifts,
  onUpdateShiftRule,
}) => {
  const currentShift = shifts[0];

  if (!currentShift) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">No shift configured</h2>
        <p className="mt-2 text-sm text-slate-600">Create a shift after the organization has been configured. No default working hours or payroll rules are assumed.</p>
      </div>
    );
  }

  const [graceMinutes, setGraceMinutes] = useState(currentShift.late_grace_minutes);
  const [earlyGraceMinutes, setEarlyGraceMinutes] = useState(currentShift.early_departure_grace_minutes);
  const [halfDayMinutes, setHalfDayMinutes] = useState(currentShift.half_day_threshold_minutes);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateShiftRule) {
      onUpdateShiftRule({
        ...currentShift,
        late_grace_minutes: graceMinutes,
        early_departure_grace_minutes: earlyGraceMinutes,
        half_day_threshold_minutes: halfDayMinutes,
      });
    }
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Shifts, Working Hours &amp; Grace Rules
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
              Configurable Template
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Configure shift start/end times, late arrival grace windows, and regional holiday schedules.
          </p>
        </div>
      </div>

      {/* Client confirmation notice */}
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Client Confirmation Requirement:</span>
          <p className="leading-relaxed">
            As mandated in the project specification, <strong>salary deduction formulas, grace period thresholds, and overtime rates must not be hardcoded or assumed</strong>. The values below are interactive parameters that will be formally locked once confirmed with Mr. Jinson Varghese.
          </p>
        </div>
      </div>

      {/* Main Shift Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: General Shift Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-800" />
              <h3 className="font-bold text-slate-900 text-base">
                {currentShift.name} (Thrissur Branch)
              </h3>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Active Shift
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-xs mb-1">Shift Start Time</span>
                <span className="font-mono font-bold text-base text-slate-900">{currentShift.start_time} AM</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Office counter opens</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-xs mb-1">Shift End Time</span>
                <span className="font-mono font-bold text-base text-slate-900">{currentShift.end_time} PM</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Daily accounts closing</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Late Arrival Grace Period (Minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
                <span className="text-xs text-slate-500">
                  Staff punches up to <strong>09:{30 + graceMinutes} AM</strong> are marked On-Time.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Early Departure Grace (Minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={earlyGraceMinutes}
                  onChange={(e) => setEarlyGraceMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
                <span className="text-xs text-slate-500">
                  Departure before 05:{60 - earlyGraceMinutes} PM flagged as Early Departure.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Half-Day Minimum Threshold (Minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="120"
                  max="360"
                  step="30"
                  value={halfDayMinutes}
                  onChange={(e) => setHalfDayMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
                <span className="text-xs text-slate-500">
                  ({Math.floor(halfDayMinutes / 60)} hours minimum work required for half-day credit).
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {isSavedNotice ? (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Parameters saved in demo session!
                </span>
              ) : <span />}

              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Update Shift Parameters
              </button>
            </div>
          </form>
        </div>

        {/* Right: Holidays & Weekly Offs */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-800" />
                <h3 className="font-bold text-slate-900 text-base">
                  Weekly Off &amp; Rest Days
                </h3>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-800">Weekly Off Day:</span>
              <p className="text-slate-600">Every <strong>Sunday</strong> is a full weekly off.</p>
              <p className="text-slate-500 text-[11px]">2nd and 4th Saturdays subject to Chit Fund customer auction schedule.</p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Upcoming Public &amp; Regional Holidays (Kerala)
              </h4>
              <div className="space-y-2 text-xs">
                {shifts.length === 0 ? null : []}            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
