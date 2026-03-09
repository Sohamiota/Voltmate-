import { Request, Response } from 'express';
import { query } from '../db';

const DEFAULT_KM_INTERVAL = 3000;
const DEFAULT_DAYS_INTERVAL = 90;

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
    const { service_no, due_km, due_date, actual_km, completion_date, status, remarks } = req.body;

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

    if (serviceId) {
      await query(
        `UPDATE vehicle_services SET
          due_km=$1, due_date=$2, actual_km=$3, completion_date=$4, status=$5, remarks=$6, updated_at=now()
         WHERE id=$7 AND vehicle_id=$8`,
        [due_km ?? null, due_date ?? null, actualKm, completion_date ?? null, newStatus, remarks ?? null, serviceId, vehicleId],
      );

      if (newStatus === 'done' && actualKm != null && completion_date) {
        const nextNo = await query(
          `SELECT COALESCE(MAX(service_no), 0) + 1 AS n FROM vehicle_services WHERE vehicle_id = $1`,
          [vehicleId],
        );
        const nextServiceNo = (nextNo as any).rows[0]?.n || 1;
        const nextDueKm = actualKm + DEFAULT_KM_INTERVAL;
        const compDate = new Date(completion_date);
        compDate.setDate(compDate.getDate() + DEFAULT_DAYS_INTERVAL);
        const nextDueDate = compDate.toISOString().slice(0, 10);
        await query(
          `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
           ON CONFLICT (vehicle_id, service_no) DO NOTHING`,
          [vehicleId, nextServiceNo, nextDueKm, nextDueDate, userId],
        );
        await query(
          'UPDATE vehicles SET current_km = $1, updated_at = now() WHERE id = $2',
          [actualKm, vehicleId],
        );
      }
    } else {
      const nextNo = await query(
        `SELECT COALESCE(MAX(service_no), 0) + 1 AS n FROM vehicle_services WHERE vehicle_id = $1`,
        [vehicleId],
      );
      const nextServiceNo = targetServiceNo ?? (nextNo as any).rows[0]?.n ?? 1;
      const ins = await query(
        `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, actual_km, completion_date, status, remarks, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
         ON CONFLICT (vehicle_id, service_no) DO UPDATE SET
          due_km=EXCLUDED.due_km, due_date=EXCLUDED.due_date, actual_km=EXCLUDED.actual_km,
          completion_date=EXCLUDED.completion_date, status=EXCLUDED.status, remarks=EXCLUDED.remarks, updated_at=now()
         RETURNING *`,
        [vehicleId, nextServiceNo, due_km ?? null, due_date ?? null, actualKm, completion_date ?? null, newStatus, remarks ?? null, userId],
      );
      const row = (ins as any).rows[0];
      if (row && newStatus === 'done' && actualKm != null && completion_date) {
        const nextDueKm = actualKm + DEFAULT_KM_INTERVAL;
        const compDate = new Date(completion_date);
        compDate.setDate(compDate.getDate() + DEFAULT_DAYS_INTERVAL);
        const nextDueDate = compDate.toISOString().slice(0, 10);
        await query(
          `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'pending', $5, now(), now())
           ON CONFLICT (vehicle_id, service_no) DO NOTHING`,
          [vehicleId, nextServiceNo + 1, nextDueKm, nextDueDate, userId],
        );
        await query(
          'UPDATE vehicles SET current_km = $1, updated_at = now() WHERE id = $2',
          [actualKm, vehicleId],
        );
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
