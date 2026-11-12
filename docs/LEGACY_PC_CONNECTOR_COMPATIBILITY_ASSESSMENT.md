# Legacy PC Connector Compatibility & Architecture Assessment

**Assessment Subject:** Deploying AttendEase Edge Connector on Branch Hardware  
**Host PC Specifications:** 32-bit Windows Vista / Windows 7, Intel Celeron Processor, 4 GB RAM  
**Target Biometric Terminal:** Hikvision DS-K1T320MFWX  
**Target Cloud Backend:** Supabase (PostgreSQL 15+ over TLS 1.3)  

---

## 1. Operating System & Runtime Incompatibility Audit

### A. Node.js Runtime
- **Node.js 18.x / 20.x / 22.x LTS:** **INCOMPATIBLE.** Modern Node.js dropped support for Windows 7 and 32-bit x86 architectures. Installers abort immediately with `OSVersionNotSupported`.
- **Node.js 13.14.0 (Legacy 32-bit):** Technically installable on Win 7 SP1, but end-of-life since April 2020. Lacks modern TLS 1.3 ciphers, has severe unpatched OpenSSL vulnerabilities, and fails to establish secure HTTPS sessions with modern Cloudflare/Supabase endpoints.

### B. Microsoft .NET Runtime
- **.NET 6 / 7 / 8 / 9:** **INCOMPATIBLE.** Requires 64-bit Windows 10 (Build 1607+) or Windows Server 2016+.
- **.NET Framework 4.8:** Supported only on Windows 7 SP1 with KB4474419 (SHA-2 code signing patch). Incompatible with Windows Vista. On an Intel Celeron with 4 GB RAM, the .NET CLR runtime incurs heavy startup overhead and high memory fragmentation.

### C. Python Runtime
- **Python 3.9+:** **INCOMPATIBLE.** Dropped Windows 7 support entirely.
- **Python 3.8.10 (32-bit):** Last supported version for Windows 7, but requires Microsoft Visual C++ 2015 Redistributable and KB2999226 (Universal C Runtime).

### D. Security & Network Vulnerability Risk
- Windows Vista reached End-of-Life in **April 2017**.
- Windows 7 reached End-of-Life in **January 2020**.
- Running financial and employee attendance services on an unpatched OS exposes the branch network to ransomware (e.g. WannaCry/EternalBlue) and local MITM interception.

---

## 2. Technical Evaluation Matrix

| Strategy | Feasibility on Legacy PC | Memory Footprint | Local Buffering | Maintenance Risk | Recommended |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js Daemon** | ❌ Fails (OS blocked) | ~180 MB | LevelDB / SQLite | High (unsupported runtime) | No |
| **.NET C# Service** | ⚠️ High friction (Win7 only) | ~140 MB | Local SQL Server Express | High (requires manual OS patches) | No |
| **Go 1.20 32-bit Binary (`attendease-agent.exe`)** | ✅ Compatible (Win 7 x86) | **< 18 MB** | Pure Go SQLite | Moderate (OS remains legacy) | **Conditionally Viable** |
| **Dedicated Edge Gateway (Mini PC / Linux)** | ✅ 100% Compatible | ~25 MB | SQLite / BoltDB | Zero (isolated, auto-updated) | **Strongly Recommended** |

---

## 3. Recommended Edge Architecture: Dual Strategy

### Strategy 1: Dedicated Hardware Edge Gateway (*Strongly Recommended for Jinson Chit Fund*)
To eliminate dependency on the old Windows PC:
- Install a commercial fanless Mini-PC (e.g., Intel N100 / J4125 with 8GB RAM, Windows 10/11 IoT or Ubuntu 24.04 LTS) or a Raspberry Pi 4 / 5.
- Approximate one-off hardware investment: ₹5,000 to ₹9,500.
- **Advantages:** 
  - 24/7 uptime without risk of branch staff turning off the office PC.
  - Native TLS 1.3 hardware-accelerated encryption.
  - Zero interference with the cashier's daily desktop tasks.

### Strategy 2: Native Go 32-bit Connector (`attendease-agent.exe`) (*Fallback for Legacy PC*)
If hardware acquisition is delayed and the client insists on using the existing Windows 7 32-bit PC:
- Built with **Go 1.20** cross-compiled via `GOOS=windows GOARCH=386`.
- **Zero Runtime Dependencies:** Compiles to a single standalone `.exe` without needing Node.js, Python, or .NET installed.
- **Local SQLite Store:** Uses embedded SQLite (`modernc.org/sqlite`) to store attendance events locally if the internet connection is disrupted.
- **Idempotent Retry Worker:** Uses exponential backoff to sync unsynchronized events to the AttendEase Supabase API once connectivity is restored.
- **System Service Wrapper:** Registered via `winsw` (Windows Service Wrapper) to auto-start with Windows and run in the background.

---

## 4. Edge Connector Security & Communication Contract

1. **Authentication:**
   - The connector authenticates to the cloud using a provisioned **Device Token** (JWT) and **Organization API Key** passed in the `Authorization: Bearer <TOKEN>` header.
   - Terminal credentials (HTTP Digest username and password) are stored in an encrypted local configuration file (`config.dat`) and are **NEVER transmitted to the cloud or browser**.
2. **Local Buffer & Retries:**
   - Every punch pulled from `/ISAPI/AccessControl/AcsEvent` is immediately written to local SQLite with status `PENDING`.
   - The sync worker transmits batches of up to 50 punches to `/api/v1/attendance/ingest`.
   - Only after receiving HTTP `200 OK` with verified insertion confirmation are local records marked as `SYNCED`.
3. **No Unauthenticated Public Inbound Ports:**
   - The connector makes **outbound connections only** to the Cloud API and local LAN terminal.
   - It does NOT expose any public inbound listening ports, preventing internet scanning attacks.
