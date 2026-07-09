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

import { crmPlainTextError, sanitizeCrmPlainText, type CrmPlainTextKind } from './crmTextInput';

export type VResult<T> = { value: T; error: string | null };

export type OptStrOptions = {
  /** Skip charset rules (still blocks emojis / control chars). */
  loose?: boolean;
  plainTextKind?: CrmPlainTextKind;
};

// ── Strip HTML / script tags from a string ────────────────────────────────────
function strip(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // remove entire <script> blocks
    .replace(/<[^>]+>/g, '')                       // strip remaining tags
    .replace(/[<>]/g, '');                         // strip stray < >
}

// ── Optional free-text field ──────────────────────────────────────────────────
export function optStr(
  val: unknown,
  maxLen = 500,
  opts: OptStrOptions = {},
): VResult<string | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  const kind = opts.plainTextKind ?? 'note';
  const s = opts.loose
    ? strip(val.trim())
    : sanitizeCrmPlainText(strip(val.trim()), kind);
  if (s.length === 0) return { value: null, error: null };
  if (s.length > maxLen) return { value: null, error: `must be at most ${maxLen} characters` };
  const plainErr = crmPlainTextError(s, kind, false);
  if (plainErr) return { value: null, error: plainErr };
  return { value: s, error: null };
}

// ── Required free-text field ──────────────────────────────────────────────────
export function reqStr(val: unknown, maxLen = 500, opts: OptStrOptions = {}): VResult<string> {
  if (val === null || val === undefined || val === '')
    return { value: '', error: 'required' };
  const r = optStr(val, maxLen, opts);
  if (r.error) return { value: '', error: r.error };
  if (!r.value)  return { value: '', error: 'required' };
  return { value: r.value, error: null };
}

// ── Plain CRM text (no emojis / random symbols) ───────────────────────────────
export function optPlainText(
  val: unknown,
  kind: CrmPlainTextKind,
  maxLen = 500,
): VResult<string | null> {
  return optStr(val, maxLen, { plainTextKind: kind });
}

export function reqPlainText(
  val: unknown,
  kind: CrmPlainTextKind,
  maxLen = 500,
): VResult<string> {
  return reqStr(val, maxLen, { plainTextKind: kind });
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

// ── Optional ISO datetime (for TIMESTAMPTZ fields) ─────────────────────────────
export function optIsoDateTime(val: unknown): VResult<string | null> {
  if (val === null || val === undefined || val === '') return { value: null, error: null };
  if (typeof val !== 'string') return { value: null, error: 'must be a string' };
  const d = new Date(val);
  if (isNaN(d.getTime())) return { value: null, error: 'invalid ISO datetime' };
  return { value: d.toISOString(), error: null };
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
  return sanitizeCrmPlainText(strip(val.trim()), 'note').slice(0, maxLen);
}

/** Hard ceiling for list endpoints — prevents OOM on Render (512 MB instances). */
export const MAX_PAGE_SIZE = 1000;

/** When clients omit limit on leads, cap rows (still large enough for full CRM export in UI). */
export const MAX_LEADS_LIST = 5000;

/** Vehicle list / export ceiling. */
export const MAX_VEHICLES_LIST = 2000;

/** CSV exports load all rows into memory — cap to avoid heap exhaustion. */
export const MAX_CSV_EXPORT_ROWS = 2000;

// ── Pagination query params ───────────────────────────────────────────────────
export function parsePagination(
  limitRaw: unknown,
  offsetRaw: unknown,
  maxLimit = MAX_PAGE_SIZE,
): { limit: number; offset: number } {
  // Default to 200 rows when no limit is supplied so a missing param never
  // silently fetches the entire table. Callers that legitimately need more
  // rows must pass an explicit limit (the hard ceiling is still maxLimit).
  const limit  = Math.min(Math.max(parseInt(String(limitRaw  ?? '200'), 10) || 200, 1), maxLimit);
  const offset = Math.max(parseInt(String(offsetRaw ?? '0'),  10) || 0, 0);
  return { limit, offset };
}

/** Leads list — omit limit (or pass `all`) to return up to MAX_LEADS_LIST rows. */
export function parseLeadsListQuery(
  limitRaw: unknown,
  offsetRaw: unknown,
): { limit: number; offset: number; capped: boolean } {
  const offset = Math.max(parseInt(String(offsetRaw ?? '0'), 10) || 0, 0);
  if (
    limitRaw === undefined ||
    limitRaw === null ||
    limitRaw === '' ||
    String(limitRaw).toLowerCase() === 'all'
  ) {
    return { limit: MAX_LEADS_LIST, offset, capped: true };
  }
  const parsed = parseInt(String(limitRaw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { limit: MAX_LEADS_LIST, offset, capped: true };
  }
  const limit = Math.min(parsed, MAX_LEADS_LIST);
  return { limit, offset, capped: limit < parsed };
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
  'New Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared', 'Catalogue Shared',
  'Demo Follow Up', 'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed',
  'Loan Processing', 'Booking Amount Received', 'Order Confirmed', 'Delivery Scheduled',
  'Delivered (Closed \u2013 Won)',
  'Lost \u2013 Price Issue', 'Lost \u2013 Competitor',
  'Lost \u2013 No Response', 'Lost \u2013 Not Interested',
] as const;

/** Canonical status string (en dash U+2013) — must match `VISIT_STATUSES` */
export const LOST_NOT_INTERESTED_STATUS = 'Lost \u2013 Not Interested' as const;

export const LOST_NOT_INTEREST_REASONS = [
  'budget',
  'timing',
  'product_fit',
  'range_anxiety',
  'prefers_ice',
  'chose_competitor',
  'family_decision',
  'other',
] as const;

export type LostNotInterestedReason = (typeof LOST_NOT_INTEREST_REASONS)[number];

export const LEAD_TYPES = [
  'Digital Lead', 'Non Digital Lead',
] as const;

export const TASK_STATUSES = ['Just Assigned', 'Under Process', 'Completed'] as const;

export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

/** Buying timeframe bucket IDs — stable CRM enums */
export const DEFERRAL_BUCKETS = [
  'within_1_month',
  'within_2_months',
  'within_3_months',
  'beyond_3_months',
  'unknown',
] as const;

/** Call outcome / stall reason IDs — stable CRM enums */
export const CONTACT_DISPOSITIONS = [
  'busy_will_call_back',
  'requested_callback_later',
  'needs_time_to_decide',
  'travel_or_offline',
  'talk_to_family_first',
  'comparing_options',
] as const;
