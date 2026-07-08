import { Request, Response } from 'express';
import { query } from '../db';
import { logActivity } from '../utils/activityLog';
import { computeNextServiceDue } from '../utils/vehicleServiceRules';
import { optPlainText } from '../utils/validate';

async function loadVehicleForScheduling(vehicleId: number) {
  const r = await query(
    `SELECT id, vehicle_type, purchase_date, current_km FROM vehicles WHERE id = $1`,
    [vehicleId],
  );
  return (r as any).rows[0] as {
    id: number;
    vehicle_type?: string | null;
    purchase_date?: string | null;
    current_km?: number | null;
  } | undefined;
}

async function scheduleNextService(
  vehicleId: number,
  completedServiceNo: number,
  completionDate: string,
  completionKm: number,
  userId: number | null,
) {
  const vehicle = await loadVehicleForScheduling(vehicleId);
  if (!vehicle) return;

  const purchaseDate = vehicle.purchase_date
    ? String(vehicle.purchase_date).slice(0, 10)
    : null;
  const purchaseKm = vehicle.current_km ?? 0;

  const next = computeNextServiceDue(
    vehicle.vehicle_type,
    completedServiceNo,
    purchaseDate,
    purchaseKm,
    completionDate.slice(0, 10),
    completionKm,
  );

  await query(
    `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
     ON CONFLICT (vehicle_id, service_no) DO NOTHING`,
    [vehicleId, next.serviceNo, next.due_km, next.due_date, userId],
  );
}

export async function listServicesForVehicle(req: Request, res: Response) {
  try {
    const vehicleId = parseInt(req.params.id, 10);
    if (isNaN(vehicleId)) return res.status(400).json({ error: 'invalid vehicle id' });
    const r = await query(
      `SELECT * FROM vehicle_services WHERE vehicle_id = $1 ORDER BY service_no ASC`,
      [vehicleId],
    );
    res.json({ services: (r as any).rows });
  } catch (e) {
    console.error('listServicesForVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function upsertService(req: Request, res: Response) {
  try {
    const vehicleId = parseInt(req.params.id, 10);
    const serviceIdParam = req.params.svcId;
    if (isNaN(vehicleId)) return res.status(400).json({ error: 'invalid vehicle id' });

    const userId = (req as any).user?.sub ?? null;
    const { service_no, due_km, due_date, actual_km, completion_date, status, remarks, cost } = req.body;

    const vRemarks = optPlainText(remarks, 'note', 2000);
    if (vRemarks.error) return res.status(400).json({ error: `remarks: ${vRemarks.error}` });
    const safeRemarks = vRemarks.value;

    const serviceId = serviceIdParam === 'new' ? null : parseInt(serviceIdParam, 10);
    if (serviceIdParam !== 'new' && isNaN(serviceId!)) return res.status(400).json({ error: 'invalid service id' });

    if (serviceId) {
      const existing = await query(
        'SELECT * FROM vehicle_services WHERE id = $1 AND vehicle_id = $2',
        [serviceId, vehicleId],
      );
      if ((existing as any).rowCount === 0) return res.status(404).json({ error: 'service not found' });
    }

    const targetServiceNo = service_no != null ? parseInt(String(service_no), 10) : null;
    const actualKm = actual_km != null ? parseInt(String(actual_km), 10) : null;
    const newStatus = (status || 'pending').toLowerCase();

    const costNum = cost != null && cost !== '' ? parseFloat(String(cost)) : null;

    if (serviceId) {
      const existingRow = (await query(
        'SELECT service_no FROM vehicle_services WHERE id = $1 AND vehicle_id = $2',
        [serviceId, vehicleId],
      ) as any).rows[0];

      await query(
        `UPDATE vehicle_services SET
          due_km=$1, due_date=$2, actual_km=$3, completion_date=$4, status=$5, remarks=$6, cost=$7, updated_at=now()
         WHERE id=$8 AND vehicle_id=$9`,
        [due_km ?? null, due_date ?? null, actualKm, completion_date ?? null, newStatus, safeRemarks, isNaN(costNum as number) ? null : costNum, serviceId, vehicleId],
      );

      if (newStatus === 'done' && actualKm != null && completion_date && existingRow?.service_no) {
        await scheduleNextService(
          vehicleId,
          existingRow.service_no,
          completion_date,
          actualKm,
          userId,
        );
        await query(
          'UPDATE vehicles SET current_km = $1, km_updated_at = now(), updated_at = now() WHERE id = $2',
          [actualKm, vehicleId],
        );
        await query(
          `UPDATE service_alerts SET status = 'resolved', acknowledged_at = now()
           WHERE vehicle_id = $1 AND service_id = $2 AND status = 'open'`,
          [vehicleId, serviceId],
        );
        await logActivity('vehicle_service', serviceId, `svc-${serviceId}`, 'update', userId, 'Service marked done');
      }
    } else {
      const nextNo = await query(
        `SELECT COALESCE(MAX(service_no), 0) + 1 AS n FROM vehicle_services WHERE vehicle_id = $1`,
        [vehicleId],
      );
      const nextServiceNo = targetServiceNo ?? (nextNo as any).rows[0]?.n ?? 1;
      const ins = await query(
        `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, actual_km, completion_date, status, remarks, cost, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
         ON CONFLICT (vehicle_id, service_no) DO UPDATE SET
          due_km=EXCLUDED.due_km, due_date=EXCLUDED.due_date, actual_km=EXCLUDED.actual_km,
          completion_date=EXCLUDED.completion_date, status=EXCLUDED.status, remarks=EXCLUDED.remarks, cost=EXCLUDED.cost, updated_at=now()
         RETURNING *`,
        [vehicleId, nextServiceNo, due_km ?? null, due_date ?? null, actualKm, completion_date ?? null, newStatus, safeRemarks, isNaN(costNum as number) ? null : costNum, userId],
      );
      const row = (ins as any).rows[0];
      if (row && newStatus === 'done' && actualKm != null && completion_date) {
        await scheduleNextService(vehicleId, row.service_no, completion_date, actualKm, userId);
        await query(
          'UPDATE vehicles SET current_km = $1, km_updated_at = now(), updated_at = now() WHERE id = $2',
          [actualKm, vehicleId],
        );
        await logActivity('vehicle_service', row?.id, `svc-${row?.id}`, 'update', userId, 'Service marked done');
      }
    }

    const list = await query(
      'SELECT * FROM vehicle_services WHERE vehicle_id = $1 ORDER BY service_no ASC',
      [vehicleId],
    );
    res.json({ services: (list as any).rows });
  } catch (e) {
    console.error('upsertService', e);
    res.status(500).json({ error: 'failed' });
  }
}
