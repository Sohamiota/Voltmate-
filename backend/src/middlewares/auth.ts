import jwt, { JsonWebTokenError, TokenExpiredError, JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// ─── FIX #9: Extend Express Request type — no more `req: any` ─────────────────
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        id?: number | string;
        email?: string;
        role?: string;
      };
    }
  }
}

// ─── FIX #2: Fail fast at startup if JWT_SECRET is missing ───────────────────
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
  throw new Error(
    '[auth] JWT_SECRET environment variable is not set. ' +
    'Server cannot start without a secure secret.'
  );
}
const JWT_SECRET: string = rawSecret;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // ─── FIX #1 (preflight): Allow OPTIONS through — auth not needed ───────────
  if (req.method === 'OPTIONS') return next();

  const auth = req.headers?.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'missing authorization header' });
  }

  // ─── FIX #4: Validate Bearer scheme explicitly ─────────────────────────────
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'invalid authorization format — expected: Bearer <token>',
    });
  }

  try {
    // ─── FIX #2: JWT_SECRET is guaranteed non-null here ───────────────────────
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (e) {
    // ─── FIX #5: Distinguish between expired and invalid tokens ───────────────
    if (e instanceof TokenExpiredError) {
      return res.status(401).json({ error: 'token expired' });
    }
    if (e instanceof JsonWebTokenError) {
      return res.status(401).json({ error: 'invalid token' });
    }
    // Unexpected error — don't leak internals
    console.error('[auth] unexpected JWT error:', e);
    return res.status(500).json({ error: 'authentication error' });
  }
}