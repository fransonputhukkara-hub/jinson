function makeRestUrl(baseUrl, table, query = {}) {
  const url = new URL(`/rest/v1/${table}`, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}

export function buildSupabaseHeaders(supabaseKey) {
  const headers = { apikey: supabaseKey, 'Content-Type': 'application/json' };
  // New sb_secret keys are not JWTs: send them only as `apikey`.
  // Legacy service_role keys are JWTs and also require the Bearer header.
  if (!supabaseKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${supabaseKey}`;
  return headers;
}

export function createSupabaseStore(config, fetchImpl = fetch) {
  const headers = buildSupabaseHeaders(config.supabaseKey);
  async function request(table, { method = 'GET', query, body, prefer } = {}) {
    const requestHeaders = { ...headers };
    if (prefer) requestHeaders.Prefer = prefer;
    const response = await fetchImpl(makeRestUrl(config.supabaseUrl, table, query), {
      method, headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Supabase ${method} ${table} failed with HTTP ${response.status}`);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  let deviceCache = null;
  let deviceCacheExpires = 0;
  let mappingsCache = null;
  let mappingsCacheExpires = 0;

  async function getDevice() {
    if (deviceCache && Date.now() < deviceCacheExpires) return deviceCache;
    const rows = await request('attendance_devices', { query: {
      select: 'id,organization_id,serial_number,manufacturer,model',
      serial_number: `eq.${config.deviceSerial}`, limit: '2',
    } });
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Hikvision serial number must match exactly one registered attendance_devices row');
    const device = rows[0];
    if (device.manufacturer !== 'Hikvision' || device.serial_number !== config.deviceSerial) {
      throw new Error('Registered database device does not match the configured Hikvision serial number');
    }
    deviceCache = device;
    deviceCacheExpires = Date.now() + 60_000;
    return device;
  }

  async function getMappings(deviceId) {
    if (mappingsCache && mappingsCache.deviceId === deviceId && Date.now() < mappingsCacheExpires) return mappingsCache.value;
    const rows = await request('device_employee_mappings', { query: {
      select: 'device_user_id,card_no,employee_id', device_id: `eq.${deviceId}`,
      is_active_on_device: 'eq.true', limit: '5000',
    } });
    const byDeviceUserId = new Map();
    const byCardNumber = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.device_user_id) byDeviceUserId.set(String(row.device_user_id), row.employee_id);
      if (row.card_no) byCardNumber.set(String(row.card_no), row.employee_id);
    }
    const value = { byDeviceUserId, byCardNumber };
    mappingsCache = { deviceId, value };
    mappingsCacheExpires = Date.now() + 60_000;
    return value;
  }

  async function ingest(events) {
    const device = await getDevice();
    const mappings = await getMappings(device.id);
    const rows = events.map((event) => {
      const employeeId = event.mappingKeyType === 'card_no'
        ? mappings.byCardNumber.get(event.deviceUserId) ?? null
        : mappings.byDeviceUserId.get(event.deviceUserId) ?? null;
      const eventSerialNo = /^\d+$/.test(String(event.eventSerialNo ?? ''))
        ? String(event.eventSerialNo)
        : null;
      return {
        organization_id: device.organization_id, device_id: device.id,
        employee_id: employeeId, is_unmapped_user: employeeId === null,
        device_user_id: event.deviceUserId,
        event_time: event.eventTime, event_type: event.eventType,
        verification_mode: event.verificationMode, is_processed: false,
        event_serial_no: eventSerialNo,
        raw_payload: event.rawPayload,
      };
    });
    let inserted = 0;
    if (rows.length) {
      const result = await request('attendance_events', {
        method: 'POST', query: { on_conflict: 'device_id,device_user_id,event_time' },
        body: rows, prefer: 'resolution=ignore-duplicates,return=representation',
      });
      inserted = Array.isArray(result) ? result.length : 0;
    }
    await request('attendance_devices', {
      method: 'PATCH', query: { id: `eq.${device.id}` },
      body: { last_sync_at: new Date().toISOString(), status: 'connected', last_error: null },
      prefer: 'return=minimal',
    });
    return { received: events.length, inserted, unmapped: rows.filter((row) => row.is_unmapped_user).length };
  }
  return { getDevice, ingest };
}
