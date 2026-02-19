import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

import { authMiddleware } from './middlewares/auth';
import activityRoutes from './routes/activity';
import attendanceRoutes from './routes/attendance';
import authRoutes from './routes/auth';
import leadsRoutes from './routes/leads';
import opportunitiesRoutes from './routes/opportunities';
import salesRoutes from './routes/sales';
import tasksRoutes from './routes/tasks';
import visitsRoutes from './routes/visits';
import { listEmployees } from './controllers/authController';

dotenv.config();

const app = express();

// ─── FIX #3: Single CORS setup — no double application ───────────────────────
// app.use(cors()) already handles OPTIONS preflight automatically.
// The extra app.options('*', cors()) call has been removed.
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// Allow both www and non-www variants of the configured origin
const allowedOrigins = [
  allowedOrigin,
  allowedOrigin.replace('https://', 'https://www.'),
  allowedOrigin.replace('https://www.', 'https://'),
  'http://localhost:3000',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};

app.use(cors(corsOptions));  // handles preflight OPTIONS internally — no duplicate needed

// ─── FIX #8: Explicit body size limit to prevent large payload attacks ────────
app.use(express.json({ limit: '10kb' }));

// ─── Public routes (no auth required) ────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

// ─── FIX #6: Auth routes on explicit /api/v1/auth prefix (no collision) ───────
// Previously both authRoutes and activityRoutes were mounted on '/api/v1',
// risking silent route collisions. Each now has its own unambiguous prefix.
app.use('/api/v1/auth', authRoutes);

// ─── FIX #1: authMiddleware applied globally here — all routes below are protected ──
// Previously authMiddleware was defined but NEVER registered in app.ts.
// Every route was publicly accessible without a token.
app.use(authMiddleware);

// ─── Protected routes ─────────────────────────────────────────────────────────
// FIX #6: activityRoutes moved to its own prefix '/api/v1/activity'
app.use('/api/v1/activity',      activityRoutes);
app.use('/api/v1/opportunities', opportunitiesRoutes);
app.use('/api/v1/attendance',    attendanceRoutes);
app.use('/api/v1/sales',         salesRoutes);
app.use('/api/v1/leads',         leadsRoutes);
app.use('/api/v1/tasks',         tasksRoutes);
app.use('/api/v1/visits',        visitsRoutes);
// Expose employees list at a top-level path so frontend calls to /api/v1/employees work
app.get('/api/v1/employees', authMiddleware, listEmployees);

// ─── FIX #10: 404 handler for undefined routes ────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── FIX #7: Global error handler — catches all unhandled route errors ─────────
// Must have exactly 4 arguments for Express to treat it as an error handler.
// Without this, thrown errors crash the server or return empty responses.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;