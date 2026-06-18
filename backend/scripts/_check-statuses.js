require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
p.query(
  `SELECT COALESCE(v.status, 'No Visit') AS status, COUNT(*)
   FROM leads l
   LEFT JOIN LATERAL (
     SELECT status FROM visits WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
   ) v ON true
   WHERE l.connect_date >= '2026-06-09' AND l.connect_date <= '2026-06-16'
   GROUP BY 1 ORDER BY count DESC`
).then(r => {
  r.rows.forEach(x => console.log(String(x.count).padStart(3), ' ', x.status));
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
