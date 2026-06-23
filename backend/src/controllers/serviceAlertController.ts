import { Request, Response } from 'express';
import { query } from '../db';
import {
  DUE_SOON_DAYS,
  isDueThisWeek,
  isDueToday,
  isStaleOdometer,
  urgency,
} from '../utils/vehicleServiceRules';

export async function getMonitoringSummary(req: Request, res: Response) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const pendingR = await query(`
      SELECT v.id, v.current_km, v.km_updated_at, v.pdi_status,
             vs.id AS service_id, vs.due_km, vs.due_date
      FROM vehicles v
      INNER JOIN vehicle_services vs ON vs.vehicle_id = v.id AND vs.status = 'pending'
    `);

    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueThisWeekCount = 0;
    let dueSoonCount = 0;

    for (const row of (pendingR as any).rows) {
      const u = urgency(row.current_km || 0, row.due_km, row.due_date);
      if (u === 'overdue') overdueCount++;
      if (u === 'due_soon') dueSoonCount++;
      if (isDueToday(row.due_date)) dueTodayCount++;
      else if (isDueThisWeek(row.due_date)) dueThisWeekCount++;
    }

    const staleR = await query(`
      SELECT COUNT(*) AS c FROM vehicles
      WHERE km_updated_at IS NULL OR km_updated_at < now() - interval '30 days'
    `);
    const staleKmCount = parseInt((staleR as any).rows[0]?.c || '0', 10);

    const pdiR = await query(`
      SELECT COUNT(*) AS c FROM vehicles
      WHERE COALESCE(pdi_status, 'pending') IN ('pending', 'in_progress')
        AND (pdi_due_date IS NULL OR pdi_due_date <= $1)
    `, [today]);
    const pdiPendingCount = parseInt((pdiR as any).rows[0]?.c || '0', 10);

    const alertsR = await query(
      `SELECT COUNT(*) AS c FROM service_alerts WHERE status = 'open'`,
    );
    const openAlertsCount = parseInt((alertsR as any).rows[0]?.c || '0', 10);

    const snapR = await query(
      `SELECT * FROM service_snapshots WHERE snapshot_date = $1`,
      [today],
    );
    const snapshot = (snapR as any).rows[0] ?? null;

    const vehiclesR = await query(`SELECT COUNT(*) AS c FROM vehicles`);
    const totalVehicles = parseInt((vehiclesR as any).rows[0]?.c || '0', 10);

    res.json({
      total_vehicles: totalVehicles,
      overdue_count: overdueCount,
      due_today_count: dueTodayCount,
      due_this_week_count: dueThisWeekCount,
      due_soon_count: dueSoonCount,
      stale_km_count: staleKmCount,
      pdi_pending_count: pdiPendingCount,
      open_alerts_count: openAlertsCount,
      briefing: snapshot
        ? {
            snapshot_date: snapshot.snapshot_date,
            top_overdue: snapshot.top_overdue ?? [],
            generated_at: snapshot.created_at,
          }
        : null,
      last_updated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('getMonitoringSummary', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function listAlerts(req: Request, res: Response) {
  try {
    const status = (req.query.status as string) || 'open';
    const alertType = req.query.type as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

    const params: unknown[] = [status];
    let typeClause = '';
    if (alertType && alertType !== 'all') {
      params.push(alertType);
      typeClause = ` AND sa.alert_type = $${params.length}`;
    }
    params.push(limit);

    const r = await query(
      `SELECT sa.*,
              v.vehicle_number, v.chassis_number, v.owner_name, v.owner_phone,
              v.location, v.current_km,
              vs.service_no, vs.due_km, vs.due_date
       FROM service_alerts sa
       JOIN vehicles v ON v.id = sa.vehicle_id
       LEFT JOIN vehicle_services vs ON vs.id = sa.service_id
       WHERE sa.status = $1${typeClause}
       ORDER BY sa.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    res.json({ alerts: (r as any).rows });
  } catch (e) {
    console.error('listAlerts', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getOpenAlertCount(_req: Request, res: Response) {
  try {
    const r = await query(
      `SELECT COUNT(*) AS c FROM service_alerts WHERE status = 'open'`,
    );
    res.json({ count: parseInt((r as any).rows[0]?.c || '0', 10) });
  } catch (e) {
    console.error('getOpenAlertCount', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function acknowledgeAlert(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

    const userId = (req as any).user?.sub ?? null;
    const r = await query(
      `UPDATE service_alerts
       SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $1
       WHERE id = $2 AND status = 'open'
       RETURNING *`,
      [userId, id],
    );
    if ((r as any).rowCount === 0) {
      return res.status(404).json({ error: 'alert not found or already acknowledged' });
    }
    res.json({ alert: (r as any).rows[0] });
  } catch (e) {
    console.error('acknowledgeAlert', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function acknowledgeAllAlerts(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub ?? null;
    const r = await query(
      `UPDATE service_alerts
       SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $1
       WHERE status = 'open'
       RETURNING id`,
      [userId],
    );
    res.json({ acknowledged: (r as any).rowCount ?? 0 });
  } catch (e) {
    console.error('acknowledgeAllAlerts', e);
    res.status(500).json({ error: 'failed' });
  }
}

/** Resolve open alerts for a vehicle/service when condition is fixed. */
export async function resolveAlertsForVehicle(
  vehicleId: number,
  alertTypes?: string[],
): Promise<void> {
  try {
    if (alertTypes && alertTypes.length > 0) {
      await query(
        `UPDATE service_alerts SET status = 'resolved', acknowledged_at = now()
         WHERE vehicle_id = $1 AND status = 'open' AND alert_type = ANY($2)`,
        [vehicleId, alertTypes],
      );
    } else {
      await query(
        `UPDATE service_alerts SET status = 'resolved', acknowledged_at = now()
         WHERE vehicle_id = $1 AND status = 'open'`,
        [vehicleId],
      );
    }
  } catch (e) {
    console.error('resolveAlertsForVehicle', e);
  }
}

export { isStaleOdometer, isDueToday, isDueThisWeek, urgency, DUE_SOON_DAYS };
