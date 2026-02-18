#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function run() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    console.log('Running migrations:', files);
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      console.log('Applying', f);
      await pool.query(sql);
    }
    console.log('Migrations applied');
  } catch (e) {
    console.error('Migration failed', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

