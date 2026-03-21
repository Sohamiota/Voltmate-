import { Request, Response } from 'express';
import { query } from '../db';
import {
  reqStr, optStr, reqId, reqEnum, optEnum,
  parsePagination, TASK_STATUSES, APPROVAL_STATUSES,
} from '../utils/validate';

// ── Auto-migrate tables on first use ──────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_date       DATE    NOT NULL,
      description     TEXT    NOT NULL,
      status          VARCHAR(50)  NOT NULL DEFAULT 'Just Assigned',
      approval_status VARCHAR(20)  NOT NULL DEFAULT 'Pending',
      approved_by     INTEGER REFERENCES users(id),
      approved_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT now(),
      updated_at      TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, task_date)
    )
  `);
  // Migrate existing tables that may be missing the new columns
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'Pending'`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by  INTEGER REFERENCES users(id)`);
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ`);
  await query(`
    CREATE TABLE IF NOT EXISTS task_edits (
      id              SERIAL PRIMARY KEY,
      task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      old_description TEXT,
      new_description TEXT,
      old_status      VARCHAR(50),
      new_status      VARCHAR(50),
      edited_by       INTEGER REFERENCES users(id),
      edited_at       TIMESTAMPTZ DEFAULT now()
    )
  `);
  tablesReady = true;
}

