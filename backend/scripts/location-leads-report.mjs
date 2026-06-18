import 'dotenv/config';
import pg from 'pg';
import * as XLSX from 'xlsx';
import { resolve } from 'path';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
SELECT
  COALESCE(NULLIF(TRIM(l.location), ''), 'Not Specified')   AS "Location",
  COUNT(*)                                                    AS "Total Leads",
  COUNT(CASE WHEN v.status IN (
    'Booking Amount Received','Booking Date Confirmed',
    'Order Confirmed','Delivered (Closed – Won)',
    'Loan Processing','Delivery Scheduled'
  ) THEN 1 END)                                              AS "Converted / Booking",
  COUNT(CASE WHEN v.status ILIKE 'Lost%' OR v.status ILIKE 'Not Interested%' THEN 1 END)
                                                             AS "Lost / Not Interested",
  COUNT(CASE WHEN v.status IS NULL THEN 1 END)               AS "No Visit Yet",
  ROUND(
    COUNT(CASE WHEN v.status IN (
      'Booking Amount Received','Booking Date Confirmed',
      'Order Confirmed','Delivered (Closed – Won)',
      'Loan Processing','Delivery Scheduled'
    ) THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1
  )                                                          AS "Conversion %"
FROM leads l
LEFT JOIN LATERAL (
  SELECT status FROM visits
  WHERE lead_id = l.id
  ORDER BY created_at DESC
  LIMIT 1
) v ON true
WHERE l.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND l.created_at <  DATE_TRUNC('month', CURRENT_DATE)
GROUP BY COALESCE(NULLIF(TRIM(l.location), ''), 'Not Specified')
ORDER BY COUNT(*) DESC;
`;

async function run() {
  const client = await pool.connect();
  try {
    const prevDate   = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const prevMonth  = prevDate.toLocaleString('en-IN', { month: 'long' });
    const prevYear   = prevDate.getFullYear();

    console.log(`\nLocation-wise leads for ${prevMonth} ${prevYear}\n${'─'.repeat(70)}`);
    const result = await client.query(sql);
    const rows   = result.rows;

    if (rows.length === 0) {
      console.log('No leads found for last month.');
      process.exit(0);
    }

    // Print to console
    console.log(
      'Location'.padEnd(28),
      'Total'.padStart(6),
      'Converted'.padStart(10),
      'Lost'.padStart(6),
      'No Visit'.padStart(10),
      'Conv%'.padStart(7),
    );
    console.log('─'.repeat(70));
    rows.forEach(r => {
      console.log(
        String(r['Location']).padEnd(28),
        String(r['Total Leads']).padStart(6),
        String(r['Converted / Booking']).padStart(10),
        String(r['Lost / Not Interested']).padStart(6),
        String(r['No Visit Yet']).padStart(10),
        String(r['Conversion %'] ?? '0').padStart(7) + '%',
      );
    });
    const total = rows.reduce((s, r) => s + Number(r['Total Leads']), 0);
    console.log('─'.repeat(70));
    console.log(`${'TOTAL'.padEnd(28)}${String(total).padStart(6)}`);

    // Export to XLSX
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${prevMonth} ${prevYear} - By Location`);

    const filename = `Location_Leads_${prevMonth}_${prevYear}.xlsx`;
    const outPath  = resolve(process.cwd(), filename);
    XLSX.writeFile(wb, outPath);
    console.log(`\nXLSX saved → ${outPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
