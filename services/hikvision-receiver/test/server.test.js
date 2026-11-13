import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiverServer } from '../src/server.js';

const token = 'a'.repeat(48);
const eventBody = JSON.stringify({
  eventType: 'AccessControllerEvent',
  dateTime: '2026-11-13T09:05:00+05:30',
  AccessControllerEvent: { employeeNoString: '101', attendanceStatus: 1, subEventType: 75 },
});

test('protects the webhook route with its per-device path token and accepts a valid event', async (t) => {
  const ingested = [];
  const store = {
    async getDevice() { return { id: 'device-1' }; },
    async ingest(events) { ingested.push(...events); return { received: events.length, inserted: events.length, unmapped: 0 }; },
  };
  const server = createReceiverServer({ webhookToken: token, maxBodyBytes: 100_000 }, store, { info() {}, error() {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const denied = await fetch(`${base}/v1/hikvision/events/${'b'.repeat(48)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: eventBody });
  assert.equal(denied.status, 404);
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  const accepted = await fetch(`${base}/v1/hikvision/events/${token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: eventBody });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).inserted, 1);
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0].deviceUserId, '101');
});
