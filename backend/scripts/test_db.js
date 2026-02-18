const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('No DATABASE_URL provided');
  process.exit(1);
}

(async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const r = await pool.query('SELECT now()');
    console.log('DB reachable, now=', r.rows[0]);
  } catch (e) {
    console.error('DB connection error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

