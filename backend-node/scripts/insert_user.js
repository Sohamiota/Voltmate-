const { query } = require('../dist/db') || require('../src/db');
const bcrypt = require('bcrypt');

async function run() {
  const email = process.argv[2] || 'localtest@example.com';
  const password = process.argv[3] || 'pass123';
  const name = process.argv[4] || 'Local Test';
  const hash = await bcrypt.hash(password, 10);
  const sql = `INSERT INTO users (name,email,password_hash,is_verified,is_approved,role,created_at)
               VALUES ($1,$2,$3,true,true,'admin',now()) RETURNING id`;
  try {
    const r = await query(sql, [name, email, hash]);
    console.log('Inserted user id', r.rows[0].id);
    process.exit(0);
  } catch (e) {
    console.error('Insert failed', e);
    process.exit(1);
  }
}

run();

