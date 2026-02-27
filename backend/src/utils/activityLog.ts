import { query } from '../db';

let activityLogReady = false;

async function ensureActivityLog() {
  if (activityLogReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id              SERIAL PRIMARY KEY,
        entity_type     TEXT NOT NULL,
        entity_id       INT,
        entity_ref      TEXT,
        action          TEXT NOT NULL,
        performed_by    INT,
        performed_by_name TEXT,
        performed_at    TIMESTAMPTZ DEFAULT now(),
        details         TEXT
      )
    `);
  } catch { /* ignore */ }
  activityLogReady = true;
}

export async function logActivity(
  entityType: string,
  entityId:   number | null,
  entityRef:  string,
  action:     'create' | 'update' | 'delete',
  userId:     number | null,
  details?:   string,
) {
  try {
    await ensureActivityLog();
    let performedByName = 'Unknown';
    if (userId) {
      try {
        const r = await query('SELECT name FROM users WHERE id=$1', [userId]);
        if ((r as any).rows.length > 0) performedByName = (r as any).rows[0].name;
      } catch { /* ignore */ }
    }
    await query(
      `INSERT INTO activity_log
         (entity_type, entity_id, entity_ref, action, performed_by, performed_by_name, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [entityType, entityId, entityRef, action, userId, performedByName, details || null],
    );
  } catch (e) {
    console.error('logActivity error', e);
  }
}
