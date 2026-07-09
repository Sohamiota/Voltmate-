import { Request, Response } from 'express';
import { query } from '../db';
import { urgency, isDueThisWeek, isDueToday, isStaleOdometer } from '../utils/vehicleServiceRules';

function normalizeCustomerName(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  return t || 'Unassigned';
}

/** GET /api/v1/vehicles/customers — fleet grouped by owner (customer) name */
export async function listCustomerGroups(_req: Request, res: Response) {
  try {
    const r = await query(`
      SELECT v.id, v.vehicle_number, v.chassis_number, v.vehicle_type,
             v.owner_name, v.owner_phone, v.location, v.current_km,
             COALESCE(v.km_updated_at, v.updated_at) AS km_updated_at,
             vs.id AS pending_service_id, vs.service_no AS pending_service_no,
             vs.due_km AS pending_due_km, vs.due_date AS pending_due_date
      FROM vehicles v
      LEFT JOIN LATERAL (
        SELECT id, service_no, due_km, due_date
        FROM vehicle_services
        WHERE vehicle_id = v.id AND status = 'pending'
        ORDER BY service_no ASC LIMIT 1
      ) vs ON true
      ORDER BY v.owner_name NULLS LAST, v.created_at DESC
    `);

    type Group = {
      customer_name: string;
      vehicle_count: number;
      overdue_count: number;
      due_soon_count: number;
      due_this_week_count: number;
      vehicles: Array<Record<string, unknown>>;
    };

    const map = new Map<string, Group>();

    for (const row of (r as any).rows) {
      const name = normalizeCustomerName(row.owner_name);
      if (!map.has(name)) {
        map.set(name, {
          customer_name: name,
          vehicle_count: 0,
          overdue_count: 0,
          due_soon_count: 0,
          due_this_week_count: 0,
          vehicles: [],
        });
      }
      const g = map.get(name)!;
      g.vehicle_count += 1;

      const currentKm = row.current_km || 0;
      const u = row.pending_service_id
        ? urgency(currentKm, row.pending_due_km, row.pending_due_date)
        : 'ok';
      if (u === 'overdue') g.overdue_count += 1;
      if (u === 'due_soon') g.due_soon_count += 1;
      if (row.pending_due_date && isDueThisWeek(row.pending_due_date)) g.due_this_week_count += 1;

      g.vehicles.push({
        id: row.id,
        vehicle_number: row.vehicle_number,
        chassis_number: row.chassis_number,
        vehicle_type: row.vehicle_type,
        owner_phone: row.owner_phone,
        location: row.location,
        current_km: row.current_km,
        pending_service_id: row.pending_service_id,
        pending_service_no: row.pending_service_no,
        pending_due_km: row.pending_due_km,
        pending_due_date: row.pending_due_date,
        urgency: u,
        due_today: isDueToday(row.pending_due_date),
        stale_km: isStaleOdometer(row.km_updated_at),
      });
    }

    const customers = Array.from(map.values()).sort(
      (a, b) =>
        b.overdue_count - a.overdue_count ||
        b.due_soon_count - a.due_soon_count ||
        b.vehicle_count - a.vehicle_count ||
        a.customer_name.localeCompare(b.customer_name),
    );

    res.json({ customers });
  } catch (e) {
    console.error('listCustomerGroups', e);
    res.status(500).json({ error: 'failed' });
  }
}

/** GET /api/v1/vehicles/customers/:customerKey — vehicles + service history for one customer */
export async function getCustomerDetail(req: Request, res: Response) {
  try {
    const customerName = normalizeCustomerName(decodeURIComponent(req.params.customerKey || ''));

    const vehiclesR = await query(
      `SELECT v.*,
              nxt.id AS next_service_id, nxt.service_no AS next_service_no,
              nxt.due_km AS next_due_km, nxt.due_date AS next_due_date
       FROM vehicles v
       LEFT JOIN LATERAL (
         SELECT id, service_no, due_km, due_date
         FROM vehicle_services WHERE vehicle_id = v.id AND status = 'pending'
         ORDER BY service_no ASC LIMIT 1
       ) nxt ON true
       WHERE COALESCE(NULLIF(TRIM(v.owner_name), ''), 'Unassigned') = $1
       ORDER BY v.created_at DESC`,
      [customerName],
    );

    const vehicles = (vehiclesR as any).rows;
    const vehicleIds = vehicles.map((v: { id: number }) => v.id);

    let completedServices: unknown[] = [];
    if (vehicleIds.length > 0) {
      const svcR = await query(
        `SELECT vs.*, v.vehicle_number, v.chassis_number, v.vehicle_type
         FROM vehicle_services vs
         JOIN vehicles v ON v.id = vs.vehicle_id
         WHERE vs.vehicle_id = ANY($1::int[])
         ORDER BY vs.completion_date DESC NULLS LAST, vs.service_no DESC
         LIMIT 50`,
        [vehicleIds],
      );
      completedServices = (svcR as any).rows;
    }

    let logs: unknown[] = [];
    if (vehicleIds.length > 0) {
      const logR = await query(
        `SELECT * FROM activity_log
         WHERE (entity_type = 'vehicle' AND entity_id = ANY($1::int[]))
            OR (entity_type = 'vehicle_service' AND entity_id IN (
                  SELECT id FROM vehicle_services WHERE vehicle_id = ANY($1::int[])
                ))
         ORDER BY performed_at DESC LIMIT 100`,
        [vehicleIds],
      );
      logs = (logR as any).rows;
    }

    res.json({
      customer_name: customerName,
      vehicles,
      services: completedServices,
      activity_log: logs,
    });
  } catch (e) {
    console.error('getCustomerDetail', e);
    res.status(500).json({ error: 'failed' });
  }
}
