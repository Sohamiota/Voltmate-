import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { authMiddleware } from './middlewares/auth';
import activityRoutes    from './routes/activity';
import activityLogRoutes from './routes/activityLog';
import attendanceRoutes  from './routes/attendance';
import authRoutes        from './routes/auth';
import leadsRoutes       from './routes/leads';
import opportunitiesRoutes from './routes/opportunities';
import salesRoutes       from './routes/sales';
import tasksRoutes       from './routes/tasks';
import visitsRoutes      from './routes/visits';
import vehicleRoutes     from './routes/vehicles';
import { listEmployees } from './controllers/authController';

dotenv.config();

const app = express();

// ─── [M-1] Security headers via helmet ───────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow Render/Vercel embedding if needed
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigin    = process.env.ALLOWED_ORIGIN  || 'http://localhost:3000';
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';

function addOriginWithVariants(list: Set<string>, url: string) {
  if (!url || !url.startsWith('http')) return;
  list.add(url);
  list.add(url.replace(/^https:\/\//,     'https://www.'));
  list.add(url.replace(/^https:\/\/www\./, 'https://'));
  list.add(url.replace(/^http:\/\//,      'http://www.'));
  list.add(url.replace(/^http:\/\/www\./,  'http://'));
}

const allowedOriginsSet = new Set<string>(['http://localhost:3000']);
addOriginWithVariants(allowedOriginsSet, allowedOrigin);
allowedOriginsEnv.split(',').map(s => s.trim()).forEach(s => addOriginWithVariants(allowedOriginsSet, s));

if ([allowedOrigin, ...allowedOriginsEnv.split(',')].some(s => /voltwheel/.test(s))) {
  ['https://voltwheelsin.com', 'https://www.voltwheelsin.com',
   'https://voltwheelsind.com', 'https://www.voltwheelsind.com']
    .forEach(o => allowedOriginsSet.add(o));
}

const allowedOrigins = Array.from(allowedOriginsSet);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // ─── [M-2] Reject requests with no Origin header (curl, file://, etc.) ───
    // Explicitly allow in development so local tooling still works.
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS: missing Origin header'));
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials:     true,
  methods:         ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders:  ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10kb' }));

// ─── Public routes ────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

// Auth routes (have their own per-endpoint rate limiters inside the router)
app.use('/api/v1/auth', authRoutes);

// ─── All routes below require a valid JWT ─────────────────────────────────────
app.use(authMiddleware);

app.use('/api/v1/activity',      activityRoutes);
app.use('/api/v1/activity-log',  activityLogRoutes);
app.use('/api/v1/opportunities', opportunitiesRoutes);
app.use('/api/v1/attendance',    attendanceRoutes);
app.use('/api/v1/sales',         salesRoutes);
app.use('/api/v1/leads',         leadsRoutes);
app.use('/api/v1/tasks',         tasksRoutes);
app.use('/api/v1/visits',        visitsRoutes);
app.use('/api/v1/vehicles',      vehicleRoutes);

// [H-6] /api/v1/employees is already exposed via /api/v1/auth/employees (with auth).
// Keep this alias but enforce authMiddleware (already applied globally above).
app.get('/api/v1/employees', listEmployees);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.stack || err.message);
  // Never leak internal error details to clients
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
