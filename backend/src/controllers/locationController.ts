import { Request, Response } from 'express';
import { query } from '../db';
import { optDate, optEnum, optId, optPlainText } from '../utils/validate';

/** Who may view trails and team snapshots (read-only CRM / attendance oversight). */
function canViewLocationTrails(role: string | undefined): boolean {
  return role === 'admin' || role === 'attendance_admin' || role === 'sales_admin';
}

const LOCATION_CONTEXTS = ['attendance', 'visit', 'field'] as const;

let locationPingColsReady = false;
/** Ensures location_pings has CRM columns (visit_id, context). Safe to call from visits reads. */
export async function ensureLocationPingCols() {
  if (locationPingColsReady) return;
  try {
    await query(`ALTER TABLE location_pings ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE location_pings ADD COLUMN IF NOT EXISTS context TEXT`);
  } catch {
    /* ignore */
  }
  locationPingColsReady = true;
}

function validateLatLng(lat: unknown, lng: unknown): string | null {
  const la = Number(lat);
  const lo = Number(lng);
  if (!isFinite(la) || la < -90 || la > 90) return 'lat must be a finite number between -90 and 90';
  if (!isFinite(lo) || lo < -180 || lo > 180) return 'lng must be a finite number between -180 and 180';
  return null;
}

/**
 * POST /api/v1/location/ping
 * Record a location ping for the authenticated user.
 * Body: { lat, lng, accuracy_m?, type?, note?, attendance_id?, visit_id?, context? }
 */
export async function recordPing(req: Request, res: Response) {
  try {
    await ensureLocationPingCols();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const body = req.body || {};
    const latLngErr = validateLatLng(body.lat, body.lng);
    if (latLngErr) return res.status(400).json({ error: latLngErr });

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const accuracyM =
      body.accuracy_m != null && isFinite(Number(body.accuracy_m)) ? Number(body.accuracy_m) : null;

    const vNote = optPlainText(body.note, 'note', 300);
    if (vNote.error) return res.status(400).json({ error: `note: ${vNote.error}` });

    const type = body.type === 'manual' ? 'manual' : 'auto';

    const vAttId = optId(body.attendance_id);
    if (vAttId.error) return res.status(400).json({ error: `attendance_id: ${vAttId.error}` });

    const vVisitId = optId(body.visit_id);
    if (vVisitId.error) return res.status(400).json({ error: `visit_id: ${vVisitId.error}` });

    if (vVisitId.value) {
      const vr = await query('SELECT id FROM visits WHERE id=$1', [vVisitId.value]);
      if ((vr as any).rowCount === 0) return res.status(404).json({ error: 'visit not found' });
    }

    const vContext = optEnum(body.context, LOCATION_CONTEXTS);
    if (vContext.error) return res.status(400).json({ error: `context: ${vContext.error}` });

    let contextVal = vContext.value;
    if (!contextVal && vVisitId.value) contextVal = 'visit';
    else if (!contextVal && vAttId.value) contextVal = 'attendance';

    const r = await query(
      `INSERT INTO location_pings
         (user_id, attendance_id, visit_id, lat, lng, accuracy_m, type, context, note, pinged_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       RETURNING *`,
      [userId, vAttId.value, vVisitId.value, lat, lng, accuracyM, type, contextVal, vNote.value],
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error('[recordPing]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/location/day?userId=&date=
 * Admin / attendance_admin / sales_admin. Returns pings + attendance for that user+day.
 */
export async function getDayTrail(req: Request, res: Response) {
  try {
    await ensureLocationPingCols();
    const requester = (req as any).user;
    if (!canViewLocationTrails(requester?.role)) return res.status(403).json({ error: 'forbidden' });

    const vUserId = optId(req.query.userId);
    const vDate = optDate(req.query.date);
    if (vUserId.error || !vUserId.value)
      return res.status(400).json({ error: 'userId is required and must be a positive integer' });
    if (vDate.error || !vDate.value)
      return res.status(400).json({ error: 'date is required in YYYY-MM-DD format' });

    const uid = vUserId.value;
    const date = vDate.value;

    const pingsResult = await query(
      `SELECT
         lp.id, lp.user_id, lp.attendance_id, lp.visit_id, lp.context,
         lp.lat, lp.lng, lp.accuracy_m, lp.type, lp.note, lp.pinged_at,
         u.name AS user_name, u.email AS user_email
       FROM location_pings lp
       LEFT JOIN users u ON u.id = lp.user_id
       WHERE lp.user_id = $1
         AND lp.pinged_at::date = $2::date
       ORDER BY lp.pinged_at ASC`,
      [uid, date],
    );

    const attResult = await query(
      `SELECT
         a.*,
         u.name  AS employee_name,
         u.email  AS employee_email
       FROM attendance a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.user_id = $1
         AND a.date = $2::date
       LIMIT 1`,
      [uid, date],
    );

    res.json({
      pings: (pingsResult as any).rows,
      attendance: (attResult as any).rows[0] ?? null,
    });
  } catch (e) {
    console.error('[getDayTrail]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/location/today-snapshot
 * Latest ping today per field user (sales, employee). Oversight roles only.
 */
export async function getTodaySnapshot(req: Request, res: Response) {
  try {
    await ensureLocationPingCols();
    const requester = (req as any).user;
    if (!canViewLocationTrails(requester?.role)) return res.status(403).json({ error: 'forbidden' });

    const r = await query(
      `SELECT DISTINCT ON (lp.user_id)
         lp.user_id,
         u.name  AS user_name,
         u.email AS user_email,
         u.role  AS user_role,
         lp.lat, lp.lng, lp.accuracy_m, lp.pinged_at,
         lp.context, lp.visit_id, lp.type, lp.note
       FROM location_pings lp
       INNER JOIN users u ON u.id = lp.user_id
       WHERE lp.pinged_at::date = CURRENT_DATE
         AND u.role IN ('sales', 'employee')
       ORDER BY lp.user_id, lp.pinged_at DESC`,
      [],
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    res.json({ snapshots: (r as any).rows, date: dateStr });
  } catch (e) {
    console.error('[getTodaySnapshot]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/location/mine?date=
 * Any authenticated user. Returns their own pings for a given date (defaults to today).
 */
export async function getMyTrail(req: Request, res: Response) {
  try {
    await ensureLocationPingCols();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const vDate = optDate(req.query.date);
    if (vDate.error) return res.status(400).json({ error: `date: ${vDate.error}` });

    const today = new Date().toISOString().slice(0, 10);
    const date = vDate.value ?? today;

    const r = await query(
      `SELECT id, lat, lng, accuracy_m, type, context, visit_id, note, pinged_at
       FROM location_pings
       WHERE user_id = $1
         AND pinged_at::date = $2::date
       ORDER BY pinged_at ASC`,
      [userId, date],
    );
    res.json({ pings: (r as any).rows, date });
  } catch (e) {
    console.error('[getMyTrail]', e);
    res.status(500).json({ error: 'failed' });
  }
}
