import { Request, Response } from 'express';
import { query } from '../db';

export async function salesByEmployee(req: Request, res: Response) {
  try {
    const sql = `
      SELECT u.id as user_id, u.name,
             COALESCE(SUM(o.amount),0)::numeric AS sales,
             COUNT(o.id) AS deals
      FROM users u
      LEFT JOIN opportunities o ON (o.connected_person = u.name OR o.salesforce_id IS NOT NULL AND o.connected_person = u.name)
      GROUP BY u.id, u.name
      ORDER BY sales DESC
      LIMIT 50
    `;
    const r = await query(sql);
    res.json({ sales: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

