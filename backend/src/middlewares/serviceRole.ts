import { Request, Response, NextFunction } from 'express';

const SERVICE_READ_ROLES = new Set(['admin', 'service', 'sales']);
const SERVICE_WRITE_ROLES = new Set(['admin', 'service']);

export function canReadService(role?: string): boolean {
  return !!role && SERVICE_READ_ROLES.has(role);
}

export function canWriteService(role?: string): boolean {
  return !!role && SERVICE_WRITE_ROLES.has(role);
}

export function requireServiceRead(req: Request, res: Response, next: NextFunction) {
  if (!canReadService(req.user?.role)) {
    return res.status(403).json({ error: 'Service Manager access required' });
  }
  next();
}

export function requireServiceWrite(req: Request, res: Response, next: NextFunction) {
  if (!canWriteService(req.user?.role)) {
    return res.status(403).json({ error: 'Service write access required' });
  }
  next();
}
