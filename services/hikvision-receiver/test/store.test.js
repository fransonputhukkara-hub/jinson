import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupabaseHeaders, createSupabaseStore } from '../src/supabase-store.js';

test('new Supabase secret keys are sent only in apikey header', () => {
  const headers = buildSupabaseHeaders('sb_secret_example');
  assert.equal(headers.apikey, 'sb_secret_example');
  assert.equal(headers.Authorization, undefined);
});

test('legacy service role JWT keys also use Bearer authorization', () => {
  const key = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
  const headers = buildSupabaseHeaders(key);
  assert.equal(headers.apikey, key);
  assert.equal(headers.Authorization, `Bearer ${key}`);
});

test('store resolves only the configured device serial using the server-only key', async () => {
  const observed = [];
  const store = createSupabaseStore({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'sb_secret_test',
    deviceSerial: 'DS-K1T320MFWX20241227V030520ENGR3024763',
  }, async (url, options) => {
    observed.push({ url: String(url), headers: options.headers });
    return new Response(JSON.stringify([{
      id: 'device-1', organization_id: 'org-1', serial_number: 'DS-K1T320MFWX20241227V030520ENGR3024763', manufacturer: 'Hikvision', model: 'DS-K1T320MFWX',
    }]), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const device = await store.getDevice();
  assert.equal(device.id, 'device-1');
  assert.match(observed[0].url, /serial_number=eq\\./);
  assert.equal(observed[0].headers.apikey, 'sb_secret_test');
  assert.equal(observed[0].headers.Authorization, undefined);
});

test('ingestion marks events without an employee mapping as unmapped', async () => {
  const calls = [];
  const store = createSupabaseStore({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'sb_secret_test',
    deviceSerial: 'DS-K1T320MFWX20241227V030520ENGR3024763',
  }, async (url, options) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    if (path.endsWith('/attendance_devices') && options.method === 'GET') {
      return new Response(JSON.stringify([{
        id: 'device-1',
        organization_id: 'org-1',
        serial_number: 'DS-K1T320MFWX20241227V030520ENGR3024763',
        manufacturer: 'Hikvision',
        model: 'DS-K1T320MFWX',
      }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/device_employee_mappings')) {
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/attendance_events') && options.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'event-1' }]), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/attendance_devices') && options.method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${options.method} ${path}`);
  });

  const result = await store.ingest([{
    deviceUserId: '007',
    eventTime: '2026-11-14T04:30:00.000Z',
    eventType: 'unknown',
    verificationMode: 'face',
    eventSerialNo: '152',
    rawPayload: { eventType: 'AccessControllerEvent' },
    mappingKeyType: 'device_user_id',
  }]);

  assert.deepEqual(result, { received: 1, inserted: 1, unmapped: 1 });
  const insert = calls.find((call) => call.path.endsWith('/attendance_events'));
  assert.equal(insert.body[0].employee_id, null);
  assert.equal(insert.body[0].is_unmapped_user, true);
  assert.equal(insert.body[0].event_serial_no, '152');
});
