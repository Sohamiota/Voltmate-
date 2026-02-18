import { Request, Response } from 'express';
import { query } from '../db';

export async function clockIn(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    // check open session
    const open = await query('SELECT id FROM attendance WHERE user_id=$1 AND clock_out_at IS NULL', [userId]);
    if ((open as any).rowCount > 0) return res.status(409).json({ error: 'already clocked in' });
    const { location, note, needs_approval } = req.body || {};
    const r = await query(
      `INSERT INTO attendance (user_id, clock_in_at, date, timezone, location, note, needs_approval, created_at)
       VALUES ($1, now(), CURRENT_DATE, $2, $3, $4, COALESCE($5,false), now()) RETURNING *`,
      [userId, Intl.DateTimeFormat().resolvedOptions().timeZone || null, location || null, note || null, needs_approval || false]
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
    const { location, note } = req.body || {};
    const r = await query(
      `UPDATE attendance SET clock_out_at=now(), location=COALESCE($1, location), note=COALESCE($2, note), duration_seconds = EXTRACT(EPOCH FROM (now() - clock_in_at))::int, updated_at=now()
       WHERE id=$3 RETURNING *`,
      [location || null, note || null, record.id]
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
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : null;
    const start = req.query.startDate as string | undefined;
    const end = req.query.endDate as string | undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const where: string[] = [];
    const params: any[] = [];
    if (userId) {
      params.push(userId);
      where.push(`user_id = $${params.length}`);
    }
    if (start) {
      params.push(start);
      where.push(`date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      where.push(`date <= $${params.length}`);
    }
    let sql = `SELECT * FROM attendance`;
    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    const start = (req.query.startDate as string) || null;
    const end = (req.query.endDate as string) || null;

    // determine date range (defaults to current month)
    const now = new Date();
    let startDate: string;
    let endDate: string;
    if (start && end) {
      startDate = start;
      endDate = end;
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
    const id = parseInt(req.params.id, 10);
    const r = await query('SELECT * FROM attendance WHERE id=$1', [id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json((r as any).rows[0]);
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

