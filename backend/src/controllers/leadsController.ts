import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';
import {
  optPhone, optDate, optEnum, reqId, optBool,
  collectErrors, parseLeadsListQuery, sanitizeSearch, LEAD_TYPES,
  reqPlainText, optPlainText, MAX_CSV_EXPORT_ROWS,
} from '../utils/validate';
import { parseCrmDeferralBody } from '../utils/crmDeferral';

function canManageLeads(role: string | undefined): boolean {
  return role === 'admin' || role === 'sales_admin';
}

// Auto-add extra columns if not already present
let leadsColsReady = false;
async function ensureLeadsCols() {
  if (leadsColsReady) return;
  try {
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS location   TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_no_2 TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_by INT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deferral_bucket TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deferral_notes TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_after_date DATE`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS earliest_purchase_intent_date DATE`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_disposition TEXT`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS callback_requested_at TIMESTAMPTZ`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_promised_callback BOOLEAN NOT NULL DEFAULT false`);
  } catch { /* ignore */ }
  leadsColsReady = true;
}

export async function createLead(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!canManageLeads(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can create leads' });

    await ensureLeadsCols();
    const userId = requester?.sub ?? null;
    const body   = req.body || {};

    const vName     = reqPlainText(body.cust_name, 'name', 200);
    const vBusiness = optPlainText(body.business, 'note', 200);
    const vPhone    = optPhone(body.phone_no);
    const vPhone2   = optPhone(body.phone_no_2);
    const vLeadType = optEnum(body.lead_type, LEAD_TYPES);
    const vNote     = optPlainText(body.note, 'note', 2000);
    const vLocation = optPlainText(body.location, 'location', 300);
    const vConnDate = optDate(body.connect_date);
    const hotProvided = Object.prototype.hasOwnProperty.call(body, 'is_hot_lead');
    const vHot      = optBool(body.is_hot_lead);

    const fieldErr = collectErrors({
      cust_name: vName.error, business: vBusiness.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      lead_type: vLeadType.error, note: vNote.error,
      location: vLocation.error, connect_date: vConnDate.error,
      is_hot_lead: hotProvided ? vHot.error : null,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const crmParsed = parseCrmDeferralBody(body as Record<string, unknown>);
    if (crmParsed.error) return res.status(400).json({ error: crmParsed.error });
    const crm = crmParsed.parsed!;

    function generateCustCode() {
      const time = Date.now().toString(36).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000).toString();
      return `C-${time}-${rand}`;
    }
    const cust_code = generateCustCode();

    const r = await query(
      `INSERT INTO leads (cust_code, connect_date, cust_name, business, phone_no, phone_no_2, lead_type, note, location, is_hot_lead,
          deferral_bucket, deferral_notes, follow_up_after_date, earliest_purchase_intent_date,
          contact_disposition, callback_requested_at, customer_promised_callback,
          created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now()) RETURNING *`,
      [cust_code, vConnDate.value, vName.value, vBusiness.value, vPhone.value,
       vPhone2.value, vLeadType.value, vNote.value, vLocation.value,
       hotProvided ? vHot.value : false,
       crm.deferral_bucket, crm.deferral_notes, crm.follow_up_after_date, crm.earliest_purchase_intent_date,
       crm.contact_disposition, crm.callback_requested_at, crm.customer_promised_callback,
       userId],
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
    const requester = (req as any).user;
    if (!canManageLeads(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can update leads' });

    await ensureLeadsCols();
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id      = vId.value;
    const userId  = requester?.sub ?? null;
    const body    = req.body || {};

    const vName     = reqPlainText(body.cust_name, 'name', 200);
    const vBusiness = optPlainText(body.business, 'note', 200);
    const vPhone    = optPhone(body.phone_no);
    const vPhone2   = optPhone(body.phone_no_2);
    const vLeadType = optEnum(body.lead_type, LEAD_TYPES);
    const vNote     = optPlainText(body.note, 'note', 2000);
    const vLocation = optPlainText(body.location, 'location', 300);
    const vConnDate = optDate(body.connect_date);
    const hotProvided = Object.prototype.hasOwnProperty.call(body, 'is_hot_lead');
    const vHot      = optBool(body.is_hot_lead);

    const fieldErr = collectErrors({
      cust_name: vName.error, business: vBusiness.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      lead_type: vLeadType.error, note: vNote.error,
      location: vLocation.error, connect_date: vConnDate.error,
      is_hot_lead: hotProvided ? vHot.error : null,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const crmParsed = parseCrmDeferralBody(body as Record<string, unknown>);
    if (crmParsed.error) return res.status(400).json({ error: crmParsed.error });
    const crm = crmParsed.parsed!;

    const existing = await query('SELECT id FROM leads WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'lead not found' });

    const r = await query(
      `UPDATE leads
      SET connect_date=$1, cust_name=$2, business=$3, phone_no=$4, phone_no_2=$5,
          lead_type=$6, note=$7, location=$8,
          is_hot_lead = CASE WHEN $10::boolean THEN $11 ELSE is_hot_lead END,
          deferral_bucket=$12, deferral_notes=$13, follow_up_after_date=$14, earliest_purchase_intent_date=$15,
          contact_disposition=$16, callback_requested_at=$17, customer_promised_callback=$18,
          updated_by=$9, updated_at=now()
       WHERE id=$19 RETURNING *`,
      [vConnDate.value, vName.value, vBusiness.value, vPhone.value,
       vPhone2.value, vLeadType.value, vNote.value, vLocation.value, userId,
       hotProvided, hotProvided ? vHot.value : false,
       crm.deferral_bucket, crm.deferral_notes, crm.follow_up_after_date, crm.earliest_purchase_intent_date,
       crm.contact_disposition, crm.callback_requested_at, crm.customer_promised_callback,
       id],
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
  const { limit, offset, capped } = parseLeadsListQuery(req.query.limit, req.query.offset);
  try {
    await ensureLeadsCols();
    const q     = sanitizeSearch(req.query.q);
    const start = optDate(req.query.startDate);
    const end   = optDate(req.query.endDate);
    if (start.error) return res.status(400).json({ error: `startDate: ${start.error}` });
    if (end.error)   return res.status(400).json({ error: `endDate: ${end.error}` });

    const where: string[] = [];
    const params: unknown[]   = [];
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

    let countSql = `SELECT COUNT(*)::int AS total FROM leads l`;
    if (where.length) countSql += ` WHERE ${where.join(' AND ')}`;
    const countRes = await query(countSql, [...params]);
    const total = (countRes as any).rows[0]?.total ?? 0;

    sql += ' ORDER BY l.created_at DESC';
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const r = await query(sql, params);
    res.json({ leads: (r as any).rows, total, limit, offset, capped });
  } catch (e) {
    console.error('listLeads error:', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteLead(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!canManageLeads(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can delete leads' });

    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;
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
            l.is_hot_lead,
            l.deferral_bucket, l.deferral_notes, l.follow_up_after_date, l.earliest_purchase_intent_date,
            l.contact_disposition, l.callback_requested_at, l.customer_promised_callback,
            uc.name AS created_by_name, l.created_at,
            uu.name AS updated_by_name, l.updated_at
      FROM leads l
      LEFT JOIN users uc ON uc.id = l.created_by
      LEFT JOIN users uu ON uu.id = l.updated_by
      ORDER BY l.created_at DESC
      LIMIT $1
    `, [MAX_CSV_EXPORT_ROWS]);
    const rows   = (r as any).rows;
    const header = ['id','cust_code','connect_date','cust_name','business','phone_no','phone_no_2','lead_type','location','note','is_hot_lead','deferral_bucket','deferral_notes','follow_up_after_date','earliest_purchase_intent_date','contact_disposition','callback_requested_at','customer_promised_callback','created_by_name','created_at','updated_by_name','updated_at'];
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

