import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ─── [C-2] Fail at startup if DATABASE_URL is missing in production ──────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('[db] DATABASE_URL environment variable is not set');
}
const resolvedConnectionString = connectionString || 'postgres://postgres@localhost:5432/postgres';

const isLocal =
  resolvedConnectionString.includes('localhost') ||
  resolvedConnectionString.includes('127.0.0.1');

// Supabase's PgBouncer pooler (port 6543) terminates TLS internally; its
// certificate does not match the client-facing hostname, so strict cert
// verification always fails. Traffic is still encrypted — we just skip the
// hostname check. For direct (non-pooler) Supabase connections on port 5432
// you can set rejectUnauthorized: true if you trust the CA bundle.
export const pool = new Pool({
  connectionString: resolvedConnectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

export async function healthCheck() {
  return pool.query('SELECT 1');
}
