import React, { useState } from 'react';
import { 
  Cpu, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ShieldAlert,
  Server
} from 'lucide-react';
import { AttendanceDevice, DeviceStatus } from '../types/database.types';
import { DeviceManager } from '../devices/DeviceManager';

interface DeviceHealthCardProps {
  device: AttendanceDevice;
  onOpenManagement?: () => void;
}

export const DeviceHealthCard: React.FC<DeviceHealthCardProps> = ({
  device,
  onOpenManagement,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: DeviceStatus;
    message: string;
    timestamp: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const adapter = DeviceManager.getInstance().getOrCreateAdapter(device);
      const res = await adapter.testConnection();
      
      setTestResult({
        status: res.status,
        message: res.message,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
    } catch (err) {
      setTestResult({
        status: 'disconnected',
        message: err instanceof Error ? err.message : 'Unknown connection error',
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Connected &amp; Active
          </span>
        );
      case 'not_yet_verified':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Not Yet Verified (POC)
          </span>
        );
      case 'simulated':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Simulated Adapter
          </span>
        );
      case 'not_configured':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            Not Configured
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Cpu className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {device.device_name}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {device.manufacturer} · {device.model}
              </p>
            </div>
          </div>
          <div>{getStatusBadge(device.status)}</div>
        </div>

        <div className="space-y-2 py-3 border-y border-slate-100 text-xs sm:text-sm text-slate-600">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Hardware Serial:</span>
            <span className="font-mono text-slate-900 font-medium">{device.serial_number}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Target IP &amp; Port:</span>
            <span className="font-mono text-slate-900 font-medium">{device.ip_address}:{device.port}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Integration Method:</span>
            <span className="font-medium text-slate-900">{device.connection_method} (ISAPI REST API)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Firmware:</span>
            <span className="font-medium text-slate-700">{device.firmware_version}</span>
          </div>
        </div>

        {testResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-800">Connection Diagnostic:</span>
              <span className="text-slate-400 tabular-nums">{testResult.timestamp}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">{testResult.message}</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Probing Terminal...' : 'Run POC Connection Test'}</span>
        </button>

        {onOpenManagement && (
          <button
            type="button"
            onClick={onOpenManagement}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Manage</span>
          </button>
        )}
      </div>
    </div>
  );
};
