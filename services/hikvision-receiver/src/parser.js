const IST_OFFSET = '+05:30';

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function xmlTag(source, name) {
  const open = `<${name}>`;
  const close = `</${name}>`;
  const start = source.indexOf(open);
  if (start < 0) return undefined;
  const valueStart = start + open.length;
  const end = source.indexOf(close, valueStart);
  if (end < 0) return undefined;
  return decodeXml(source.slice(valueStart, end).replace(/<[^>]*>/g, ''));
}

function parseXmlEvent(xml) {
  if (xml.includes('<!DOCTYPE') || xml.includes('<!ENTITY')) {
    throw new Error('XML declarations with DTD/entities are not accepted');
  }
  const open = '<AccessControllerEvent>';
  const close = '</AccessControllerEvent>';
  const start = xml.indexOf(open);
  const end = start < 0 ? -1 : xml.indexOf(close, start + open.length);
  const detail = start >= 0 && end >= 0 ? xml.slice(start + open.length, end) : xml;
  const field = (name) => xmlTag(detail, name) ?? xmlTag(xml, name);
  return [{
    eventType: xmlTag(xml, 'eventType'),
    eventDescription: xmlTag(xml, 'eventDescription'),
    dateTime: xmlTag(xml, 'dateTime') ?? xmlTag(xml, 'time'),
    employeeNoString: field('employeeNoString'),
    employeeNo: field('employeeNo'),
    cardNo: field('cardNo'),
    attendanceStatus: field('attendanceStatus') ?? field('attendanceState'),
    majorEventType: field('majorEventType') ?? field('major'),
    subEventType: field('subEventType') ?? field('minorType') ?? field('minor'),
    currentVerifyMode: field('currentVerifyMode') ?? field('verifyMode'),
    serialNo: field('serialNo'),
  }];
}

function getJsonCandidates(value) {
  if (Array.isArray(value)) return value.flatMap(getJsonCandidates);
  if (!value || typeof value !== 'object') return [];
  const root = value.EventNotificationAlert ?? value.eventNotificationAlert ?? value;
  if (Array.isArray(root)) return root.flatMap(getJsonCandidates);
  const acsEvent = root.AcsEvent ?? root.acsEvent;
  const infoList = acsEvent?.InfoList ?? acsEvent?.infoList ?? root.InfoList;
  if (Array.isArray(infoList)) return infoList.map((item) => ({ ...root, ...item }));
  const detail = root.AccessControllerEvent ?? root.accessControllerEvent ?? root;
  return [{
    eventType: root.eventType ?? root.EventType,
    eventDescription: root.eventDescription,
    dateTime: root.dateTime ?? root.time ?? detail.dateTime ?? detail.time,
    employeeNoString: detail.employeeNoString ?? detail.employeeNoStr,
    employeeNo: detail.employeeNo,
    cardNo: detail.cardNo,
    attendanceStatus: detail.attendanceStatus ?? detail.attendanceState,
    majorEventType: detail.majorEventType ?? detail.major,
    subEventType: detail.subEventType ?? detail.minorType ?? detail.minor,
    currentVerifyMode: detail.currentVerifyMode ?? detail.verifyMode,
    serialNo: detail.serialNo ?? detail.eventSerialNo,
  }];
}

function parseTextPayload(text, contentType = '') {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.includes('<!DOCTYPE') || trimmed.includes('<!ENTITY')) {
    throw new Error('XML declarations with DTD/entities are not accepted');
  }
  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return getJsonCandidates(JSON.parse(trimmed));
  }
  if (contentType.includes('xml') || trimmed.startsWith('<')) return parseXmlEvent(trimmed);
  throw new Error('Unsupported Hikvision event content type');
}

function parseMultipart(buffer, contentType) {
  const boundaryPart = contentType.split(';').map((part) => part.trim()).find((part) => part.toLowerCase().startsWith('boundary='));
  if (!boundaryPart) throw new Error('Multipart request is missing its boundary');
  let boundary = boundaryPart.slice('boundary='.length).trim();
  if (boundary.startsWith('"') && boundary.endsWith('"')) boundary = boundary.slice(1, -1);
  if (!boundary || boundary.length > 200) throw new Error('Multipart boundary is invalid');
  const parts = buffer.toString('latin1').split(`--${boundary}`).slice(1);
  const candidates = [];
  for (let part of parts) {
    if (part.startsWith('--')) continue;
    while (part.startsWith('\r\n')) part = part.slice(2);
    while (part.startsWith('\n')) part = part.slice(1);
    const separator = part.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const headers = part.slice(0, separator);
    let content = part.slice(separator + 4);
    while (content.endsWith('\r\n')) content = content.slice(0, -2);
    if (headers.toLowerCase().includes('filename=') || !content.trim()) continue;
    const typeLine = headers.split('\r\n').find((line) => line.toLowerCase().startsWith('content-type:'));
    const partType = typeLine ? typeLine.slice(typeLine.indexOf(':') + 1).trim().toLowerCase() : 'text/plain';
    try { candidates.push(...parseTextPayload(content, partType)); }
    catch { /* Ignore unrelated multipart parts. */ }
  }
  if (!candidates.length) throw new Error('No supported Hikvision event part found in multipart request');
  return candidates;
}

