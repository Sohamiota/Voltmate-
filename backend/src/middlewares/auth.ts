import jwt, { JsonWebTokenError, TokenExpiredError, JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

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

  try {
    // ─── [M-4] Algorithm explicitly pinned to HS256 ───────────────────────────
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    req.user = decoded;
    next();
  } catch (e) {
    if (e instanceof TokenExpiredError)
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    if (e instanceof JsonWebTokenError)
      return res.status(401).json({ error: 'Invalid token' });
    console.error('[auth] unexpected JWT error:', e);
    return res.status(500).json({ error: 'Authentication error' });
  }
}
