#!/usr/bin/env node
/**
 * Report: All active leads (New Lead + any follow-up stage, excluding Lost)
 * connected between two dates.
 *
 * Usage:
 *   node scripts/active-leads-report.js 2026-06-09 2026-06-16
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const FROM_DATE = process.argv[2] || '2026-06-09';
const TO_DATE   = process.argv[3] || '2026-06-16';

const sql = `
SELECT
  l.cust_code                                          AS "Cust Code",
  l.cust_name                                          AS "Customer Name",
  l.phone_no                                           AS "Phone",
  l.phone_no_2                                         AS "Phone 2",
  l.location                                           AS "Location",
  l.lead_type                                          AS "Lead Type",
  CASE WHEN l.is_hot_lead THEN 'Yes' ELSE 'No' END    AS "Hot Lead",
  TO_CHAR(l.connect_date, 'DD-Mon-YYYY')               AS "Connect Date",
  COALESCE(v.status, 'No Visit')                       AS "Current Status",
  v.next_action                                        AS "Next Action",
  TO_CHAR(v.next_action_date, 'DD-Mon-YYYY')           AS "Next Action Date",
  v.note                                               AS "Note",
  u_sales.name                                         AS "Salesperson",
  u_created.name                                       AS "Created By",
  TO_CHAR(l.created_at AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH24:MI') AS "Added At"
FROM leads l
LEFT JOIN LATERAL (
  SELECT status, next_action, next_action_date, salesperson_id, note
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
    OR (
      v.status NOT ILIKE 'Lost%'
      AND v.status NOT ILIKE 'Delivered%'
      AND v.status NOT IN ('Booking Amount Received', 'Order Confirmed', 'Delivery Scheduled', 'Loan Processing')
    )
  )
ORDER BY
  CASE COALESCE(v.status, 'No Visit')
    WHEN 'No Visit'            THEN 1
    WHEN 'New Lead'            THEN 2
    WHEN 'Attempted Contact'   THEN 3
    WHEN 'Connected'           THEN 4
    WHEN 'Requirement Identified' THEN 5
    WHEN 'Qualified Lead'      THEN 6
    WHEN 'Demo Scheduled'      THEN 7
    WHEN 'Demo Completed'      THEN 8
    WHEN 'Catalogue Shared'    THEN 9
    WHEN 'Quotation Shared'    THEN 10
    WHEN 'Demo Follow Up'      THEN 11
    WHEN 'Follow-Up 2'         THEN 12
    WHEN 'Negotiation'         THEN 13
    ELSE 14
  END,
  l.connect_date ASC;
`;

function pad(str, len) {
  return String(str ?? '').slice(0, len).padEnd(len);
}

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, [FROM_DATE, TO_DATE]);
    const rows   = result.rows;

    const D = '═'.repeat(140);
    const T = '─'.repeat(140);

    console.log('\n' + D);
    console.log(` ACTIVE LEADS — New Lead & Follow-Up Stages  |  ${FROM_DATE}  to  ${TO_DATE}`);
    console.log(D);

    if (rows.length === 0) {
      console.log(' No active leads found for this date range.');
      console.log(D + '\n');
      return;
    }

    // ── Status breakdown header ───────────────────────────────────────────────
    const byStatus = {};
    for (const r of rows) {
      const s = r['Current Status'];
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    console.log(' Stage Summary:');
    for (const [s, c] of Object.entries(byStatus)) {
      console.log(`   ${String(c).padStart(3)}  ${s}`);
    }
    console.log(T);

    // ── Column headers ────────────────────────────────────────────────────────
    console.log(
      '#'.padStart(3) + '  ' +
      pad('Cust Code',      16) +
      pad('Customer Name',  22) +
      pad('Phone',          13) +
      pad('Location',       22) +
      pad('Connect Date',   14) +
      pad('Current Status', 20) +
      pad('Next Action',    18) +
      pad('Next Action Dt', 15) +
      pad('Salesperson',    16)
    );
    console.log(T);

    rows.forEach((r, i) => {
      console.log(
        String(i + 1).padStart(3) + '  ' +
        pad(r['Cust Code'],      16) +
        pad(r['Customer Name'],  22) +
        pad(r['Phone'],          13) +
        pad(r['Location'],       22) +
        pad(r['Connect Date'],   14) +
        pad(r['Current Status'], 20) +
        pad(r['Next Action'],    18) +
        pad(r['Next Action Date'], 15) +
        pad(r['Salesperson'],    16)
      );
    });

    console.log(T);
    console.log(` Total: ${rows.length} active lead(s)`);
    console.log(D);

    // ── Salesperson breakdown ─────────────────────────────────────────────────
    const bySP = {};
    for (const r of rows) {
      const s = r['Salesperson'] || '(unassigned)';
      bySP[s] = (bySP[s] || 0) + 1;
    }
    console.log('\n Salesperson Breakdown:');
    for (const [s, c] of Object.entries(bySP).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(c).padStart(3)}  ${s}`);
    }
    console.log('');

    // ── Save CSV ──────────────────────────────────────────────────────────────
    const headers  = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const filename = `active_leads_${FROM_DATE}_to_${TO_DATE}.csv`;
    const outPath  = path.resolve(process.cwd(), filename);
    fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
    console.log(`CSV saved to: ${outPath}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
