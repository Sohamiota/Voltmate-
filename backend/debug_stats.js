const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@voltmate-db:5432/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

(async ()=> {
  try {
    const userId = 1;
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const startDate = first.toISOString().slice(0,10);
    const endDate = last.toISOString().slice(0,10);
    console.log('debug stats with', { DATABASE_URL, startDate, endDate, userId });
    const statsSql = `
      SELECT
        COALESCE(SUM(duration_seconds),0)::bigint AS total_seconds,
        COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0)::int AS pending_count,
        (SELECT COUNT(DISTINCT date) FROM attendance WHERE user_id=$1 AND date BETWEEN $2 AND $3) AS days_present
      FROM attendance
      WHERE user_id=$1 AND date BETWEEN $2 AND $3
    `;
    const r = await pool.query(statsSql, [userId, startDate, endDate]);
    console.log('rows', r.rows);
  } catch (e) {
    console.error('debug error', e);
  } finally {
    await pool.end();
  }
})();

