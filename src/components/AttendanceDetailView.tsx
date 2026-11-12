import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  CalendarOff,
  Download,
  AlertCircle,
  FileEdit
} from 'lucide-react';
import { AttendanceDailySummary, Employee } from '../types/database.types';

interface AttendanceDetailViewProps {
  summaries: AttendanceDailySummary[];
  employees: Employee[];
  initialFilter?: string;
  onRequestCorrection?: (employeeId: string) => void;
}

export const AttendanceDetailView: React.FC<AttendanceDetailViewProps> = ({
  summaries,
  employees,
  initialFilter = 'all',
  onRequestCorrection,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>(initialFilter);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

  // Employee lookup
  const employeeMap = new Map(employees.map(e => [e.id, e]));

  const filtered = summaries.filter(item => {
    const emp = employeeMap.get(item.employee_id);
    const matchesSearch = !search || 
      emp?.display_name.toLowerCase().includes(search.toLowerCase()) ||
      emp?.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      emp?.designation.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'present') return item.status === 'present';
    if (filter === 'late') return item.status === 'late' || item.is_late;
    if (filter === 'absent') return item.status === 'absent';
    if (filter === 'on_leave') return item.status === 'on_leave';
    if (filter === 'missing_checkout') return item.is_missing_checkout;
    return true;
  });

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  const formatHours = (mins: number) => {
    if (!mins || mins === 0) return '0h 00m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  };

  const getStatusBadge = (item: AttendanceDailySummary) => {
    if (item.status === 'on_leave') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
          <CalendarOff className="w-3.5 h-3.5" />
          On Leave
        </span>
      );
    }
    if (item.status === 'absent') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
          <UserX className="w-3.5 h-3.5" />
          Absent
        </span>
      );
    }
    if (item.is_missing_checkout) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-900 bg-orange-100 border border-orange-300 px-2.5 py-1 rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          Missing Out
        </span>
      );
    }
    if (item.is_late || item.status === 'late') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Late ({item.late_minutes}m)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Present
      </span>
    );
  };

  const handleExportCSV = () => {
    const headers = ['Employee Code', 'Name', 'Designation', 'Status', 'First In', 'Last Out', 'Work Hours', 'Late Mins', 'Remarks'];
    const rows = filtered.map(item => {
      const emp = employeeMap.get(item.employee_id);
      return [
        emp?.employee_code || '',
        `"${emp?.display_name || ''}"`,
        `"${emp?.designation || ''}"`,
        item.status,
        item.first_check_in ? formatTime(item.first_check_in) : '',
        item.last_check_out ? formatTime(item.last_check_out) : '',
        formatHours(item.total_work_minutes),
        item.late_minutes,
        `"${item.remarks || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name, code (e.g. JCF-001) or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {[
              { id: 'all', label: 'All Staff' },
              { id: 'present', label: 'Present' },
              { id: 'late', label: 'Late' },
              { id: 'absent', label: 'Absent' },
              { id: 'missing_checkout', label: 'Missing Out' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filter === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedDate} (IST)</span>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Designation</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">First In</th>
                <th className="py-3 px-3">Last Out</th>
                <th className="py-3 px-3 text-right">Work Duration</th>
                <th className="py-3 px-4">Remarks / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching attendance records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const emp = employeeMap.get(item.employee_id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 leading-tight">
                          {emp?.display_name || 'Unknown'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {emp?.employee_code} · Hardware ID: {emp?.id.replace('emp-', '10')}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {emp?.designation || 'Staff'}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {getStatusBadge(item)}
                      </td>

                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-800">
                        {formatTime(item.first_check_in)}
                      </td>

                      <td className="py-3.5 px-3 font-mono tabular-nums text-slate-800">
                        {formatTime(item.last_check_out)}
                      </td>

                      <td className="py-3.5 px-3 font-mono tabular-nums font-semibold text-right text-slate-900">
                        {formatHours(item.total_work_minutes)}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 truncate max-w-xs">
                            {item.remarks || 'Normal shift attendance'}
                          </span>

                          {(item.is_missing_checkout || item.is_late || item.status === 'absent') && onRequestCorrection && (
                            <button
                              type="button"
                              onClick={() => onRequestCorrection(item.employee_id)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Submit audited correction request for this employee"
                            >
                              <FileEdit className="w-3 h-3 text-orange-600" />
                              <span>Fix / Adjust</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
