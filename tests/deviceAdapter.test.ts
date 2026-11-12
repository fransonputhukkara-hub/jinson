import { describe, it, expect } from 'vitest';
import { HikvisionDSK1T320MFWXAdapter } from '../src/devices/hikvision/HikvisionAdapter';
import { DeviceManager } from '../src/devices/DeviceManager';
import { AttendanceDevice } from '../src/types/database.types';

describe('Hikvision Device Adapter - Unit Tests', () => {
  const adapter = new HikvisionDSK1T320MFWXAdapter({
    deviceId: 'hik-test-01',
    organizationId: 'org-test',
    deviceIp: '192.168.1.120',
    port: 80,
    username: 'admin',
    password: 'secretPassword123',
  });

  it('correctly returns manufacturer and model specifications', () => {
    expect(adapter.getManufacturer()).toBe('Hikvision');
    expect(adapter.getModel()).toBe('DS-K1T320MFWX');
  });

  it('safely scrubs password from public getConfig()', () => {
    const config = adapter.getConfig();
    expect(config.deviceIp).toBe('192.168.1.120');
    expect((config as Record<string, unknown>).password).toBeUndefined();
  });

  it('normalizes Hikvision Face verification AcsEvent payload (minorType 75 / 0x4b)', () => {
    const rawPayload = {
      majorType: 5,
      minorType: 75, // Face verification valid
      employeeNoString: '101',
      time: '2026-10-15T09:25:30Z',
      attendanceStatus: 1, // checkIn
      serialNo: 12345,
    };

    const normalized = adapter.normalizeAcsEvent(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.deviceUserId).toBe('101');
    expect(normalized?.verificationMode).toBe('face');
    expect(normalized?.eventType).toBe('check_in');
    expect(normalized?.serialNumber).toBe(12345);
  });

  it('normalizes Hikvision Fingerprint verification AcsEvent (minorType 71 / 0x47)', () => {
    const rawPayload = {
      majorType: 5,
      minorType: 71, // Fingerprint verification valid
      employeeNoString: '102',
      time: '2026-10-15T18:05:00Z',
      attendanceStatus: 2, // checkOut
    };

    const normalized = adapter.normalizeAcsEvent(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.deviceUserId).toBe('102');
    expect(normalized?.verificationMode).toBe('fingerprint');
    expect(normalized?.eventType).toBe('check_out');
  });

  it('normalizes Hikvision M1 Card verification AcsEvent (minorType 1 / 0x01)', () => {
    const rawPayload = {
      majorType: 5,
      minorType: 1, // Card verification valid
      cardNo: 'CARD-998877',
      employeeNoString: '103',
      time: '2026-10-15T09:28:12Z',
    };

    const normalized = adapter.normalizeAcsEvent(rawPayload);
    expect(normalized).not.toBeNull();
    expect(normalized?.verificationMode).toBe('card');
  });

  it('builds a valid ISAPI query search description object', () => {
    const start = new Date('2026-10-15T00:00:00Z');
    const end = new Date('2026-10-15T23:59:59Z');
    const payload = adapter.buildAcsEventQueryPayload(start, end, 'query-1', 50);

    expect(payload.AcsEventSearchDescription).toBeDefined();
    expect(payload.AcsEventSearchDescription.searchID).toBe('query-1');
    expect(payload.AcsEventSearchDescription.maxResults).toBe(50);
    expect(payload.AcsEventSearchDescription.AcsEventCond.major).toBe(5);
  });

  it('DeviceManager properly resolves Hikvision vs eSSL adapters', () => {
    const hikDevice: AttendanceDevice = {
      id: 'd1',
      organization_id: 'org-1',
      branch_id: 'b1',
      device_name: 'Main Counter',
      manufacturer: 'Hikvision',
      model: 'DS-K1T320MFWX',
      serial_number: 'SN1',
      connection_method: 'ISAPI',
      status: 'not_yet_verified',
      supported_capabilities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const esslDevice: AttendanceDevice = {
      id: 'd2',
      organization_id: 'org-1',
      branch_id: 'b2',
      device_name: 'Secondary',
      manufacturer: 'eSSL',
      model: 'K90',
      serial_number: 'SN2',
      connection_method: 'Push_SDK',
      status: 'not_configured',
      supported_capabilities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const manager = DeviceManager.getInstance();
    const adapter1 = manager.getOrCreateAdapter(hikDevice);
    const adapter2 = manager.getOrCreateAdapter(esslDevice);

    expect(adapter1.getManufacturer()).toBe('Hikvision');
    expect(adapter2.getManufacturer()).toBe('eSSL');
  });

  it('honestly returns not_configured when device IP is 0.0.0.0 or blank', async () => {
    const unconfiguredAdapter = new HikvisionDSK1T320MFWXAdapter({
      deviceId: 'hik-unconf',
      organizationId: 'org-test',
      deviceIp: '0.0.0.0',
      port: 80,
    });

    const res = await unconfiguredAdapter.testConnection();
    expect(res.isConnected).toBe(false);
    expect(res.status).toBe('not_configured');
  });

  it('honestly returns disconnected rather than fabricating connection success for unreachable hardware', async () => {
    // 127.0.0.1 on unused port 59999
    const unreachableAdapter = new HikvisionDSK1T320MFWXAdapter({
      deviceId: 'hik-offline',
      organizationId: 'org-test',
      deviceIp: '127.0.0.1',
      port: 59999,
      timeoutMs: 500,
    });

    const res = await unreachableAdapter.testConnection();
    expect(res.isConnected).toBe(false);
    expect(res.status).toBe('disconnected');
    expect(res.message).toContain('Unable to establish connection');

    const info = await unreachableAdapter.getDeviceInfo();
    expect(info.firmwareVersion).toContain('Not Connected');
  });
});
