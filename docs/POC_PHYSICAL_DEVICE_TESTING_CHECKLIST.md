# Physical Device POC Testing Checklist: Hikvision DS-K1T320MFWX

This checklist guides the CCTV/biometric installation partner when commissioning the **Hikvision DS-K1T320MFWX** at **Jinson Chit Fund**.

---

## Phase 1: Physical Installation & Network Commissioning
- [ ] **Power Supply:** Connect terminal to rated 12V DC, 1.5A power adapter or dedicated UPS line.
- [ ] **Ethernet / Wi-Fi Setup:** Assign a static LAN IP address (e.g. `192.168.1.120`, Subnet `255.255.255.0`, Gateway `192.168.1.1`).
- [ ] **NTP Time Sync:** Set NTP server to `time.google.com` or `time.nist.gov` with timezone set to `UTC+05:30 (Chennai, Kolkata, Mumbai, New Delhi)`.
- [ ] **Terminal Activation:** Set secure `admin` password via SADP Tool or device web portal. Record password securely in partner vault.

---

## Phase 2: ISAPI & Security Verification
- [ ] **Verify Web GUI Access:** Open `http://192.168.1.120` from the branch PC and verify successful login.
- [ ] **Enable ISAPI / CGI:** In Device Web GUI > System > Security > Authentication, ensure `Digest/Basic` is permitted.
- [ ] **Dedicated Service Account:** Create an operator account (e.g., `attendease_svc`) with Access Control and Event Retrieval permissions rather than using root admin.

---

## Phase 3: Edge Connector Configuration
- [ ] **Connector Installation:** Run `attendease-connector` on the branch Windows PC or local mini-PC.
- [ ] **Connector Config (`.env`):**
  ```env
  DEVICE_IP=192.168.1.120
  DEVICE_PORT=80
  DEVICE_USER=attendease_svc
  DEVICE_PASS=********
  ORGANIZATION_ID=92388e80-1783-44b7-93ee-cb640ea3aaaf
  DEVICE_ID=hik-jcf-thrissur-01
  CLOUD_API_URL=https://[YOUR_SUPABASE_PROJECT].supabase.co/rest/v1
  ```
- [ ] **Ping & Handshake Test:** Run `curl http://localhost:8088/api/test-connection` and verify `status: "connected"`.

---

## Phase 4: Biometric Enrollment & Real Punch Verification
- [ ] **User Enrollment:** Enroll Test Employee 1 (e.g., Device User ID `101`, JCF-001) with Face and Card.
- [ ] **Initial Check-in Punch:** Perform physical face scan at terminal. Verify terminal displays audible greeting "Authenticated".
- [ ] **Event Capture Test:** Query AcsEvent endpoint:
  ```bash
  curl -k --digest -u attendease_svc:PASS -X POST "http://192.168.1.120/ISAPI/AccessControl/AcsEvent?format=json" -d @query.json
  ```
- [ ] **Verify Minor Type:** Confirm `minorType` is `75` (face verification) or `1` (card verification).
- [ ] **Deduplication Test:** Have the same employee scan 3 times within 20 seconds. Confirm the AttendEase calculation engine consolidates them into a single check-in.
- [ ] **Offline Buffer Test:** Disconnect the Ethernet cable from the router, make 2 test punches, reconnect the cable, and verify missed punches backfill cleanly.
