import { Request, Response } from 'express';
import { query } from '../db';
import { optStr, optId, optDate, parsePagination } from '../utils/validate';

export async function clockIn(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    // check open session
    const open = await query('SELECT id FROM attendance WHERE user_id=$1 AND clock_out_at IS NULL', [userId]);
    if ((open as any).rowCount > 0) return res.status(409).json({ error: 'already clocked in' });
    const body = req.body || {};
    const vLoc  = optStr(body.location, 300);
    const vNote = optStr(body.note, 500);
    if (vLoc.error)  return res.status(400).json({ error: `location: ${vLoc.error}` });
    if (vNote.error) return res.status(400).json({ error: `note: ${vNote.error}` });
    const needs_approval = body.needs_approval === true || body.needs_approval === 'true';

    const r = await query(
      `INSERT INTO attendance (user_id, clock_in_at, date, timezone, location, note, needs_approval, created_at)
       VALUES ($1, now(), CURRENT_DATE, $2, $3, $4, COALESCE($5,false), now()) RETURNING *`,
      [userId, Intl.DateTimeFormat().resolvedOptions().timeZone || null, vLoc.value, vNote.value, needs_approval]
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function clockOut(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const r0 = await query('SELECT * FROM attendance WHERE user_id=$1 AND clock_out_at IS NULL ORDER BY clock_in_at DESC LIMIT 1', [userId]);
    if ((r0 as any).rowCount === 0) return res.status(400).json({ error: 'no open session' });
    const record = (r0 as any).rows[0];
    const body2  = req.body || {};
    const vLoc2  = optStr(body2.location, 300);
    const vNote2 = optStr(body2.note, 500);
    if (vLoc2.error)  return res.status(400).json({ error: `location: ${vLoc2.error}` });
    if (vNote2.error) return res.status(400).json({ error: `note: ${vNote2.error}` });

    const r = await query(
      `UPDATE attendance SET clock_out_at=now(), location=COALESCE($1, location), note=COALESCE($2, note), duration_seconds = EXTRACT(EPOCH FROM (now() - clock_in_at))::int, updated_at=now()
       WHERE id=$3 RETURNING *`,
      [vLoc2.value, vNote2.value, record.id]
    );
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function currentAttendance(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const r = await query('SELECT * FROM attendance WHERE user_id=$1 AND clock_out_at IS NULL ORDER BY clock_in_at DESC LIMIT 1', [userId]);
    if ((r as any).rowCount === 0) return res.status(204).send();
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listAttendance(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    const isAdmin   = requester?.role === 'admin';

    const vUserId = optId(req.query.userId);
    const vStart  = optDate(req.query.startDate);
    const vEnd    = optDate(req.query.endDate);
    if (vUserId.error) return res.status(400).json({ error: `userId: ${vUserId.error}` });
    if (vStart.error)  return res.status(400).json({ error: `startDate: ${vStart.error}` });
    if (vEnd.error)    return res.status(400).json({ error: `endDate: ${vEnd.error}` });

    const userId = isAdmin ? vUserId.value : requester?.sub;
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);

    const where: string[] = [];
    const params: any[] = [];
    if (userId) {
      params.push(userId);
      where.push(`a.user_id = $${params.length}`);
    }
    if (vStart.value) {
      params.push(vStart.value);
      where.push(`a.date >= $${params.length}`);
    }
    if (vEnd.value) {
      params.push(vEnd.value);
      where.push(`a.date <= $${params.length}`);
    }
    let sql = `
      SELECT
        a.*,
        u.name  AS employee_name,
        u.email AS employee_email,
        u.role  AS employee_role
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
    `;
    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const r = await query(sql, params);
    res.json({ attendance: (r as any).rows, limit, offset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function attendanceStats(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const vStart = optDate(req.query.startDate);
    const vEnd   = optDate(req.query.endDate);
    if (vStart.error) return res.status(400).json({ error: `startDate: ${vStart.error}` });
    if (vEnd.error)   return res.status(400).json({ error: `endDate: ${vEnd.error}` });

    // determine date range (defaults to current month)
    const now = new Date();
    let startDate: string;
    let endDate: string;
    if (vStart.value && vEnd.value) {
      startDate = vStart.value;
      endDate   = vEnd.value;
    } else {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      startDate = first.toISOString().slice(0, 10);
      endDate = last.toISOString().slice(0, 10);
    }

    // total hours (sum duration_seconds) and pending count and days_present
    const statsSql = `
      SELECT
        COALESCE(SUM(duration_seconds),0)::bigint AS total_seconds,
        COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0)::int AS pending_count,
        (SELECT COUNT(DISTINCT date) FROM attendance WHERE user_id=$1 AND date BETWEEN $2 AND $3) AS days_present
      FROM attendance
      WHERE user_id=$1 AND date BETWEEN $2 AND $3
    `;
    console.log('attendanceStats params', { userId, startDate, endDate });
    const r = await query(statsSql, [userId, startDate, endDate]);
    const row = (r as any).rows[0];
    console.log('attendanceStats row', row);
    try {
      const totalSeconds = parseInt(row.total_seconds || '0', 10);
      const totalHours = +(totalSeconds / 3600).toFixed(2);
      const pendingCount = parseInt(row.pending_count || '0', 10);
      const daysPresent = parseInt(row.days_present || '0', 10);

      // total days in range (inclusive)
      const s = new Date(startDate);
      const e = new Date(endDate);
      const msPerDay = 24 * 60 * 60 * 1000;
      const totalDays = Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1;
      const attendanceRate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

      res.json({
        total_hours: totalHours,
        days_present: daysPresent,
        pending_count: pendingCount,
        attendance_rate: attendanceRate,
        startDate,
        endDate,
        total_days: totalDays
      });
      return;
    } catch (inner) {
      console.error('attendanceStats compute error', inner && ((inner as any).stack || inner));
      throw inner;
    }
    // unreachable
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getAttendance(req: Request, res: Response) {
  try {
    const id        = parseInt(req.params.id, 10);
    const requester = (req as any).user;
    const r = await query('SELECT * FROM attendance WHERE id=$1', [id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    const record = (r as any).rows[0];
    // Non-admins may only read their own attendance records
    if (requester?.role !== 'admin' && String(record.user_id) !== String(requester?.sub)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function adminApproveAttendance(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const id = parseInt(req.params.id, 10);
    const { approve, note } = req.body;
    if (approve) {
      const r = await query('UPDATE attendance SET status=$1, approved_by=$2, approved_at=now(), updated_at=now() WHERE id=$3 RETURNING *', ['approved', requester.sub, id]);
      return res.json((r as any).rows[0]);
    } else {
      const r = await query('UPDATE attendance SET status=$1, approved_by=$2, approved_at=now(), note=COALESCE(note, $3), updated_at=now() WHERE id=$4 RETURNING *', ['rejected', requester.sub, note || null, id]);
      return res.json((r as any).rows[0]);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

