import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';
import { register, verify, login, me, adminApprove, listEmployees } from './handlers/auth';
dotenv.config();

const app = express();
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/v1/auth/register', register);
app.post('/api/v1/auth/verify', verify);
app.post('/api/v1/auth/login', login);

// simple JWT auth middleware
import jwt from 'jsonwebtoken';

function authMiddleware(req: any, res: any, next: any) {
  const auth = req.headers?.authorization;
  if (!auth) return res.status(401).json({ error: 'missing auth' });
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'please_change_me') as any;
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get('/api/v1/auth/me', authMiddleware, me);

// admin actions
app.post('/api/v1/admin/users/:id/approve', authMiddleware, adminApprove);
// list approved employees
app.get('/api/v1/employees', authMiddleware, listEmployees);

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => {
  console.log(`server listening on ${port}`);
});

