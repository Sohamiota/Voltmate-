import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: any, res: Response, next: NextFunction) {
  // Allow preflight requests through without authentication
  if (req.method === 'OPTIONS') return next();

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

