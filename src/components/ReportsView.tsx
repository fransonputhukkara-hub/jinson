import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  History,
  ShieldCheck
} from 'lucide-react';
import { AttendanceDailySummary, Employee } from '../types/database.types';

interface ReportsViewProps {
  summaries: AttendanceDailySummary[];
  employees: Employee[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ summaries, employees }) => {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'sync_audit'>('daily');
  const employeeMap = new Map(employees.map(e => [e.id, e]));

  // Mock sync history logs
  const syncLogs = [
    {
      id: 'sync-01',
      time: '2026-10-15 09:45:10 IST',
      device: 'Hikvision DS-K1T320MFWX (Thrissur)',
      status: 'pending_edge_service',
      pulled: 0,
      details: 'Browser POC simulated check. Awaiting local connector deployment on 192.168.1.120.',
    },
    {
      id: 'sync-02',
      time: '2026-10-15 09:00:00 IST',
      device: 'System Scheduler',
      status: 'success',
      pulled: 7,
      details: 'Daily attendance summary table initialized for Jinson Chit Fund.',
    },
  ];

  const handleDownloadReport = () => {
    alert('Exporting verified report archive (CSV)...');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Attendance &amp; System Audit Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Export compliant attendance logs, monthly registers, and biometric sync trails.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadReport}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export All Data (CSV)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setReportType('daily')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'daily'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daily Attendance Register
        </button>
        <button
          type="button"
          onClick={() => setReportType('sync_audit')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            reportType === 'sync_audit'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Device Synchronization Audit
        </button>
      </div>

      {reportType === 'daily' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-3">
            Today's Attendance Register Summary (15 Oct 2026)
          </h3>
          <div className="space-y-2 text-xs">
            {summaries.map(s => {
              const emp = employeeMap.get(s.employee_id);
              return (
                <div key={s.id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{emp?.display_name}</span>
                    <span className="text-slate-500 font-mono ml-2">({emp?.employee_code})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-slate-700">
                      Work: {Math.floor(s.total_work_minutes / 60)}h {s.total_work_minutes % 60}m
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                      s.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                      s.status === 'late' ? 'bg-amber-100 text-amber-800' :
                      s.status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reportType === 'sync_audit' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-3">
            Hardware Synchronization Logs
          </h3>
          <div className="space-y-3 text-xs">
            {syncLogs.map(log => (
              <div key={log.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900">{log.device}</span>
                  <span className="font-mono text-slate-500">{log.time}</span>
                </div>
                <p className="text-slate-600">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
