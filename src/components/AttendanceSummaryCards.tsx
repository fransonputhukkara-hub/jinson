import React from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  CalendarOff, 
  AlertTriangle 
} from 'lucide-react';

interface AttendanceSummaryCardsProps {
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  missingCheckout: number;
  isSeniorMode?: boolean;
  onCardClick?: (filter: string) => void;
}

export const AttendanceSummaryCards: React.FC<AttendanceSummaryCardsProps> = ({
  total,
  present,
  absent,
  late,
  onLeave,
  missingCheckout,
  isSeniorMode = false,
  onCardClick,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* 1. Total Employees */}
      <button
        type="button"
        onClick={() => onCardClick?.('all')}
        className={`p-4 bg-white rounded-xl border border-slate-300 text-left hover:border-slate-400 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-1 ring-slate-200' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-slate-600 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            Total Staff
          </span>
          <Users className="w-5 h-5 text-slate-500 group-hover:text-slate-800" />
        </div>
        <div className={`font-bold tabular-nums text-slate-900 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {total}
        </div>
        <div className={`text-slate-600 font-medium ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          Active Chit Fund roster
        </div>
      </button>

      {/* 2. Present */}
      <button
        type="button"
        onClick={() => onCardClick?.('present')}
        className={`p-4 bg-white rounded-xl border border-emerald-300 text-left hover:border-emerald-500 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-1 ring-emerald-200 bg-emerald-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-emerald-800 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            Present
          </span>
          <UserCheck className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform" />
        </div>
        <div className={`font-bold tabular-nums text-emerald-700 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {present}
        </div>
        <div className={`text-emerald-700 font-semibold ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          ✓ Verified in office
        </div>
      </button>

      {/* 3. Late Arrivals */}
      <button
        type="button"
        onClick={() => onCardClick?.('late')}
        className={`p-4 bg-white rounded-xl border border-amber-300 text-left hover:border-amber-500 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-1 ring-amber-200 bg-amber-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-amber-800 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            Late Arrival
          </span>
          <Clock className="w-5 h-5 text-amber-700 group-hover:scale-110 transition-transform" />
        </div>
        <div className={`font-bold tabular-nums text-amber-800 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {late}
        </div>
        <div className={`text-amber-800 font-semibold ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          After 09:45 AM
        </div>
      </button>

      {/* 4. Absent */}
      <button
        type="button"
        onClick={() => onCardClick?.('absent')}
        className={`p-4 bg-white rounded-xl border border-rose-300 text-left hover:border-rose-500 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-1 ring-rose-200 bg-rose-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-rose-800 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            Absent
          </span>
          <UserX className="w-5 h-5 text-rose-700 group-hover:scale-110 transition-transform" />
        </div>
        <div className={`font-bold tabular-nums text-rose-700 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {absent}
        </div>
        <div className={`text-rose-700 font-semibold ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          No scan recorded
        </div>
      </button>

      {/* 5. On Leave */}
      <button
        type="button"
        onClick={() => onCardClick?.('on_leave')}
        className={`p-4 bg-white rounded-xl border border-blue-300 text-left hover:border-blue-500 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-1 ring-blue-200 bg-blue-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-blue-800 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            On Leave
          </span>
          <CalendarOff className="w-5 h-5 text-blue-700 group-hover:scale-110 transition-transform" />
        </div>
        <div className={`font-bold tabular-nums text-blue-800 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {onLeave}
        </div>
        <div className={`text-blue-800 font-semibold ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          Approved time-off
        </div>
      </button>

      {/* 6. Missing Check-Out */}
      <button
        type="button"
        onClick={() => onCardClick?.('missing_checkout')}
        className={`p-4 bg-white rounded-xl border border-orange-400 text-left hover:border-orange-600 transition-all shadow-xs group ${
          isSeniorMode ? 'p-5 ring-2 ring-orange-400 bg-orange-50/30' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-bold uppercase tracking-wider text-orange-900 ${
            isSeniorMode ? 'text-sm' : 'text-xs'
          }`}>
            Missing Out
          </span>
          <AlertTriangle className="w-5 h-5 text-orange-700 group-hover:scale-110 transition-transform" />
        </div>
        <div className={`font-bold tabular-nums text-orange-800 ${
          isSeniorMode ? 'text-4xl sm:text-5xl my-1' : 'text-3xl'
        }`}>
          {missingCheckout}
        </div>
        <div className={`text-orange-900 font-bold ${isSeniorMode ? 'text-xs sm:text-sm' : 'text-xs'}`}>
          Tap to Resolve ➔
        </div>
      </button>
    </div>
  );
};
