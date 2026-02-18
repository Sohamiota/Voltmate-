const {Pool} = require('pg');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const pool = new Pool({ connectionString: 'postgres://postgres:postgres@172.17.0.2:5432/postgres' });
    const r = await pool.query("SELECT password_hash FROM users WHERE email=$1", ['localadmin@example.com']);
    console.log('rows:', r.rows);
    if (r.rowCount > 0) {
      const ok = await bcrypt.compare('AdminPass123', r.rows[0].password_hash);
      console.log('match', ok);
    } else {
      console.log('no user found');
    }
    await pool.end();
  } catch (e) {
    console.error('error', e);
    process.exit(1);
  }
})();