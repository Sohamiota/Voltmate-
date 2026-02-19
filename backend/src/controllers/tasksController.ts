import { Request, Response } from 'express';
import { query } from '../db';

// ── Auto-migrate tables on first use ──────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_date     DATE    NOT NULL,
      description   TEXT    NOT NULL,
      status        VARCHAR(50) NOT NULL DEFAULT 'Just Assigned',
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, task_date)
    )
  `);
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

// ── GET /tasks/today  – today's task for the logged-in user ──────────────────
export async function getTodayTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const r = await query(
      `SELECT t.*, u.name AS employee_name, u.email AS employee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.user_id
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

// ── POST /tasks  – create today's task (one per day, returns 409 if exists) ──
export async function createTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const { description, status } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'description required' });
    const validStatuses = ['Just Assigned', 'Under Process', 'Completed'];
    const taskStatus = validStatuses.includes(status) ? status : 'Just Assigned';

    // Upsert: if a task already exists for today update it and record an edit
    const existing = await query(
      'SELECT * FROM tasks WHERE user_id=$1 AND task_date=CURRENT_DATE',
      [userId]
    );
    if ((existing as any).rowCount > 0) {
      const prev = (existing as any).rows[0];
      const changed = prev.description !== description.trim() || prev.status !== taskStatus;
      if (changed) {
        await query(
          `INSERT INTO task_edits (task_id, old_description, new_description, old_status, new_status, edited_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [prev.id, prev.description, description.trim(), prev.status, taskStatus, userId]
        );
      }
      const upd = await query(
        `UPDATE tasks SET description=$1, status=$2, updated_at=now()
         WHERE id=$3 RETURNING *`,
        [description.trim(), taskStatus, prev.id]
      );
      return res.json({ ...(upd as any).rows[0], updated: true });
    }

    const ins = await query(
      `INSERT INTO tasks (user_id, task_date, description, status)
       VALUES ($1, CURRENT_DATE, $2, $3) RETURNING *`,
      [userId, description.trim(), taskStatus]
    );
    res.status(201).json({ ...(ins as any).rows[0], updated: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── PATCH /tasks/:id  – update description and/or status, records edit ──────
export async function updateTask(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'missing user' });
    const id = parseInt(req.params.id, 10);
    const { description, status } = req.body;
    const validStatuses = ['Just Assigned', 'Under Process', 'Completed'];

    const existing = await query('SELECT * FROM tasks WHERE id=$1', [id]);
    if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'not found' });
    const prev = (existing as any).rows[0];

    // Only the owner can edit (unless admin)
    const requester = (req as any).user;
    if (prev.user_id !== requester.sub && requester.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const newDesc   = description?.trim()                    ?? prev.description;
    const newStatus = validStatuses.includes(status) ? status : prev.status;

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

// ── GET /tasks  – list all tasks for the logged-in user (with employee info) ─
export async function listTasks(req: Request, res: Response) {
  try {
    await ensureTables();
    const requester = (req as any).user;
    const isAdmin = requester?.role === 'admin';
    const limit  = Math.min(parseInt((req.query.limit as string)  || '100', 10), 1000);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    let sql: string;
    let params: any[];

    if (isAdmin) {
      // Admins see all employees' tasks
      sql = `
        SELECT t.*, u.name AS employee_name, u.email AS employee_email
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY t.task_date DESC, t.updated_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, offset];
    } else {
      sql = `
        SELECT t.*, u.name AS employee_name, u.email AS employee_email
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE t.user_id = $1
        ORDER BY t.task_date DESC, t.updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [requester.sub, limit, offset];
    }

    const r = await query(sql, params);
    res.json({ tasks: (r as any).rows, limit, offset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
}

// ── GET /tasks/:id/history  – edit history for a specific task ───────────────
export async function getTaskHistory(req: Request, res: Response) {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
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
