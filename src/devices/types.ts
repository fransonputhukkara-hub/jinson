import { DeviceManufacturer, DeviceStatus, PunchEventType } from '../types/database.types';

export interface DeviceConfig {
  deviceId: string;
  organizationId: string;
  deviceIp: string;
  port: number;
  username?: string;
  password?: string;
  useHttps?: boolean;
  timeoutMs?: number;
}

export interface RawDeviceEvent {
  minorType?: number;
  majorType?: number;
  employeeNoString?: string;
  cardNo?: string;
  time?: string;
  eventDescription?: string;
  mask?: string;
  serialNo?: number;
  pictureUrl?: string;
  [key: string]: unknown;
}

export interface NormalizedDeviceEvent {
  deviceUserId: string;
  timestamp: string; // ISO format
  eventType: PunchEventType;
  verificationMode: 'face' | 'fingerprint' | 'card' | 'password' | 'manual' | 'unknown';
  serialNumber?: number;
  rawEvent: RawDeviceEvent;
}

export interface DeviceInfoResult {
  manufacturer: DeviceManufacturer;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  macAddress?: string;
  supportedCapabilities: DeviceCapability[];
}

export type DeviceCapability = 
  | 'test_connection'
  | 'read_device_info'
  | 'read_device_status'
  | 'retrieve_attendance_events'
  | 'retrieve_device_users'
  | 'create_update_device_users'
  | 'deactivate_device_users'
  | 'sync_historical_attendance'
  | 'realtime_event_listening';

export interface DeviceSyncResult {
  success: boolean;
  eventsPulled: number;
  events: NormalizedDeviceEvent[];
  lastSyncTimestamp: string;
  error?: string;
}

export interface DeviceConnectionTestResult {
  isConnected: boolean;
  status: DeviceStatus;
  latencyMs?: number;
  message: string;
  error?: string;
}

export interface IDeviceAdapter {
  getManufacturer(): DeviceManufacturer;
  getModel(): string;
  testConnection(): Promise<DeviceConnectionTestResult>;
  getDeviceInfo(): Promise<DeviceInfoResult>;
  getDeviceStatus(): Promise<DeviceStatus>;
  fetchAttendanceEvents(since: Date): Promise<DeviceSyncResult>;
  syncHistoricalAttendance(startDate: Date, endDate: Date): Promise<DeviceSyncResult>;
  getSupportedCapabilities(): DeviceCapability[];
}
