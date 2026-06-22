require('dotenv').config();
const { Pool } = require('pg');
const IPCIDR = require('ip-cidr').default;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const officeIp = '103.217.243.151';
  const newCidr = '103.217.243.0/24';

  console.log('103.217.243.151 in new range:', new IPCIDR(newCidr).contains(officeIp));
  console.log('103.217.243.151 in OLD range:', new IPCIDR('103.252.165.0/24').contains(officeIp));

  const exists = await pool.query('SELECT id FROM allowed_networks WHERE ip_cidr = $1', [newCidr]);
  if (exists.rowCount > 0) {
    await pool.query('UPDATE allowed_networks SET is_active = true, label = $2 WHERE ip_cidr = $1', [
      newCidr,
      'VOLT WHEELS Office (new ISP)',
    ]);
    console.log('Updated existing rule for', newCidr);
  } else {
    const r = await pool.query(
      'INSERT INTO allowed_networks (label, ip_cidr) VALUES ($1, $2) RETURNING *',
      ['VOLT WHEELS Office (new ISP)', newCidr],
    );
    console.log('Added:', r.rows[0]);
  }

  const all = await pool.query('SELECT id, label, ip_cidr, is_active FROM allowed_networks ORDER BY id');
  console.log('\n=== Allowed networks now ===');
  console.table(all.rows);
}

main()
  .catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
