import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/postgres';

export const pool = new Pool({
  connectionString,
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

