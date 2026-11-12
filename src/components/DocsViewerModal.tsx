import React, { useState } from 'react';
import { FileText, Database, ShieldCheck, Cpu, X, AlertTriangle } from 'lucide-react';

interface DocsViewerModalProps {
  isOpen: boolean;
  initialDoc: 'feasibility' | 'setup' | 'legacy-pc';
  onClose: () => void;
}

export const DocsViewerModal: React.FC<DocsViewerModalProps> = ({
  isOpen,
  initialDoc,
  onClose,
}) => {
  const [activeDoc, setActiveDoc] = useState<'feasibility' | 'setup' | 'legacy-pc'>(initialDoc);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveDoc('feasibility')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDoc === 'feasibility'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Hikvision Feasibility</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDoc('legacy-pc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDoc === 'legacy-pc'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Old PC Assessment</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDoc('setup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeDoc === 'setup'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Safe Setup Guide</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 font-bold text-lg shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto py-4 text-xs sm:text-sm text-slate-700 space-y-4">
          {activeDoc === 'feasibility' && (
            <div className="space-y-4 leading-relaxed">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <span className="font-bold">Device Target:</span> Hikvision DS-K1T320MFWX (Face, M1 Card, Wi-Fi terminal).
                <br />
                <span className="font-bold">Verdict:</span> Fully feasible using ISAPI REST API over LAN with an Edge Connector Daemon.
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  1. The LAN-to-Browser Constraint &amp; Solution
                </h4>
                <p className="text-slate-600">
                  Modern browsers block direct cross-origin HTTP/TCP connections from cloud web apps to private LAN IP addresses (e.g. <code>192.168.1.120</code>) due to CORS and mixed-content security policies.
                </p>
                <p className="text-slate-600 mt-1">
                  AttendEase solves this with a lightweight Edge Connector running on a local branch PC that queries <code>/ISAPI/AccessControl/AcsEvent</code> with Digest Auth and streams sanitized punch events to Supabase PostgreSQL.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  2. Four-Tier Verification Boundary
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                  <li><strong>Tier 1 (Implemented &amp; Unit-Tested):</strong> AcsEvent parsing (face, fingerprint, card), 60s deduplication, ISAPI search query payload generator, and ingestion idempotency.</li>
                  <li><strong>Tier 2 (Verified Against Vendor Docs):</strong> ISAPI deviceInfo, digest authentication (RFC 2617), and HTTP Event push specification.</li>
                  <li><strong>Tier 3 (Physical Hardware Testing):</strong> Scheduled for on-site commissioning using the POC checklist.</li>
                  <li><strong>Tier 4 (Not Yet Verified):</strong> Physical device handshake and eSSL K90 secondary adapter.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  3. Direction Determination (IN vs OUT)
                </h4>
                <p className="text-slate-600">
                  When terminal keys are pressed, explicit status (checkIn, checkOut, breakIn, breakOut) is preserved. When in pure Access Control door mode, punches are safely resolved against the employee's assigned shift schedule without naive alternating assumptions.
                </p>
              </div>
            </div>
          )}

          {activeDoc === 'legacy-pc' && (
            <div className="space-y-4 leading-relaxed">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Legacy Branch PC Hardware Assessment
                </span>
                <span>Host: 32-bit Windows Vista / Windows 7, Intel Celeron CPU, 4 GB RAM.</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  1. Runtime Incompatibility Findings
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                  <li><strong>Modern Node.js (v18/20/22):</strong> INCOMPATIBLE. Dropped Windows 7 and 32-bit architecture. Installer refuses to run.</li>
                  <li><strong>.NET 6/7/8/9:</strong> INCOMPATIBLE. Requires 64-bit Windows 10+.</li>
                  <li><strong>Windows Vista:</strong> End of Life since 2017. Lacks modern TLS 1.3 cryptographic support required for cloud communication.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  2. Dual Strategy Solution
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-2">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                    <span className="font-bold text-emerald-950 block mb-1">Strategy 1: Dedicated Mini-PC (Recommended)</span>
                    <p className="text-emerald-800">
                      Install a low-cost fanless Mini-PC (Intel N100 / Raspberry Pi) running Linux. 24/7 reliability, hardware TLS 1.3, independent of cashier desktop.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold text-slate-900 block mb-1">Strategy 2: Standalone Go 32-bit Agent (Fallback)</span>
                    <p className="text-slate-600">
                      If the old PC must be used: a single self-contained Go 1.20 32-bit binary with embedded SQLite and zero external runtime dependencies. Memory footprint &lt;18 MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeDoc === 'setup' && (
            <div className="space-y-4 leading-relaxed">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-900">Zero-Credential Safe Demo Mode (Current State):</span>
                <p className="text-slate-600 mt-1">
                  Starts seamlessly with all connection values blank except <code>VITE_APP_ENV=development</code> and <code>VITE_DEMO_MODE=true</code>.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  1. PostgreSQL Migrations (Supabase)
                </h4>
                <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs space-y-1">
                  <div>1. 20250101000000_initial_schema.sql (Base tables &amp; indexes)</div>
                  <div>2. 20250101000001_tenant_isolation_rls.sql (Tenant boundary RLS)</div>
                  <div>3. 20250101000002_security_hardening_and_payroll.sql (Role security, branch scoping &amp; locked payroll)</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">
                  2. Privacy &amp; PII Scrubbing
                </h4>
                <p className="text-slate-600 text-xs">
                  Sentry monitor automatically redacts employee salaries, bank accounts, Aadhaar, PAN, passwords, and biometric vectors before dispatch.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
