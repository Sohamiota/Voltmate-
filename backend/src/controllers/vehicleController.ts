import { Request, Response } from 'express';
import { query, pool } from '../db';
import { logActivity } from '../utils/activityLog';
import {
  DEFAULT_PDI_CHECKLIST,
  computeInitialServiceDue,
  isDueThisWeek,
  isDueToday,
  isStaleOdometer,
  PDI_DUE_DAYS,
  urgency,
} from '../utils/vehicleServiceRules';
import { parseVehicleTextFields } from '../utils/vehicleValidate';
import { MAX_VEHICLES_LIST } from '../utils/validate';

const VEHICLE_LIST_SQL = `
  SELECT v.*,
         s1.id AS s1_id, s1.due_km AS s1_due_km, s1.due_date AS s1_due_date,
         s1.actual_km AS s1_actual_km, s1.completion_date AS s1_completion_date,
         s1.status AS s1_status, s1.remarks AS s1_remarks, s1.cost AS s1_cost,
         s2.id AS s2_id, s2.due_km AS s2_due_km, s2.due_date AS s2_due_date,
         s2.actual_km AS s2_actual_km, s2.completion_date AS s2_completion_date,
         s2.status AS s2_status, s2.remarks AS s2_remarks, s2.cost AS s2_cost,
         s3.id AS s3_id, s3.due_km AS s3_due_km, s3.due_date AS s3_due_date,
         s3.actual_km AS s3_actual_km, s3.completion_date AS s3_completion_date,
         s3.status AS s3_status, s3.remarks AS s3_remarks, s3.cost AS s3_cost,
         nxt.id AS next_service_id, nxt.service_no AS next_service_no,
         nxt.due_km AS next_due_km, nxt.due_date AS next_due_date
  FROM vehicles v
  LEFT JOIN vehicle_services s1 ON s1.vehicle_id = v.id AND s1.service_no = 1
  LEFT JOIN vehicle_services s2 ON s2.vehicle_id = v.id AND s2.service_no = 2
  LEFT JOIN vehicle_services s3 ON s3.vehicle_id = v.id AND s3.service_no = 3
  LEFT JOIN LATERAL (
    SELECT id, service_no, due_km, due_date
    FROM vehicle_services
    WHERE vehicle_id = v.id AND status = 'pending'
    ORDER BY service_no ASC LIMIT 1
  ) nxt ON true
`;

function mapVehicleRow(row: any) {
  const u = urgency(row.current_km || 0, row.next_due_km, row.next_due_date);
  return {
    ...row,
    urgency: u,
    stale_km: isStaleOdometer(row.km_updated_at),
  };
}

