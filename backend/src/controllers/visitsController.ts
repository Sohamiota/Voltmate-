import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';
import {
  reqId, optId, optStr, optPhone, optDate, optEnum,
  collectErrors, parsePagination, VISIT_STATUSES,
} from '../utils/validate';

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
    const body   = req.body || {};

    const vLeadId      = reqId(body.lead_id);
    const vSalesperson = optId(body.salesperson_id);
    const vVehicle     = optStr(body.vehicle, 200);
    const vStatus      = optEnum(body.status, VISIT_STATUSES);
    const vNextAction  = optEnum(body.next_action, VISIT_STATUSES);
    const vVisitDate   = optDate(body.visit_date);
    const vNextDate    = optDate(body.next_action_date);
    const vConnDate    = optDate(body.connect_date);
    const vNote        = optStr(body.note, 2000);
    const vPhone       = optPhone(body.phone_no);
    const vPhone2      = optPhone(body.phone_no_2);

    const fieldErr = collectErrors({
      lead_id: vLeadId.error, salesperson_id: vSalesperson.error,
      vehicle: vVehicle.error, status: vStatus.error, next_action: vNextAction.error,
      visit_date: vVisitDate.error, next_action_date: vNextDate.error,
      connect_date: vConnDate.error, note: vNote.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const leadR = await query('SELECT id, cust_code, lead_type, connect_date FROM leads WHERE id=$1', [vLeadId.value]);
    if (leadR.rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    const lead = leadR.rows[0] as { cust_code: string; lead_type?: string; connect_date?: string };
    const connect_date = vConnDate.value ?? lead.connect_date ?? null;

    const r = await query(
      `INSERT INTO visits
        (lead_id, lead_cust_code, lead_type, connect_date, salesperson_id, vehicle, status, visit_date,
         next_action, next_action_date, note, phone_no, phone_no_2,
         created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now()) RETURNING *`,
      [vLeadId.value, lead.cust_code, lead.lead_type || null, connect_date,
       vSalesperson.value, vVehicle.value, vStatus.value,
       vVisitDate.value, vNextAction.value, vNextDate.value, vNote.value,
       vPhone.value, vPhone2.value, userId],
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
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id      = vId.value;
    const userId  = (req as any).user?.sub ?? null;
    const body    = req.body || {};

    const vSalesperson = optId(body.salesperson_id);
    const vVehicle     = optStr(body.vehicle, 200);
    const vStatus      = optEnum(body.status, VISIT_STATUSES);
    const vNextAction  = optEnum(body.next_action, VISIT_STATUSES);
    const vVisitDate   = optDate(body.visit_date);
    const vNextDate    = optDate(body.next_action_date);
    const vConnDate    = optDate(body.connect_date);
    const vNote        = optStr(body.note, 2000);
    const vPhone       = optPhone(body.phone_no);
    const vPhone2      = optPhone(body.phone_no_2);

    const fieldErr = collectErrors({
      salesperson_id: vSalesperson.error, vehicle: vVehicle.error,
      status: vStatus.error, next_action: vNextAction.error,
      visit_date: vVisitDate.error, next_action_date: vNextDate.error,
      connect_date: vConnDate.error, note: vNote.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const existing = await query('SELECT id FROM visits WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'visit not found' });

    const r = await query(
      `UPDATE visits
       SET vehicle=$1, salesperson_id=$2, status=$3, visit_date=$4,
           next_action=$5, next_action_date=$6, note=$7,
           phone_no=$8, phone_no_2=$9, connect_date=$10, updated_by=$11, updated_at=now()
       WHERE id=$12 RETURNING *`,
      [vVehicle.value, vSalesperson.value, vStatus.value, vVisitDate.value,
       vNextAction.value, vNextDate.value, vNote.value,
       vPhone.value, vPhone2.value, vConnDate.value ?? null, userId, id],
    );
    const updated = (r as any).rows[0];
    await logActivity('visit', id, updated.lead_cust_code || String(id), 'update', userId, `Visit updated`);
    res.json(updated);
  } catch (e) {
    console.error('updateVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteVisit(req: Request, res: Response) {
  try {
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;
    const requester = (req as any).user;
    const userId    = requester?.sub ?? null;

    const existing = await query('SELECT lead_cust_code FROM visits WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'visit not found' });
    const row = (existing as any).rows[0];
    await query('DELETE FROM visits WHERE id = $1', [id]);
    await logActivity('visit', id, row?.lead_cust_code || String(id), 'delete', userId, 'Visit deleted');
    res.status(204).send();
  } catch (e) {
    console.error('deleteVisit error:', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listVisits(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
  try {
    await ensureVisitsCols();
    const r = await query(
      `SELECT v.id, v.lead_id, v.lead_cust_code, v.salesperson_id, v.vehicle, v.status,
              v.visit_date, v.next_action, v.next_action_date, v.note, v.phone_no, v.phone_no_2,
              v.created_by, v.created_at, v.updated_by, v.updated_at,
              COALESCE(v.lead_type, l.lead_type) AS lead_type,
              COALESCE(v.connect_date, l.connect_date) AS connect_date,
              l.cust_name,
              l.phone_no AS lead_phone_no,
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

// Visits visible in the "Visit Report" view (restricted statuses are hidden everywhere).
// Restricted statuses:
// - Lost (any): v.status LIKE 'Lost%'
// - Loan Processing
// - Booking Amount Received
// - Anything after booking: Order Confirmed, Delivery Scheduled, Delivered (Closed - Won)
export async function listVisibleVisits(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
  try {
    await ensureVisitsCols();
    const r = await query(
      `SELECT v.id, v.lead_id, v.lead_cust_code, v.salesperson_id, v.vehicle, v.status,
              v.visit_date, v.next_action, v.next_action_date, v.note, v.phone_no, v.phone_no_2,
              v.created_by, v.created_at, v.updated_by, v.updated_at,
              COALESCE(v.lead_type, l.lead_type) AS lead_type,
              COALESCE(v.connect_date, l.connect_date) AS connect_date,
              l.cust_name,
              l.phone_no AS lead_phone_no,
              u.name  AS salesperson_name,
              uc.name AS created_by_name,
              uu.name AS updated_by_name
       FROM visits v
       LEFT JOIN leads  l  ON l.id  = v.lead_id
       LEFT JOIN users  u  ON u.id  = v.salesperson_id
       LEFT JOIN users  uc ON uc.id = v.created_by
       LEFT JOIN users  uu ON uu.id = v.updated_by
       WHERE
         v.status IS NULL OR (
           v.status NOT ILIKE 'Lost%' AND
           v.status NOT ILIKE 'Loan Processing' AND
           v.status NOT ILIKE 'Booking Amount Received' AND
           v.status NOT ILIKE 'Order Confirmed' AND
           v.status NOT ILIKE 'Delivery Scheduled' AND
           v.status NOT ILIKE 'Delivered (Closed%'
         )
       ORDER BY v.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    res.json({ visits: (r as any).rows, limit, offset });
  } catch (e) {
    console.error('listVisibleVisits error:', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportVisitsCSV(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const r = await query(`
      SELECT v.id, v.lead_cust_code, COALESCE(v.lead_type, l.lead_type) AS lead_type,
             COALESCE(v.connect_date, l.connect_date) AS connect_date,
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

export async function exportVisibleVisitsCSV(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const r = await query(`
      SELECT v.id, v.lead_cust_code, COALESCE(v.lead_type, l.lead_type) AS lead_type,
             COALESCE(v.connect_date, l.connect_date) AS connect_date,
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
      WHERE
        v.status IS NULL OR (
          v.status NOT ILIKE 'Lost%' AND
          v.status NOT ILIKE 'Loan Processing' AND
          v.status NOT ILIKE 'Booking Amount Received' AND
          v.status NOT ILIKE 'Order Confirmed' AND
          v.status NOT ILIKE 'Delivery Scheduled' AND
          v.status NOT ILIKE 'Delivered (Closed%'
        )
      ORDER BY v.created_at DESC
    `);
    const rows   = (r as any).rows;
    const header = ['id','lead_cust_code','lead_type','connect_date','cust_name','phone_no','phone_no_2','salesperson_name','vehicle','status','visit_date','next_action','next_action_date','note','created_by_name','created_at','updated_by_name','updated_at'];
    const csv    = [header.join(',')].concat(
      rows.map((row: any) => header.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')),
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visible_visits.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}
