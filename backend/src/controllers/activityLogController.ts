import { Request, Response } from 'express';
import { query } from '../db';

// GET /api/v1/activity-log?entity_type=lead&entity_id=123&limit=50
export async function listActivityLog(req: Request, res: Response) {
  try {
    const entityType = req.query.entity_type as string | undefined;
    const entityId   = req.query.entity_id   as string | undefined;
    const limit      = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const where: string[]  = [];
    const params: any[]    = [];
    if (entityType) { params.push(entityType); where.push(`entity_type = $${params.length}`); }
    if (entityId)   { params.push(parseInt(entityId, 10)); where.push(`entity_id = $${params.length}`); }

    let sql = `SELECT * FROM activity_log`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY performed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const r = await query(sql, params);
    res.json({ logs: (r as any).rows });
  } catch (e) {
    console.error('listActivityLog error:', e);
    res.status(500).json({ error: 'failed' });
  }
}
