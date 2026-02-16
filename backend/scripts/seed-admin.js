#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  try {
    const email = process.env.SEED_ADMIN_EMAIL || 'localadmin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'AdminPass123';
    const name = process.env.SEED_ADMIN_NAME || 'Local Admin';
    const hash = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO users (name,email,password_hash,is_verified,is_approved,role,created_at)
                 VALUES ($1,$2,$3,true,true,'admin',now()) ON CONFLICT (email) DO NOTHING RETURNING id`;
    const r = await pool.query(sql, [name, email, hash]);
    if (r.rowCount > 0) {
      console.log('Inserted admin id', r.rows[0].id);
    } else {
      console.log('Admin already exists or insert skipped');
    }
  } catch (e) {
    console.error('Seed failed', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

