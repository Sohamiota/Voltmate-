import { NextFunction, Request, Response } from 'express';

/** Max concurrent bulk list/export queries — avoids heap spikes on 512 MB Render. */
const MAX_CONCURRENT = 2;
let active = 0;

export function heavyRequestGuard(req: Request, res: Response, next: NextFunction) {
  if (active >= MAX_CONCURRENT) {
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
