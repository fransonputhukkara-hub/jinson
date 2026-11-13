import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { loadConfig } from './config.js';
import { parseHikvisionPayload, normalizeHikvisionEvents } from './parser.js';
import { createSupabaseStore } from './supabase-store.js';

function safeTokenMatch(provided, expected) {
  const left = Buffer.from(String(provided || ''));
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

async function readBody(request, maxBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

export function createReceiverServer(config, store, logger = console) {
  const expectedPath = `/v1/hikvision/events/${config.webhookToken}`;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return sendJson(response, 200, { ok: true, service: 'attendease-hikvision-receiver' });
    }
    if (request.method === 'GET' && url.pathname === '/readyz') {
      try { await store.getDevice(); return sendJson(response, 200, { ready: true }); }
      catch { return sendJson(response, 503, { ready: false }); }
    }
    if (request.method !== 'POST' || !safeTokenMatch(url.pathname, expectedPath)) {
      return sendJson(response, 404, { error: 'Not found' });
    }
    try {
      const contentType = request.headers['content-type'] || '';
      if (!/(application\/(?:json|xml)|text\/xml|multipart\/)/i.test(contentType)) {
        return sendJson(response, 415, { error: 'Unsupported content type' });
      }
      const body = await readBody(request, config.maxBodyBytes);
      let events;
      try { events = normalizeHikvisionEvents(parseHikvisionPayload(body, contentType)); }
      catch { return sendJson(response, 400, { error: 'Invalid or unsupported Hikvision event payload' }); }
      if (!events.length) return sendJson(response, 200, { received: 0, ignored: true });
      const result = await store.ingest(events);
      logger.info?.(`[AttendEase Hikvision] accepted=${result.received} inserted=${result.inserted} unmapped=${result.unmapped}`);
      return sendJson(response, 200, result);
    } catch (error) {
      const status = Number(error?.statusCode) || 503;
      if (status === 413) return sendJson(response, 413, { error: 'Request body too large' });
      if (status === 415) return sendJson(response, 415, { error: 'Unsupported event payload' });
      logger.error?.(`[AttendEase Hikvision] ingestion failed (${error instanceof Error ? error.message : 'unknown error'})`);
      return sendJson(response, 503, { error: 'Temporary ingestion failure' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 50;
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let config;
  try { config = loadConfig(); }
  catch (error) { console.error(`[AttendEase Hikvision] configuration error: ${error.message}`); process.exit(1); }
  const store = createSupabaseStore(config);
  const server = createReceiverServer(config, store);
  server.listen(config.port, config.host, () => console.info(`[AttendEase Hikvision] listening on ${config.host}:${config.port}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
