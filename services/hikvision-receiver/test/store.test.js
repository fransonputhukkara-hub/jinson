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
  assert.match(observed[0].url, /serial_number=eq\./);
  assert.equal(observed[0].headers.apikey, 'sb_secret_test');
  assert.equal(observed[0].headers.Authorization, undefined);
});
