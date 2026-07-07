import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';
import { ensureLocationPingCols } from './locationController';
import {
  reqId, optId, optStr, optPhone, optDate, optEnum, optBool,
  collectErrors, parsePagination, VISIT_STATUSES,
  MAX_CSV_EXPORT_ROWS,
  LOST_NOT_INTEREST_REASONS, LOST_NOT_INTERESTED_STATUS,
} from '../utils/validate';
import { parseCrmDeferralBody, ParsedCrmDeferral } from '../utils/crmDeferral';

function canManageVisits(role: string | undefined): boolean {
  return role === 'admin' || role === 'sales_admin';
}

/** Pipeline stages shown in Visit Report when `include_lost` is off */
const VISIT_REPORT_PIPELINE_ONLY = [
  'New Lead',
  'Attempted Contact',
  'Connected',
  'Requirement Identified',
  'Qualified Lead',
  'Demo Scheduled',
  'Demo Completed',
  'Quotation Shared',
  'Catalogue Shared',
  'Demo Follow Up',
  'Follow-Up 2',
  'Negotiation',
  'Booking Date Confirmed',
] as const;

const VISIT_REPORT_LOST_CLOSED_EXTRA = [
  'Lost \u2013 Price Issue',
  'Lost \u2013 Competitor',
  'Lost \u2013 No Response',
  'Lost \u2013 Not Interested',
  'Loan Processing',
  'Booking Amount Received',
  'Order Confirmed',
  'Delivery Scheduled',
  'Delivered (Closed \u2013 Won)',
] as const;

function sqlQuoteStatusList(items: readonly string[]): string {
  return items.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ');
}

function parseIncludeLost(raw: unknown): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function parseVisitDateParam(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function visitReportWhereSql(includeLost: boolean): string {
  const pipeline = sqlQuoteStatusList(VISIT_REPORT_PIPELINE_ONLY);
  const extended = sqlQuoteStatusList([...VISIT_REPORT_PIPELINE_ONLY, ...VISIT_REPORT_LOST_CLOSED_EXTRA]);
  if (includeLost) return `(v.status IS NULL OR v.status IN (${extended}))`;
  return `(v.status IS NULL OR v.status IN (${pipeline}))
          AND (v.next_action IS NULL OR v.next_action NOT ILIKE 'Lost%')`;
}

/** Validate/store Lost–NI fields; clears disposition when status moves away */
function lostNiDispositionFromBody(body: Record<string, unknown>, status: string | null) {
  if (status !== LOST_NOT_INTERESTED_STATUS) {
    return { error: null as string | null, reason: null as string | null, notes: null as string | null };
  }
  const vLostReason = optEnum(body.lost_not_interested_reason, LOST_NOT_INTEREST_REASONS);
  const vLostNotes = optStr(body.lost_reason_notes, 2000);
  const reasonErr =
    vLostReason.error ?? (!vLostReason.value ? 'required when status is Lost – Not Interested' : null);
  let notesErr = vLostNotes.error;
  if (vLostReason.value === 'other' && !(vLostNotes.value && vLostNotes.value.trim()))
    notesErr = 'required when reason is other';
  const fieldErr = collectErrors({
    lost_not_interested_reason: reasonErr,
    lost_reason_notes: notesErr,
  });
  return {
    error: fieldErr,
    reason: vLostReason.value as string | null,
    notes: vLostNotes.value,
  };
}

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
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS lost_not_interested_reason TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS lost_reason_notes TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS deferral_bucket TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS deferral_notes TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS follow_up_after_date DATE`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS earliest_purchase_intent_date DATE`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS contact_disposition TEXT`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS callback_requested_at TIMESTAMPTZ`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS customer_promised_callback BOOLEAN NOT NULL DEFAULT false`);
    await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN NOT NULL DEFAULT false`);
  } catch { /* ignore */ }
  visitsColsReady = true;
  try {
    await ensureLocationPingCols();
  } catch { /* ignore */ }
}

