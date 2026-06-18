import 'dotenv/config';
import pg from 'pg';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
SELECT
  l.id                                AS "Lead ID",
  l.cust_code                         AS "Customer Code",
  l.cust_name                         AS "Customer Name",
  l.phone_no                          AS "Phone 1",
  l.phone_no_2                        AS "Phone 2",
  l.business                          AS "Business",
  l.location                          AS "Location",
  l.lead_type                         AS "Lead Type",
  l.connect_date                      AS "Connect Date",
  CASE WHEN l.is_hot_lead THEN 'Yes' ELSE 'No' END AS "Hot Lead",
  v.status                            AS "Current Status",
  v.vehicle                           AS "Vehicle",
  v.visit_date                        AS "Last Visit Date",
  v.next_action                       AS "Next Action",
  v.next_action_date                  AS "Next Action Date",
  v.lost_not_interested_reason        AS "Lost Reason",
  v.lost_reason_notes                 AS "Lost Notes",
  v.deferral_bucket                   AS "Deferral Bucket",
  v.note                              AS "Visit Note",
  u_sales.name                        AS "Salesperson",
  u_created.name                      AS "Created By",
  TO_CHAR(l.created_at, 'DD-Mon-YYYY HH24:MI') AS "Created At"
FROM leads l
LEFT JOIN LATERAL (
  SELECT * FROM visits
  WHERE lead_id = l.id
  ORDER BY created_at DESC
  LIMIT 1
) v ON true
LEFT JOIN users u_sales   ON u_sales.id   = v.salesperson_id
LEFT JOIN users u_created ON u_created.id = l.created_by
WHERE l.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND l.created_at <  DATE_TRUNC('month', CURRENT_DATE)
ORDER BY l.created_at DESC;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Fetching leads from last month...');
    const result = await client.query(sql);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log('No leads found for last month.');
      process.exit(0);
    }

    console.log(`Found ${rows.length} leads. Generating XLSX...`);

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads - Last Month');

    const now = new Date();
    const month = now.toLocaleString('en-IN', { month: 'long' });
    const year  = now.getFullYear();
    // Previous month label
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toLocaleString('en-IN', { month: 'long' });
    const prevYear  = prevDate.getFullYear();

    const filename = `Leads_${prevMonth}_${prevYear}.xlsx`;
    const outPath  = resolve(process.cwd(), filename);
    XLSX.writeFile(wb, outPath);

    console.log(`\nDone! File saved to:\n  ${outPath}`);
    console.log(`Total leads exported: ${rows.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
