require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const ips = await pool.query(`
    SELECT clock_in_ip,
           COUNT(*)::int AS attempts,
           COUNT(DISTINCT user_id)::int AS users,
           MIN(clock_in_at) AS first_seen,
           MAX(clock_in_at) AS last_seen,
           SUM(CASE WHEN network_verified THEN 1 ELSE 0 END)::int AS verified,
           SUM(CASE WHEN NOT network_verified THEN 1 ELSE 0 END)::int AS off_network
    FROM attendance
    WHERE clock_in_ip IS NOT NULL AND clock_in_ip <> ''
    GROUP BY clock_in_ip
    ORDER BY attempts DESC
    LIMIT 30
  `);
  console.log('=== Clock-in IPs (attendance attempts) ===');
  console.table(ips.rows);

  const allowed = await pool.query(
    'SELECT id, label, ip_cidr, is_active, created_at FROM allowed_networks ORDER BY created_at',
  );
  console.log('\n=== Allowed networks (whitelist) ===');
  console.table(allowed.rows);

  const recent = await pool.query(`
    SELECT a.id, u.name, u.email, a.date, a.clock_in_at, a.clock_in_ip,
           a.network_verified, a.status
    FROM attendance a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.clock_in_ip IS NOT NULL
    ORDER BY a.clock_in_at DESC
    LIMIT 25
  `);
  console.log('\n=== Recent attendance with IPs ===');
  console.table(recent.rows);
}

main()
  .catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