export function parseHikvisionPayload(buffer, contentType = '') {
  const normalizedType = contentType.toLowerCase();
  if (normalizedType.includes('multipart/')) return parseMultipart(buffer, normalizedType);
  return parseTextPayload(buffer.toString('utf8'), normalizedType);
}

function parseEventTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  const hasTimezone = candidate.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(candidate) || /[+-]\d{4}$/.test(candidate);
  const isIsoDateTime = candidate.length >= 19 && candidate[4] === '-' && candidate[7] === '-' && (candidate[10] === 'T' || candidate[10] === ' ');
  const normalized = isIsoDateTime && !hasTimezone ? `${candidate.replace(' ', 'T')}${IST_OFFSET}` : candidate;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeAttendanceStatus(value) {
  const status = String(value ?? '').trim().toLowerCase().replaceAll(' ', '').replaceAll('_', '').replaceAll('-', '');
  if (['1', 'checkin', 'onwork', 'in'].includes(status)) return 'check_in';
  if (['2', 'checkout', 'offwork', 'out'].includes(status)) return 'check_out';
  if (['3', 'breakout'].includes(status)) return 'break_start';
  if (['4', 'breakin'].includes(status)) return 'break_end';
  return 'unknown';
}

function normalizeVerificationMode(value, minorType) {
  const mode = String(value ?? '').toLowerCase();
  if (mode.includes('finger')) return 'fingerprint';
  if (mode.includes('face')) return 'face';
  if (mode.includes('card')) return 'card';
  const minor = Number(minorType);
  if (minor === 75 || minor === 0x4b) return 'face';
  if (minor === 71 || minor === 0x47) return 'fingerprint';
  if (minor === 1) return 'card';
  return 'unknown';
}

export function normalizeHikvisionEvents(candidates) {
  const events = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const eventType = String(candidate.eventType ?? '').trim();
    if (eventType && !eventType.toLowerCase().includes('accesscontrollerevent')) continue;
    const employeeNoString = candidate.employeeNoString ?? '';
    const employeeNo = candidate.employeeNo ?? '';
    const cardNo = candidate.cardNo ?? '';
    const deviceUserId = String(employeeNoString || employeeNo || cardNo).trim();
    const eventTime = parseEventTime(candidate.dateTime ?? candidate.time);
    if (!deviceUserId || deviceUserId.length > 64 || !eventTime) continue;
    const major = candidate.majorEventType ?? candidate.major;
    if (major !== undefined && major !== null && String(major) !== '' && Number(major) !== 5) continue;
    const minorType = candidate.subEventType ?? candidate.minorType ?? candidate.minor;
    const serialNo = candidate.serialNo === undefined ? undefined : String(candidate.serialNo).slice(0, 64);
    events.push({
      deviceUserId,
      eventTime,
      eventType: normalizeAttendanceStatus(candidate.attendanceStatus ?? candidate.attendanceState),
      verificationMode: normalizeVerificationMode(candidate.currentVerifyMode ?? candidate.verifyMode, minorType),
      eventSerialNo: serialNo,
      rawPayload: {
        eventType: eventType || 'AccessControllerEvent',
        eventDescription: String(candidate.eventDescription ?? '').slice(0, 120),
        dateTime: String(candidate.dateTime ?? candidate.time ?? ''),
        employeeNoString: String(employeeNoString),
        employeeNo: String(employeeNo),
        cardNo: String(cardNo),
        attendanceStatus: String(candidate.attendanceStatus ?? candidate.attendanceState ?? ''),
        majorEventType: String(major ?? ''),
        subEventType: String(minorType ?? ''),
        currentVerifyMode: String(candidate.currentVerifyMode ?? candidate.verifyMode ?? ''),
        serialNo: serialNo ?? '',
      },
      mappingKeyType: employeeNoString || employeeNo ? 'device_user_id' : 'card_no',
    });
  }
  return events;
}
