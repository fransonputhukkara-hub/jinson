# AttendEase Hikvision ISUP 5.0 integration

This directory is the implementation workspace for the official ISUP 5.0 integration. It is intentionally not a functioning listener yet.

## Why there is no listener binary in Git

ISUP is a Hikvision protocol. The implementation must use the official Device Gateway or official ISUP SDK package and its vendor-provided interface definitions. Do not hand-code the proprietary wire protocol or commit vendor binaries/headers to this repository.

## Current state

- DS-K1T320MFWX product documentation confirms ISUP 5.0 support.
- The exact installed firmware V3.5.20 build 241227 is included in Hikvision's release notes for this terminal family.
- Official Device Gateway Linux64 and official ISUP SDK Linux64 are candidate server components.
- Exact Device Gateway compatibility with this terminal/firmware is not yet confirmed.
- The official SDK/Gateway package has not yet been obtained.
- No ISUP registration or alarm listener has been started.
- The physical terminal has not been switched to AttendEase ISUP 5.0.

See docs/integrations/hikvision-isup5.md for the integration plan and rollout gates.

## Read-only Oracle preflight

Run this on the existing Oracle VM before installing anything:

~~~bash
bash services/hikvision-isup5/scripts/preflight.sh
~~~

The script only reports OS/architecture, CPU/RAM/disk, selected TCP listeners, UFW status and the existing AttendEase HTTP receiver/Caddy service state. It does not install packages, alter services, bind ports or change firewall rules.

## Planned event path

1. The official ISUP component accepts device registration and alarm/event traffic.
2. Its documented callback/API yields the event body.
3. A small local adapter forwards the event to the existing loopback-only Node receiver at 127.0.0.1:3100.
4. The Node receiver validates the webhook token, normalizes the event and inserts it into Supabase with the existing duplicate-protection constraint.

The native component must not hold the Supabase secret. It must not forward images or biometric templates.

## Do not configure the terminal yet

The latest device screenshot displayed ISUP 4.0 selected, server port 80 and registration status Offline. These are not approved deployment values. Final server port(s), device ID, alarm-centre URL/port and encryption key must come from the chosen official Gateway/SDK configuration. Keep Hik-Connect and the friend's existing server services unchanged until a tested rollback procedure exists.
