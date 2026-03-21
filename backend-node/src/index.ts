import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt, { JsonWebTokenError, JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db';
import { register, verify, login, me, adminApprove, listEmployees } from './handlers/auth';
import { getOpportunity, updateOpportunity } from './handlers/opportunity';
dotenv.config();

// ─── [H-5 / C-1] JWT secret must be set — no fallback ────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[auth] JWT_SECRET environment variable is not set. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}

const app = express();

// ─── [M-1] Security headers ───────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) {
      return process.env.NODE_ENV !== 'production' ? cb(null, true) : cb(new Error('Missing Origin'));
    }
    origin === allowedOrigin ? cb(null, true) : cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── [L-1] Body size limit (backend-node was missing this) ───────────────────
app.use(express.json({ limit: '10kb' }));

// ─── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many registrations. Try again later.' },
});

// ─── [M-4] JWT middleware with algorithm pinned to HS256 ─────────────────────
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();
  const auth = req.headers?.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ error: 'Invalid authorization format' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] }) as JwtPayload;
    (req as any).user = decoded;
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

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/v1/auth/register', registerLimiter, register);
app.post('/api/v1/auth/verify',   authMiddleware,  verify);
app.post('/api/v1/auth/login',    loginLimiter,    login);

app.get('/api/v1/auth/me',        authMiddleware, me);
app.post('/api/v1/admin/users/:id/approve', authMiddleware, adminApprove);
app.get('/api/v1/employees',      authMiddleware, listEmployees);

app.get('/api/v1/opportunities/:id',  authMiddleware, getOpportunity);
app.patch('/api/v1/opportunities/:id', authMiddleware, updateOpportunity);
app.get('/api/v1/opportunities', authMiddleware, (req, res) => {
  const { listOpportunities } = require('./handlers/opportunity');
  return listOpportunities(req, res);
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler — never leak internals ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => console.log(`server listening on ${port}`));
