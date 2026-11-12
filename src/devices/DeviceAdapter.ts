import { 
  DeviceCapability, 
  DeviceConfig, 
  DeviceConnectionTestResult, 
  DeviceInfoResult, 
  DeviceSyncResult, 
  IDeviceAdapter 
} from './types';
import { DeviceManufacturer, DeviceStatus } from '../types/database.types';

export abstract class DeviceAdapter implements IDeviceAdapter {
  protected config: DeviceConfig;
  protected lastKnownStatus: DeviceStatus = 'not_yet_verified';

  constructor(config: DeviceConfig) {
    this.config = config;
  }

  abstract getManufacturer(): DeviceManufacturer;
  abstract getModel(): string;
  abstract testConnection(): Promise<DeviceConnectionTestResult>;
  abstract getDeviceInfo(): Promise<DeviceInfoResult>;
  abstract getDeviceStatus(): Promise<DeviceStatus>;
  abstract fetchAttendanceEvents(since: Date): Promise<DeviceSyncResult>;
  abstract syncHistoricalAttendance(startDate: Date, endDate: Date): Promise<DeviceSyncResult>;
  abstract getSupportedCapabilities(): DeviceCapability[];

  public getConfig(): Readonly<DeviceConfig> {
    // Return config without revealing password
    const { password, ...safeConfig } = this.config;
    return safeConfig as DeviceConfig;
  }
}
