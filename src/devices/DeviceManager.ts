import { DeviceConfig, IDeviceAdapter } from './types';
import { HikvisionDSK1T320MFWXAdapter } from './hikvision/HikvisionAdapter';
import { EsslK90Adapter } from './essl/EsslK90Adapter';
import { AttendanceDevice } from '../types/database.types';

export class DeviceManager {
  private static instance: DeviceManager;
  private adapters: Map<string, IDeviceAdapter> = new Map();

  private constructor() {}

  public static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  public getOrCreateAdapter(device: AttendanceDevice, credentials?: { username?: string; password?: string }): IDeviceAdapter {
    const key = device.id;
    if (this.adapters.has(key)) {
      return this.adapters.get(key)!;
    }

    const config: DeviceConfig = {
      deviceId: device.id,
      organizationId: device.organization_id,
      deviceIp: device.ip_address || '0.0.0.0',
      port: device.port || 80,
      username: credentials?.username,
      password: credentials?.password,
      useHttps: device.port === 443,
    };

    let adapter: IDeviceAdapter;
    if (device.manufacturer === 'Hikvision' || device.model.includes('DS-K1T320')) {
      adapter = new HikvisionDSK1T320MFWXAdapter(config);
    } else if (device.manufacturer === 'eSSL' || device.model.includes('K90')) {
      adapter = new EsslK90Adapter(config);
    } else {
      adapter = new HikvisionDSK1T320MFWXAdapter(config);
    }

    this.adapters.set(key, adapter);
    return adapter;
  }
}
