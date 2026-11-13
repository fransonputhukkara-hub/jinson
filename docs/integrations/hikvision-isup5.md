# Hikvision ISUP 5.0 integration plan

**Status:** engineering foundation only. No ISUP listener is deployed or connected to the terminal yet.

## Decision

Use Hikvision ISUP 5.0 as the device uplink protocol for the Jinson Chit Fund terminal. Do not implement the proprietary binary protocol from scratch. Prefer an official Hikvision Linux integration component:

1. Evaluate the official Hik Device Gateway for Linux64 first. Hikvision describes Device Gateway as accepting ISUP 5.0 devices, including MinMoe access-control devices, and exposing HTTP/HTTPS interfaces for third-party integration.
2. If Device Gateway does not support this exact terminal/model/firmware or its resource requirements do not fit the Oracle VM, use the official ISUP SDK Linux64 (native C/C++ libraries and headers) and implement registration and alarm callbacks using the vendor API.

The official TPP materials list a Linux64 Device Gateway package. Exact DS-K1T320MFWX compatibility with that gateway still needs written confirmation or a real registration test. The model's ISUP 5.0 support is confirmed independently by its product documentation.

## Confirmed device facts

- Model: DS-K1T320MFWX
- Serial: DS-K1T320MFWX20241227V030520ENGR3024763
- Firmware displayed: V3.5.20 build 241227
- Hikvision's V3.5.20 build 241227 release notes include DS-K1T320MFWX.
- The DS-K1T320MFWX product datasheet lists ISAPI and ISUP 5.0 support.
- The DS-K1T320 Series manual explains the ISUP 5.0 configuration fields and key requirements.

