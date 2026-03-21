#!/usr/bin/env node
/**
 * Delete users by email. Clears FK references so DELETE succeeds.
 *
 * Usage:
 *   node scripts/delete-users-by-email.js
 *   node scripts/delete-users-by-email.js user1@x.com user2@y.com
 *
 * Requires DATABASE_URL in .env (same as seed-admin.js).
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

const DEFAULT_EMAILS = ['22051987@kiit.ac.in', 'bsohambiswas101@gmail.com'];

async function safeQuery(client, text, params) {
  try {
    await client.query(text, params);
  } catch (e) {
    if (e.code === '42P01') {
      // undefined_table — optional tables
      return;
    }
    throw e;
  }
}

async function deleteUserByEmail(client, email) {
  const trimmed = String(email).trim().toLowerCase();
  const r = await client.query('SELECT id, name, email, role FROM users WHERE lower(email) = $1', [
    trimmed,
  ]);
  if (r.rowCount === 0) {
    console.log('Not found (skipped):', email);
    return;
  }
  const row = r.rows[0];
  const id = row.id;
  console.log('Removing user id=%s name=%s email=%s role=%s', id, row.name, row.email, row.role);

  await client.query('UPDATE visits SET salesperson_id = NULL WHERE salesperson_id = $1', [id]);
  await client.query('UPDATE visits SET created_by = NULL WHERE created_by = $1', [id]);
  await safeQuery(client, 'UPDATE visits SET updated_by = NULL WHERE updated_by = $1', [id]);

  await client.query('UPDATE leads SET created_by = NULL WHERE created_by = $1', [id]);
  await safeQuery(client, 'UPDATE leads SET updated_by = NULL WHERE updated_by = $1', [id]);

  await safeQuery(client, 'UPDATE tasks SET approved_by = NULL WHERE approved_by = $1', [id]);
  await safeQuery(client, 'UPDATE task_edits SET edited_by = NULL WHERE edited_by = $1', [id]);

  await safeQuery(client, 'UPDATE attendance SET approved_by = NULL WHERE approved_by = $1', [id]);

  const del = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
  if (del.rowCount === 0) {
    console.error('DELETE failed for id', id);
  } else {
    console.log('Deleted:', del.rows[0].email);
  }
}

async function run() {
  const emails = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_EMAILS;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const email of emails) {
      await deleteUserByEmail(client, email);
    }
    await client.query('COMMIT');
    console.log('Done.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message || e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
