import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';
import {
  reqStr, optStr, optPhone, optDate, optEnum, reqId,
  collectErrors, parsePagination, sanitizeSearch, LEAD_TYPES,
} from '../utils/validate';

// Auto-add extra columns if not already present
let leadsColsReady = false;
async function ensureLeadsCols() {
  if (leadsColsReady) return;
  try {
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS location   TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_no_2 TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_by INT`);
  } catch { /* ignore */ }
  leadsColsReady = true;
}

export async function createLead(req: Request, res: Response) {
  try {
    await ensureLeadsCols();
    const userId = (req as any).user?.sub ?? null;
    const body   = req.body || {};

    const vName     = reqStr(body.cust_name, 200);
    const vBusiness = optStr(body.business, 200);
    const vPhone    = optPhone(body.phone_no);
    const vPhone2   = optPhone(body.phone_no_2);
    const vLeadType = optEnum(body.lead_type, LEAD_TYPES);
    const vNote     = optStr(body.note, 2000);
    const vLocation = optStr(body.location, 300);
    const vConnDate = optDate(body.connect_date);

    const fieldErr = collectErrors({
      cust_name: vName.error, business: vBusiness.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      lead_type: vLeadType.error, note: vNote.error,
      location: vLocation.error, connect_date: vConnDate.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    function generateCustCode() {
      const time = Date.now().toString(36).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000).toString();
      return `C-${time}-${rand}`;
    }
    const cust_code = generateCustCode();

    const r = await query(
      `INSERT INTO leads (cust_code, connect_date, cust_name, business, phone_no, phone_no_2, lead_type, note, location, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) RETURNING *`,
      [cust_code, vConnDate.value, vName.value, vBusiness.value, vPhone.value,
       vPhone2.value, vLeadType.value, vNote.value, vLocation.value, userId],
    );
    const newLead = (r as any).rows[0];
    await logActivity('lead', newLead.id, cust_code, 'create', userId, `Lead created: ${vName.value}`);
    res.status(201).json(newLead);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateLead(req: Request, res: Response) {
  try {
    await ensureLeadsCols();
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id      = vId.value;
    const userId  = (req as any).user?.sub ?? null;
    const body    = req.body || {};

    const vName     = reqStr(body.cust_name, 200);
    const vBusiness = optStr(body.business, 200);
    const vPhone    = optPhone(body.phone_no);
    const vPhone2   = optPhone(body.phone_no_2);
    const vLeadType = optEnum(body.lead_type, LEAD_TYPES);
    const vNote     = optStr(body.note, 2000);
    const vLocation = optStr(body.location, 300);
    const vConnDate = optDate(body.connect_date);

    const fieldErr = collectErrors({
      cust_name: vName.error, business: vBusiness.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      lead_type: vLeadType.error, note: vNote.error,
      location: vLocation.error, connect_date: vConnDate.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const existing = await query('SELECT id FROM leads WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'lead not found' });

    const r = await query(
      `UPDATE leads
      SET connect_date=$1, cust_name=$2, business=$3, phone_no=$4, phone_no_2=$5,
          lead_type=$6, note=$7, location=$8, updated_by=$9, updated_at=now()
       WHERE id=$10 RETURNING *`,
      [vConnDate.value, vName.value, vBusiness.value, vPhone.value,
       vPhone2.value, vLeadType.value, vNote.value, vLocation.value, userId, id],
    );
    const updated = (r as any).rows[0];
    await logActivity('lead', id, updated.cust_code || String(id), 'update', userId, `Lead updated: ${vName.value}`);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listLeads(req: Request, res: Response) {
  const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
  try {
    await ensureLeadsCols();
    const q     = sanitizeSearch(req.query.q);
    const start = optDate(req.query.startDate);
    const end   = optDate(req.query.endDate);
    if (start.error) return res.status(400).json({ error: `startDate: ${start.error}` });
    if (end.error)   return res.status(400).json({ error: `endDate: ${end.error}` });

    const where: string[] = [];
    const params: any[]   = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(l.cust_code ILIKE $${params.length} OR l.cust_name ILIKE $${params.length} OR l.phone_no ILIKE $${params.length} OR l.location ILIKE $${params.length})`);
    }
    if (start.value) { params.push(start.value); where.push(`l.connect_date >= $${params.length}`); }
    if (end.value)   { params.push(end.value);   where.push(`l.connect_date <= $${params.length}`); }

    let sql = `
      SELECT l.*,
            uc.name AS created_by_name,
            uu.name AS updated_by_name
      FROM leads l
      LEFT JOIN users uc ON uc.id = l.created_by
      LEFT JOIN users uu ON uu.id = l.updated_by
    `;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const r = await query(sql, params);
    res.json({ leads: (r as any).rows, limit, offset });
  } catch (e) {
    console.error('listLeads error:', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteLead(req: Request, res: Response) {
  try {
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;
    const requester = (req as any).user;
    const userId    = requester?.sub ?? null;

    const pre = await query('SELECT cust_code, cust_name FROM leads WHERE id=$1', [id]);
    if ((pre as any).rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    const row = (pre as any).rows[0];

    await query('DELETE FROM leads WHERE id=$1', [id]);
    await logActivity(
      'lead', id,
      row?.cust_code || String(id),
      'delete',
      userId,
      `Lead deleted: ${row?.cust_name || id}`,
    );
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportLeadsCSV(req: Request, res: Response) {
  try {
    await ensureLeadsCols();
    const r = await query(`
      SELECT l.id, l.cust_code, l.connect_date, l.cust_name, l.business,
            l.phone_no, l.phone_no_2, l.lead_type, l.location, l.note,
            uc.name AS created_by_name, l.created_at,
            uu.name AS updated_by_name, l.updated_at
      FROM leads l
      LEFT JOIN users uc ON uc.id = l.created_by
      LEFT JOIN users uu ON uu.id = l.updated_by
      ORDER BY l.created_at DESC
    `);
    const rows   = (r as any).rows;
    const header = ['id','cust_code','connect_date','cust_name','business','phone_no','phone_no_2','lead_type','location','note','created_by_name','created_at','updated_by_name','updated_at'];
    const csv    = [header.join(',')].concat(
      rows.map((row: any) => header.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')),
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}