// ── GET /tasks/today ──────────────────────────────────────────────────────────
export async function getTodayTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const r = await query(
      `SELECT t.*, u.name AS employee_name, u.email AS employee_email,
              ab.name AS approved_by_name
       FROM tasks t
       LEFT JOIN users u  ON u.id  = t.user_id
       LEFT JOIN users ab ON ab.id = t.approved_by
       WHERE t.user_id = $1 AND t.task_date = CURRENT_DATE`,
      [userId]
    );
    if ((r as any).rowCount === 0) return res.status(204).send();
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── POST /tasks ───────────────────────────────────────────────────────────────
export async function createTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const body  = req.body || {};
    const vDesc = reqStr(body.description, 1000);
    if (vDesc.error) return res.status(400).json({ error: `description: ${vDesc.error}` });
    const vStatus = optEnum(body.status, TASK_STATUSES);
    if (vStatus.error) return res.status(400).json({ error: `status: ${vStatus.error}` });

    const description = vDesc.value as string;
    const taskStatus  = vStatus.value ?? 'Just Assigned';

    const existing = await query(
      'SELECT * FROM tasks WHERE user_id=$1 AND task_date=CURRENT_DATE',
      [userId]
    );
    if ((existing as any).rowCount > 0) {
      const prev = (existing as any).rows[0];
      const changed = prev.description !== description || prev.status !== taskStatus;
      if (changed) {
        await query(
          `INSERT INTO task_edits (task_id, old_description, new_description, old_status, new_status, edited_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [prev.id, prev.description, description, prev.status, taskStatus, userId]
        );
      }
      const upd = await query(
        `UPDATE tasks SET description=$1, status=$2, approval_status='Pending',
                         approved_by=NULL, approved_at=NULL, updated_at=now()
         WHERE id=$3 RETURNING *`,
        [description, taskStatus, prev.id]
      );
      return res.json({ ...(upd as any).rows[0], updated: true });
    }

    const ins = await query(
      `INSERT INTO tasks (user_id, task_date, description, status, approval_status)
       VALUES ($1, CURRENT_DATE, $2, $3, 'Pending') RETURNING *`,
      [userId, description, taskStatus]
    );
    res.status(201).json({ ...(ins as any).rows[0], updated: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── PATCH /tasks/:id ─────────────────────────────────────────────────────────
export async function updateTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId    = (req as any).user?.sub;
    const requester = (req as any).user;
    if (!userId) return res.status(401).json({ error: 'missing user' });

    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id   = vId.value;
    const body = req.body || {};

    const vDesc   = optStr(body.description, 1000);
    const vStatus = optEnum(body.status, TASK_STATUSES);
    if (vDesc.error)   return res.status(400).json({ error: `description: ${vDesc.error}` });
    if (vStatus.error) return res.status(400).json({ error: `status: ${vStatus.error}` });

    const existing = await query('SELECT * FROM tasks WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    const prev = (existing as any).rows[0];

    if (prev.user_id !== requester.sub && requester.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const newDesc   = vDesc.value   ?? prev.description;
    const newStatus = vStatus.value ?? prev.status;

    const changed = newDesc !== prev.description || newStatus !== prev.status;
    if (changed) {
      await query(
        `INSERT INTO task_edits (task_id, old_description, new_description, old_status, new_status, edited_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, prev.description, newDesc, prev.status, newStatus, userId]
      );
    }

    const upd = await query(
      `UPDATE tasks SET description=$1, status=$2, updated_at=now()
       WHERE id=$3 RETURNING *`,
      [newDesc, newStatus, id]
    );
    res.json((upd as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── PATCH /tasks/:id/approval  – admin approve / reject ──────────────────────
export async function approveTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const adminId = (req as any).user?.sub;
    const role    = (req as any).user?.role;
    if (role !== 'admin') return res.status(403).json({ error: 'admin only' });

    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id = vId.value;

    const vApproval = reqEnum(req.body?.approval_status, APPROVAL_STATUSES);
    if (vApproval.error)
      return res.status(400).json({ error: `approval_status: ${vApproval.error}` });
    const approval_status = vApproval.value;

    const existing = await query('SELECT * FROM tasks WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'not found' });

    const upd = await query(
      `UPDATE tasks
       SET approval_status=$1,
           approved_by = CASE WHEN $1 IN ('Approved','Rejected') THEN $2 ELSE NULL END,
           approved_at = CASE WHEN $1 IN ('Approved','Rejected') THEN now()  ELSE NULL END,
           updated_at  = now()
       WHERE id=$3
       RETURNING *`,
      [approval_status, adminId, id]
    );
    res.json((upd as any).rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── GET /tasks ────────────────────────────────────────────────────────────────
export async function listTasks(req: Request, res: Response) {
  try {
    await ensureTables();
    const requester   = (req as any).user;
    const isAdmin     = requester?.role === 'admin';
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset, 1000);

    // Validate the optional approval filter — only accept whitelisted values.
    // Previously this was interpolated directly into SQL; now it uses a $N
    // parameter to be fully safe even if the whitelist check is ever bypassed.
    const vApproval = optEnum(req.query.approval, APPROVAL_STATUSES);
    if (vApproval.error) return res.status(400).json({ error: `approval: ${vApproval.error}` });
    const approvalFilter = vApproval.value;

    let sql: string;
    let params: any[];

    if (isAdmin) {
      if (approvalFilter) {
        sql = `
          SELECT t.*, u.name AS employee_name, u.email AS employee_email,
                 ab.name AS approved_by_name
          FROM tasks t
          LEFT JOIN users u  ON u.id  = t.user_id
          LEFT JOIN users ab ON ab.id = t.approved_by
          WHERE t.approval_status = $1
          ORDER BY t.task_date DESC, t.updated_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [approvalFilter, limit, offset];
      } else {
        sql = `
          SELECT t.*, u.name AS employee_name, u.email AS employee_email,
                 ab.name AS approved_by_name
          FROM tasks t
          LEFT JOIN users u  ON u.id  = t.user_id
          LEFT JOIN users ab ON ab.id = t.approved_by
          ORDER BY t.task_date DESC, t.updated_at DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      }
    } else {
      if (approvalFilter) {
        sql = `
          SELECT t.*, u.name AS employee_name, u.email AS employee_email,
                 ab.name AS approved_by_name
          FROM tasks t
          LEFT JOIN users u  ON u.id  = t.user_id
          LEFT JOIN users ab ON ab.id = t.approved_by
          WHERE t.user_id = $1 AND t.approval_status = $2
          ORDER BY t.task_date DESC, t.updated_at DESC
          LIMIT $3 OFFSET $4
        `;
        params = [requester.sub, approvalFilter, limit, offset];
      } else {
        sql = `
          SELECT t.*, u.name AS employee_name, u.email AS employee_email,
                 ab.name AS approved_by_name
          FROM tasks t
          LEFT JOIN users u  ON u.id  = t.user_id
          LEFT JOIN users ab ON ab.id = t.approved_by
          WHERE t.user_id = $1
          ORDER BY t.task_date DESC, t.updated_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [requester.sub, limit, offset];
      }
    }

    const r = await query(sql, params);
    res.json({ tasks: (r as any).rows, limit, offset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── GET /tasks/:id/history ────────────────────────────────────────────────────
export async function getTaskHistory(req: Request, res: Response) {
  try {
    await ensureTables();
    const vId = reqId(req.params.id);
    if (vId.error) return res.status(400).json({ error: 'invalid id' });
    const id        = vId.value;
    const requester = (req as any).user;

    // Verify the task exists and the caller owns it (or is admin)
    const taskRow = await query('SELECT user_id FROM tasks WHERE id=$1', [id]);
    if ((taskRow as any).rowCount === 0) return res.status(404).json({ error: 'task not found' });
    const taskOwnerId = (taskRow as any).rows[0].user_id;
    if (requester?.role !== 'admin' && String(taskOwnerId) !== String(requester?.sub)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const r = await query(
      `SELECT te.*, u.name AS edited_by_name
       FROM task_edits te
       LEFT JOIN users u ON u.id = te.edited_by
       WHERE te.task_id = $1
       ORDER BY te.edited_at DESC`,
      [id]
    );
    res.json({ history: (r as any).rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}
