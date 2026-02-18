import { Request, Response } from 'express';
import { query } from '../db';

export async function createLead(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub;
    const { connect_date, cust_name, business, phone_no, lead_type, note } = req.body;
    if (!cust_name) return res.status(400).json({ error: 'cust_name required' });

    // Generate cust_code server-side to ensure uniqueness / consistent format
    function generateCustCode() {
      const time = Date.now().toString(36).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000).toString();
      return `C-${time}-${rand}`;
    }

    const cust_code = generateCustCode();

    const r = await query(
      `INSERT INTO leads (cust_code, connect_date, cust_name, business, phone_no, lead_type, note, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now()) RETURNING *`,
      [cust_code, connect_date || null, cust_name, business || null, phone_no || null, lead_type || null, note || null, userId || null]
    );
    res.status(201).json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listLeads(req: Request, res: Response) {
  // Declare pagination variables in function scope so fallbacks can access them
  let limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000);
  let offset = parseInt((req.query.offset as string) || '0', 10);
  try {
    const q = (req.query.q as string) || '';
    const start = req.query.startDate as string | undefined;
    const end = req.query.endDate as string | undefined;
    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(cust_code ILIKE $${params.length} OR cust_name ILIKE $${params.length} OR phone_no ILIKE $${params.length})`);
    }
    if (start) {
      params.push(start);
      where.push(`connect_date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      where.push(`connect_date <= $${params.length}`);
    }
    let sql = `SELECT * FROM leads`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const r = await query(sql, params);
    res.json({ leads: (r as any).rows, limit, offset });
  } catch (e) {
    console.error('listLeads error:', (e as any));
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteLead(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM leads WHERE id=$1', [id]);
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportLeadsCSV(req: Request, res: Response) {
  try {
    const r = await query('SELECT id, cust_code, connect_date, cust_name, business, phone_no, lead_type, note, created_at FROM leads ORDER BY created_at DESC');
    const rows = (r as any).rows;
    const header = ['id','cust_code','connect_date','cust_name','business','phone_no','lead_type','note','created_at'];
    const csv = [header.join(',')].concat(rows.map((row: any) => header.map(h => `"${(row[h]||'').toString().replace(/"/g,'""')}"`).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

