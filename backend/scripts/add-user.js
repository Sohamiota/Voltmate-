#!/usr/bin/env node
/**
 * Create or update a user directly in the database (verified + approved).
 * Usage (from backend/):
 *   node scripts/add-user.js
 * Or override with env:
 *   ADD_USER_EMAIL=... ADD_USER_PASSWORD=... ADD_USER_NAME="..." ADD_USER_ROLE=employee node scripts/add-user.js
 *
 * Allowed roles match adminChangeRole: admin, sales, service, employee
 * ("user" in requests maps to employee.)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL is not set. Add it to backend/.env');
  process.exit(1);
}

const isLocal =
  DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const email =
  (process.env.ADD_USER_EMAIL || 'rahulmandal713202@gmail.com').toLowerCase();
const password = process.env.ADD_USER_PASSWORD || 'Rahul@713202';
const name = process.env.ADD_USER_NAME || 'Rahul Mandal';
let role = (process.env.ADD_USER_ROLE || 'employee').toLowerCase();
if (role === 'user') role = 'employee';
const ALLOWED = ['admin', 'attendance_admin', 'sales_admin', 'sales', 'service', 'employee'];
if (!ALLOWED.includes(role)) {
  console.error(`✗ role must be one of: ${ALLOWED.join(', ')} (or "user" → employee)`);
  process.exit(1);
}

async function run() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name text,
      ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'employee',
      ADD COLUMN IF NOT EXISTS otp_code text,
      ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz
  `);

  const hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_verified, is_approved, role, created_at)
     VALUES ($1, $2, $3, true, true, $4, now())
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       is_verified = true,
       is_approved = true,
       role = EXCLUDED.role,
       otp_code = NULL,
       otp_expires_at = NULL
     RETURNING id, name, email, role, is_approved`,
    [name, email, hash, role]
  );

  console.log('✓ User upserted:', result.rows[0]);
  await pool.end();
}

run().catch((err) => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});
