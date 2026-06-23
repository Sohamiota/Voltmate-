import { Request, Response } from 'express';
import { query } from '../db';

export async function getServiceAnalytics(req: Request, res: Response) {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);

    const completedR = await query(
      `SELECT COUNT(*) AS c,
              COALESCE(SUM(cost), 0) AS total_cost,
              COALESCE(AVG(cost), 0) AS avg_cost
       FROM vehicle_services
       WHERE status = 'done'
         AND completion_date >= $1 AND completion_date <= $2`,
      [from, to],
    );
    const completed = (completedR as any).rows[0];

    const byMonthR = await query(
      `SELECT to_char(completion_date, 'YYYY-MM') AS month,
              COUNT(*) AS completions,
              COALESCE(SUM(cost), 0) AS total_cost
       FROM vehicle_services
       WHERE status = 'done' AND completion_date >= $1 AND completion_date <= $2
       GROUP BY 1 ORDER BY 1`,
      [from, to],
    );

    const byLocationR = await query(
      `SELECT v.location, COUNT(*) AS completions, COALESCE(SUM(vs.cost), 0) AS total_cost
       FROM vehicle_services vs
       JOIN vehicles v ON v.id = vs.vehicle_id
       WHERE vs.status = 'done' AND vs.completion_date >= $1 AND vs.completion_date <= $2
       GROUP BY v.location ORDER BY completions DESC`,
      [from, to],
    );

    const byTypeR = await query(
      `SELECT v.vehicle_type, COUNT(*) AS completions, COALESCE(SUM(vs.cost), 0) AS total_cost
       FROM vehicle_services vs
       JOIN vehicles v ON v.id = vs.vehicle_id
       WHERE vs.status = 'done' AND vs.completion_date >= $1 AND vs.completion_date <= $2
       GROUP BY v.vehicle_type ORDER BY completions DESC`,
      [from, to],
    );

    const fleetR = await query(`
      SELECT
        COUNT(DISTINCT v.id) AS total_vehicles,
        COUNT(DISTINCT v.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM vehicle_services vs
            WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
              AND (vs.due_date < CURRENT_DATE OR v.current_km >= vs.due_km)
          )
        ) AS overdue_vehicles,
        COUNT(DISTINCT v.id) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM vehicle_services vs WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
          )
        ) AS no_pending_service
      FROM vehicles v
    `);
    const fleet = (fleetR as any).rows[0];

    const alertsR = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS open_alerts,
         COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_alerts
       FROM service_alerts
       WHERE created_at >= $1::date AND created_at <= ($2::date + interval '1 day')`,
      [from, to],
    );
    const alerts = (alertsR as any).rows[0];

    res.json({
      range: { from, to },
      completions: {
        count: parseInt(completed?.c || '0', 10),
        total_cost: parseFloat(completed?.total_cost || '0'),
        avg_cost: parseFloat(completed?.avg_cost || '0'),
      },
      by_month: (byMonthR as any).rows,
      by_location: (byLocationR as any).rows,
      by_vehicle_type: (byTypeR as any).rows,
      fleet_health: {
        total_vehicles: parseInt(fleet?.total_vehicles || '0', 10),
        overdue_vehicles: parseInt(fleet?.overdue_vehicles || '0', 10),
        no_pending_service: parseInt(fleet?.no_pending_service || '0', 10),
        overdue_pct: fleet?.total_vehicles
          ? Math.round((parseInt(fleet.overdue_vehicles, 10) / parseInt(fleet.total_vehicles, 10)) * 100)
          : 0,
      },
      alerts_workload: {
        open: parseInt(alerts?.open_alerts || '0', 10),
        acknowledged: parseInt(alerts?.acknowledged_alerts || '0', 10),
      },
    });
  } catch (e) {
    console.error('getServiceAnalytics', e);
    res.status(500).json({ error: 'failed' });
  }
}
