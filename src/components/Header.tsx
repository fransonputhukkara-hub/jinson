import React from 'react';
import { Calendar, ShieldCheck, SunMedium } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  organizationName: string;
  branchName: string;
  isSeniorMode?: boolean;
  onToggleSeniorMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  organizationName,
  branchName,
  isSeniorMode = false,
  onToggleSeniorMode,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Single text wordmark with subtle subtitle */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 shrink-0 text-left cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              AE
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                AttendEase
              </span>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline">
                {organizationName} · {branchName}
              </span>
            </div>
          </button>

          {/* Zone 2: Single-line clean text navigation links adhering to Top Bar Contract */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => onSelectTab('dashboard')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('attendance')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'attendance'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('corrections')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'corrections'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Corrections
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('leave')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'leave'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Leave
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('employees')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'employees'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Employees
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('shifts')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'shifts'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Shifts &amp; Rules
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('payroll')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap py-2 border-b-2 cursor-pointer ${
                currentTab === 'payroll'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-600'
              }`}
            >
              Payroll Preview
            </button>
          </nav>

          {/* Zone 3: Senior Mode switch & Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {onToggleSeniorMode && (
              <button
                type="button"
                onClick={onToggleSeniorMode}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSeniorMode
                    ? 'bg-amber-100 text-amber-950 border-amber-300 ring-2 ring-amber-400'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="Toggle Extra Large Text Mode for Senior Users"
              >
                <SunMedium className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Senior View:</span>
                <span>{isSeniorMode ? 'Large' : 'Normal'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectTab('devices')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Hikvision POC</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Navigation Bar */}
      <div className="lg:hidden border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'attendance', label: 'Attendance' },
          { id: 'corrections', label: 'Corrections' },
          { id: 'leave', label: 'Leave' },
          { id: 'employees', label: 'Staff' },
          { id: 'shifts', label: 'Shifts' },
          { id: 'devices', label: 'Devices' },
          { id: 'payroll', label: 'Payroll' },
          { id: 'reports', label: 'Reports' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              currentTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
