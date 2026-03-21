import { Request, Response } from 'express';
import { query } from '../db';
import { reqId, optStr, parsePagination, sanitizeSearch } from '../utils/validate';

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
  'distributor_manufacturer',
  'source'
];

export async function getOpportunity(req: Request, res: Response) {
  try {
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;
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
    const requester = (req as any).user;
    if (requester?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can modify opportunities' });
    }
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id      = vId.value;
    const payload = req.body || {};
    const keys    = Object.keys(payload).filter(k => ALLOWED_FIELDS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'no valid fields to update' });

    const setClauses: string[] = [];
    const values: any[] = [];
    for (let i = 0; i < keys.length; i++) {
      const k   = keys[i];
      const raw = payload[k];
      // Sanitize every text value: strip HTML tags, cap at 500 chars
      const vVal = optStr(raw, 500);
      if (vVal.error) return res.status(400).json({ error: `${k}: ${vVal.error}` });
      setClauses.push(`${k} = $${i + 1}`);
      values.push(vVal.value);
    }
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
    const q      = sanitizeSearch(req.query.q);
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset, 100);
    // Only accept the two known source filter values; anything else is ignored
    const rawSource = req.query.source as string | undefined;
    const source = rawSource === 'salesforce' || rawSource === 'non-salesforce'
      ? rawSource : '';

    let sql: string;
    let params: any[] = [];
    const where: string[] = [];
    if (q.length > 0) {
      where.push(`(opportunity_name ILIKE $${params.length + 1} OR phone_no ILIKE $${params.length + 1})`);
      params.push(`%${q}%`);  // q is already sanitized by sanitizeSearch()
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

