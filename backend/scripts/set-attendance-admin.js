#!/usr/bin/env node
/**
 * Grants the attendance_admin role to an existing user.
 * Usage (from backend/):
 *   node scripts/set-attendance-admin.js
 * Or override target email:
 *   TARGET_EMAIL=someone@example.com node scripts/set-attendance-admin.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

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

const targetEmail = (process.env.TARGET_EMAIL || 'debu@gmail.com').toLowerCase();

async function run() {
  const check = await pool.query(
    'SELECT id, name, email, role, is_verified, is_approved FROM users WHERE lower(email) = $1',
    [targetEmail]
  );

  if (check.rowCount === 0) {
    console.error(`✗ No user found with email: ${targetEmail}`);
    console.error('  Make sure the user has registered first, or use add-user.js to create them.');
    await pool.end();
    process.exit(1);
  }

  const user = check.rows[0];
  console.log('Found user:', user);

  const result = await pool.query(
    `UPDATE users
     SET role = 'attendance_admin',
         is_verified = true,
         is_approved = true
     WHERE lower(email) = $1
     RETURNING id, name, email, role, is_verified, is_approved`,
    [targetEmail]
  );

  console.log('✓ Role updated:', result.rows[0]);
  console.log('  The user must log out and log back in for the new role to take effect.');
  await pool.end();
}

run().catch((err) => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});
