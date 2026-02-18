import { Request, Response } from 'express';
import { query } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'invalid request' });
    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if ((exists as any).rowCount > 0) return res.status(409).json({ error: 'email exists' });
    const hash = await bcrypt.hash(password, 10);
    const otp = genOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await query(
      `INSERT INTO users (name,email,password_hash,is_verified,is_approved,role,otp_code,otp_expires_at,created_at)
       VALUES ($1,$2,$3,false,false,'employee',$4,$5,now()) RETURNING id`,
      [name, email, hash, otp, expires]
    );
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM || 'no-reply@example.com',
          subject: 'Your OTP code',
          text: `Your OTP is ${otp}. It expires in 15 minutes.`,
          html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 15 minutes.</p>`,
        });
      } catch (e) {
        console.error('sendgrid error', e);
        console.log('OTP for', email, otp);
      }
    } else {
      console.log('OTP for', email, otp);
    }
    res.status(202).json({ message: 'user created, otp sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create user' });
  }
}

export async function verify(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'invalid request' });
    const r = await query('UPDATE users SET is_verified=true, otp_code=NULL, otp_expires_at=NULL WHERE email=$1 AND otp_code=$2 AND otp_expires_at>now()', [email, otp]);
    if (r.rowCount === 0) return res.status(400).json({ error: 'invalid otp or expired' });
    res.json({ message: 'verified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'invalid request' });
    const r = await query('SELECT id, email, password_hash, is_verified, is_approved, role FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    if (!u.is_verified) return res.status(403).json({ error: 'email not verified' });
    if (!u.is_approved) return res.status(403).json({ error: 'account not approved' });
    const token = jwt.sign({ sub: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET || '6f9d3a8b2e1f4c7a9d5b6e2a3c4f7d1b2a9c5e7f8d3b6a1c4e9f2b7a6c3d8e1');
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
}

export async function me(req: Request, res: Response) {
  res.json({ ok: true, user: (req as any).user });
}

export async function listEmployees(req: Request, res: Response) {
  try {
    const r = await query(
      `SELECT id, name, email, role, is_verified, is_approved, created_at
       FROM users
       WHERE is_approved = true
       ORDER BY created_at DESC`
    );
    res.json({ employees: r.rows });
  } catch (err) {
    console.error('listEmployees error:', err);
    res.status(500).json({ error: 'failed' });
  }
}

export async function adminApprove(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const id = parseInt(req.params.id, 10);
    await query('UPDATE users SET is_approved=true WHERE id=$1', [id]);
    res.json({ message: 'approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed' });
  }
}

