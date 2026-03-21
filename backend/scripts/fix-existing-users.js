#!/usr/bin/env node
/**
 * One-time migration: mark all users that predate the is_verified / is_approved
 * columns as verified and approved so they can still log in after the security
 * hardening update.
 *
 * Safe to run multiple times (UPDATE only touches rows that need it).
 *
 * Usage:
 *   node scripts/fix-existing-users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Ensure columns exist (no-op if already present)
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false
    `);

    // 2. Approve + verify every user that was created before the new flow
    //    (i.e. those whose is_verified or is_approved is still false/NULL)
    const r = await client.query(`
      UPDATE users
         SET is_verified = true,
             is_approved = true
       WHERE is_verified IS NOT TRUE
          OR is_approved IS NOT TRUE
      RETURNING id, email, role
    `);

    if (r.rowCount === 0) {
      console.log('No rows needed updating — all users already verified & approved.');
    } else {
      console.log(`Updated ${r.rowCount} user(s):`);
      r.rows.forEach(u => console.log(`  id=${u.id}  ${u.email}  (${u.role})`));
    }
    console.log('Done.');
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
