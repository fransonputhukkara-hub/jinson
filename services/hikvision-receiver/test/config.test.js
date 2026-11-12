import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const validEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  HIKVISION_DEVICE_SERIAL: 'DS-K1T320MFWX20241227V030520ENGR3024763',
  HIKVISION_WEBHOOK_TOKEN: 'a'.repeat(64),
};

test('loads receiver configuration with loopback-only bind defaults', () => {
  const config = loadConfig(validEnv);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3100);
  assert.equal(config.deviceSerial, validEnv.HIKVISION_DEVICE_SERIAL);
});

test('rejects browser-safe publishable keys', () => {
  assert.throws(() => loadConfig({ ...validEnv, SUPABASE_SECRET_KEY: 'sb_publishable_nope' }), /publishable key cannot be used/);
});

test('rejects public direct listener binds', () => {
  assert.throws(() => loadConfig({ ...validEnv, HOST: '0.0.0.0' }), /must bind to loopback/);
});

test('requires a high-entropy path token', () => {
  assert.throws(() => loadConfig({ ...validEnv, HIKVISION_WEBHOOK_TOKEN: 'weak' }), /at least 32/);
});
