import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHikvisionPayload, normalizeHikvisionEvents } from '../src/parser.js';

const xmlEvent = `<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert version="2.0">
  <dateTime>2026-11-13T09:05:00+05:30</dateTime>
  <eventType>AccessControllerEvent</eventType>
  <eventDescription>Access Controller Event</eventDescription>
  <AccessControllerEvent>
    <majorEventType>5</majorEventType>
    <subEventType>75</subEventType>
    <employeeNoString>101</employeeNoString>
    <attendanceStatus>1</attendanceStatus>
    <currentVerifyMode>face</currentVerifyMode>
    <serialNo>8042</serialNo>
  </AccessControllerEvent>
</EventNotificationAlert>`;

test('parses and normalizes a Hikvision AccessControllerEvent XML payload', () => {
  const candidates = parseHikvisionPayload(Buffer.from(xmlEvent), 'application/xml; charset=UTF-8');
  const [event] = normalizeHikvisionEvents(candidates);
  assert.equal(event.deviceUserId, '101');
  assert.equal(event.eventTime, '2026-11-13T03:35:00.000Z');
  assert.equal(event.eventType, 'check_in');
  assert.equal(event.verificationMode, 'face');
  assert.equal(event.eventSerialNo, '8042');
  assert.equal(event.rawPayload.serialNo, '8042');
});

test('interprets timezone-less terminal timestamps as India Standard Time', () => {
  const candidates = parseHikvisionPayload(Buffer.from(JSON.stringify({
    eventType: 'AccessControllerEvent',
    dateTime: '2026-11-13T09:05:00',
    AccessControllerEvent: { employeeNoString: '102', attendanceStatus: '2', subEventType: 71 },
  })), 'application/json');
  const [event] = normalizeHikvisionEvents(candidates);
  assert.equal(event.eventTime, '2026-11-13T03:35:00.000Z');
  assert.equal(event.eventType, 'check_out');
  assert.equal(event.verificationMode, 'fingerprint');
});

test('ignores unrelated alarms and never invents a missing timestamp', () => {
  const unrelated = parseHikvisionPayload(Buffer.from(JSON.stringify({ eventType: 'DeviceStatusChanged', dateTime: '2026-11-13T09:05:00+05:30' })), 'application/json');
  assert.deepEqual(normalizeHikvisionEvents(unrelated), []);
  const noTime = parseHikvisionPayload(Buffer.from(JSON.stringify({ eventType: 'AccessControllerEvent', AccessControllerEvent: { employeeNoString: '101' } })), 'application/json');
  assert.deepEqual(normalizeHikvisionEvents(noTime), []);
});

test('parses event JSON from multipart and ignores image attachment parts', () => {
  const boundary = 'attendease-test-boundary';
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="AccessControllerEvent"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ eventType: 'AccessControllerEvent', dateTime: '2026-11-13T10:00:00+05:30', AccessControllerEvent: { employeeNoString: '103', attendanceStatus: 1, subEventType: 1 } })}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="picture"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\nNOT-A-REAL-IMAGE\r\n`,
    `--${boundary}--\r\n`,
  ].join('');
  const [event] = normalizeHikvisionEvents(parseHikvisionPayload(Buffer.from(body), `multipart/form-data; boundary=${boundary}`));
  assert.equal(event.deviceUserId, '103');
  assert.equal(event.verificationMode, 'card');
  assert.equal('picture' in event.rawPayload, false);
});

test('rejects XML with DTD or external entity declarations', () => {
  assert.throws(() => parseHikvisionPayload(Buffer.from('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>'), 'application/xml'), /DTD\/entities/);
});
