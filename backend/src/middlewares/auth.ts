import jwt, { JsonWebTokenError, TokenExpiredError, JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { query } from '../db';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        sub?: number | string;
        email?: string;
        role?: string;
      };
    }
  }
}

// ─── [C-1] Fail at startup if JWT_SECRET is missing ──────────────────────────
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error(
    '[auth] JWT_SECRET environment variable is not set. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}
const JWT_SECRET: string = rawSecret;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();

  const auth = req.headers?.authorization;
  if (!auth)
    return res.status(401).json({ error: 'Missing authorization header' });

  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ error: 'Invalid authorization format — expected: Bearer <token>' });

  let decoded: JwtPayload;
  try {
    // ─── [M-4] Algorithm explicitly pinned to HS256 ───────────────────────────
    decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch (e) {
    if (e instanceof TokenExpiredError)
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    if (e instanceof JsonWebTokenError)
      return res.status(401).json({ error: 'Invalid token' });
    console.error('[auth] unexpected JWT error:', e);
    return res.status(500).json({ error: 'Authentication error' });
  }

  // Always fetch the live role from the DB so role changes take effect
  // immediately without requiring the user to log out and log back in.
  const userId = decoded.sub;
  if (!userId) {
    req.user = decoded;
    return next();
  }

  query('SELECT role, is_approved FROM users WHERE id = $1', [userId])
    .then((r: any) => {
      if (!r.rowCount) return res.status(401).json({ error: 'Account not found' });
      const row = r.rows[0];
      if (!row.is_approved) return res.status(403).json({ error: 'Account is not approved' });
      req.user = { ...decoded, role: row.role };
      next();
    })
    .catch((err: unknown) => {
      console.error('[auth] DB role lookup failed:', err);
      // Fall back to the role embedded in the token rather than blocking the request
      req.user = decoded;
      next();
    });
}
