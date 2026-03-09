#!/usr/bin/env node
/**
 * Seed vehicles and vehicle_services from seed-vehicles-data.json.
 * Run from repo root: node backend/scripts/seed-vehicles.js
 * Uses DATABASE_URL from .env (same as backend).
 */
require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

function normalizeDate(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  const sep = t.includes('/') ? '/' : '-';
  const parts = t.split(sep).map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  let y, m, d;
  if (c.length === 4) {
    d = a;
    m = b;
    y = c;
  } else if (a.length === 4) {
    y = a;
    m = b;
    d = c;
  } else return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizeStatus(s) {
  if (!s || typeof s !== 'string') return 'pending';
  const t = s.toLowerCase();
  if (t === 'done') return 'done';
  return 'pending';
}

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      vehicle_number TEXT,
      chassis_number TEXT,
      vehicle_type TEXT,
      owner_name TEXT,
      owner_phone TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      location TEXT,
      purchase_date DATE,
      current_km INT DEFAULT 0,
      pdi TEXT,
      speak_with TEXT,
      remarks TEXT,
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS vehicle_services (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      service_no INT NOT NULL,
      due_km INT,
      due_date DATE,
      actual_km INT,
      completion_date DATE,
      status TEXT DEFAULT 'pending',
      remarks TEXT,
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(vehicle_id, service_no)
    )
  `);
  await client.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'poi')
      THEN ALTER TABLE vehicles RENAME COLUMN poi TO pdi;
      END IF;
    END $$
  `).catch(() => {});
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'speak_with')
      THEN ALTER TABLE vehicles ADD COLUMN speak_with TEXT;
      END IF;
    END $$
  `).catch(() => {});
}

async function run() {
  const dataPath = path.join(__dirname, 'seed-vehicles-data.json');
  let raw;
  try {
    raw = fs.readFileSync(dataPath, 'utf8');
  } catch (e) {
    console.error('Could not read seed-vehicles-data.json:', e.message);
    process.exit(1);
  }
  let vehicles;
  try {
    vehicles = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON in seed-vehicles-data.json:', e.message);
    process.exit(1);
  }
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    console.error('seed-vehicles-data.json must be a non-empty array');
    process.exit(1);
  }

  const client = await pool.connect();
  const importedIds = [];
  try {
    await ensureTables(client);
    await client.query('BEGIN');
    for (const row of vehicles) {
      const chassis_number = row.chassis_number ?? row.vehicle_number ?? null;
      const vehicle_number = row.vehicle_number ?? chassis_number ?? null;
      const vehicle_type = row.vehicle_type ?? null;
      const owner_name = row.owner_name ?? null;
      const owner_phone = row.owner_phone ?? null;
      const driver_name = row.driver_name ?? null;
      const driver_phone = row.driver_phone ?? null;
      const location = row.location ?? null;
      const purchase_date = normalizeDate(row.purchase_date);
      const current_km = row.current_km != null ? parseInt(String(row.current_km), 10) : 0;
      const pdi = row.pdi ?? null;
      const speak_with = row.speak_with ?? null;
      const remarks = row.remarks ?? null;

      const ins = await client.query(
        `INSERT INTO vehicles (
          vehicle_number, chassis_number, vehicle_type,
          owner_name, owner_phone, driver_name, driver_phone,
          location, purchase_date, current_km, pdi, speak_with, remarks,
          created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
        RETURNING id`,
        [
          vehicle_number,
          chassis_number,
          vehicle_type,
          owner_name,
          owner_phone,
          driver_name,
          driver_phone,
          location,
          purchase_date,
          isNaN(current_km) ? 0 : Math.max(0, current_km),
          pdi,
          speak_with,
          remarks,
          null,
        ]
      );
      const vehicleId = ins.rows[0]?.id;
      if (!vehicleId) continue;
      importedIds.push(vehicleId);

      const services = Array.isArray(row.services) ? row.services : [];
      let lastActualKm = current_km;

      for (const svc of services) {
        const service_no = svc.service_no != null ? parseInt(String(svc.service_no), 10) : null;
        if (service_no == null || isNaN(service_no)) continue;
        const due_km = svc.due_km != null ? parseInt(String(svc.due_km), 10) : null;
        const due_date = normalizeDate(svc.due_date);
        const actual_km = svc.actual_km != null ? parseInt(String(svc.actual_km), 10) : null;
        const completion_date = normalizeDate(svc.completion_date);
        const status = normalizeStatus(svc.status);
        const svcRemarks = svc.remarks ?? null;

        await client.query(
          `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, actual_km, completion_date, status, remarks, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
           ON CONFLICT (vehicle_id, service_no) DO UPDATE SET
            due_km=EXCLUDED.due_km, due_date=EXCLUDED.due_date, actual_km=EXCLUDED.actual_km,
            completion_date=EXCLUDED.completion_date, status=EXCLUDED.status, remarks=EXCLUDED.remarks, updated_at=now()`,
          [
            vehicleId,
            service_no,
            due_km ?? null,
            due_date ?? null,
            actual_km,
            completion_date ?? null,
            status,
            svcRemarks,
            null,
          ]
        );
        if (actual_km != null) lastActualKm = actual_km;
      }

      if (lastActualKm > 0) {
        await client.query('UPDATE vehicles SET current_km = $1, updated_at = now() WHERE id = $2', [
          lastActualKm,
          vehicleId,
        ]);
      }
    }
    await client.query('COMMIT');
    console.log('Seeded', importedIds.length, 'vehicles. IDs:', importedIds.join(', '));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
