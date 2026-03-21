import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres';

const isLocal =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

// ─── [H-3] Always verify the server TLS certificate in production ─────────────
// Set PGSSLROOTCERT to a CA bundle if connecting to a self-signed cert server.
// For managed providers (Supabase, Neon, RDS) the default CA store is sufficient.
export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: true },
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}
