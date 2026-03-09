import { Request, Response } from 'express';
import { query } from '../db';

const DEFAULT_KM_INTERVAL = 3000;
const DEFAULT_DAYS_INTERVAL = 90;
const DUE_SOON_DAYS = 7;
const DUE_SOON_KM = 500;

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        vehicle_number TEXT,
        chassis_number TEXT,
        vehicle_type TEXT,
        owner_name TEXT,
        owner_phone TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        location TEXT,
        purchase_date DATE,
        current_km INT DEFAULT 0,
        poi TEXT,
        remarks TEXT,
        created_by INT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS vehicle_services (
        id SERIAL PRIMARY KEY,
        vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        service_no INT NOT NULL,
        due_km INT,
        due_date DATE,
        actual_km INT,
        completion_date DATE,
        status TEXT DEFAULT 'pending',
        remarks TEXT,
        created_by INT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(vehicle_id, service_no)
      )
    `);
  } catch (e) {
    console.error('ensureTables vehicles', e);
  }
  tablesReady = true;
}

function urgency(currentKm: number, dueKm: number | null, dueDate: string | null): 'overdue' | 'due_soon' | 'ok' {
  const today = new Date().toISOString().slice(0, 10);
  const overdueByDate = dueDate && dueDate < today;
  const overdueByKm = dueKm != null && currentKm >= dueKm;
  if (overdueByDate || overdueByKm) return 'overdue';

  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const daysLeft = dueDateObj ? Math.ceil((dueDateObj.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 9999;
  const kmLeft = dueKm != null ? dueKm - currentKm : 9999;
  if (daysLeft <= DUE_SOON_DAYS || kmLeft <= DUE_SOON_KM) return 'due_soon';
  return 'ok';
}

export async function listVehicles(req: Request, res: Response) {
  try {
    await ensureTables();
    const r = await query(`
      SELECT v.*,
             (SELECT vs.id FROM vehicle_services vs
              WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
              ORDER BY vs.service_no ASC LIMIT 1) AS next_service_id,
             (SELECT vs.service_no FROM vehicle_services vs
              WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
              ORDER BY vs.service_no ASC LIMIT 1) AS next_service_no,
             (SELECT vs.due_km FROM vehicle_services vs
              WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
              ORDER BY vs.service_no ASC LIMIT 1) AS next_due_km,
             (SELECT vs.due_date FROM vehicle_services vs
              WHERE vs.vehicle_id = v.id AND vs.status = 'pending'
              ORDER BY vs.service_no ASC LIMIT 1) AS next_due_date
      FROM vehicles v
      ORDER BY v.created_at DESC
    `);
    const rows = (r as any).rows;
    const withUrgency = rows.map((row: any) => ({
      ...row,
      urgency: urgency(row.current_km || 0, row.next_due_km, row.next_due_date),
    }));
    res.json({ vehicles: withUrgency });
  } catch (e) {
    console.error('listVehicles', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function createVehicle(req: Request, res: Response) {
  try {
    await ensureTables();
    const userId = (req as any).user?.sub ?? null;
    const {
      vehicle_number, chassis_number, vehicle_type,
      owner_name, owner_phone, driver_name, driver_phone,
      location, purchase_date, current_km, poi, remarks,
    } = req.body;

    const purchaseKm = current_km != null ? parseInt(String(current_km), 10) : 0;
    const dueKm = purchaseKm + DEFAULT_KM_INTERVAL;
    let dueDate: string | null = null;
    if (purchase_date) {
      const d = new Date(purchase_date);
      d.setDate(d.getDate() + DEFAULT_DAYS_INTERVAL);
      dueDate = d.toISOString().slice(0, 10);
    }

    const ins = await query(
      `INSERT INTO vehicles (
        vehicle_number, chassis_number, vehicle_type,
        owner_name, owner_phone, driver_name, driver_phone,
        location, purchase_date, current_km, poi, remarks,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      RETURNING *`,
      [
        vehicle_number || null, chassis_number || null, vehicle_type || null,
        owner_name || null, owner_phone || null, driver_name || null, driver_phone || null,
        location || null, purchase_date || null, purchaseKm, poi || null, remarks || null,
        userId,
      ],
    );
    const vehicle = (ins as any).rows[0];
    await query(
      `INSERT INTO vehicle_services (vehicle_id, service_no, due_km, due_date, status, created_by, created_at, updated_at)
       VALUES ($1, 1, $2, $3, 'pending', $4, now(), now())`,
      [vehicle.id, dueKm, dueDate, userId],
    );
    res.status(201).json(vehicle);
  } catch (e) {
    console.error('createVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const {
      vehicle_number, chassis_number, vehicle_type,
      owner_name, owner_phone, driver_name, driver_phone,
      location, purchase_date, current_km, poi, remarks,
    } = req.body;

    const r = await query(
      `UPDATE vehicles SET
        vehicle_number=$1, chassis_number=$2, vehicle_type=$3,
        owner_name=$4, owner_phone=$5, driver_name=$6, driver_phone=$7,
        location=$8, purchase_date=$9, current_km=$10, poi=$11, remarks=$12,
        updated_at=now()
       WHERE id=$13 RETURNING *`,
      [
        vehicle_number ?? null, chassis_number ?? null, vehicle_type ?? null,
        owner_name ?? null, owner_phone ?? null, driver_name ?? null, driver_phone ?? null,
        location ?? null, purchase_date ?? null, current_km ?? null, poi ?? null, remarks ?? null,
        id,
      ],
    );
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('updateVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function patchCurrentKm(req: Request, res: Response) {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    const current_km = req.body.current_km != null ? parseInt(String(req.body.current_km), 10) : null;
    if (current_km == null || current_km < 0) return res.status(400).json({ error: 'current_km required and must be >= 0' });
    const r = await query('UPDATE vehicles SET current_km = $1, updated_at = now() WHERE id = $2 RETURNING *', [current_km, id]);
    if ((r as any).rowCount === 0) return res.status(404).json({ error: 'vehicle not found' });
    res.json((r as any).rows[0]);
  } catch (e) {
    console.error('patchCurrentKm', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function deleteVehicle(req: Request, res: Response) {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
    await query('DELETE FROM vehicles WHERE id=$1', [id]);
    res.json({ message: 'deleted' });
  } catch (e) {
    console.error('deleteVehicle', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function serviceDashboard(req: Request, res: Response) {
  try {
    await ensureTables();
    const r = await query(`
      SELECT v.id, v.vehicle_number, v.chassis_number, v.vehicle_type,
             v.owner_name, v.owner_phone, v.location, v.current_km,
             vs.id AS service_id, vs.service_no, vs.due_km, vs.due_date, vs.status
      FROM vehicles v
      INNER JOIN vehicle_services vs ON vs.vehicle_id = v.id AND vs.status = 'pending'
      ORDER BY v.id, vs.service_no ASC
    `);
    const rows = (r as any).rows;
    const today = new Date().toISOString().slice(0, 10);
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + DUE_SOON_DAYS);
    const sevenDaysStr = inSevenDays.toISOString().slice(0, 10);

    const items = rows.map((row: any) => {
      const currentKm = row.current_km || 0;
      const u = urgency(currentKm, row.due_km, row.due_date);
      let dueToday = false;
      let dueThisWeek = false;
      if (row.due_date) {
        dueToday = row.due_date === today;
        dueThisWeek = row.due_date >= today && row.due_date <= sevenDaysStr;
      }
      return {
        ...row,
        urgency: u,
        due_today: dueToday,
        due_this_week: dueThisWeek,
      };
    });

    const vehiclesCount = await query('SELECT COUNT(*) AS c FROM vehicles');
    const totalVehicles = parseInt((vehiclesCount as any).rows[0]?.c || '0', 10);
    const overdue = items.filter((i: any) => i.urgency === 'overdue').length;
    const dueToday = items.filter((i: any) => i.due_today).length;
    const dueThisWeek = items.filter((i: any) => i.due_this_week && !i.due_today).length;

    const order: Record<string, number> = { overdue: 0, due_soon: 1, ok: 2 };
    const sorted = [...items].sort((a: any, b: any) => (order[a.urgency] ?? 2) - (order[b.urgency] ?? 2));

    res.json({
      total_vehicles: totalVehicles,
      overdue_count: overdue,
      due_today_count: dueToday,
      due_this_week_count: dueThisWeek,
      pending_services: sorted,
    });
  } catch (e) {
    console.error('serviceDashboard', e);
    res.status(500).json({ error: 'failed' });
  }
}
