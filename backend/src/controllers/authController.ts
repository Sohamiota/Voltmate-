import { Request, Response } from 'express';
import { query } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import { reqStr, reqEmail, collectErrors, optEnum } from '../utils/validate';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ─── [C-1] JWT secret MUST come from environment — never fall back to a
// hardcoded value. The fail-fast check in middlewares/auth.ts handles startup.
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('[auth] JWT_SECRET is not set');
  return s;
}

// ─── [M-3] Cryptographically secure OTP using Node's built-in crypto ─────────
function genOTP(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

// ─── [M-7] Password strength rules ───────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password))          return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))          return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))          return 'Password must contain at least one number';
  return null;
}

export async function register(req: Request, res: Response) {
  try {
    const body = req.body || {};

    const vName  = reqStr(body.name, 100);
    const vEmail = reqEmail(body.email);

    // Passwords must never be stripped/transformed before hashing.
    // Only check presence and cap length to prevent bcrypt DoS.
    const rawPw = typeof body.password === 'string' ? body.password : '';
    const fieldErr = collectErrors({
      name:  vName.error,
      email: vEmail.error,
      password: !rawPw ? 'required' : rawPw.length > 128 ? 'too long (max 128)' : null,
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const name     = vName.value as string;
    const email    = vEmail.value as string;
    const password = rawPw;

    // ─── [M-7] Enforce password strength ─────────────────────────────────────
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if ((exists as any).rowCount > 0)
      return res.status(409).json({ error: 'email already registered' });

    const hash = await bcrypt.hash(password, 12);

    // ─── [C-3] OTP verification re-enabled; secure token via crypto ──────────
    const otp     = genOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // ─── [C-2] Role is ALWAYS 'employee' at self-registration ────────────────
    // Admins can promote users via the dedicated admin endpoint.
    await query(
      `INSERT INTO users
         (name, email, password_hash, is_verified, is_approved, role, otp_code, otp_expires_at, created_at)
       VALUES ($1,$2,$3,false,false,'employee',$4,$5,now())`,
      [name, email, hash, otp, expires],
    );

    // ─── Send OTP via SendGrid when configured; otherwise log to stdout ─────
    // When SENDGRID_API_KEY is not set, OTP is intentionally printed to the
    // server log so admins can relay it to the new user manually.
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to:      email,
          from:    process.env.SENDGRID_FROM || 'no-reply@example.com',
          subject: 'Verify your Voltmate account',
          text:    `Your verification code is ${otp}. It expires in 15 minutes.`,
          html:    `<p>Your verification code is <strong>${otp}</strong>. It expires in 15 minutes.</p>`,
        });
      } catch (e) {
        console.error('[auth] SendGrid error — falling back to log:', e);
        console.log(`[OTP] ${email} → ${otp}`);
      }
    } else {
      // No email provider configured — log OTP so admin can relay it manually
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
    const body   = req.body || {};
    const vEmail = reqEmail(body.email);
    const vOtp   = reqStr(body.otp, 6);
    const fieldErr = collectErrors({ email: vEmail.error, otp: vOtp.error });
    if (fieldErr) return res.status(400).json({ error: fieldErr });

    const email = vEmail.value;
    const otp   = (vOtp.value as string).trim();
    // OTP must be exactly 6 digits
    if (!/^\d{6}$/.test(otp))
      return res.status(400).json({ error: 'otp must be a 6-digit number' });

    const r = await query(
      `UPDATE users
         SET is_verified=true, otp_code=NULL, otp_expires_at=NULL
       WHERE email=$1
         AND otp_code=$2
         AND otp_expires_at > now()`,
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
    const body   = req.body || {};
    const vEmail = reqEmail(body.email);

    // Passwords must NEVER be stripped/transformed before bcrypt.compare() —
    // doing so would corrupt the credential check. Only enforce presence and
    // an upper-bound length to prevent bcrypt DoS (72-byte truncation issue).
    const rawPw = typeof body.password === 'string' ? body.password : '';
    if (!rawPw)          return res.status(400).json({ error: 'password: required' });
    if (rawPw.length > 128) return res.status(400).json({ error: 'password: too long' });
    if (vEmail.error)    return res.status(400).json({ error: `email: ${vEmail.error}` });

    const email    = vEmail.value as string;  // already lowercased by reqEmail
    const password = rawPw;

    // Use LOWER(email) so existing users whose email was stored with mixed
    // casing can still log in after we started normalising to lowercase.
    const r = await query(
      'SELECT id, email, password_hash, is_verified, is_approved, role FROM users WHERE LOWER(email)=$1',
      [email],
    );

    // ─── Use the SAME error for "not found" and "wrong password" to prevent
    // account enumeration (attacker cannot distinguish the two cases).
    const notFound = (r as any).rowCount === 0;
    const u        = notFound ? null : (r as any).rows[0];
    const ok       = notFound ? false : await bcrypt.compare(password, u.password_hash);

    if (notFound || !ok)
      return res.status(401).json({ error: 'Invalid credentials' });

    if (!u.is_verified)
      return res.status(403).json({ error: 'Email not verified. Check your inbox for the OTP.' });
    if (!u.is_approved)
      return res.status(403).json({ error: 'Account pending admin approval.' });

    // ─── [C-1] Secret must exist (enforced at startup). [C-5] Token expires. ─
    // ─── [M-4] Algorithm pinned to HS256. ────────────────────────────────────
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
  try {
    const u = (req as any).user;
    const r = await query('SELECT is_on_probation FROM users WHERE id=$1', [u.sub]);
    const is_on_probation = (r && (r as any).rows[0]?.is_on_probation) ?? false;
    res.json({ ok: true, user: { ...u, is_on_probation } });
  } catch (err) {
    console.error('[me]', err);
    res.json({ ok: true, user: (req as any).user });
  }
}

// ─── Expose only non-sensitive fields ─────────────────────────────────────────
export async function listEmployees(req: Request, res: Response) {
  try {
    const r = await query(
      `SELECT id, name, email, role, is_verified, is_approved, created_at
         FROM users
        WHERE is_approved = true
        ORDER BY created_at DESC`,
    );
    res.json({ employees: (r as any).rows });
  } catch (err) {
    console.error('[listEmployees]', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
}

// ─── Admin-only: approve a pending user ───────────────────────────────────────
export async function adminApprove(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    await query('UPDATE users SET is_approved=true WHERE id=$1', [id]);
    res.json({ message: 'User approved' });
  } catch (err) {
    console.error('[adminApprove]', err);
    res.status(500).json({ error: 'Failed to approve user' });
  }
}

// ─── Admin-only: change a user's role ─────────────────────────────────────────
export async function adminChangeRole(req: Request, res: Response) {
  try {
    const requester = (req as any).user;
    if (!requester || requester.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    const ALLOWED = ['admin', 'sales', 'service', 'employee'] as const;
    const vRole = optEnum(req.body?.role, ALLOWED);
    if (vRole.error || !vRole.value)
      return res.status(400).json({ error: `role must be one of: ${ALLOWED.join(', ')}` });
    const role = vRole.value;

    await query('UPDATE users SET role=$1 WHERE id=$2', [role, id]);
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error('[adminChangeRole]', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
}
