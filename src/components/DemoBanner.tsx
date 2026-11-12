import React from 'react';
import { AlertCircle, Database, FileText } from 'lucide-react';

interface DemoBannerProps {
  onOpenPocDoc?: () => void;
  onOpenSetupDoc?: () => void;
  isLiveMode?: boolean;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  onOpenPocDoc,
  onOpenSetupDoc,
  isLiveMode = false,
}) => {
  if (isLiveMode) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-emerald-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-emerald-900">LIVE MODE ENABLED</span>
              <span className="mx-2 hidden sm:inline">·</span>
              <span className="text-emerald-800">
                Sign-in and database access require valid Supabase authentication, applied migrations and working Row-Level Security policies.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-start sm:items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold">EVALUATION DEMO MODE</span>
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="text-amber-800">
              Viewing synthetic test data for <strong>Jinson Chit Fund</strong>. Real attendance ingestion requires the branch Edge Connector daemon and Supabase credentials.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {onOpenPocDoc && (
            <button
              type="button"
              onClick={onOpenPocDoc}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 transition-colors flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span>Hikvision POC Spec</span>
            </button>
          )}
          {onOpenSetupDoc && (
            <button
              type="button"
              onClick={onOpenSetupDoc}
              className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-amber-50 text-amber-900 rounded border border-amber-300 transition-colors flex items-center gap-1 shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-amber-700" />
              <span>Setup Guide</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
