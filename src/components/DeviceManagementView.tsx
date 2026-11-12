import React, { useState } from 'react';
import { 
  Cpu, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ShieldAlert,
  Server,
  Terminal,
  FileText,
  Key,
  Network,
  Clock,
  Layers
} from 'lucide-react';
import { AttendanceDevice, DeviceStatus } from '../types/database.types';
import { DeviceManager } from '../devices/DeviceManager';

interface DeviceManagementViewProps {
  devices: AttendanceDevice[];
  onOpenPocModal?: () => void;
}

export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  devices,
  onOpenPocModal,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || '');
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [testLogs, setTestLogs] = useState<Record<string, { status: DeviceStatus; message: string; timestamp: string }>>({});

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || devices[0];

  const handleTestConnection = async (device: AttendanceDevice) => {
    setTestingDeviceId(device.id);
    try {
      const adapter = DeviceManager.getInstance().getOrCreateAdapter(device);
      const res = await adapter.testConnection();
      setTestLogs(prev => ({
        ...prev,
        [device.id]: {
          status: res.status,
          message: res.message,
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        }
      }));
    } catch (err) {
      setTestLogs(prev => ({
        ...prev,
        [device.id]: {
          status: 'disconnected',
          message: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        }
      }));
    } finally {
      setTestingDeviceId(null);
    }
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Connected &amp; Verified
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
            Not Configured (Future)
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
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Attendance Hardware &amp; Biometric Integrations
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Universal adapter architecture bridging physical facial &amp; fingerprint access terminals with PostgreSQL.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenPocModal}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
        >
          <FileText className="w-4 h-4" />
          <span>View Hardware POC Checklist</span>
        </button>
      </div>

      {/* Device List & Detailed Inspector Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device selector list */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Configured Terminals ({devices.length})
          </h3>

          {devices.map(device => {
            const isSelected = device.id === selectedDeviceId;
            return (
              <button
                key={device.id}
                type="button"
                onClick={() => setSelectedDeviceId(device.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-white border-slate-900 ring-2 ring-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-slate-900 text-sm">
                    {device.device_name}
                  </div>
                  <div>{getStatusBadge(device.status)}</div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div>Model: <strong className="text-slate-700">{device.manufacturer} {device.model}</strong></div>
                  <div className="font-mono">SN: {device.serial_number}</div>
                  <div>Protocol: {device.connection_method}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Inspector */}
        {selectedDevice && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedDevice.device_name}
                  </h3>
                  {getStatusBadge(selectedDevice.status)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Assigned to: Thrissur Main Branch · Device Identifier: <span className="font-mono">{selectedDevice.id}</span>
                </p>
              </div>

              <button
                type="button"
                disabled={testingDeviceId === selectedDevice.id}
                onClick={() => handleTestConnection(selectedDevice)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingDeviceId === selectedDevice.id ? 'animate-spin' : ''}`} />
                <span>Run Connection Test</span>
              </button>
            </div>

            {/* Test result display */}
            {testLogs[selectedDevice.id] && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">Connection Probe Output:</span>
                  <span className="font-mono text-slate-400">{testLogs[selectedDevice.id].timestamp}</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {testLogs[selectedDevice.id].message}
                </p>
              </div>
            )}

            {/* Technical Parameters Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Hardware &amp; Network Configuration
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">Manufacturer &amp; Model</span>
                  <span className="font-bold text-slate-900">{selectedDevice.manufacturer} {selectedDevice.model}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">Serial Number</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDevice.serial_number}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">LAN IP &amp; Port</span>
                  <span className="font-mono font-bold text-slate-900">{selectedDevice.ip_address}:{selectedDevice.port}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">Communication Protocol</span>
                  <span className="font-bold text-slate-900">{selectedDevice.connection_method} (ISAPI REST API)</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">Firmware Version</span>
                  <span className="font-medium text-slate-800">{selectedDevice.firmware_version}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block text-xs mb-0.5">Last Sync Attempt</span>
                  <span className="font-medium text-slate-600">
                    {selectedDevice.last_sync_at ? selectedDevice.last_sync_at : 'No previous sync recorded'}
                  </span>
                </div>
              </div>
            </div>

            {/* Supported Capabilities list */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Verified Terminal Capabilities
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectedDevice.supported_capabilities.map((cap) => (
                  <div
                    key={cap}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2 text-slate-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="capitalize">{cap.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Integration Architecture Explanation */}
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <Network className="w-4 h-4 text-blue-700" />
                <span>Edge Connector Protocol Architecture</span>
              </div>
              <p className="leading-relaxed">
                As detailed in the <strong>Hikvision DS-K1T320MFWX Integration Feasibility Document</strong>, attendance machines on private LAN subnets cannot be directly accessed by web browsers due to CORS and mixed-content security policies. 
              </p>
              <p className="leading-relaxed">
                A lightweight connector daemon (Node.js/Go) runs on the branch network, polls <code>/ISAPI/AccessControl/AcsEvent</code> with HTTP Digest Authentication, and streams idempotent punch events over secure HTTPS to Supabase.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
