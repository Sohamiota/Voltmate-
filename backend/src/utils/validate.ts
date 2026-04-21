/**
 * Lightweight validation & sanitization helpers.
 *
 * Design goals:
 *  - Zero extra dependencies (uses only Node built-ins)
 *  - Every helper returns { value, error } so callers can collect all field
 *    errors and return them together rather than one at a time
 *  - Text helpers strip HTML/script tags to prevent stored-XSS
 *  - All DB queries already use parameterised $N placeholders (pg library),
 *    so SQL injection is handled at the driver level; these helpers add a
 *    second layer for format/type correctness
 */

export type VResult<T> = { value: T; error: string | null };

// ── Strip HTML / script tags from a string ────────────────────────────────────
function strip(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove entire <script> blocks
    .replace(/<[^>]+>/g, '')                       // strip remaining tags
    .replace(/[<>]/g, '');                         // strip stray < >
}

// ── Optional free-text field ──────────────────────────────────────────────────
export function optStr(val: unknown, maxLen = 500): VResult<string | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  const s = strip(val.trim());
  if (s.length === 0) return { value: null, error: null };
  if (s.length > maxLen) return { value: null, error: `must be at most ${maxLen} characters` };
  return { value: s, error: null };
}

// ── Required free-text field ──────────────────────────────────────────────────
export function reqStr(val: unknown, maxLen = 500): VResult<string> {
  if (val === null || val === undefined || val === '')
    return { value: '', error: 'required' };
  const r = optStr(val, maxLen);
  if (r.error) return { value: '', error: r.error };
  if (!r.value)  return { value: '', error: 'required' };
  return { value: r.value, error: null };
}

// ── Email ─────────────────────────────────────────────────────────────────────
export function reqEmail(val: unknown): VResult<string> {
  if (!val || typeof val !== 'string') return { value: '', error: 'required' };
  const e = val.trim().toLowerCase();
  if (e.length > 254) return { value: '', error: 'email too long' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
    return { value: '', error: 'invalid email format' };
  return { value: e, error: null };
}

// ── Optional phone (digits, spaces, dashes, parens, leading +) ───────────────
export function optPhone(val: unknown): VResult<string | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  const t = val.trim();
  if (!/^[+]?[\d\s\-(). ]{7,20}$/.test(t))
    return { value: null, error: 'invalid phone number (7–20 digits, may include +, spaces, dashes)' };
  return { value: t, error: null };
}

// ── Optional ISO date (YYYY-MM-DD) ────────────────────────────────────────────
export function optDate(val: unknown): VResult<string | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return { value: null, error: 'must be YYYY-MM-DD format' };
  if (isNaN(new Date(val).getTime()))    return { value: null, error: 'invalid date' };
  return { value: val, error: null };
}

// ── Required positive integer (e.g. resource IDs) ────────────────────────────
export function reqId(val: unknown): VResult<number> {
  const n = parseInt(String(val), 10);
  if (isNaN(n) || n <= 0) return { value: 0, error: 'must be a positive integer' };
  return { value: n, error: null };
}

// ── Optional positive integer ─────────────────────────────────────────────────
export function optId(val: unknown): VResult<number | null> {
  if (val === null || val === undefined || val === '' || val === 'null')
    return { value: null, error: null };
  return reqId(val);
}

// ── Optional enum ─────────────────────────────────────────────────────────────
export function optEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
): VResult<T | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  if (!(allowed as readonly string[]).includes(val))
    return { value: null, error: `must be one of: ${allowed.join(', ')}` };
  return { value: val as T, error: null };
}

// ── Required enum ─────────────────────────────────────────────────────────────
export function reqEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
): VResult<T> {
  const r = optEnum(val, allowed);
  if (r.error)  return { value: '' as T, error: r.error };
  if (!r.value) return { value: '' as T, error: `required; must be one of: ${allowed.join(', ')}` };
  return { value: r.value, error: null };
}

// ── Boolean (body field) ──────────────────────────────────────────────────────
export function optBool(val: unknown): VResult<boolean> {
  if (val === true  || val === 'true'  || val === 1 || val === '1')
    return { value: true,  error: null };
  if (val === false || val === 'false' || val === 0 || val === '0'
      || val === null || val === undefined)
    return { value: false, error: null };
  return { value: false, error: 'must be true or false' };
}

// ── Sanitized search query (no HTML, capped length) ───────────────────────────
export function sanitizeSearch(val: unknown, maxLen = 100): string {
  if (!val || typeof val !== 'string') return '';
  return strip(val.trim()).slice(0, maxLen);
}

// ── Pagination query params ───────────────────────────────────────────────────
export function parsePagination(
  limitRaw: unknown,
  offsetRaw: unknown,
  maxLimit = 100000,
): { limit: number; offset: number } {
  const limit  = Math.min(Math.max(parseInt(String(limitRaw  ?? '100000'), 10) || 100000, 1), maxLimit);
  const offset = Math.max(parseInt(String(offsetRaw ?? '0'),  10) || 0, 0);
  return { limit, offset };
}

// ── Collect field errors and return a single error string (or null) ───────────
export function collectErrors(checks: Record<string, string | null>): string | null {
  const msgs = Object.entries(checks)
    .filter(([, e]) => e !== null)
    .map(([field, e]) => `${field}: ${e}`);
  return msgs.length ? msgs.join('; ') : null;
}

// ── Domain constants ──────────────────────────────────────────────────────────

export const VISIT_STATUSES = [
  'New Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared',
  'Demo Follow Up', 'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed',
  'Loan Processing', 'Booking Amount Received', 'Order Confirmed', 'Delivery Scheduled',
  'Delivered (Closed \u2013 Won)',
  'Lost \u2013 Price Issue', 'Lost \u2013 Competitor',
  'Lost \u2013 No Response', 'Lost \u2013 Not Interested',
] as const;

export const LEAD_TYPES = [
  'Digital Lead', 'Non Digital Lead',
] as const;

export const TASK_STATUSES = ['Just Assigned', 'Under Process', 'Completed'] as const;

export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
