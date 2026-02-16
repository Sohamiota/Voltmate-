import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import opportunitiesRoutes from './routes/opportunities';
import attendanceRoutes from './routes/attendance';
import activityRoutes from './routes/activity';

dotenv.config();

const app = express();
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1', authRoutes);
app.use('/api/v1/opportunities', opportunitiesRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1', activityRoutes);

export default app;

