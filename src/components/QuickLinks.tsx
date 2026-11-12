import React from 'react';
import { 
  Clock, 
  Users, 
  IndianRupee, 
  FileSpreadsheet, 
  Cpu, 
  FileCode,
  ShieldCheck
} from 'lucide-react';

interface QuickLinksProps {
  onSelectTab: (tab: string) => void;
  onOpenPocModal?: () => void;
}

export const QuickLinks: React.FC<QuickLinksProps> = ({
  onSelectTab,
  onOpenPocModal,
}) => {
  const links = [
    {
      id: 'attendance',
      title: 'Daily Attendance',
      desc: 'Live punches, in/out timestamps & grace records',
      icon: Clock,
      action: () => onSelectTab('attendance'),
      badge: 'Today',
    },
    {
      id: 'employees',
      title: 'Employee Roster',
      desc: 'Branch allocations, designations & shifts',
      icon: Users,
      action: () => onSelectTab('employees'),
      badge: '7 Staff',
    },
    {
      id: 'devices',
      title: 'Biometric Terminals',
      desc: 'Hikvision DS-K1T320MFWX POC & eSSL K90 adapter',
      icon: Cpu,
      action: () => onSelectTab('devices'),
      badge: 'ISAPI',
    },
    {
      id: 'payroll',
      title: 'Payroll Management',
      desc: 'Salary components, deductions & locked cycles',
      icon: IndianRupee,
      action: () => onSelectTab('payroll'),
      badge: 'Oct 2026',
    },
    {
      id: 'reports',
      title: 'Reports & Audit',
      desc: 'Attendance register, sync logs & CSV export',
      icon: FileSpreadsheet,
      action: () => onSelectTab('reports'),
      badge: 'Export',
    },
    {
      id: 'poc',
      title: 'Physical POC Checklist',
      desc: 'Step-by-step CCTV installer verification guide',
      icon: ShieldCheck,
      action: onOpenPocModal || (() => onSelectTab('devices')),
      badge: 'Hardware',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 leading-tight">
            Quick Actions &amp; Portals
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Direct shortcuts for company owners and managers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              type="button"
              onClick={link.action}
              className="p-3.5 bg-slate-50/60 hover:bg-slate-100/80 rounded-lg border border-slate-200/80 text-left transition-all group flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 group-hover:border-slate-300 shadow-2xs">
                <Icon className="w-4 h-4 text-slate-700 group-hover:text-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {link.title}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 tabular-nums">
                    {link.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {link.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
