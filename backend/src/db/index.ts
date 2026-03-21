import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres';

const isLocal =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

// Supabase's PgBouncer pooler (port 6543) terminates TLS internally; its
// certificate does not match the client-facing hostname, so strict cert
// verification always fails. Traffic is still encrypted — we just skip the
// hostname check. For direct (non-pooler) Supabase connections on port 5432
// you can set rejectUnauthorized: true if you trust the CA bundle.
export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}
