import { DeviceAdapter } from '../DeviceAdapter';
import { 
  DeviceCapability, 
  DeviceConfig, 
  DeviceConnectionTestResult, 
  DeviceInfoResult, 
  DeviceSyncResult 
} from '../types';
import { DeviceManufacturer, DeviceStatus } from '../../types/database.types';

/**
 * eSSL K90 Standalone Fingerprint Terminal Adapter (Future Adapter)
 * Typically uses ZKTeco/eSSL Push SDK over HTTP or UDP on port 4370.
 */
export class EsslK90Adapter extends DeviceAdapter {
  constructor(config: DeviceConfig) {
    super(config);
  }

  getManufacturer(): DeviceManufacturer {
    return 'eSSL';
  }

  getModel(): string {
    return 'K90';
  }

  getSupportedCapabilities(): DeviceCapability[] {
    return [
      'test_connection',
      'read_device_info',
      'retrieve_attendance_events',
      'sync_historical_attendance'
    ];
  }

  async testConnection(): Promise<DeviceConnectionTestResult> {
    return {
      isConnected: false,
      status: 'not_yet_verified',
      message: 'eSSL K90 integration is staged as a future device adapter. Hardware POC scheduled after Hikvision DS-K1T320MFWX verification.',
    };
  }

  async getDeviceInfo(): Promise<DeviceInfoResult> {
    return {
      manufacturer: 'eSSL',
      model: 'K90',
      firmwareVersion: 'Unknown (Terminal Not Connected)',
      serialNumber: 'Pending Hardware Connection',
      supportedCapabilities: this.getSupportedCapabilities(),
    };
  }

  async getDeviceStatus(): Promise<DeviceStatus> {
    return 'not_yet_verified';
  }

  async fetchAttendanceEvents(since: Date): Promise<DeviceSyncResult> {
    return {
      success: false,
      eventsPulled: 0,
      events: [],
      lastSyncTimestamp: new Date().toISOString(),
      error: 'eSSL K90 adapter is scheduled for Milestone 2.',
    };
  }

  async syncHistoricalAttendance(startDate: Date, endDate: Date): Promise<DeviceSyncResult> {
    return this.fetchAttendanceEvents(startDate);
  }
}
