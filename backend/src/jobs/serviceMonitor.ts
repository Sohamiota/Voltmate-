import cron from 'node-cron';
import { query } from '../db';
import {
  AlertType,
  DEFAULT_PDI_CHECKLIST,
  isDueThisWeek,
  isDueToday,
  isStaleOdometer,
  PDI_DUE_DAYS,
  urgency,
} from '../utils/vehicleServiceRules';

async function upsertAlert(
  vehicleId: number,
  serviceId: number | null,
  alertType: AlertType,
  title: string,
  message: string,
  digestDate: string,
): Promise<void> {
  const existing = await query(
    `SELECT id FROM service_alerts
     WHERE vehicle_id = $1 AND alert_type = $2 AND status = 'open'
       AND (($3::int IS NULL AND service_id IS NULL) OR service_id = $3)
     LIMIT 1`,
    [vehicleId, alertType, serviceId],
  );
  if ((existing as any).rowCount > 0) return;

  await query(
    `INSERT INTO service_alerts (vehicle_id, service_id, alert_type, title, message, digest_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
    [vehicleId, serviceId, alertType, title, message, digestDate],
  );
}

export async function runServiceMonitor(): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  console.log(`[serviceMonitor] running at ${now.toISOString()}`);

  const vehiclesR = await query(`
    SELECT v.*,
           vs.id AS service_id, vs.service_no, vs.due_km, vs.due_date, vs.status AS svc_status
    FROM vehicles v
    LEFT JOIN LATERAL (
      SELECT id, service_no, due_km, due_date, status
      FROM vehicle_services
      WHERE vehicle_id = v.id AND status = 'pending'
      ORDER BY service_no ASC LIMIT 1
    ) vs ON true
  `);

  let overdueCount = 0;
  let dueTodayCount = 0;
  let dueThisWeekCount = 0;
  let dueSoonCount = 0;
  let staleKmCount = 0;
  let pdiPendingCount = 0;
  const topOverdue: Array<Record<string, unknown>> = [];

  for (const row of (vehiclesR as any).rows) {
    const label = row.vehicle_number || row.chassis_number || `Vehicle #${row.id}`;
    const currentKm = row.current_km || 0;

    if (isStaleOdometer(row.km_updated_at)) {
      staleKmCount++;
      await upsertAlert(
        row.id,
        null,
        'stale_odometer',
        'Stale odometer reading',
        `${label}: KM not updated in 30+ days (current: ${currentKm} km)`,
        today,
      );
    }

    const pdiStatus = row.pdi_status || 'pending';
    if (['pending', 'in_progress'].includes(pdiStatus)) {
      const pdiDue = row.pdi_due_date || row.purchase_date;
      if (!pdiDue || pdiDue <= today) {
        pdiPendingCount++;
        await upsertAlert(
          row.id,
          null,
          'pdi_pending',
          'PDI pending',
          `${label}: Pre-delivery inspection not completed`,
          today,
        );
      }
    }

    if (!row.service_id) continue;

    const u = urgency(currentKm, row.due_km, row.due_date);
    if (u === 'overdue') {
      overdueCount++;
      if (topOverdue.length < 10) {
        topOverdue.push({
          vehicle_id: row.id,
          label,
          owner_name: row.owner_name,
          due_date: row.due_date,
          due_km: row.due_km,
          service_no: row.service_no,
        });
      }
      await upsertAlert(
        row.id,
        row.service_id,
        'overdue',
        `Service #${row.service_no} overdue`,
        `${label}: Service #${row.service_no} is overdue (due ${row.due_date || '—'}, ${row.due_km ?? '—'} km)`,
        today,
      );
      if (row.due_km != null && currentKm >= row.due_km) {
        await upsertAlert(
          row.id,
          row.service_id,
          'km_overdue',
          'KM threshold reached',
          `${label}: Current KM ${currentKm} exceeds due KM ${row.due_km}`,
          today,
        );
      }
    } else if (u === 'due_soon') {
      dueSoonCount++;
      await upsertAlert(
        row.id,
        row.service_id,
        'due_soon',
        `Service #${row.service_no} due soon`,
        `${label}: Service #${row.service_no} due soon (${row.due_date || '—'})`,
        today,
      );
    }

    if (isDueToday(row.due_date)) {
      dueTodayCount++;
      await upsertAlert(
        row.id,
        row.service_id,
        'due_today',
        `Service #${row.service_no} due today`,
        `${label}: Service #${row.service_no} is due today`,
        today,
      );
    } else if (isDueThisWeek(row.due_date)) {
      dueThisWeekCount++;
    }
  }

  const alertsR = await query(`SELECT COUNT(*) AS c FROM service_alerts WHERE status = 'open'`);
  const openAlertsCount = parseInt((alertsR as any).rows[0]?.c || '0', 10);

  await query(
    `INSERT INTO service_snapshots (
       snapshot_date, overdue_count, due_today_count, due_this_week_count,
       due_soon_count, stale_km_count, pdi_pending_count, open_alerts_count, top_overdue
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (snapshot_date) DO UPDATE SET
       overdue_count = EXCLUDED.overdue_count,
       due_today_count = EXCLUDED.due_today_count,
       due_this_week_count = EXCLUDED.due_this_week_count,
       due_soon_count = EXCLUDED.due_soon_count,
       stale_km_count = EXCLUDED.stale_km_count,
       pdi_pending_count = EXCLUDED.pdi_pending_count,
       open_alerts_count = EXCLUDED.open_alerts_count,
       top_overdue = EXCLUDED.top_overdue,
       created_at = now()`,
    [
      today,
      overdueCount,
      dueTodayCount,
      dueThisWeekCount,
      dueSoonCount,
      staleKmCount,
      pdiPendingCount,
      openAlertsCount,
      JSON.stringify(topOverdue),
    ],
  );

  await query(
    `UPDATE vehicles SET
       pdi_status = COALESCE(pdi_status, 'pending'),
       pdi_checklist = CASE
         WHEN pdi_checklist IS NULL OR pdi_checklist = '[]'::jsonb
         THEN $1::jsonb ELSE pdi_checklist END,
       pdi_due_date = COALESCE(pdi_due_date, purchase_date + $2)
     WHERE purchase_date IS NOT NULL
       AND (pdi_due_date IS NULL OR pdi_checklist IS NULL OR pdi_checklist = '[]'::jsonb)`,
    [JSON.stringify(DEFAULT_PDI_CHECKLIST), PDI_DUE_DAYS],
  );

  console.log(
    `[serviceMonitor] done — overdue: ${overdueCount}, due today: ${dueTodayCount}, ` +
    `due soon: ${dueSoonCount}, stale KM: ${staleKmCount}, PDI pending: ${pdiPendingCount}`,
  );
}

export function startServiceMonitorJob(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      runServiceMonitor().catch(err => console.error('[serviceMonitor] unhandled error:', err));
    },
    { timezone: 'Asia/Kolkata' },
  );
  console.log('[serviceMonitor] cron scheduled — 08:00 IST daily');
}
