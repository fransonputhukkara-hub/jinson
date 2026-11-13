# AttendEase Hikvision HTTP Listening Receiver

A small Node.js 22+ service for receiving Hikvision terminal alarm/event POSTs over HTTPS and saving normalized attendance events to the existing AttendEase Supabase schema.

## Integration approach

The Hikvision DS-K1T320 series manual describes **HTTP Listening**: the terminal sends event/alarm notifications to a configured IP/domain, URL, port and HTTP/HTTPS protocol. The terminal initiates the outbound connection, so the Oracle VM does not need access to the office LAN address and the office router does not need port-forwarding.

This receiver does not use or modify Hik-Connect, ISUP, or SDK Server settings. Leave Hik-Connect enabled, ISUP disabled, and SDK Server port 7999 unchanged.

## What it does

- Accepts JSON, XML and multipart HTTP Listening payloads.
- Parses AccessControllerEvent details and normalizes employee/device ID, time, attendance status and verification mode.
- Ignores image/file attachments; no face images or biometric templates are stored.
- Finds the configured terminal by exact serial number in `attendance_devices`.
- Maps device user IDs/card numbers through `device_employee_mappings`.
- Stores raw punches in `attendance_events`; database uniqueness on `(device_id, device_user_id, event_time)` protects against repeated delivery.
- Keeps unmapped events with `employee_id = null` so an administrator can correct mappings later.
- Uses a server-only Supabase secret; the Netlify/browser app never receives it.

## Limitations — read before deployment

1. **Physical payload verification is still pending.** The exact event body emitted by this terminal/firmware must be captured with one real test punch. Unit tests validate known shapes; they do not prove communication with the physical machine.
2. **HTTP Listening is forward-only.** It does not retrieve old attendance records. Historical backfill needs a separate one-time office-LAN ISAPI poller/export or a device UI export.
3. **The Supabase schema must be initialized first.** Tables `attendance_devices`, `device_employee_mappings`, and `attendance_events` must exist. The device row must contain the exact terminal serial, and device-user mapping rows must be configured.
4. **This service only ingests raw punch events.** It does not calculate or persist `attendance_daily_summaries`, run payroll, enroll biometric users, or change terminal attendance mode. A separate trusted processing step is still needed before dashboard daily totals are populated from these raw events.
5. The receiver has not been deployed to Oracle Cloud and the device has not been configured to send to it.

## Environment

Copy `.env.example` to `/etc/attendease/hikvision-receiver.env` and provide:

- `SUPABASE_URL`: staging Supabase project URL.
- `SUPABASE_SECRET_KEY`: server-only `sb_secret_...` key. A legacy `SUPABASE_SERVICE_ROLE_KEY` JWT is accepted temporarily, but do not use a publishable/anon key.
- `HIKVISION_DEVICE_SERIAL`: exact device serial.
- `HIKVISION_WEBHOOK_TOKEN`: at least 32 URL-safe random characters (`openssl rand -hex 32`).
- `HOST=127.0.0.1`, `PORT=3100`.

Never store these values in Git, a `VITE_*` variable, Netlify, or the browser. Supabase secret/service-role keys bypass RLS and must remain server-side.

## Local checks

```bash
npm test
npm start
```

Health: `GET http://127.0.0.1:3100/healthz`.
Readiness: `GET http://127.0.0.1:3100/readyz` (checks that exactly one registered device matches the configured serial).

## Oracle VM deployment outline (Ubuntu)

This guide assumes Ubuntu with systemd. Confirm the VM OS and architecture before executing it.

1. Reserve/confirm the Oracle VM public IP. Point an A record such as `attendease-events.yourdomain.com` to that IP.
2. Allow inbound TCP 80 and 443 in the Oracle Cloud NSG/security list and VM firewall. Do **not** expose 3100 or 7999 publicly. No office-router port-forwarding is needed.
3. Install Node.js 22+, create a locked-down `attendease` OS user, deploy this directory to `/opt/attendease-hikvision-receiver`, and place the environment file at `/etc/attendease/hikvision-receiver.env` with root ownership and mode `0600`.
4. Install Caddy and configure `deploy/Caddyfile.example` with the real DNS name. Caddy obtains/renews TLS and reverse-proxies HTTPS to `127.0.0.1:3100`.
5. Install `deploy/attendease-hikvision-receiver.service` into `/etc/systemd/system/`, then run `systemctl daemon-reload`, `systemctl enable --now attendease-hikvision-receiver`, and verify `/healthz` and `/readyz` over HTTPS.
6. Test with a synthetic event before configuring the terminal. Do not use real employee attendance until the test and stored row are reviewed.

## Hikvision HTTP Listening values — only after the cloud receiver passes

In **System and Maintenance → System Configuration → Network → Network Service → HTTP(S) → HTTP Listening**:

- Event Alarm IP/Domain Name: `attendease-events.yourdomain.com`
- URL: `/v1/hikvision/events/<the-random-device-token>`
- Port: `443`
- Protocol: `HTTPS`

Do not press Save until cloud HTTPS is live and the synthetic-event test succeeds. Keep Hik-Connect enabled, ISUP disabled and SDK Server port 7999 unchanged. Then make one approved test punch and inspect receiver logs and the Supabase row. The Hik-Connect Online badge does not prove AttendEase ingestion works.
