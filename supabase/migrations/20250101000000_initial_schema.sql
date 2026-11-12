-- ==============================================================================
-- UNIVERSAL ATTENDANCE & PAYROLL SAAS - INITIAL MULTI-TENANT SCHEMA
-- Target Database: PostgreSQL 15+ (Supabase)
-- Milestone 1 Baseline Schema
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. User Profiles (Auth Link)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Branches (Tenant Scoped)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_branch_code_per_org UNIQUE (organization_id, code)
);

-- 4. Organization Memberships & Roles
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_admin', 'installer_partner', 'company_owner', 'company_admin', 'branch_manager', 'employee')),
    assigned_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_org_membership UNIQUE (organization_id, user_id)
);

-- 5. Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_dept_code_per_org UNIQUE (organization_id, code)
);

-- 6. Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_grace_minutes INTEGER NOT NULL DEFAULT 15,
    early_departure_grace_minutes INTEGER NOT NULL DEFAULT 15,
    half_day_threshold_minutes INTEGER NOT NULL DEFAULT 240,
    is_night_shift BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_shift_name_per_org UNIQUE (organization_id, name)
);

-- 7. Employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    employee_code VARCHAR(64) NOT NULL, -- App Employee ID
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    designation VARCHAR(120) NOT NULL,
    joining_date DATE NOT NULL,
    employment_status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'probation', 'resigned', 'terminated', 'on_leave')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_emp_code_per_org UNIQUE (organization_id, employee_code)
);

-- 8. Attendance Devices (Hardware Terminals)
CREATE TABLE IF NOT EXISTS attendance_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    device_name VARCHAR(150) NOT NULL,
    manufacturer VARCHAR(50) NOT NULL, -- 'Hikvision', 'eSSL', etc.
    model VARCHAR(100) NOT NULL,        -- e.g. 'DS-K1T320MFWX'
    serial_number VARCHAR(100) NOT NULL,
    ip_address INET,
    port INTEGER NOT NULL DEFAULT 80,
    connection_method VARCHAR(50) NOT NULL DEFAULT 'ISAPI',
    status VARCHAR(50) NOT NULL DEFAULT 'not_yet_verified' CHECK (status IN ('connected', 'disconnected', 'not_configured', 'simulated', 'not_yet_verified')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    firmware_version VARCHAR(100),
    supported_capabilities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_device_sn_per_org UNIQUE (organization_id, serial_number)
);

-- 9. Device Employee Mappings (Bridge between Terminal User ID and Cloud Employee ID)
CREATE TABLE IF NOT EXISTS device_employee_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES attendance_devices(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    device_user_id VARCHAR(64) NOT NULL, -- ID stored on physical terminal (e.g., '101')
    card_no VARCHAR(64),
    is_enrolled_face BOOLEAN NOT NULL DEFAULT false,
    is_enrolled_fingerprint BOOLEAN NOT NULL DEFAULT false,
    is_enrolled_card BOOLEAN NOT NULL DEFAULT false,
    is_active_on_device BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_device_user_mapping UNIQUE (device_id, device_user_id)
);

-- 10. Raw Attendance Events (Immutable Source of Truth)
CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_id UUID REFERENCES attendance_devices(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    device_user_id VARCHAR(64) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(32) NOT NULL DEFAULT 'unknown' CHECK (event_type IN ('check_in', 'check_out', 'break_start', 'break_end', 'overtime_start', 'overtime_end', 'unknown')),
    verification_mode VARCHAR(32) NOT NULL DEFAULT 'unknown' CHECK (verification_mode IN ('face', 'fingerprint', 'card', 'password', 'manual', 'unknown')),
    is_processed BOOLEAN NOT NULL DEFAULT false,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_event_record UNIQUE (device_id, device_user_id, event_time)
);

-- 11. Attendance Daily Summaries (Computed Aggregates)
CREATE TABLE IF NOT EXISTS attendance_daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    first_check_in TIMESTAMPTZ,
    last_check_out TIMESTAMPTZ,
    total_work_minutes INTEGER NOT NULL DEFAULT 0,
    total_break_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday', 'weekly_off')),
    is_late BOOLEAN NOT NULL DEFAULT false,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    is_early_departure BOOLEAN NOT NULL DEFAULT false,
    early_departure_minutes INTEGER NOT NULL DEFAULT 0,
    is_missing_checkout BOOLEAN NOT NULL DEFAULT false,
    remarks TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_emp_daily_summary UNIQUE (employee_id, work_date)
);

-- 12. Device Sync Logs
CREATE TABLE IF NOT EXISTS device_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES attendance_devices(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL CHECK (status IN ('success', 'failed', 'in_progress')),
    events_pulled INTEGER NOT NULL DEFAULT 0,
    events_inserted INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. System Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
    related_entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    changes JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_org ON attendance_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_org_time ON attendance_events(organization_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_summaries_emp_date ON attendance_daily_summaries(employee_id, work_date);
