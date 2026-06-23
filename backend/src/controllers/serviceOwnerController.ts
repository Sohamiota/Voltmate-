import crypto from 'crypto';
import { Request, Response } from 'express';
import { query } from '../db';
import { normalizePhone } from '../utils/vehicleServiceRules';

function genOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function genToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function requestOwnerOtp(req: Request, res: Response) {
  try {
    const phoneRaw = req.body?.phone;
    if (!phoneRaw || typeof phoneRaw !== 'string') {
      return res.status(400).json({ error: 'phone required' });
    }
    const phone = normalizePhone(phoneRaw);
    if (phone.length < 10) {
      return res.status(400).json({ error: 'invalid phone number' });
    }

    const vehiclesR = await query(
      `SELECT id FROM vehicles WHERE RIGHT(REGEXP_REPLACE(COALESCE(owner_phone, ''), '\\D', '', 'g'), 10) = $1 LIMIT 1`,
      [phone],
    );
    if ((vehiclesR as any).rowCount === 0) {
      return res.status(404).json({ error: 'No vehicle found for this phone number' });
    }

    const otp = genOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await query(`DELETE FROM service_owner_otp WHERE owner_phone = $1`, [phone]);
    await query(
      `INSERT INTO service_owner_otp (owner_phone, otp_code, otp_expires_at) VALUES ($1, $2, $3)`,
      [phone, otp, expires],
    );

    console.log(`[serviceOwner] OTP for ${phone} → ${otp}`);
    res.json({ message: 'OTP sent', expires_in_minutes: 15 });
  } catch (e) {
    console.error('requestOwnerOtp', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function verifyOwnerOtp(req: Request, res: Response) {
  try {
    const phoneRaw = req.body?.phone;
    const otpRaw = req.body?.otp;
    if (!phoneRaw || !otpRaw) {
      return res.status(400).json({ error: 'phone and otp required' });
    }
    const phone = normalizePhone(String(phoneRaw));
    const otp = String(otpRaw).trim();
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'otp must be 6 digits' });
    }

    const r = await query(
      `DELETE FROM service_owner_otp
       WHERE owner_phone = $1 AND otp_code = $2 AND otp_expires_at > now()
       RETURNING id`,
      [phone, otp],
    );
    if ((r as any).rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const token = genToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO service_owner_tokens (owner_phone, token, expires_at) VALUES ($1, $2, $3)`,
      [phone, token, expires],
    );

    res.json({ token, expires_at: expires.toISOString() });
  } catch (e) {
    console.error('verifyOwnerOtp', e);
    res.status(500).json({ error: 'failed' });
  }
}

export async function getOwnerServiceStatus(req: Request, res: Response) {
  try {
    const auth = req.headers?.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization' });
    const [, token] = auth.split(' ');
    if (!token) return res.status(401).json({ error: 'Invalid authorization' });

    const tokR = await query(
      `SELECT owner_phone FROM service_owner_tokens WHERE token = $1 AND expires_at > now()`,
      [token],
    );
    if ((tokR as any).rowCount === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const phone = (tokR as any).rows[0].owner_phone;

    const vehiclesR = await query(
      `SELECT v.id, v.vehicle_number, v.chassis_number, v.vehicle_type,
              v.owner_name, v.current_km, v.purchase_date,
              vs.service_no, vs.due_km, vs.due_date, vs.status AS service_status,
              last_done.service_no AS last_done_no,
              last_done.completion_date AS last_done_date,
              last_done.actual_km AS last_done_km
       FROM vehicles v
       LEFT JOIN LATERAL (
         SELECT service_no, due_km, due_date, status
         FROM vehicle_services WHERE vehicle_id = v.id AND status = 'pending'
         ORDER BY service_no ASC LIMIT 1
       ) vs ON true
       LEFT JOIN LATERAL (
         SELECT service_no, completion_date, actual_km
         FROM vehicle_services WHERE vehicle_id = v.id AND status = 'done'
         ORDER BY service_no DESC LIMIT 1
       ) last_done ON true
       WHERE RIGHT(REGEXP_REPLACE(COALESCE(v.owner_phone, ''), '\\D', '', 'g'), 10) = $1
       ORDER BY v.created_at DESC`,
      [phone],
    );

    res.json({
      vehicles: (vehiclesR as any).rows,
      dealership_contact: {
        name: 'Voltwheels Service Desk',
        phone: process.env.DEALERSHIP_PHONE || '+91-XXXXXXXXXX',
      },
    });
  } catch (e) {
    console.error('getOwnerServiceStatus', e);
    res.status(500).json({ error: 'failed' });
  }
}
