import { Request, Response } from 'express';
import { query } from '../db';

// Allowed fields that can be updated via PATCH
const ALLOWED_FIELDS = [
  'sl_no',
  'opportunity_name',
  'phone_no',
  'stage',
  'next_connect',
  'last_connect',
  'month_of_reconnect',
  'stage_remark',
  'connected_person',
  'probability',
  'business_payload',
  'use_range',
  'customer_own_vehicle',
  'customer_location',
  'vehicle_suggested_action',
  'distributor_manufacturer'
  ,'source'
];

export async function getOpportunity(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const r = await query('SELECT * FROM opportunities WHERE id=$1', [id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateOpportunity(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const payload = req.body || {};
    const keys = Object.keys(payload).filter(k => ALLOWED_FIELDS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'no valid fields to update' });

    // Build parameterized query
    const setClauses: string[] = [];
    const values: any[] = [];
    keys.forEach((k, i) => {
      // For JSON payloads, keep as-is; for booleans/numbers/strings also as-is
      setClauses.push(`${k} = $${i + 1}`);
      values.push(payload[k]);
    });
    // updated_at
    setClauses.push(`updated_at = now()`);
    const sql = `UPDATE opportunities SET ${setClauses.join(', ')} WHERE id = $${values.length + 1} RETURNING *`;
    values.push(id);
    const r = await query(sql, values);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listOpportunities(req: Request, res: Response) {
  try {
    // optional query: q (search), limit, offset
    const q = (req.query.q as string) || '';
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const source = (req.query.source as string) || ''; // expected: 'salesforce' | 'non-salesforce' | ''

    let sql: string;
    let params: any[] = [];
    // build WHERE clauses
    const where: string[] = [];
    if (q && q.trim().length > 0) {
      where.push(`(opportunity_name ILIKE $${params.length + 1} OR phone_no ILIKE $${params.length + 1})`);
      params.push(`%${q}%`);
    }
    if (source === 'salesforce') {
      where.push(`source = 'salesforce'`);
    } else if (source === 'non-salesforce') {
      where.push(`(source IS NULL OR source != 'salesforce')`);
    }

    if (where.length > 0) {
      sql = `SELECT id, sl_no, opportunity_name, phone_no, stage, created_at
             FROM opportunities
             WHERE ${where.join(' AND ')}
             ORDER BY created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      sql = `SELECT id, sl_no, opportunity_name, phone_no, stage, created_at
             FROM opportunities
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`;
      params = [limit, offset];
    }

    const r = await query(sql, params);
    res.json({ opportunities: (r as any).rows, limit, offset, source: source || 'all' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

