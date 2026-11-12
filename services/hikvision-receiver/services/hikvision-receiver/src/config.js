export function loadConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const supabaseKey = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const deviceSerial = env.HIKVISION_DEVICE_SERIAL?.trim();
  const webhookToken = env.HIKVISION_WEBHOOK_TOKEN?.trim();
  const host = env.HOST || '127.0.0.1';
  const port = Number(env.PORT || 3100);
  const maxBodyBytes = Number(env.MAX_BODY_BYTES || 8 * 1024 * 1024);

  if (!supabaseUrl || !/^https:\/\//i.test(supabaseUrl)) throw new Error('SUPABASE_URL must be an HTTPS URL');
  if (!supabaseKey) throw new Error('SUPABASE_SECRET_KEY is required (legacy SUPABASE_SERVICE_ROLE_KEY is supported)');
  if (supabaseKey.startsWith('sb_publishable_')) throw new Error('A publishable key cannot be used by this server; use a server-only secret key');
  if (!deviceSerial) throw new Error('HIKVISION_DEVICE_SERIAL is required');
  if (!webhookToken || webhookToken.length < 32 || !/^[A-Za-z0-9_-]+$/.test(webhookToken)) {
    throw new Error('HIKVISION_WEBHOOK_TOKEN must be at least 32 URL-safe characters');
  }
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('HOST must bind to loopback; expose HTTPS only through a reverse proxy');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1024 || maxBodyBytes > 16 * 1024 * 1024) {
    throw new Error('MAX_BODY_BYTES must be between 1 KiB and 16 MiB');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    supabaseKey,
    deviceSerial,
    webhookToken,
    host,
    port,
    maxBodyBytes,
  };
}
