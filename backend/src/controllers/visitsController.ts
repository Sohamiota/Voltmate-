import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';

// Auto-add phone + audit columns to visits table if not present
let visitsColsReady = false;
async function ensureVisitsCols() {
  if (visitsColsReady) return;
  try {
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS phone_no     TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS phone_no_2   TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_by   INT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS lead_type    TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS connect_date DATE`);
  } catch { /* ignore */ }
  visitsColsReady = true;
}

export async function createVisit(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const userId = (req as any).user?.sub ?? null;
    const {
      lead_id, vehicle, salesperson_id, status,
      visit_date, next_action, next_action_date, note,
      phone_no, phone_no_2, connect_date: body_connect_date,
    } = req.body;

    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });

    const leadR = await query('SELECT id, cust_code, lead_type, connect_date FROM leads WHERE id=$1', [lead_id]);
    if (leadR.rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    const lead = leadR.rows[0] as { cust_code: string; lead_type?: string; connect_date?: string };
    const connect_date = body_connect_date != null ? body_connect_date : (lead.connect_date || null);

    const r = await query(
      `INSERT INTO visits
        (lead_id, lead_cust_code, lead_type, connect_date, salesperson_id, vehicle, status, visit_date,
         next_action, next_action_date, note, phone_no, phone_no_2,
         created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now()) RETURNING *`,
      [lead_id, lead.cust_code, lead.lead_type || null, connect_date, salesperson_id || null, vehicle || null, status || null,
       visit_date || null, next_action || null, next_action_date || null, note || null,
       phone_no || null, phone_no_2 || null, userId],
    );
    const newVisit = (r as any).rows[0];
    await logActivity('visit', newVisit.id, lead.cust_code, 'create', userId, `Visit created for ${lead.cust_code}`);
    res.status(201).json(newVisit);
  } catch (e) {
    console.error('createVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateVisit(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const id     = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const userId = (req as any).user?.sub ?? null;
    const { vehicle, salesperson_id, status, visit_date, next_action, next_action_date, note, phone_no, phone_no_2, connect_date } = req.body;
    const r = await query(
      `UPDATE visits
       SET vehicle=$1, salesperson_id=$2, status=$3, visit_date=$4,
           next_action=$5, next_action_date=$6, note=$7,
           phone_no=$8, phone_no_2=$9, connect_date=$10, updated_by=$11, updated_at=now()
       WHERE id=$12 RETURNING *`,
      [vehicle || null, salesperson_id || null, status || null, visit_date || null,
       next_action || null, next_action_date || null, note || null,
       phone_no || null, phone_no_2 || null, connect_date ?? null, userId, id],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'visit not found' });
    const updated = (r as any).rows[0];
    await logActivity('visit', id, updated.lead_cust_code || String(id), 'update', userId, `Visit updated`);
    res.json(updated);
  } catch (e) {
    console.error('updateVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listVisits(req: Request, res: Response) {
  const limit  = Math.min(parseInt((req.query.limit  as string) || '100', 10), 1000);
  const offset = parseInt((req.query.offset as string) || '0', 10);
  try {
    await ensureVisitsCols();
    const r = await query(
      `SELECT v.*,
              l.cust_name,
              l.phone_no AS lead_phone_no,
              COALESCE(v.lead_type, l.lead_type) AS lead_type,
              u.name  AS salesperson_name,
              uc.name AS created_by_name,
              uu.name AS updated_by_name
       FROM visits v
       LEFT JOIN leads  l  ON l.id  = v.lead_id
       LEFT JOIN users  u  ON u.id  = v.salesperson_id
       LEFT JOIN users  uc ON uc.id = v.created_by
       LEFT JOIN users  uu ON uu.id = v.updated_by
       ORDER BY v.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    res.json({ visits: (r as any).rows, limit, offset });
  } catch (e) {
    console.error('listVisits error:', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportVisitsCSV(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const r = await query(`
      SELECT v.id, v.lead_cust_code, COALESCE(v.lead_type, l.lead_type) AS lead_type,
             v.connect_date,
             l.cust_name, v.phone_no, v.phone_no_2,
             u.name  AS salesperson_name,
             v.vehicle, v.status, v.visit_date,
             v.next_action, v.next_action_date, v.note,
             uc.name AS created_by_name, v.created_at,
             uu.name AS updated_by_name, v.updated_at
      FROM visits v
      LEFT JOIN leads l  ON l.id  = v.lead_id
      LEFT JOIN users u  ON u.id  = v.salesperson_id
      LEFT JOIN users uc ON uc.id = v.created_by
      LEFT JOIN users uu ON uu.id = v.updated_by
      ORDER BY v.created_at DESC
    `);
    const rows   = (r as any).rows;
    const header = ['id','lead_cust_code','lead_type','connect_date','cust_name','phone_no','phone_no_2','salesperson_name','vehicle','status','visit_date','next_action','next_action_date','note','created_by_name','created_at','updated_by_name','updated_at'];
    const csv    = [header.join(',')].concat(
      rows.map((row: any) => header.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')),
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visits.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}
