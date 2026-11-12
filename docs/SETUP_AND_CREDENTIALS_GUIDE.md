# AttendEase Setup & External Credentials Guide

**Version:** 2.0 (Milestone 2 Security & Architecture Hardened)  
**Target Environment:** Safe Local Demo / Staging / Production Deployment  

---

## 1. Zero-Credential Safe Demo Mode (Default)

AttendEase is architected to launch, compile, and run completely offline in **Evaluation Demo Mode** with zero external credentials required:
- **`VITE_APP_ENV=development`**
- **`VITE_DEMO_MODE=true`**
- **All other connection variables left blank.**

When external database credentials (`VITE_SUPABASE_URL`) are omitted or blank, the application automatically mounts the isolated synthetic **Jinson Chit Fund** dataset with:
- Multi-branch structure (Thrissur Main Branch & Ernakulam Branch).
- Realistic shifts (09:30 AM to 06:00 PM, 15m grace period).
- Staff roster with biometric hardware mappings.
- Attendance exceptions (late arrivals, missing check-outs, approved leaves).
- Prominent **DEMO MODE** banner across all views.
- **Physical device honesty:** The Hikvision terminal is explicitly flagged as `Not Yet Verified (POC)` and never reports fabricated punches as real hardware syncs.

---

## 2. Production Environment Transition Guide

When deploying to production with live customer data:

### Step 1: Database Provisioning (Supabase PostgreSQL)
1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and execute the migration files sequentially:
   - `supabase/migrations/20250101000000_initial_schema.sql` (Tables, constraints, foreign keys)
   - `supabase/migrations/20250101000001_tenant_isolation_rls.sql` (Base tenant isolation RLS)
   - `supabase/migrations/20250101000002_security_hardening_and_payroll.sql` (Role security, branch manager scoping, immutable audit & locked payroll)

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and provide the following client-side values:
```env
# Public Supabase Client (Protected by Row Level Security)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."

# Environment Mode
VITE_APP_ENV="production"
VITE_DEMO_MODE="false"

# Sentry Error Monitoring (PII is automatically scrubbed)
VITE_SENTRY_DSN="https://key@sentry.io/project"
```

### Step 3: Server Secret Isolation (CRITICAL)
- **NEVER put the Supabase `service_role` key into Vite or any `.env` file read by the frontend bundle.**
- The frontend operates strictly with the public `anon` key, subject to PostgreSQL Row Level Security.
- Device terminal passwords and service credentials reside exclusively on the private branch Edge Connector daemon (`attendease-agent`).

---

## 3. Physical Hardware Checklist Before Commissioning

| Hardware / Network Component | Specification / Requirement | Purpose |
| :--- | :--- | :--- |
| **Attendance Machine** | Hikvision DS-K1T320MFWX (Firmware $\ge$ V3.2) | Facial & Card attendance at branch |
| **Local Network Subnet** | Static IP reservation (e.g. `192.168.1.120`) | Fixed address for Edge Connector queries |
| **Edge Connector Host** | Mini-PC (Linux/Win10) or Legacy PC via 32-bit Go agent | Outbound relay to Cloud Supabase API |
| **NTP Synchronization** | UTC+05:30 (Asia/Kolkata) | Prevents terminal clock drift |
