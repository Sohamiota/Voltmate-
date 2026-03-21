import { Request, Response } from 'express';
import { query } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ─── [C-1 / H-5] JWT secret MUST come from environment ───────────────────────
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('[auth] JWT_SECRET is not set');
  return s;
}

// ─── [M-3] Cryptographically secure OTP ──────────────────────────────────────
function genOTP(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

// ─── [M-7] Password strength validation ──────────────────────────────────────
function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))          return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))          return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))          return 'Password must contain at least one number';
  return null;
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if ((exists as any).rowCount > 0)
      return res.status(409).json({ error: 'email already registered' });

    const hash    = await bcrypt.hash(password, 12);
    const otp     = genOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // ─── [C-2] Always register as 'employee' — no client-supplied role ────────
    await query(
      `INSERT INTO users
         (name, email, password_hash, is_verified, is_approved, role, otp_code, otp_expires_at, created_at)
       VALUES ($1,$2,$3,false,false,'employee',$4,$5,now())`,
      [name, email, hash, otp, expires],
    );

    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to:      email,
          from:    process.env.SENDGRID_FROM || 'no-reply@example.com',
          subject: 'Verify your account',
          text:    `Your OTP is ${otp}. It expires in 15 minutes.`,
          html:    `<p>Your OTP is <strong>${otp}</strong>. Expires in 15 minutes.</p>`,
        });
      } catch (e) {
        console.error('[auth] SendGrid error — falling back to log:', e);
        console.log(`[OTP] ${email} → ${otp}`);
      }
    } else {
      // No email provider — log OTP for admin to relay manually
      console.log(`[OTP] ${email} → ${otp}`);
    }

    res.status(202).json({ message: 'Registration received. Please verify your email.' });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function verify(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });

    const r = await query(
      `UPDATE users
         SET is_verified=true, otp_code=NULL, otp_expires_at=NULL
       WHERE email=$1 AND otp_code=$2 AND otp_expires_at > now()`,
      [email, otp],
    );
    if ((r as any).rowCount === 0)
      return res.status(400).json({ error: 'Invalid or expired OTP' });

    res.json({ message: 'Email verified. Await admin approval before logging in.' });
  } catch (err) {
    console.error('[verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const r = await query(
      'SELECT id, email, password_hash, is_verified, is_approved, role FROM users WHERE email=$1',
      [email],
    );

    const notFound = (r as any).rowCount === 0;
    const u        = notFound ? null : (r as any).rows[0];
    const ok       = notFound ? false : await bcrypt.compare(password, u.password_hash);

    if (notFound || !ok) return res.status(401).json({ error: 'Invalid credentials' });
    if (!u.is_verified)  return res.status(403).json({ error: 'Email not verified' });
    if (!u.is_approved)  return res.status(403).json({ error: 'Account pending approval' });

    // ─── [H-5] No hardcoded fallback; [C-5] 8h expiry; [M-4] HS256 pinned ───
    const token = jwt.sign(
      { sub: u.id, email: u.email, role: u.role },
      getJwtSecret(),
      { algorithm: 'HS256', expiresIn: '8h' },
    );

    res.json({ token });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function me(req: Request, res: Response) {
  res.json({ ok: true, user: (req as any).user });
}

export async function listEmployees(req: Request, res: Response) {
  try {
    const r = await query(
      `SELECT id, name, email, role, is_verified, is_approved, created_at
         FROM users WHERE is_approved = true ORDER BY created_at DESC`,
    );
    res.json({ employees: (r as any).rows });
  } catch (err) {
    console.error('[listEmployees]', err);
    res.status(500).json({ error: 'Failed' });
  }
}

export async function adminApprove(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    await query('UPDATE users SET is_approved=true WHERE id=$1', [id]);
    res.json({ message: 'approved' });
  } catch (err) {
    console.error('[adminApprove]', err);
    res.status(500).json({ error: 'Failed' });
  }
}
