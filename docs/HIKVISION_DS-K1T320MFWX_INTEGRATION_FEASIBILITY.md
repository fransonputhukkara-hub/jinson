# Hikvision DS-K1T320MFWX Integration Feasibility & Verification Status

**Document Version:** 2.0 (Milestone 2 Audit Update)  
**Target Hardware:** Hikvision DS-K1T320MFWX (Value Series Face Access Terminal)  
**Target Client:** Jinson Chit Fund (Thrissur HQ)  
**Security Notice:** All network IP addresses (e.g. `192.168.1.120`) and sample credentials in documentation or demo mode are placeholder configurations. Real hardware credentials and network parameters must be set via local environment variables at physical commissioning time.

---

## 1. Explicit Four-Tier Integration Verification Matrix

To ensure absolute engineering transparency, all capabilities and ISAPI operations are categorized into four distinct verification levels:

| ISAPI Operation / Feature | HTTP Method & Endpoint | Verification Level | Test / Verification Evidence |
| :--- | :--- | :--- | :--- |
| **AcsEvent JSON Parsing** | `POST /ISAPI/AccessControl/AcsEvent?format=json` | **Tier 1: Implemented & Unit-Tested** | Validated in `tests/deviceAdapter.test.ts` across Face (0x4b / 75), Fingerprint (0x47 / 71), and Card (0x01 / 1). |
| **Event Query Formatting** | `AcsEventSearchDescription` JSON query | **Tier 1: Implemented & Unit-Tested** | Validated in `tests/deviceAdapter.test.ts` for time filters, major/minor types, pagination. |
| **Punch Deduplication** | 60-Second Debounce Engine | **Tier 1: Implemented & Unit-Tested** | Validated in `tests/attendanceCalculator.test.ts` with multi-punch sequence consolidation. |
| **Ingestion Idempotency** | Hardware serial & Event UID deduplication | **Tier 1: Implemented & Unit-Tested** | Validated in `tests/attendanceIngestion.test.ts`. |
| **Device Info Schema** | `GET /ISAPI/System/deviceInfo` | **Tier 2: Verified Against Docs** | Grounded in official Hikvision ISAPI Access Control Developer Guide (V2.5). |
| **HTTP Digest Auth (RFC 2617)** | ISAPI challenge-response handshake | **Tier 2: Verified Against Docs** | Grounded in Hikvision Security Guidelines (Digest/Basic mode). |
| **HTTP Event Host Push** | `POST /ISAPI/Event/notification/httpHosts` | **Tier 2: Verified Against Docs** | Supported on firmware V3.2+; push listening server spec confirmed in vendor docs. |
| **User Enrollment / Record** | `POST /ISAPI/AccessControl/UserInfo/Record` | **Tier 2: Verified Against Docs** | Documented in ISAPI Access Control specification. |
| **Local Edge Daemon Sync** | Node.js / Go 32-bit standalone agent | **Tier 4: Not Yet Verified** | Staged for local network deployment; pending physical branch network access. |
| **Live Hardware Communication** | TCP handshake with physical DS-K1T320MFWX | **Tier 4: Not Yet Verified** | Requires physical device on client LAN, static IP assignment, and installer presence. |
| **Hardware Fingerprint Scanner** | Secondary eSSL K90 terminal | **Tier 4: Not Yet Verified** | Staged as future adapter for subsequent milestone. |

*Note: No capabilities are marked "Tier 3: Tested against a physical device" until the on-site physical commissioning test using `docs/POC_PHYSICAL_DEVICE_TESTING_CHECKLIST.md` is completed and signed off.*

---

## 2. Event Direction Determination Strategy (IN vs OUT)

A common pitfall with biometric terminals is assuming every scan alternates strictly between IN and OUT. For the **Hikvision DS-K1T320MFWX**, event direction is resolved through a three-stage heuristic:

1. **Explicit Terminal Status Keys (Primary):**
   When the terminal's screen is configured with status keys, staff select **1: Check In**, **2: Check Out**, **3: Break Out**, or **4: Break In**. The terminal transmits `attendanceStatus` (or `attendanceState`) in the AcsEvent JSON body. If present, the engine honors this explicit direction directly.
2. **Shift Window Heuristics (Fallback for Access Control Mode):**
   If the device operates in pure access control mode (door unlock mode without on-screen status selection), all punches have `attendanceStatus = null` or `unknown`:
   - **Check-In Candidate:** The earliest verified punch occurring within the morning shift window (e.g. between 08:30 AM and 11:30 AM for Jinson's 09:30 AM shift).
   - **Check-Out Candidate:** The latest verified punch occurring in the afternoon or evening (after the half-day threshold).
   - **Intermediate Punches:** Recorded as attendance events but flagged as intermediate break/errand scans, preventing false check-in/out toggling.
3. **Manager Corrections & Audit Trail:**
   If an employee forgets to clock out or makes an erroneous punch, the manager uses the auditable `attendance_corrections` workflow with original and adjusted values preserved in `audit_logs`.

---

## 3. Real Hardware Prerequisites Prior to Physical Connection

1. **Terminal Serial Number & Firmware:** Confirm the unit has firmware `V3.2.30` or higher to ensure full ISAPI JSON endpoint support.
2. **Network Isolation:** The terminal must reside on a dedicated VLAN or subnet with static IP address reservation in the branch router.
3. **No Cloud Exposure:** Never port-forward port 80/443 of the physical terminal directly to the public internet. All communication with Supabase occurs outbound from the local Edge Connector over encrypted HTTPS.
