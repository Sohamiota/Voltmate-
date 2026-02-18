import { Request, Response } from 'express';
import { query } from '../db';

export async function createVisit(req: Request, res: Response) {
  try {
    console.log('createVisit body', req.body);
    const userId = (req as any).user?.sub;
    const {
      lead_id,
      vehicle,
      salesperson_id,
      status,
      visit_date,
      next_action,
      next_action_date,
      note
    } = req.body;

    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });

    // fetch lead to get cust_code
    const leadR = await query('SELECT id, cust_code FROM leads WHERE id=$1', [lead_id]);
    if (leadR.rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    const lead = leadR.rows[0];

    const r = await query(
      `INSERT INTO visits
        (lead_id, lead_cust_code, salesperson_id, vehicle, status, visit_date, next_action, next_action_date, note, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) RETURNING *`,
      [lead_id, lead.cust_code, salesperson_id || null, vehicle || null, status || null, visit_date || null, next_action || null, next_action_date || null, note || null, userId || null]
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error('createVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listVisits(req: Request, res: Response) {
  // pagination variables in function scope for fallback
  let limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000);
  let offset = parseInt((req.query.offset as string) || '0', 10);
  try {
    const r = await query(
      `SELECT v.*, l.cust_name, l.phone_no, u.name as salesperson_name
       FROM visits v
       LEFT JOIN leads l ON l.id = v.lead_id
       LEFT JOIN users u ON u.id = v.salesperson_id
       ORDER BY v.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ visits: (r as any).rows, limit, offset });
  } catch (e) {
    console.error('listVisits error:', (e as any));
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportVisitsCSV(req: Request, res: Response) {
  try {
    const r = await query(`SELECT v.id, v.lead_cust_code, l.cust_name, v.salesperson_id, u.name as salesperson_name,
      v.vehicle, v.status, v.visit_date, v.next_action, v.next_action_date, v.note, v.created_at
      FROM visits v
      LEFT JOIN leads l ON l.id = v.lead_id
      LEFT JOIN users u ON u.id = v.salesperson_id
      ORDER BY v.created_at DESC`);
    const rows = (r as any).rows;
    const header = ['id','lead_cust_code','cust_name','salesperson_id','salesperson_name','vehicle','status','visit_date','next_action','next_action_date','note','created_at'];
    const csv = [header.join(',')].concat(rows.map((row: any) => header.map(h => `"${(row[h]||'').toString().replace(/"/g,'""')}"`).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visits.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

