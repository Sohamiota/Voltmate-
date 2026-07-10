import { NextFunction, Request, Response } from 'express';

/** Requests above this row count share the concurrency slot (OOM protection on Render). */
const HEAVY_LIMIT_THRESHOLD = 500;

/** Max concurrent heavy list/export queries — avoids heap spikes on 512 MB Render. */
const MAX_CONCURRENT = 2;
let active = 0;

function isHeavyRequest(req: Request): boolean {
  if (req.path.includes('/export')) return true;

  const raw = req.query.limit;
  if (raw === undefined || raw === null || raw === '') return true;
  if (String(raw).toLowerCase() === 'all') return true;

  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return true;
  return n > HEAVY_LIMIT_THRESHOLD;
}

export function heavyRequestGuard(req: Request, res: Response, next: NextFunction) {
  if (!isHeavyRequest(req)) {
    next();
    return;
  }

  if (active >= MAX_CONCURRENT) {
    res.setHeader('Retry-After', '2');
    res.status(503).json({ error: 'Server busy loading reports — please retry in a few seconds.' });
    return;
  }
  active++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    active = Math.max(0, active - 1);
  };
  res.on('finish', release);
  res.on('close', release);
  next();
}
