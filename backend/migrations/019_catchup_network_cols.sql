-- Catch-up migration: safely applies all network-related schema additions that
-- may be missing on the production database.  Every statement uses IF NOT EXISTS
-- or IF EXISTS so it is safe to run multiple times without errors.

-- 1. allowed_networks table (from 008)
CREATE TABLE IF NOT EXISTS allowed_networks (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  ip_cidr    TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Extra attendance columns for network tracking (from 009)
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS clock_in_ip      TEXT,
  ADD COLUMN IF NOT EXISTS network_verified BOOLEAN NOT NULL DEFAULT false;

-- 3. location_pings table (from 010) — employees' GPS trail while clocked in
CREATE TABLE IF NOT EXISTS location_pings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
  lat           NUMERIC(10,7) NOT NULL,
  lng           NUMERIC(10,7) NOT NULL,
  accuracy_m    NUMERIC(8,2),
  type          TEXT NOT NULL DEFAULT 'auto',   -- 'auto' | 'manual'
  note          TEXT,
  context       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. visit_context column on location_pings (from 012)
ALTER TABLE location_pings
  ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL;
