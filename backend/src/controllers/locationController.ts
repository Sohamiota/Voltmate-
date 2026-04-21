import { Request, Response } from 'express';
import { query } from '../db';
import { optStr, optDate, optId } from '../utils/validate';

function isAdminLike(role: string | undefined): boolean {
  return role === 'admin' || role === 'attendance_admin';
}

function validateLatLng(lat: unknown, lng: unknown): string | null {
  const la = Number(lat);
  const lo = Number(lng);
  if (!isFinite(la) || la < -90  || la > 90)  return 'lat must be a finite number between -90 and 90';
  if (!isFinite(lo) || lo < -180 || lo > 180) return 'lng must be a finite number between -180 and 180';
  return null;
}

/**
 * POST /api/v1/location/ping
 * Record a location ping for the authenticated user.
 * Body: { lat, lng, accuracy_m?, type?, note?, attendance_id? }
 */
export async function recordPing(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const body = req.body || {};
    const latLngErr = validateLatLng(body.lat, body.lng);
    if (latLngErr) return res.status(400).json({ error: latLngErr });

    const lat       = Number(body.lat);
    const lng       = Number(body.lng);
    const accuracyM = body.accuracy_m != null && isFinite(Number(body.accuracy_m))
      ? Number(body.accuracy_m)
      : null;

    const vNote = optStr(body.note, 300);
    if (vNote.error) return res.status(400).json({ error: `note: ${vNote.error}` });

    const type = body.type === 'manual' ? 'manual' : 'auto';

    const vAttId = optId(body.attendance_id);
    if (vAttId.error) return res.status(400).json({ error: `attendance_id: ${vAttId.error}` });

    const r = await query(
      `INSERT INTO location_pings
         (user_id, attendance_id, lat, lng, accuracy_m, type, note, pinged_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [userId, vAttId.value, lat, lng, accuracyM, type, vNote.value],
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error('[recordPing]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/location/day?userId=&date=
 * Admin-only. Returns all pings for a given user on a given date,
 * plus the matching attendance record for that user+date.
 */
export async function getDayTrail(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!isAdminLike(requester?.role)) return res.status(403).json({ error: 'forbidden' });

    const vUserId = optId(req.query.userId);
    const vDate   = optDate(req.query.date);
    if (vUserId.error || !vUserId.value)
      return res.status(400).json({ error: 'userId is required and must be a positive integer' });
    if (vDate.error || !vDate.value)
      return res.status(400).json({ error: 'date is required in YYYY-MM-DD format' });

    const userId = vUserId.value;
    const date   = vDate.value;

    // Fetch pings for that user on that calendar date
    const pingsResult = await query(
      `SELECT
         lp.id, lp.user_id, lp.attendance_id,
         lp.lat, lp.lng, lp.accuracy_m, lp.type, lp.note, lp.pinged_at,
         u.name AS user_name, u.email AS user_email
       FROM location_pings lp
       LEFT JOIN users u ON u.id = lp.user_id
       WHERE lp.user_id = $1
         AND lp.pinged_at::date = $2::date
       ORDER BY lp.pinged_at ASC`,
      [userId, date],
    );

    // Fetch the attendance record for that user+date
    const attResult = await query(
      `SELECT
         a.*,
         u.name  AS employee_name,
         u.email AS employee_email
       FROM attendance a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.user_id = $1
         AND a.date = $2::date
       LIMIT 1`,
      [userId, date],
    );

    res.json({
      pings:      (pingsResult as any).rows,
      attendance: (attResult   as any).rows[0] ?? null,
    });
  } catch (e) {
    console.error('[getDayTrail]', e);
    res.status(500).json({ error: 'failed' });
  }
}

/**
 * GET /api/v1/location/mine?date=
 * Any authenticated user. Returns their own pings for a given date (defaults to today).
 */
export async function getMyTrail(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const vDate = optDate(req.query.date);
    if (vDate.error) return res.status(400).json({ error: `date: ${vDate.error}` });

    const today = new Date().toISOString().slice(0, 10);
    const date  = vDate.value ?? today;

    const r = await query(
      `SELECT id, lat, lng, accuracy_m, type, note, pinged_at
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
