import 'dotenv/config';   // must be first — loads .env before any other module reads process.env
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { authMiddleware } from './middlewares/auth';
import { apiLimiter, writeLimiter, deleteLimiter } from './middlewares/rateLimits';
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
import serviceStatusRoutes from './routes/serviceStatus';
import networkRoutes     from './routes/networks';
import locationRoutes    from './routes/location';
import leaveRoutes       from './routes/leave';
import billingRoutes     from './routes/billing';
import youtubeRoutes     from './routes/youtube';
import whatsappRoutes    from './routes/whatsapp';
import { listEmployees } from './controllers/authController';
import { healthCheck } from './db';

const app = express();

// Render sits behind Cloudflare + its own load balancer (2 hops). Without this,
// req.ip is a proxy address and office-network attendance checks always fail.
app.set('trust proxy', 2);

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
    // No Origin: health probes, curl, server-to-server, same-origin navigation.
    // CORS only applies to browsers; blocking these caused 500s on Render.
    if (!origin) {
      return callback(null, true);
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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Public routes ────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (_req, res) => {
  try {
    await healthCheck();
    res.json({ status: 'ok', db: 'ok' });
  } catch (e) {
    console.error('[health] db check failed:', e);
    res.status(503).json({ status: 'degraded', db: 'error' });
  }
});

// Auth routes (have their own per-endpoint rate limiters inside the router)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/service-status', serviceStatusRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);

// ─── All routes below require a valid JWT ─────────────────────────────────────
app.use(authMiddleware);

// ─── Abuse protection: tiered rate limits applied to all authenticated routes ─
// Tier 1 – global cap (stops scrapers / scanners)
app.use(apiLimiter);
// Tier 2 – write cap: POST / PUT / PATCH / DELETE (stops bulk-write bots)
app.use(writeLimiter);
// Tier 3 – delete cap: DELETE only (extra brake on destructive ops)
app.use(deleteLimiter);

app.use('/api/v1/activity',      activityRoutes);
app.use('/api/v1/activity-log',  activityLogRoutes);
app.use('/api/v1/opportunities', opportunitiesRoutes);
app.use('/api/v1/attendance',    attendanceRoutes);
app.use('/api/v1/sales',         salesRoutes);
app.use('/api/v1/leads',         leadsRoutes);
app.use('/api/v1/tasks',         tasksRoutes);
app.use('/api/v1/visits',        visitsRoutes);
app.use('/api/v1/vehicles',      vehicleRoutes);
app.use('/api/v1/networks',      networkRoutes);
app.use('/api/v1/location',      locationRoutes);
app.use('/api/v1/leave',         leaveRoutes);
app.use('/api/v1/billing',       billingRoutes);
app.use('/api/v1/youtube',       youtubeRoutes);

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
  if (err.message.startsWith('CORS')) {
    console.warn('[cors]', err.message);
    res.status(403).json({ error: err.message });
    return;
  }
  console.error('[error]', err.stack || err.message);
  // Never leak internal error details to clients
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
