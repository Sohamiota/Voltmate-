import fs from 'fs';
import path from 'path';
import { query } from '../db';

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

/** Idempotent schema bootstrap — mirrors migration 021 for prod DBs that haven't run migrate yet. */
export async function ensureServiceManagerSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const candidates = [
      path.join(process.cwd(), 'migrations', '021_service_manager.sql'),
      path.join(__dirname, '..', '..', 'migrations', '021_service_manager.sql'),
    ];
    let sql = FALLBACK_SQL;
    for (const migrationPath of candidates) {
      try {
        if (fs.existsSync(migrationPath)) {
          sql = fs.readFileSync(migrationPath, 'utf8');
          break;
        }
      } catch { /* try next */ }
    }
    await query(sql);
    schemaReady = true;
  })().catch(err => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
}

export async function ensureServiceManagerMiddleware(
  _req: unknown,
  _res: unknown,
  next: (err?: unknown) => void,
): Promise<void> {
  try {
    await ensureServiceManagerSchema();
    next();
  } catch (e) {
    next(e);
  }
}

const FALLBACK_SQL = `
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_number TEXT, chassis_number TEXT, vehicle_type TEXT,
  owner_name TEXT, owner_phone TEXT, driver_name TEXT, driver_phone TEXT,
  location TEXT, purchase_date DATE, current_km INT DEFAULT 0, pdi TEXT,
  pdi_status TEXT DEFAULT 'pending', pdi_due_date DATE, pdi_completed_at TIMESTAMPTZ,
  pdi_checklist JSONB DEFAULT '[]'::jsonb, speak_with TEXT, remarks TEXT,
  km_updated_at TIMESTAMPTZ DEFAULT now(), created_by INT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicle_services (
  id SERIAL PRIMARY KEY, vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_no INT NOT NULL, due_km INT, due_date DATE, actual_km INT, completion_date DATE,
  status TEXT DEFAULT 'pending', remarks TEXT, cost NUMERIC(12,2), created_by INT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vehicle_id, service_no)
);
CREATE TABLE IF NOT EXISTS service_alerts (
  id SERIAL PRIMARY KEY, vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_id INT REFERENCES vehicle_services(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
  status TEXT NOT NULL DEFAULT 'open', digest_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(), acknowledged_at TIMESTAMPTZ, acknowledged_by INT
);
CREATE TABLE IF NOT EXISTS service_snapshots (
  id SERIAL PRIMARY KEY, snapshot_date DATE NOT NULL UNIQUE,
  overdue_count INT DEFAULT 0, due_today_count INT DEFAULT 0, due_this_week_count INT DEFAULT 0,
  due_soon_count INT DEFAULT 0, stale_km_count INT DEFAULT 0, pdi_pending_count INT DEFAULT 0,
  open_alerts_count INT DEFAULT 0, top_overdue JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS pdi_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pdi_due_date DATE,
  ADD COLUMN IF NOT EXISTS pdi_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdi_checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speak_with TEXT,
  ADD COLUMN IF NOT EXISTS km_updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE vehicle_services ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2);
`;
