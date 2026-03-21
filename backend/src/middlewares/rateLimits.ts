import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Prefer authenticated user ID as the rate-limit key so office networks sharing
// one IP are not collectively penalised. Falls back to IP for unauthenticated
// requests (login / register — handled separately in routes/auth.ts).
const userOrIpKey = (req: Request): string => {
  const uid = (req as any).user?.sub;
  return uid ? `uid:${uid}` : `ip:${req.ip ?? 'unknown'}`;
};

// ── Tier 1 – Global authenticated API ────────────────────────────────────────
// Covers every route mounted after authMiddleware.
// 500 requests per 15 min per user — stops scrapers and vulnerability scanners.
export const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             500,
  keyGenerator:    userOrIpKey,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

// ── Tier 2 – Write operations (POST / PUT / PATCH / DELETE) ──────────────────
// 100 mutations per 15 min per user — blocks bulk-write bots and automated
// form-fillers while keeping normal usage unaffected.
export const writeLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  keyGenerator:    userOrIpKey,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            (req: Request) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
  message: { error: 'Too many write requests. Please slow down.' },
});

// ── Tier 3 – Delete operations ────────────────────────────────────────────────
// 30 deletes per 15 min per user — extra brake on the most destructive action.
export const deleteLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             30,
  keyGenerator:    userOrIpKey,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            (req: Request) => req.method !== 'DELETE',
  message: { error: 'Too many delete requests. Please wait before deleting more.' },
});

// ── Tier 4 – Data export / CSV endpoints ─────────────────────────────────────
// 20 exports per hour per user — prevents bulk data harvesting.
export const exportLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  keyGenerator:    userOrIpKey,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Export limit reached. You can export up to 20 times per hour.' },
});
