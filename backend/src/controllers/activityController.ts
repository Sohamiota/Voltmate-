import { Request, Response } from 'express';
import { query } from '../db';

// Returns a merged activity feed from attendance and opportunities
export async function getActivity(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    // attendance: use created_at, opportunities: created_at
    const sql = `
      SELECT id, 'attendance' AS type, user_id AS actor_id, created_at, note AS text
      FROM attendance
      UNION ALL
      SELECT id, 'opportunity' AS type, NULL AS actor_id, created_at, opportunity_name AS text
      FROM opportunities
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const r = await query(sql, [limit]);
    res.json({ activities: (r as any).rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