async function syncLeadCrmRollupFromVisit(leadId: number | null, crm: ParsedCrmDeferral) {
  if (!leadId) return;
  await query(
    `UPDATE leads SET
       deferral_bucket = $1,
       deferral_notes = $2,
       follow_up_after_date = $3,
       earliest_purchase_intent_date = $4,
       contact_disposition = $5,
       callback_requested_at = $6,
       customer_promised_callback = $7,
       updated_at = now()
     WHERE id = $8`,
    [
      crm.deferral_bucket,
      crm.deferral_notes,
      crm.follow_up_after_date,
      crm.earliest_purchase_intent_date,
      crm.contact_disposition,
      crm.callback_requested_at,
      crm.customer_promised_callback,
      leadId,
    ],
  );
}

/** Inline SELECT columns for CRM deferral fields */
const VISIT_CRM_SQL = `
              v.deferral_bucket, v.deferral_notes, v.follow_up_after_date, v.earliest_purchase_intent_date,
              v.contact_disposition, v.callback_requested_at, v.customer_promised_callback`;

const VISIT_CSV_CRM_KEYS = [
  'deferral_bucket',
  'deferral_notes',
  'follow_up_after_date',
  'earliest_purchase_intent_date',
  'contact_disposition',
  'callback_requested_at',
  'customer_promised_callback',
] as const;

const VISIT_CSV_HEADER = ['id','lead_cust_code','lead_type','connect_date','cust_name','lead_location','phone_no','phone_no_2','salesperson_name','vehicle','status','visit_date','next_action','next_action_date','note','lost_not_interested_reason','lost_reason_notes',...VISIT_CSV_CRM_KEYS,'is_hot_lead','is_walk_in','visit_location_captured_at','created_by_name','created_at','updated_by_name','updated_at'];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function sendVisitCsv(res: Response, rows: Record<string, unknown>[], filename: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(VISIT_CSV_HEADER.join(',') + '\n');
  for (const row of rows) {
    res.write(VISIT_CSV_HEADER.map(h => csvCell(row[h])).join(',') + '\n');
  }
  res.end();
}

