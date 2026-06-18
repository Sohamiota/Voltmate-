#!/usr/bin/env node
/**
 * Report: Leads connected between two dates whose demo has NOT been scheduled,
 * showing only active/follow-up stages (excludes Lost, Demo Scheduled and beyond).
 *
 * Usage:
 *   node scripts/demo-not-scheduled-report.js 2026-06-09 2026-06-16
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const FROM_DATE = process.argv[2] || '2026-06-09';
const TO_DATE   = process.argv[3] || '2026-06-16';

// Only include these pre-demo / follow-up stages (no lost, no demo-scheduled-or-beyond)
const INCLUDE_STATUSES = [
  'New Lead',
  'Attempted Contact',
  'Connected',
  'Requirement Identified',
  'Qualified Lead',
];

const placeholders = INCLUDE_STATUSES.map((_, i) => `$${i + 3}`).join(', ');

const sql = `
SELECT
  l.cust_code                                          AS "Cust Code",
  l.cust_name                                          AS "Customer Name",
  l.phone_no                                           AS "Phone",
  l.location                                           AS "Location",
  l.lead_type                                          AS "Lead Type",
  CASE WHEN l.is_hot_lead THEN 'Yes' ELSE 'No' END    AS "Hot Lead",
  TO_CHAR(l.connect_date, 'DD-Mon-YYYY')               AS "Connect Date",
  COALESCE(v.status, 'No Visit')                       AS "Current Status",
  v.next_action                                        AS "Next Action",
  TO_CHAR(v.next_action_date, 'DD-Mon-YYYY')           AS "Next Action Date",
  u_sales.name                                         AS "Salesperson",
  u_created.name                                       AS "Created By",
  TO_CHAR(l.created_at AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH24:MI') AS "Added At"
FROM leads l
LEFT JOIN LATERAL (
  SELECT status, next_action, next_action_date, salesperson_id
  FROM visits
  WHERE lead_id = l.id
  ORDER BY created_at DESC
  LIMIT 1
) v ON true
LEFT JOIN users u_sales   ON u_sales.id   = v.salesperson_id
LEFT JOIN users u_created ON u_created.id = l.created_by
WHERE l.connect_date >= $1::date
  AND l.connect_date <= $2::date
  AND (
    v.status IS NULL
    OR v.status IN (${placeholders})
  )
ORDER BY l.connect_date ASC, l.created_at ASC;
`;

function pad(str, len) {
  return String(str ?? '').slice(0, len).padEnd(len);
}

async function run() {
  const client = await pool.connect();
  try {
    const params = [FROM_DATE, TO_DATE, ...INCLUDE_STATUSES];
    const result = await client.query(sql, params);
    const rows = result.rows;

    const divider = '═'.repeat(130);
    const thin    = '─'.repeat(130);

    console.log('\n' + divider);
    console.log(` LEADS — DEMO NOT SCHEDULED (Active / Follow-Up Only)  |  ${FROM_DATE}  to  ${TO_DATE}`);
    console.log(divider);

    if (rows.length === 0) {
      console.log(' No leads found in active/follow-up stages for this date range.');
      console.log(divider);
      return;
    }

    console.log(
      pad('Cust Code', 14) +
      pad('Customer Name', 24) +
      pad('Phone', 14) +
      pad('Location', 22) +
      pad('Lead Type', 14) +
      pad('Hot', 5) +
      pad('Connect Date', 14) +
      pad('Current Status', 22) +
      pad('Salesperson', 18)
    );
    console.log(thin);

    for (const r of rows) {
      console.log(
        pad(r['Cust Code'],      14) +
        pad(r['Customer Name'],  24) +
        pad(r['Phone'],          14) +
        pad(r['Location'],       22) +
        pad(r['Lead Type'],      14) +
        pad(r['Hot Lead'],        5) +
        pad(r['Connect Date'],   14) +
        pad(r['Current Status'], 22) +
        pad(r['Salesperson'],    18)
      );
    }

    console.log(thin);
    console.log(` Total: ${rows.length} lead(s)`);
    console.log(divider);

    // Status breakdown
    const byStatus = {};
    for (const r of rows) {
      const s = r['Current Status'];
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    console.log('\n Status Breakdown:');
    for (const [s, c] of Object.entries(byStatus).sort((a,b) => b[1]-a[1])) {
      console.log(`   ${String(c).padStart(3)}  ${s}`);
    }

    // Salesperson breakdown
    const bySP = {};
    for (const r of rows) {
      const s = r['Salesperson'] || '(unassigned)';
      bySP[s] = (bySP[s] || 0) + 1;
    }
    console.log('\n Salesperson Breakdown:');
    for (const [s, c] of Object.entries(bySP).sort((a,b) => b[1]-a[1])) {
      console.log(`   ${String(c).padStart(3)}  ${s}`);
    }
    console.log('');

    // Save CSV
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const filename = `demo_not_scheduled_active_${FROM_DATE}_to_${TO_DATE}.csv`;
    const outPath  = path.resolve(process.cwd(), filename);
    fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
    console.log(`CSV saved to: ${outPath}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
