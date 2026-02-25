/**
 * One-time script: clears all test data before going to production.
 * Deletes every row from leads, visits, tasks, task_edits, and attendance.
 * Users (employee accounts) are NOT touched.
 *
 * Run with:
 *   npx ts-node scripts/clear-test-data.ts
 *
 * Make sure DATABASE_URL is set in .env (or exported in your shell) before running.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres';

const isLocal =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Tables to wipe — ORDER matters (child tables first)
const TABLES = [
  'task_edits',
  'tasks',
  'attendance',
  'visits',
  'leads',
];

async function clearTestData() {
  const client = await pool.connect();
  try {
    console.log('Connecting to:', connectionString.replace(/:([^:@]+)@/, ':***@'));
    console.log('');

    await client.query('BEGIN');

    for (const table of TABLES) {
      try {
        const before = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count  = parseInt(before.rows[0].count, 10);
        await client.query(`DELETE FROM ${table}`);
        console.log(`✓  ${table.padEnd(15)} — deleted ${count} row(s)`);
      } catch (err: any) {
        // Table may not exist yet (auto-created on first use)
        if (err.code === '42P01') {
          console.log(`–  ${table.padEnd(15)} — table does not exist, skipping`);
        } else {
          throw err;
        }
      }
    }

    await client.query('COMMIT');
    console.log('');
    console.log('All test data cleared successfully.');
    console.log('User accounts have been kept intact.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearTestData();