export async function createVisit(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!canManageVisits(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can create visits' });

    await ensureVisitsCols();
    const userId = requester?.sub ?? null;
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

    const hotProvided = Object.prototype.hasOwnProperty.call(body, 'is_hot_lead');
    const vHot        = optBool(body.is_hot_lead);
    const vWalkIn     = optBool(body.is_walk_in);

    const fieldErr = collectErrors({
      lead_id: vLeadId.error, salesperson_id: vSalesperson.error,
      vehicle: vVehicle.error, status: vStatus.error, next_action: vNextAction.error,
      visit_date: vVisitDate.error, next_action_date: vNextDate.error,
      connect_date: vConnDate.error, note: vNote.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      is_hot_lead: hotProvided ? vHot.error : null,
      is_walk_in: vWalkIn.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const lostNi = lostNiDispositionFromBody(body as Record<string, unknown>, vStatus.value);
    if (lostNi.error) return res.status(400).json({ error: lostNi.error });

    const crmParsed = parseCrmDeferralBody(body as Record<string, unknown>);
    if (crmParsed.error) return res.status(400).json({ error: crmParsed.error });
    const crm = crmParsed.parsed!;

    const leadR = await query('SELECT id, cust_code, lead_type, connect_date FROM leads WHERE id=$1', [vLeadId.value]);
    if (leadR.rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    const lead = leadR.rows[0] as { cust_code: string; lead_type?: string; connect_date?: string };
    const connect_date = vConnDate.value ?? lead.connect_date ?? null;

    const r = await query(
      `INSERT INTO visits
        (lead_id, lead_cust_code, lead_type, connect_date, salesperson_id, vehicle, status, visit_date,
         next_action, next_action_date, note, phone_no, phone_no_2,
         lost_not_interested_reason, lost_reason_notes,
         deferral_bucket, deferral_notes, follow_up_after_date, earliest_purchase_intent_date,
         contact_disposition, callback_requested_at, customer_promised_callback, is_walk_in,
         created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,now(),now()) RETURNING *`,
      [
        vLeadId.value, lead.cust_code, lead.lead_type || null, connect_date,
        vSalesperson.value, vVehicle.value, vStatus.value,
        vVisitDate.value, vNextAction.value, vNextDate.value, vNote.value,
        vPhone.value, vPhone2.value, lostNi.reason, lostNi.notes,
        crm.deferral_bucket, crm.deferral_notes, crm.follow_up_after_date, crm.earliest_purchase_intent_date,
        crm.contact_disposition, crm.callback_requested_at, crm.customer_promised_callback,
        vWalkIn.value,
        userId,
      ],
    );
    const newVisit = (r as any).rows[0];
    if (hotProvided && !vHot.error) {
      await query('UPDATE leads SET is_hot_lead=$1 WHERE id=$2', [vHot.value, vLeadId.value]);
    }
    await syncLeadCrmRollupFromVisit(vLeadId.value, crm);
    await logActivity('visit', newVisit.id, lead.cust_code, 'create', userId, `Visit created for ${lead.cust_code}`);
    res.status(201).json(newVisit);
  } catch (e) {
    console.error('createVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateVisit(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!canManageVisits(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can update visits' });

    await ensureVisitsCols();
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id      = vId.value;
    const userId  = requester?.sub ?? null;
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

    const hotProvided = Object.prototype.hasOwnProperty.call(body, 'is_hot_lead');
    const vHot        = optBool(body.is_hot_lead);
    const vWalkIn     = optBool(body.is_walk_in);

    const fieldErr = collectErrors({
      salesperson_id: vSalesperson.error, vehicle: vVehicle.error,
      status: vStatus.error, next_action: vNextAction.error,
      visit_date: vVisitDate.error, next_action_date: vNextDate.error,
      connect_date: vConnDate.error, note: vNote.error,
      phone_no: vPhone.error, phone_no_2: vPhone2.error,
      is_hot_lead: hotProvided ? vHot.error : null,
      is_walk_in: vWalkIn.error,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const lostNi = lostNiDispositionFromBody(body as Record<string, unknown>, vStatus.value);
    if (lostNi.error) return res.status(400).json({ error: lostNi.error });

    const crmParsed = parseCrmDeferralBody(body as Record<string, unknown>);
    if (crmParsed.error) return res.status(400).json({ error: crmParsed.error });
    const crm = crmParsed.parsed!;

    const existing = await query('SELECT id, lead_id FROM visits WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'visit not found' });
    const leadId = (existing as any).rows[0]?.lead_id as number | null;

    const r = await query(
      `UPDATE visits
       SET vehicle=$1, salesperson_id=$2, status=$3, visit_date=$4,
           next_action=$5, next_action_date=$6, note=$7,
           phone_no=$8, phone_no_2=$9, connect_date=$10,
           lost_not_interested_reason=$11, lost_reason_notes=$12,
           deferral_bucket=$13, deferral_notes=$14, follow_up_after_date=$15, earliest_purchase_intent_date=$16,
           contact_disposition=$17, callback_requested_at=$18, customer_promised_callback=$19,
           is_walk_in=$20,
           updated_by=$21, updated_at=now()
       WHERE id=$22 RETURNING *`,
      [
        vVehicle.value, vSalesperson.value, vStatus.value, vVisitDate.value,
        vNextAction.value, vNextDate.value, vNote.value,
        vPhone.value, vPhone2.value, vConnDate.value ?? null,
        lostNi.reason, lostNi.notes,
        crm.deferral_bucket, crm.deferral_notes, crm.follow_up_after_date, crm.earliest_purchase_intent_date,
        crm.contact_disposition, crm.callback_requested_at, crm.customer_promised_callback,
        vWalkIn.value,
        userId, id,
      ],
    );
    const updated = (r as any).rows[0];
    if (hotProvided && leadId != null && !vHot.error) {
      await query('UPDATE leads SET is_hot_lead=$1 WHERE id=$2', [vHot.value, leadId]);
    }
    await syncLeadCrmRollupFromVisit(leadId, crm);
    await logActivity('visit', id, updated.lead_cust_code || String(id), 'update', userId, `Visit updated`);
    res.json(updated);
  } catch (e) {
    console.error('updateVisit error', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteVisit(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!canManageVisits(requester?.role))
      return res.status(403).json({ error: 'Forbidden: only admin and sales_admin can delete visits' });

    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;
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

    // Optional date filter: ?visit_date_from=YYYY-MM-DD restricts to visits on or after that date.
    // Used by the dashboard to fetch only the last 30 days instead of all-time data.
    const rawFrom = req.query.visit_date_from;
    const visitDateFrom = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(String(rawFrom))
      ? String(rawFrom) : null;

    const params: (string | number)[] = visitDateFrom
      ? [visitDateFrom, limit, offset]
      : [limit, offset];

    const dateClause = visitDateFrom
      ? `WHERE v.visit_date >= $1`
      : '';

    const limitPlaceholder  = visitDateFrom ? '$2' : '$1';
    const offsetPlaceholder = visitDateFrom ? '$3' : '$2';

    const r = await query(
      `SELECT v.id, v.lead_id, v.lead_cust_code, v.salesperson_id, v.vehicle, v.status,
              v.visit_date, v.next_action, v.next_action_date, v.note, v.phone_no, v.phone_no_2,
              v.lost_not_interested_reason, v.lost_reason_notes,
${VISIT_CRM_SQL},
              v.created_by, v.created_at, v.updated_by, v.updated_at,
              COALESCE(v.lead_type, l.lead_type) AS lead_type,
              COALESCE(v.connect_date, l.connect_date) AS connect_date,
              l.cust_name,
              l.location AS lead_location,
              l.phone_no AS lead_phone_no,
              COALESCE(l.is_hot_lead, false) AS is_hot_lead,
              COALESCE(v.is_walk_in, false) AS is_walk_in,
              u.name  AS salesperson_name,
              uc.name AS created_by_name,
              uu.name AS updated_by_name,
              (SELECT MAX(lp.pinged_at) FROM location_pings lp WHERE lp.visit_id = v.id) AS visit_location_captured_at
       FROM visits v
       LEFT JOIN leads  l  ON l.id  = v.lead_id
       LEFT JOIN users  u  ON u.id  = v.salesperson_id
       LEFT JOIN users  uc ON uc.id = v.created_by
       LEFT JOIN users  uu ON uu.id = v.updated_by
       ${dateClause}
       ORDER BY v.created_at DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      params,
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
  const includeLost = parseIncludeLost(req.query.include_lost);
  const visitDateFrom = parseVisitDateParam(req.query.visit_date_from);
  const visitDateTo = parseVisitDateParam(req.query.visit_date_to);
  try {
    await ensureVisitsCols();
    const whereParts = [visitReportWhereSql(includeLost)];
    const params: (string | number)[] = [];
    if (visitDateFrom) {
      params.push(visitDateFrom);
      whereParts.push(`v.visit_date >= $${params.length}`);
    }
    if (visitDateTo) {
      params.push(visitDateTo);
      whereParts.push(`v.visit_date <= $${params.length}`);
    }
    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;
    const whereExtra = whereParts.join(' AND ');
    const r = await query(
      `SELECT v.id, v.lead_id, v.lead_cust_code, v.salesperson_id, v.vehicle, v.status,
              v.visit_date, v.next_action, v.next_action_date, v.note, v.phone_no, v.phone_no_2,
              v.lost_not_interested_reason, v.lost_reason_notes,
${VISIT_CRM_SQL},
              v.created_by, v.created_at, v.updated_by, v.updated_at,
              COALESCE(v.lead_type, l.lead_type) AS lead_type,
              COALESCE(v.connect_date, l.connect_date) AS connect_date,
              l.cust_name,
              l.location AS lead_location,
              l.phone_no AS lead_phone_no,
              COALESCE(l.is_hot_lead, false) AS is_hot_lead,
              COALESCE(v.is_walk_in, false) AS is_walk_in,
              u.name  AS salesperson_name,
              uc.name AS created_by_name,
              uu.name AS updated_by_name,
              (SELECT MAX(lp.pinged_at) FROM location_pings lp WHERE lp.visit_id = v.id) AS visit_location_captured_at
       FROM visits v
       LEFT JOIN leads  l  ON l.id  = v.lead_id
       LEFT JOIN users  u  ON u.id  = v.salesperson_id
       LEFT JOIN users  uc ON uc.id = v.created_by
       LEFT JOIN users  uu ON uu.id = v.updated_by
       WHERE ${whereExtra}
       ORDER BY v.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    res.json({
      visits: (r as any).rows,
      limit,
      offset,
      include_lost: includeLost,
      visit_date_from: visitDateFrom,
      visit_date_to: visitDateTo,
    });
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
             l.cust_name, l.location AS lead_location, v.phone_no, v.phone_no_2,
             u.name  AS salesperson_name,
             v.vehicle, v.status, v.visit_date,
             v.next_action, v.next_action_date, v.note,
             v.lost_not_interested_reason, v.lost_reason_notes,
             v.deferral_bucket, v.deferral_notes, v.follow_up_after_date, v.earliest_purchase_intent_date,
             v.contact_disposition, v.callback_requested_at, v.customer_promised_callback,
             COALESCE(l.is_hot_lead, false) AS is_hot_lead,
             COALESCE(v.is_walk_in, false) AS is_walk_in,
             uc.name AS created_by_name, v.created_at,
             uu.name AS updated_by_name, v.updated_at,
             (SELECT MAX(lp.pinged_at) FROM location_pings lp WHERE lp.visit_id = v.id) AS visit_location_captured_at
      FROM visits v
      LEFT JOIN leads l  ON l.id  = v.lead_id
      LEFT JOIN users u  ON u.id  = v.salesperson_id
      LEFT JOIN users uc ON uc.id = v.created_by
      LEFT JOIN users uu ON uu.id = v.updated_by
      ORDER BY v.created_at DESC
      LIMIT ${MAX_CSV_EXPORT_ROWS}
    `);
    const rows   = (r as any).rows;
    sendVisitCsv(res, rows, 'visits.csv');
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// Returns visits where next_action_date is in the past and the lead is still
// in an active pipeline stage. Used by the dashboard to highlight overdue rows.
export async function listOverdueVisits(_req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const r = await query(`
      SELECT v.id, v.lead_cust_code, v.status, v.next_action,
             v.next_action_date, v.visit_date,
             l.cust_name, u.name AS salesperson_name
      FROM visits v
      LEFT JOIN leads l ON l.id  = v.lead_id
      LEFT JOIN users u ON u.id  = v.salesperson_id
      WHERE v.next_action_date < CURRENT_DATE
        AND (v.status IS NULL OR (
              v.status NOT ILIKE 'Lost%'
          AND v.status NOT ILIKE 'Delivered%'
          AND v.status NOT ILIKE 'Booking Amount%'
          AND v.status NOT ILIKE 'Order Confirmed%'
          AND v.status NOT ILIKE 'Delivery Scheduled%'
        ))
        AND (v.next_action IS NULL OR v.next_action NOT ILIKE 'Lost%')
      ORDER BY v.next_action_date ASC
      LIMIT 100
    `);
    res.json({ overdue: (r as any).rows });
  } catch (e) {
    console.error('listOverdueVisits error:', e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── Sales Analytics ───────────────────────────────────────────────────────────
// Returns all pre-aggregated analytics data in a single call.
// Admin-only — used by /admin/sales-analytics page.
const VISIBLE_STATUSES = [
  'New Lead', 'Attempted Contact', 'Connected', 'Requirement Identified',
  'Qualified Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared', 'Catalogue Shared',
  'Demo Follow Up', 'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed',
];
const CLOSED_FILTER = `(
  v.status NOT ILIKE 'Lost%'
  AND v.status NOT ILIKE 'Delivered%'
  AND v.status NOT ILIKE 'Booking Amount%'
  AND v.status NOT ILIKE 'Order Confirmed%'
  AND v.status NOT ILIKE 'Delivery Scheduled%'
  AND v.status NOT ILIKE 'Loan Processing%'
  AND (v.next_action IS NULL OR v.next_action NOT ILIKE 'Lost%')
)`;

export async function getAnalytics(_req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const statusList = VISIBLE_STATUSES.map((_, i) => `$${i + 1}`).join(', ');

    const [funnel, spStats, aging, vehicle, location, trend, atRisk, lostNiBreakdown] = await Promise.all([

      // 1. Pipeline funnel — count per stage
      query(
        `SELECT COALESCE(v.status, 'New Lead') AS status, COUNT(*) AS count
         FROM visits v
         WHERE v.status IN (${statusList})
         GROUP BY v.status
         ORDER BY v.status`,
        VISIBLE_STATUSES,
      ),

      // 2. Salesperson stats
      query(
        `SELECT
           COALESCE(u.name, 'Unassigned') AS name,
           COUNT(v.id)                    AS total,
           COUNT(CASE WHEN v.next_action_date < CURRENT_DATE AND ${CLOSED_FILTER} THEN 1 END) AS overdue,
           COUNT(CASE WHEN v.next_action_date IS NULL        AND ${CLOSED_FILTER} THEN 1 END) AS no_date,
           COUNT(CASE WHEN v.updated_at < now() - interval '7 days' AND ${CLOSED_FILTER} THEN 1 END) AS stale_7d,
           COUNT(CASE WHEN v.status ILIKE 'Lost%'
                       AND DATE_TRUNC('month', v.updated_at) = DATE_TRUNC('month', now()) THEN 1 END) AS lost_month
         FROM visits v
         LEFT JOIN users u ON u.id = v.salesperson_id
         WHERE v.status IN (${statusList})
         GROUP BY u.name
         ORDER BY total DESC`,
        VISIBLE_STATUSES,
      ),

      // 3. Stage aging — days since last update, bucketed
      query(
        `SELECT
           COALESCE(v.status, 'New Lead') AS status,
           CASE
             WHEN CURRENT_DATE - v.updated_at::date < 3  THEN 'lt3d'
             WHEN CURRENT_DATE - v.updated_at::date < 7  THEN '3to7d'
             WHEN CURRENT_DATE - v.updated_at::date < 14 THEN '7to14d'
             ELSE 'gt14d'
           END AS bucket,
           COUNT(*) AS count
         FROM visits v
         WHERE v.status IN (${statusList})
         GROUP BY v.status, bucket`,
        VISIBLE_STATUSES,
      ),

      // 4. Vehicle breakdown
      query(
        `SELECT COALESCE(NULLIF(TRIM(v.vehicle), ''), 'Unknown') AS vehicle, COUNT(*) AS count
         FROM visits v
         WHERE v.status IN (${statusList})
           AND v.vehicle IS NOT NULL AND TRIM(v.vehicle) <> ''
         GROUP BY vehicle
         ORDER BY count DESC`,
        VISIBLE_STATUSES,
      ),

      // 5. Location breakdown
      query(
        `SELECT COALESCE(NULLIF(TRIM(l.location), ''), 'Unknown') AS location, COUNT(*) AS count
         FROM visits v
         LEFT JOIN leads l ON l.id = v.lead_id
         WHERE v.status IN (${statusList})
         GROUP BY location
         ORDER BY count DESC
         LIMIT 20`,
        VISIBLE_STATUSES,
      ),

      // 6. 30-day daily visit trend
      query(
        `SELECT TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
         FROM visits v
         WHERE v.visit_date >= CURRENT_DATE - INTERVAL '30 days'
           AND v.visit_date IS NOT NULL
         GROUP BY v.visit_date
         ORDER BY v.visit_date ASC`,
        [],
      ),

      // 7. At-risk summary scalars
      query(
        `SELECT
           COUNT(CASE WHEN v.next_action_date < CURRENT_DATE AND ${CLOSED_FILTER} THEN 1 END) AS overdue,
           COUNT(CASE WHEN v.next_action_date IS NULL        AND ${CLOSED_FILTER} THEN 1 END) AS no_date,
           COUNT(CASE WHEN v.updated_at < now() - interval '7 days' AND ${CLOSED_FILTER} THEN 1 END) AS stale_7d
         FROM visits v
         WHERE v.status IN (${statusList})`,
        VISIBLE_STATUSES,
      ),

      // 8. Lost – Not Interested reason breakdown (all time)
      query(
        `SELECT COALESCE(NULLIF(TRIM(v.lost_not_interested_reason), ''), '(unset)') AS reason,
                COUNT(*)::int AS count
         FROM visits v
         WHERE v.status = $1
         GROUP BY 1
         ORDER BY count DESC`,
        [LOST_NOT_INTERESTED_STATUS],
      ),
    ]);

    res.json({
      pipeline_funnel:    (funnel    as any).rows,
      salesperson_stats:  (spStats   as any).rows,
      stage_aging:        (aging     as any).rows,
      vehicle_breakdown:  (vehicle   as any).rows,
      location_breakdown: (location  as any).rows,
      daily_trend:        (trend     as any).rows,
      at_risk_summary:    (atRisk    as any).rows[0] ?? { overdue: 0, no_date: 0, stale_7d: 0 },
      lost_not_interested_breakdown: (lostNiBreakdown as any).rows,
    });
  } catch (e) {
    console.error('getAnalytics error:', (e as any)?.stack || e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportVisibleVisitsCSV(req: Request, res: Response) {
  try {
    await ensureVisitsCols();
    const includeLost = parseIncludeLost(req.query.include_lost);
    const whereExtra = visitReportWhereSql(includeLost);
    const r = await query(`
      SELECT v.id, v.lead_cust_code, COALESCE(v.lead_type, l.lead_type) AS lead_type,
             COALESCE(v.connect_date, l.connect_date) AS connect_date,
             l.cust_name, l.location AS lead_location, v.phone_no, v.phone_no_2,
             u.name  AS salesperson_name,
             v.vehicle, v.status, v.visit_date,
             v.next_action, v.next_action_date, v.note,
             v.lost_not_interested_reason, v.lost_reason_notes,
             v.deferral_bucket, v.deferral_notes, v.follow_up_after_date, v.earliest_purchase_intent_date,
             v.contact_disposition, v.callback_requested_at, v.customer_promised_callback,
             COALESCE(l.is_hot_lead, false) AS is_hot_lead,
             COALESCE(v.is_walk_in, false) AS is_walk_in,
             uc.name AS created_by_name, v.created_at,
             uu.name AS updated_by_name, v.updated_at,
             (SELECT MAX(lp.pinged_at) FROM location_pings lp WHERE lp.visit_id = v.id) AS visit_location_captured_at
      FROM visits v
      LEFT JOIN leads l  ON l.id  = v.lead_id
      LEFT JOIN users u  ON u.id  = v.salesperson_id
      LEFT JOIN users uc ON uc.id = v.created_by
      LEFT JOIN users uu ON uu.id = v.updated_by
      WHERE ${whereExtra}
      ORDER BY v.created_at DESC
      LIMIT ${MAX_CSV_EXPORT_ROWS}
    `);
    const rows   = (r as any).rows;
    sendVisitCsv(res, rows, 'visible_visits.csv');
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}