export async function listVehicles(req: Request, res: Response) {
  try {
    const search = (req.query.search as string)?.trim().toLowerCase();
    const urgencyFilter = req.query.urgency as string | undefined;
    const location = req.query.location as string | undefined;
    const vehicleType = req.query.vehicle_type as string | undefined;
    const serviceNo = req.query.service_no as string | undefined;

    const r = await query(
      `${VEHICLE_LIST_SQL} ORDER BY v.created_at DESC LIMIT $1`,
      [MAX_VEHICLES_LIST],
    );
    let rows = (r as any).rows.map(mapVehicleRow);

    if (search) {
      rows = rows.filter((row: any) => {
        const hay = [
          row.vehicle_number, row.chassis_number, row.owner_name,
          row.owner_phone, row.driver_name, row.driver_phone, row.location,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(search);
      });
    }
    if (urgencyFilter && urgencyFilter !== 'all') {
      rows = rows.filter((row: any) => row.urgency === urgencyFilter);
    }
    if (location) {
      rows = rows.filter((row: any) => (row.location || '').toLowerCase() === location.toLowerCase());
    }
    if (vehicleType) {
      rows = rows.filter((row: any) => (row.vehicle_type || '').toLowerCase() === vehicleType.toLowerCase());
    }
    if (serviceNo) {
      const n = parseInt(serviceNo, 10);
      if (!isNaN(n)) rows = rows.filter((row: any) => row.next_service_no === n);
    }

    res.json({ vehicles: rows, limit: MAX_VEHICLES_LIST, truncated: rows.length >= MAX_VEHICLES_LIST });
  } catch (e) {
    console.error('listVehicles', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getVehicle(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

    const r = await query(`${VEHICLE_LIST_SQL} WHERE v.id = $1`, [id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });

    const servicesR = await query(
      `SELECT * FROM vehicle_services WHERE vehicle_id = $1 ORDER BY service_no ASC`,
      [id],
    );

    res.json({
      vehicle: mapVehicleRow((r as any).rows[0]),
      services: (servicesR as any).rows,
    });
  } catch (e) {
    console.error('getVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function createVehicle(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub ?? null;
    const body = req.body || {};
    const parsed = parseVehicleTextFields(body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const {
      vehicle_number, chassis_number, vehicle_type,
      owner_name, owner_phone, driver_name, driver_phone,
      location, purchase_date, pdi, speak_with, remarks,
    } = parsed.fields;

    const current_km = body.current_km != null ? parseInt(String(body.current_km), 10) : 0;
    const purchaseKm = Number.isFinite(current_km) && current_km >= 0 ? current_km : 0;
    const purchaseDateStr = purchase_date ? String(purchase_date).slice(0, 10) : null;
    const firstService = computeInitialServiceDue(vehicle_type, purchaseDateStr, purchaseKm);
    let pdiDueDate: string | null = null;
    if (purchase_date) {
      const pdiD = new Date(purchase_date);
      pdiD.setDate(pdiD.getDate() + PDI_DUE_DAYS);
      pdiDueDate = pdiD.toISOString().slice(0, 10);
    }

    const ins = await query(
      `INSERT INTO vehicles (
        vehicle_number, chassis_number, vehicle_type,
        owner_name, owner_phone, driver_name, driver_phone,
        location, purchase_date, current_km, pdi, pdi_status, pdi_due_date, pdi_checklist,
        speak_with, remarks, km_updated_at, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15,now(),$16,now(),now())
      RETURNING *`,
      [
        vehicle_number, chassis_number, vehicle_type,
        owner_name, owner_phone, driver_name, driver_phone,
        location, purchase_date, purchaseKm, pdi, pdiDueDate,
        JSON.stringify(DEFAULT_PDI_CHECKLIST), speak_with, remarks, userId,
      ],
    );
    const vehicle = (ins as any).rows[0];
    await query(
      `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
       VALUES ($1, 1, $2, $3, 'pending', $4, now(), now())`,
      [vehicle.id, firstService.due_km, firstService.due_date, userId],
    );
    await logActivity('vehicle', vehicle.id, vehicle.vehicle_number || vehicle.chassis_number, 'create', userId);
    res.status(201).json(vehicle);
  } catch (e) {
    console.error('createVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const userId = (req as any).user?.sub ?? null;
    const body = req.body || {};
    const parsed = parseVehicleTextFields(body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const {
      vehicle_number, chassis_number, vehicle_type,
      owner_name, owner_phone, driver_name, driver_phone,
      location, purchase_date, pdi, speak_with, remarks,
    } = parsed.fields;

    const current_km = body.current_km != null ? parseInt(String(body.current_km), 10) : null;

    const r = await query(
      `UPDATE vehicles SET
        vehicle_number=$1, chassis_number=$2, vehicle_type=$3,
        owner_name=$4, owner_phone=$5, driver_name=$6, driver_phone=$7,
        location=$8, purchase_date=$9, current_km=$10, pdi=$11, speak_with=$12, remarks=$13,
        updated_at=now()
       WHERE id=$14 RETURNING *`,
      [
        vehicle_number, chassis_number, vehicle_type,
        owner_name, owner_phone, driver_name, driver_phone,
        location, purchase_date, current_km, pdi,
        speak_with, remarks, id,
      ],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });
    await logActivity('vehicle', id, vehicle_number || chassis_number || String(id), 'update', userId);
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('updateVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function patchCurrentKm(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const userId = (req as any).user?.sub ?? null;
    const current_km = req.body.current_km != null ? parseInt(String(req.body.current_km), 10) : null;
    if (current_km == null || current_km < 0) {
      return res.status(400).json({ error: 'current_km required and must be >= 0' });
    }
    const r = await query(
      `UPDATE vehicles SET current_km = $1, km_updated_at = now(), updated_at = now()
       WHERE id = $2 RETURNING *`,
      [current_km, id],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });
    await logActivity('vehicle', id, String(id), 'update', userId, `KM updated to ${current_km}`);
    await query(
      `UPDATE service_alerts SET status = 'resolved', acknowledged_at = now()
       WHERE vehicle_id = $1 AND alert_type = 'stale_odometer' AND status = 'open'`,
      [id],
    );
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('patchCurrentKm', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updatePdi(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const userId = (req as any).user?.sub ?? null;
    const { pdi_status, pdi_checklist, pdi_due_date } = req.body;

    const status = pdi_status || 'pending';
    const checklist = pdi_checklist ? JSON.stringify(pdi_checklist) : null;

    const r = await query(
      `UPDATE vehicles SET
         pdi_status = $1,
         pdi_checklist = COALESCE($2::jsonb, pdi_checklist),
         pdi_due_date = COALESCE($3, pdi_due_date),
         pdi_completed_at = CASE WHEN $1 IN ('done', 'waived') THEN COALESCE(pdi_completed_at, now()) ELSE NULL END,
         updated_at = now()
       WHERE id = $4 RETURNING *`,
      [status, checklist, pdi_due_date ?? null, id],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });

    if (['done', 'waived'].includes(status)) {
      await query(
        `UPDATE service_alerts SET status = 'resolved', acknowledged_at = now()
         WHERE vehicle_id = $1 AND alert_type = 'pdi_pending' AND status = 'open'`,
        [id],
      );
    }
    await logActivity('vehicle_pdi', id, String(id), 'update', userId, `PDI status: ${status}`);
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('updatePdi', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteVehicle(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const userId = (req as any).user?.sub ?? null;
    await query('DELETE FROM vehicles WHERE id=$1', [id]);
    await logActivity('vehicle', id, String(id), 'delete', userId);
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error('deleteVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  const sep = t.includes('/') ? '/' : '-';
  const parts = t.split(sep).map(p => p.trim());
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  let y: string, m: string, d: string;
  if (c.length === 4) { d = a; m = b; y = c; }
  else if (a.length === 4) { y = a; m = b; d = c; }
  else return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export async function importVehicles(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.sub ?? null;
    const vehicles = req.body?.vehicles;
    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ error: 'body.vehicles must be a non-empty array' });
    }

    const client = await pool.connect();
    const importedIds: number[] = [];
    try {
      await client.query('BEGIN');
      for (let i = 0; i < vehicles.length; i++) {
        const row = vehicles[i];
        const parsed = parseVehicleTextFields(row as Record<string, unknown>);
        if (parsed.error) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `vehicles[${i}]: ${parsed.error}` });
        }
        const f = parsed.fields;
        const chassis_number = f.chassis_number ?? f.vehicle_number ?? null;
        const vehicle_number = f.vehicle_number ?? chassis_number ?? null;
        const purchase_date = normalizeDate(f.purchase_date ?? (row as any).purchase_date);
        const current_km = row.current_km != null ? parseInt(String(row.current_km), 10) : 0;
        let pdiDueDate: string | null = null;
        if (purchase_date) {
          const pdiD = new Date(purchase_date);
          pdiD.setDate(pdiD.getDate() + PDI_DUE_DAYS);
          pdiDueDate = pdiD.toISOString().slice(0, 10);
        }

        const ins = await client.query(
          `INSERT INTO vehicles (
            vehicle_number, chassis_number, vehicle_type,
            owner_name, owner_phone, driver_name, driver_phone,
            location, purchase_date, current_km, pdi, pdi_status, pdi_due_date, pdi_checklist,
            speak_with, remarks, km_updated_at, created_by, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15,now(),$16,now(),now())
          RETURNING id`,
          [
            vehicle_number, chassis_number, f.vehicle_type,
            f.owner_name, f.owner_phone,
            f.driver_name, f.driver_phone,
            f.location, purchase_date, isNaN(current_km) ? 0 : current_km,
            f.pdi, pdiDueDate, JSON.stringify(DEFAULT_PDI_CHECKLIST),
            f.speak_with, f.remarks, userId,
          ],
        );
        const vehicleId = (ins as any).rows[0]?.id;
        if (!vehicleId) continue;
        importedIds.push(vehicleId);

        const services = Array.isArray(row.services) ? row.services : [];
        if (services.length === 0) {
          const purchaseDateStr = purchase_date ? String(purchase_date).slice(0, 10) : null;
          const firstService = computeInitialServiceDue(
            row.vehicle_type ?? null,
            purchaseDateStr,
            isNaN(current_km) ? 0 : current_km,
          );
          await client.query(
            `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
             VALUES ($1, 1, $2, $3, 'pending', $4, now(), now())
             ON CONFLICT (vehicle_id, service_no) DO NOTHING`,
            [vehicleId, firstService.due_km, firstService.due_date, userId],
          );
        }

        let lastActualKm = current_km;
        for (const svc of services) {
          const service_no = svc.service_no != null ? parseInt(String(svc.service_no), 10) : null;
          if (service_no == null || isNaN(service_no)) continue;
          await client.query(
            `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, actual_km, completion_date, status, remarks, created_by, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
             ON CONFLICT (vehicle_id, service_no) DO UPDATE SET
              due_km=EXCLUDED.due_km, due_date=EXCLUDED.due_date, actual_km=EXCLUDED.actual_km,
              completion_date=EXCLUDED.completion_date, status=EXCLUDED.status, remarks=EXCLUDED.remarks, updated_at=now()`,
            [
              vehicleId, service_no,
              svc.due_km != null ? parseInt(String(svc.due_km), 10) : null,
              normalizeDate(svc.due_date),
              svc.actual_km != null ? parseInt(String(svc.actual_km), 10) : null,
              normalizeDate(svc.completion_date),
              (svc.status || 'pending').toLowerCase(),
              svc.remarks ?? null, userId,
            ],
          );
          if (svc.actual_km != null) lastActualKm = parseInt(String(svc.actual_km), 10);
        }
        if (lastActualKm > 0) {
          await client.query(
            'UPDATE vehicles SET current_km = $1, km_updated_at = now(), updated_at = now() WHERE id = $2',
            [lastActualKm, vehicleId],
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    await logActivity('vehicle_import', null, 'bulk', 'create', userId, `Imported ${importedIds.length} vehicles`);
    res.status(201).json({ imported: importedIds.length, ids: importedIds });
  } catch (e) {
    console.error('importVehicles', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function serviceDashboard(req: Request, res: Response) {
  try {
    const r = await query(`
      SELECT v.id, v.current_km,
             COALESCE(v.km_updated_at, v.updated_at) AS km_updated_at,
             vs.due_km, vs.due_date
      FROM vehicles v
      INNER JOIN vehicle_services vs ON vs.vehicle_id = v.id AND vs.status = 'pending'
    `);

    let overdue = 0;
    let dueSoon = 0;
    let dueToday = 0;
    let dueThisWeek = 0;
    let staleKm = 0;

    for (const row of (r as any).rows) {
      const currentKm = row.current_km || 0;
      const u = urgency(currentKm, row.due_km, row.due_date);
      if (u === 'overdue') overdue += 1;
      if (u === 'due_soon') dueSoon += 1;
      if (isDueToday(row.due_date)) dueToday += 1;
      else if (isDueThisWeek(row.due_date)) dueThisWeek += 1;
      if (isStaleOdometer(row.km_updated_at)) staleKm += 1;
    }

    const vehiclesCount = await query('SELECT COUNT(*) AS c FROM vehicles');
    const totalVehicles = parseInt((vehiclesCount as any).rows[0]?.c || '0', 10);

    let openAlerts = 0;
    let snapshot: Record<string, unknown> | null = null;
    try {
      const alertsR = await query(`SELECT COUNT(*) AS c FROM service_alerts WHERE status = 'open'`);
      openAlerts = parseInt((alertsR as any).rows[0]?.c || '0', 10);
      const today = new Date().toISOString().slice(0, 10);
      const snapR = await query(`SELECT * FROM service_snapshots WHERE snapshot_date = $1`, [today]);
      snapshot = (snapR as any).rows[0] ?? null;
    } catch (alertErr) {
      console.warn('serviceDashboard monitoring tables unavailable', alertErr);
    }

    res.json({
      total_vehicles: totalVehicles,
      overdue_count: overdue,
      due_today_count: dueToday,
      due_this_week_count: dueThisWeek,
      due_soon_count: dueSoon,
      stale_km_count: staleKm,
      open_alerts_count: openAlerts,
      briefing: snapshot
        ? { snapshot_date: snapshot.snapshot_date, top_overdue: snapshot.top_overdue ?? [], generated_at: snapshot.created_at }
        : null,
      last_updated: new Date().toISOString(),
    });
  } catch (e) {
    console.error('serviceDashboard', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function exportVehiclesCSV(req: Request, res: Response) {
  try {
    const r = await query(`
      SELECT v.owner_name, v.owner_phone,
             s1.due_km AS s1_due_km, s1.due_date AS s1_due_date, s1.actual_km AS s1_actual_km,
             s1.completion_date AS s1_completion_date, s1.status AS s1_status, s1.cost AS s1_cost,
             s2.due_km AS s2_due_km, s2.due_date AS s2_due_date, s2.actual_km AS s2_actual_km,
             s2.completion_date AS s2_completion_date, s2.status AS s2_status, s2.cost AS s2_cost,
             s3.due_km AS s3_due_km, s3.due_date AS s3_due_date, s3.actual_km AS s3_actual_km,
             s3.completion_date AS s3_completion_date, s3.status AS s3_status, s3.cost AS s3_cost
      FROM vehicles v
      LEFT JOIN vehicle_services s1 ON s1.vehicle_id = v.id AND s1.service_no = 1
      LEFT JOIN vehicle_services s2 ON s2.vehicle_id = v.id AND s2.service_no = 2
      LEFT JOIN vehicle_services s3 ON s3.vehicle_id = v.id AND s3.service_no = 3
      ORDER BY v.created_at DESC
      LIMIT $1
    `, [MAX_VEHICLES_LIST]);
    const rows = (r as any).rows;
    const header = [
      'owner_name', 'owner_phone',
      '1st_service_km', '1st_service_date', '1st_service_status', '1st_service_cost',
      '2nd_service_km', '2nd_service_date', '2nd_service_status', '2nd_service_cost',
      '3rd_service_km', '3rd_service_date', '3rd_service_status', '3rd_service_cost',
    ];
    const csvRows = rows.map((row: any) => {
      const s1Done = row.s1_status === 'done';
      const s2Done = row.s2_status === 'done';
      const s3Done = row.s3_status === 'done';
      return [
        row.owner_name ?? '', row.owner_phone ?? '',
        (s1Done ? row.s1_actual_km : row.s1_due_km) ?? '',
        (s1Done ? row.s1_completion_date : row.s1_due_date) ?? '',
        row.s1_status ?? '', row.s1_cost ?? '',
        (s2Done ? row.s2_actual_km : row.s2_due_km) ?? '',
        (s2Done ? row.s2_completion_date : row.s2_due_date) ?? '',
        row.s2_status ?? '', row.s2_cost ?? '',
        (s3Done ? row.s3_actual_km : row.s3_due_km) ?? '',
        (s3Done ? row.s3_completion_date : row.s3_due_date) ?? '',
        row.s3_status ?? '', row.s3_cost ?? '',
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(',')].concat(csvRows).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vehicles-services.csv"');
    res.send(csv);
  } catch (e) {
    console.error('exportVehiclesCSV', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getFilterOptions(_req: Request, res: Response) {
  try {
    const locR = await query(
      `SELECT DISTINCT location FROM vehicles WHERE location IS NOT NULL AND location != '' ORDER BY location`,
    );
    const typeR = await query(
      `SELECT DISTINCT vehicle_type FROM vehicles WHERE vehicle_type IS NOT NULL AND vehicle_type != '' ORDER BY vehicle_type`,
    );
    res.json({
      locations: (locR as any).rows.map((r: any) => r.location),
      vehicle_types: (typeR as any).rows.map((r: any) => r.vehicle_type),
    });
  } catch (e) {
    console.error('getFilterOptions', e);
    res.status(500).json({ error: 'failed' });
  }
}
