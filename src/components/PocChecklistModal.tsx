import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  ShieldCheck, 
  Cpu, 
  Network, 
  Terminal, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';

interface PocChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  details: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'p1_power',
    category: '1. Physical Installation & Network',
    label: '12V DC 1.5A Power & UPS line verified',
    details: 'Terminal booted cleanly; LCD screen active with stable backlight.',
  },
  {
    id: 'p1_ip',
    category: '1. Physical Installation & Network',
    label: 'Static LAN IP assigned (192.168.1.120)',
    details: 'Reserved in router DHCP table with subnet 255.255.255.0 and Gateway 192.168.1.1.',
  },
  {
    id: 'p1_ntp',
    category: '1. Physical Installation & Network',
    label: 'NTP Time Synchronized to IST (UTC+05:30)',
    details: 'Time matches Indian Standard Time precisely to prevent false late arrivals.',
  },
  {
    id: 'p2_isapi',
    category: '2. ISAPI & Authentication',
    label: 'ISAPI enabled with Digest/Basic Auth',
    details: 'Configured in Hikvision Web GUI > System > Security > Authentication.',
  },
  {
    id: 'p2_user',
    category: '2. ISAPI & Authentication',
    label: 'Dedicated service account created',
    details: 'Operator account attendease_svc with Access Control & Event Query permissions.',
  },
  {
    id: 'p3_connector',
    category: '3. Local Edge Connector',
    label: 'AttendEase Connector Daemon started on local PC',
    details: 'Running on port 8088 on the branch Windows PC, successfully pinging 192.168.1.120.',
  },
  {
    id: 'p4_face',
    category: '4. Biometric Enrollment & Real Punch',
    label: 'Employee 101 (JCF-001) Face Enrolled',
    details: 'Facial template enrolled on device; terminal provides audible "Authenticated" prompt.',
  },
  {
    id: 'p4_dedup',
    category: '4. Biometric Enrollment & Real Punch',
    label: '60-Second Deduplication Confirmed',
    details: 'Three rapid test punches within 20s consolidated into exactly 1 check-in event.',
  },
  {
    id: 'p4_offline',
    category: '4. Biometric Enrollment & Real Punch',
    label: 'Offline Flash Buffer Backfill Verified',
    details: 'Network disconnected, test punch taken, reconnected; event synchronized cleanly.',
  },
];

export const PocChecklistModal: React.FC<PocChecklistModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('attendease_poc_checklist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('attendease_poc_checklist', JSON.stringify(checkedIds));
    } catch {
      // ignore
    }
  }, [checkedIds]);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setCheckedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const total = CHECKLIST_ITEMS.length;
  const completed = Object.values(checkedIds).filter(Boolean).length;
  const percent = Math.round((completed / total) * 100);

  // Group by category
  const categories = Array.from(new Set(CHECKLIST_ITEMS.map(i => i.category)));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-900" />
              <h3 className="text-lg font-bold text-slate-900">
                Hikvision DS-K1T320MFWX Physical POC Checklist
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Field testing protocol for CCTV / Biometric Installation Partner at Jinson Chit Fund
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="py-3 border-b border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-700">Verification Progress: {completed} of {total} steps</span>
            <span className="tabular-nums font-mono text-slate-900">{percent}% Complete</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-slate-900 h-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Checklist Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs sm:text-sm">
          {categories.map(cat => (
            <div key={cat} className="space-y-2">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                {cat}
              </h4>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.filter(item => item.category === cat).map(item => {
                  const isChecked = Boolean(checkedIds[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`w-full p-3 rounded-lg border text-left flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 text-slate-900">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold ${isChecked ? 'text-emerald-950 line-through opacity-80' : 'text-slate-900'}`}>
                          {item.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {item.details}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCheckedIds({})}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            Reset Checklist
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