References:
- [DS-K1T320MFWX datasheet](https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000080/S000000103/S000000107/OFR000141/M000059153/Data_Sheet/DS-K1T320MFWX_Datasheet_20231227.pdf)
- [DS-K1T320 Series V3.5.20 build 241227 release notes](https://assets.hikvision.com/prd/public/all/files/202503/releasenote%5CDS-K1T320_Series_MinMoe_V3.5.20_build241227_Release_Note.pdf)
- [DS-K1T320 Series user manual](https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000080/S000000103/S000000107/OFR000141/M000059150/User_Manual/UD28901B-C_Baseline_DS-K1T320-Series-Face-Recognition-Terminal_User-Manual_V2.1_20231110.PDF)

## Device configuration distinction

The terminal has two distinct sets of fields in the ISUP configuration page:

1. ISUP platform registration: protocol version, server IP/address, server port, device ID, ISUP account and ISUP 5.0 key.
2. ISUP listening: alarm-centre IP/domain, alarm-centre URL and alarm-centre port.

These fields are not interchangeable. The selected official Gateway/SDK documentation must determine which listener(s) and ports to use.

The manual states:
- ISUP server port is configured on the device and its documented range is 1–65535.
- Device ID is entered in the ISUP registration settings.
- With ISUP 5.0, create/use an ISUP account and key.
- The ISUP key length is 8–16 characters.
- ISUP alarm-centre settings are configured separately.
- Saving the configuration activates the settings; changing protocol/connection mode must be planned with rollback.

Reference: [DS-K1T320 Series user manual, ISUP section](https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000080/S000000103/S000000107/OFR000141/M000059150/User_Manual/UD28901B-C_Baseline_DS-K1T320-Series-Face-Recognition-Terminal_User-Manual_V2.1_20231110.PDF)

**Latest screenshot observation only (not evidence that settings were saved):** ISUP toggle appeared enabled, ISUP 4.0 was selected, server address showed 129.159.233.179, server port showed 80, Device ID showed 3024763 and registration status showed Offline. The ISUP Listening alarm-centre fields showed 0.0.0.0, slash and port 0. Do not reuse these values. Port 80 is already used by Caddy on the Oracle VM and is not an approved ISUP listener port.

## Official implementation options

### Option A — Hik Device Gateway (evaluate first)

Hikvision's Open Platform describes Device Gateway as:
- A software package with Linux64 and Win64 versions.
- Accepting devices over ISUP 5.0.
- Supporting video devices and MinMoe access-control devices.
- Exposing HTTP/HTTPS and RTSP interfaces for third-party integration, including access-control person management and alarm/event functions.

The TPP Getting Started Guide shows a Linux64 package named Hik DeviceGateway V1.8.0.4 Build 20250227. Obtain the currently published package from the account's Support → Download area rather than relying on an old copy.

References:
- [Hikvision Open Platform](https://open.hikvision.com/osp)
- [Hikvision TPP Getting Started Guide](https://tpp.hikvision.com/pd/GettingStartedGuide.pdf)

**Unverified:** public Device Gateway material does not explicitly name DS-K1T320MFWX or firmware V3.5.20. Confirm exact model compatibility and minimum RAM/CPU/disk before installing it on the existing shared 1 GB Oracle VM.

### Option B — Official ISUP SDK Linux64

Hikvision's public ISUPSDK API reference documents separate registration and alarm-listener modules. It includes registration/listen APIs such as NET_ECMS_Init, NET_ECMS_StartListen and alarm APIs such as NET_EALARM_Init and NET_EALARM_StartListen.

The native host must be built against the exact header and library versions supplied by Hikvision. Callback signatures, ISUP 5.0 session/key handling, device registration, alarm callback data structure and event body decoding must come from the official SDK materials.

Reference: [Hikvision ISUPSDK API reference](https://open.hikvision.com/hardware/v2/%E6%8E%A5%E5%8F%A3%E5%AE%9A%E4%B9%89/index.html)

Do not substitute an unverified community implementation or invent ISUP frame handling. No production code may claim to parse attendance events until a real device event has been captured and decoded with the official SDK/API.

## AttendEase integration boundary

Keep the existing Node HTTP receiver and Supabase write path as the application-side ingestion component:

- Existing receiver binds to 127.0.0.1:3100.
- Existing receiver validates a high-entropy URL token, parses supported JSON/XML payloads, looks up the exact device serial, maps employee IDs and performs duplicate-safe Supabase insertion.
- The ISUP component must forward a decoded event to this local receiver only after a valid vendor callback.
- The native ISUP component must not receive the Supabase secret key.
- Do not expose port 3100 or the webhook token publicly.
- Do not log ISUP keys, Supabase secrets, webhook tokens, face images or fingerprint templates.

A real terminal event is required to confirm the payload format. Synthetic JSON tests of the existing HTTP receiver are not proof of ISUP connectivity.

## Network and port safety

- The terminal initiates its uplink connection from the office; no inbound port forwarding is required on the office router.
- Oracle Cloud ingress must allow only the exact TCP listener port(s) selected by the official Gateway/SDK.
- Do not assume registration and alarm-listener ports are the same.
- Do not reuse ports 80, 443, 3000, 3100, 7999 or 8000.
- Port 7660 is already allowed in UFW for the shared VM. Treat it as reserved until its owner/purpose is confirmed. Do not bind it or change its firewall rule.
- Do not change UFW, Oracle NSGs/Security Lists or the terminal configuration until the chosen software and exact ports are documented.

## Rollout gates

1. Obtain the official Device Gateway Linux64 package and/or ISUP SDK Linux64 materials from Hikvision TPP.
2. Confirm in writing whether DS-K1T320MFWX / firmware V3.5.20 is supported by the chosen component.
3. Confirm minimum server resources and exact registration/alarm port requirements.
4. Review the existing shared VM's resource and port preflight output.
5. Install the ISUP component alongside the existing HTTP receiver; do not stop or replace the friend's application.
6. Configure the terminal using a newly generated ISUP 5.0 key and platform-issued device ID, with a documented rollback to its previous settings.
7. Confirm registration Online.
8. Make one approved physical attendance punch and capture the actual ISUP alarm callback.
9. Forward one real event to the existing receiver and verify the exact row in Supabase.
10. Only then implement unattended restart/reconnect handling, historical retrieval (if supported), attendance calculations and full application workflows.

## Current blocker

The official vendor binaries/headers and their license/usage terms are not yet present in this repository or on the Oracle VM. Obtain them through Hikvision TPP before implementing or compiling the native ISUP host.
