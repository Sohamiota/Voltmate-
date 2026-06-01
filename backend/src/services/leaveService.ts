import { query } from '../db';
import {
  type ProofPayload,
  saveProofFile,
} from '../utils/leaveProof';

export const PROBATION_MONTHS = 3;
export const MAX_EARNED_PER_TYPE = 6;
export const ACCRUAL_INTERVAL_MONTHS = 2;
/** Casual leave must start at least this many calendar days after today. */
export const CL_MIN_ADVANCE_DAYS = 2;
/** Sick leave above this many working days requires medical proof before approval. */
export const SL_PROOF_THRESHOLD_DAYS = 2;

export type LeaveType = 'CL' | 'SL';

export type LeaveBalance = {
  fy_label: string;
  fy_start_year: number;
  on_probation: boolean;
  probation_end: string | null;
  can_apply: boolean;
  cl_earned: number;
  cl_used: number;
  cl_pending: number;
  cl_available: number;
  sl_earned: number;
  sl_carried_forward: number;
  sl_used: number;
  sl_pending: number;
  sl_available: number;
  accrual_periods_completed: number;
  next_accrual_note: string;
};

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** FY starts April 1. Returns the calendar year in which FY begins (e.g. Apr 2025–Mar 2026 → 2025). */
export function fyStartYearForDate(d: Date = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyLabel(fyStartYear: number): string {
  const end = String(fyStartYear + 1).slice(-2);
  return `${fyStartYear}-${end}`;
}

export function fyStartDate(fyStartYear: number): Date {
  return new Date(fyStartYear, 3, 1);
}

export function fyEndDate(fyStartYear: number): Date {
  return new Date(fyStartYear + 1, 2, 31);
}

export function getProbationEnd(joinDate: Date): Date {
  return addMonths(joinDate, PROBATION_MONTHS);
}

export function isOnProbation(joinDate: Date, asOf: Date = new Date()): boolean {
  return asOf < getProbationEnd(joinDate);
}

/** Complete 2-month accrual blocks since accrual start, capped at 6 per FY. */
export function countAccrualPeriods(accrualStart: Date, asOf: Date, fyEnd: Date): number {
  const end = asOf <= fyEnd ? asOf : fyEnd;
  if (end < accrualStart) return 0;

  let periods = 0;
  let blockStart = new Date(accrualStart);
  while (periods < MAX_EARNED_PER_TYPE) {
    const blockEnd = addMonths(blockStart, ACCRUAL_INTERVAL_MONTHS);
    blockEnd.setDate(blockEnd.getDate() - 1);
    if (blockEnd > end) break;
    periods += 1;
    blockStart = addMonths(blockStart, ACCRUAL_INTERVAL_MONTHS);
  }
  return periods;
}

export async function getHolidayDatesBetween(start: Date, end: Date): Promise<Set<string>> {
  const r = await query(
    `SELECT holiday_date::text AS d FROM holidays
      WHERE holiday_date >= $1 AND holiday_date <= $2`,
    [toIsoDate(start), toIsoDate(end)],
  );
  return new Set((r as any).rows.map((row: { d: string }) => row.d.slice(0, 10)));
}

/** Working days Mon–Sat, excluding company holidays. */
export async function countWorkingDays(startIso: string, endIso: string): Promise<number> {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (end < start) return 0;

  const holidays = await getHolidayDatesBetween(start, end);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const key = toIsoDate(cur);
    if (dow !== 0 && !holidays.has(key)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function sumLeaveDays(
  userId: number,
  fyStartYear: number,
  leaveType: LeaveType,
  status: 'approved' | 'pending',
): Promise<number> {
  const fyStart = toIsoDate(fyStartDate(fyStartYear));
  const fyEnd = toIsoDate(fyEndDate(fyStartYear));
  const r = await query(
    `SELECT COALESCE(SUM(days), 0)::float AS total
       FROM leave_requests
      WHERE user_id = $1
        AND leave_type = $2
        AND status = $3
        AND start_date <= $5
        AND end_date >= $4`,
    [userId, leaveType, status, fyStart, fyEnd],
  );
  return Number((r as any).rows[0]?.total ?? 0);
}

async function ensureSlCarryForward(userId: number, fyStartYear: number, joinDate: Date): Promise<number> {
  const existing = await query(
    `SELECT sl_carried_in FROM leave_fy_balances WHERE user_id = $1 AND fy_start_year = $2`,
    [userId, fyStartYear],
  );
  if ((existing as any).rowCount > 0) {
    return Number((existing as any).rows[0].sl_carried_in);
  }

  if (fyStartYear <= fyStartYearForDate(joinDate)) {
    await query(
      `INSERT INTO leave_fy_balances (user_id, fy_start_year, sl_carried_in)
       VALUES ($1, $2, 0) ON CONFLICT (user_id, fy_start_year) DO NOTHING`,
      [userId, fyStartYear],
    );
    return 0;
  }

  const prevFy = fyStartYear - 1;
  const prevBalance = await getLeaveBalanceForUser(userId, joinDate, prevFy);
  const unusedSl = Math.max(0, prevBalance.sl_available);

  await query(
    `INSERT INTO leave_fy_balances (user_id, fy_start_year, sl_carried_in)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, fy_start_year) DO UPDATE SET sl_carried_in = EXCLUDED.sl_carried_in`,
    [userId, fyStartYear, unusedSl],
  );
  return unusedSl;
}

async function getLeaveBalanceForUser(
  userId: number,
  joinDate: Date,
  fyStartYear: number,
  asOf: Date = new Date(),
): Promise<LeaveBalance> {
  const fyStart = fyStartDate(fyStartYear);
  const fyEnd = fyEndDate(fyStartYear);
  const probationEnd = getProbationEnd(joinDate);
  const onProbation = isOnProbation(joinDate, asOf);
  const accrualStart = probationEnd > fyStart ? probationEnd : fyStart;
  const periods = countAccrualPeriods(accrualStart, asOf, fyEnd);
  const earned = Math.min(periods, MAX_EARNED_PER_TYPE);

  const slCarried = await ensureSlCarryForward(userId, fyStartYear, joinDate);

  const [clUsed, slUsed, clPending, slPending] = await Promise.all([
    sumLeaveDays(userId, fyStartYear, 'CL', 'approved'),
    sumLeaveDays(userId, fyStartYear, 'SL', 'approved'),
    sumLeaveDays(userId, fyStartYear, 'CL', 'pending'),
    sumLeaveDays(userId, fyStartYear, 'SL', 'pending'),
  ]);

  const clAvailable = Math.max(0, earned - clUsed - clPending);
  const slAvailable = Math.max(0, earned + slCarried - slUsed - slPending);

  let nextAccrualNote = '';
  if (onProbation) {
    nextAccrualNote = `Leave opens after probation ends on ${toIsoDate(probationEnd)}`;
  } else if (periods >= MAX_EARNED_PER_TYPE) {
    nextAccrualNote = 'Maximum accrual reached for this financial year';
  } else {
    const nextBlockStart = addMonths(accrualStart, periods * ACCRUAL_INTERVAL_MONTHS);
    const nextBlockEnd = addMonths(nextBlockStart, ACCRUAL_INTERVAL_MONTHS);
    nextBlockEnd.setDate(nextBlockEnd.getDate() - 1);
    nextAccrualNote = `Next +1 CL & +1 SL after ${toIsoDate(nextBlockEnd)}`;
  }

  return {
    fy_label: fyLabel(fyStartYear),
    fy_start_year: fyStartYear,
    on_probation: onProbation,
    probation_end: toIsoDate(probationEnd),
    can_apply: !onProbation,
    cl_earned: earned,
    cl_used: clUsed,
    cl_pending: clPending,
    cl_available: clAvailable,
    sl_earned: earned,
    sl_carried_forward: slCarried,
    sl_used: slUsed,
    sl_pending: slPending,
    sl_available: slAvailable,
    accrual_periods_completed: periods,
    next_accrual_note: nextAccrualNote,
  };
}

export async function getLeaveBalance(userId: number): Promise<LeaveBalance> {
  const u = await query('SELECT join_date, created_at FROM users WHERE id = $1', [userId]);
  if ((u as any).rowCount === 0) throw new Error('user_not_found');
  const row = (u as any).rows[0];
  const joinDate = parseDate(
    row.join_date ? String(row.join_date).slice(0, 10) : String(row.created_at).slice(0, 10),
  );
  const fy = fyStartYearForDate();
  return getLeaveBalanceForUser(userId, joinDate, fy);
}

export async function listHolidays(year?: number) {
  const y = year ?? new Date().getFullYear();
  const r = await query(
    `SELECT id, holiday_date, name FROM holidays
      WHERE EXTRACT(YEAR FROM holiday_date) = $1
         OR EXTRACT(YEAR FROM holiday_date) = $2
      ORDER BY holiday_date`,
    [y, y + 1],
  );
  return (r as any).rows;
}

export function requiresMedicalProof(leaveType: LeaveType, workingDays: number): boolean {
  return leaveType === 'SL' && workingDays > SL_PROOF_THRESHOLD_DAYS;
}

/** Earliest ISO date allowed for casual leave start (today + CL_MIN_ADVANCE_DAYS). */
export function minClStartDateIso(asOf: Date = new Date()): string {
  const min = new Date(asOf);
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + CL_MIN_ADVANCE_DAYS);
  return toIsoDate(min);
}

export function validateClAdvanceNotice(startDate: string, asOf: Date = new Date()): void {
  const start = parseDate(startDate);
  const minStart = parseDate(minClStartDateIso(asOf));
  if (start < minStart) {
    throw new Error(
      `cl_advance_required: Casual leave must be applied at least ${CL_MIN_ADVANCE_DAYS} days before the start date (earliest: ${minClStartDateIso(asOf)})`,
    );
  }
}

async function attachProofToRequest(
  requestId: number,
  userId: number,
  proof: ProofPayload,
): Promise<void> {
  const saved = saveProofFile(userId, requestId, proof);
  await query(
    `UPDATE leave_requests
        SET proof_filename = $1,
            proof_mime_type = $2,
            proof_path = $3,
            proof_uploaded_at = now(),
            updated_at = now()
      WHERE id = $4 AND user_id = $5`,
    [saved.filename, saved.mimeType, saved.relativePath, requestId, userId],
  );
}

export async function uploadLeaveProof(
  userId: number,
  requestId: number,
  proof: ProofPayload,
) {
  const r0 = await query(
    `SELECT * FROM leave_requests WHERE id = $1 AND user_id = $2`,
    [requestId, userId],
  );
  if ((r0 as any).rowCount === 0) throw new Error('not_found');
  const row = (r0 as any).rows[0];
  if (row.status !== 'pending') throw new Error('cannot_upload_proof');
  if (!row.requires_proof) throw new Error('proof_not_required');

  await attachProofToRequest(requestId, userId, proof);
  const r = await query('SELECT * FROM leave_requests WHERE id = $1', [requestId]);
  return (r as any).rows[0];
}

export function getLeaveProofMeta(row: {
  proof_path?: string | null;
  proof_filename?: string | null;
  proof_mime_type?: string | null;
  requires_proof?: boolean;
}) {
  return {
    requires_proof: !!row.requires_proof,
    proof_uploaded: !!row.proof_path,
    proof_filename: row.proof_filename ?? null,
    proof_mime_type: row.proof_mime_type ?? null,
  };
}

async function hasAttendanceConflict(userId: number, startIso: string, endIso: string): Promise<boolean> {
  const r = await query(
    `SELECT id FROM attendance
      WHERE user_id = $1
        AND date >= $2 AND date <= $3
        AND status IN ('approved', 'pending')
      LIMIT 1`,
    [userId, startIso, endIso],
  );
  return (r as any).rowCount > 0;
}

async function hasLeaveOverlap(
  userId: number,
  startIso: string,
  endIso: string,
  excludeId?: number,
): Promise<boolean> {
  const params: unknown[] = [userId, startIso, endIso];
  let sql = `SELECT id FROM leave_requests
      WHERE user_id = $1
        AND status IN ('pending', 'approved')
        AND start_date <= $3 AND end_date >= $2`;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $4`;
  }
  sql += ' LIMIT 1';
  const r = await query(sql, params);
  return (r as any).rowCount > 0;
}

export async function applyLeave(
  userId: number,
  leaveType: LeaveType,
  startDate: string,
  endDate: string,
  reason?: string,
  proof?: ProofPayload,
) {
  const balance = await getLeaveBalance(userId);
  if (!balance.can_apply) {
    throw new Error(`probation_active: Leave available after ${balance.probation_end}`);
  }

  const days = await countWorkingDays(startDate, endDate);
  if (days <= 0) {
    throw new Error('no_working_days: Selected range has no working days (weekends/holidays only)');
  }

  if (leaveType === 'CL') {
    validateClAdvanceNotice(startDate);
  }

  const needsProof = requiresMedicalProof(leaveType, days);

  if (await hasAttendanceConflict(userId, startDate, endDate)) {
    throw new Error('attendance_conflict: You already have attendance marked in this period');
  }
  if (await hasLeaveOverlap(userId, startDate, endDate)) {
    throw new Error('leave_overlap: Another leave request overlaps these dates');
  }

  const available = leaveType === 'CL' ? balance.cl_available : balance.sl_available;
  if (days > available) {
    throw new Error(
      `insufficient_balance: Requested ${days} day(s) but only ${available} ${leaveType} available`,
    );
  }

  const r = await query(
    `INSERT INTO leave_requests
       (user_id, leave_type, start_date, end_date, days, reason, status, requires_proof)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [userId, leaveType, startDate, endDate, days, reason?.trim() || null, needsProof],
  );
  const row = (r as any).rows[0];

  if (needsProof && proof) {
    await attachProofToRequest(row.id, userId, proof);
    const r2 = await query('SELECT * FROM leave_requests WHERE id = $1', [row.id]);
    return (r2 as any).rows[0];
  }

  return row;
}

export async function syncAttendanceForApprovedLeave(leaveRow: {
  id: number;
  user_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
}) {
  const start = parseDate(String(leaveRow.start_date).slice(0, 10));
  const end = parseDate(String(leaveRow.end_date).slice(0, 10));
  const holidays = await getHolidayDatesBetween(start, end);
  const note = `${leaveRow.leave_type} leave #${leaveRow.id}${leaveRow.reason ? `: ${leaveRow.reason}` : ''}`;

  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const key = toIsoDate(cur);
    if (dow !== 0 && !holidays.has(key)) {
      await query(
        `INSERT INTO attendance (user_id, date, status, note, needs_approval, created_at, updated_at)
         SELECT $1, $2, 'leave', $3, false, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM attendance WHERE user_id = $1 AND date = $2
         )`,
        [leaveRow.user_id, key, note],
      );
      await query(
        `UPDATE attendance SET status = 'leave', note = $3, updated_at = now()
         WHERE user_id = $1 AND date = $2 AND status IN ('absent', 'rejected', 'pending')`,
        [leaveRow.user_id, key, note],
      );
    }
    cur.setDate(cur.getDate() + 1);
  }
}

export async function approveLeaveRequest(
  requestId: number,
  approverId: number,
  approve: boolean,
  adminNote?: string,
) {
  const r0 = await query('SELECT * FROM leave_requests WHERE id = $1', [requestId]);
  if ((r0 as any).rowCount === 0) throw new Error('not_found');
  const row = (r0 as any).rows[0];
  if (row.status !== 'pending') throw new Error('already_processed');

  if (approve) {
    const balance = await getLeaveBalance(row.user_id);
    const available = row.leave_type === 'CL' ? balance.cl_available : balance.sl_available;
    if (Number(row.days) > available) {
      throw new Error(`insufficient_balance: Only ${available} ${row.leave_type} available now`);
    }
    if (row.requires_proof && !row.proof_path) {
      throw new Error(
        'proof_required: Medical document required — employee must upload proof before approval',
      );
    }
  }

  const status = approve ? 'approved' : 'rejected';
  const r = await query(
    `UPDATE leave_requests
        SET status = $1,
            admin_note = $2,
            approved_by = $3,
            approved_at = now(),
            updated_at = now()
      WHERE id = $4
      RETURNING *`,
    [status, adminNote?.trim() || null, approverId, requestId],
  );
  const updated = (r as any).rows[0];
  if (approve) await syncAttendanceForApprovedLeave(updated);
  return updated;
}

export async function cancelLeaveRequest(userId: number, requestId: number) {
  const r0 = await query(
    `SELECT * FROM leave_requests WHERE id = $1 AND user_id = $2`,
    [requestId, userId],
  );
  if ((r0 as any).rowCount === 0) throw new Error('not_found');
  const row = (r0 as any).rows[0];
  if (row.status !== 'pending') throw new Error('cannot_cancel');

  const r = await query(
    `UPDATE leave_requests SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *`,
    [requestId],
  );
  return (r as any).rows[0];
}

export async function listLeaveRequests(opts: {
  userId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params: unknown[] = [];
  const clauses: string[] = [];

  if (opts.userId) {
    params.push(opts.userId);
    clauses.push(`lr.user_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    clauses.push(`lr.status = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(opts.limit ?? 100, 500);
  const offset = opts.offset ?? 0;
  params.push(limit, offset);

  const r = await query(
    `SELECT lr.*,
            u.name AS employee_name,
            u.email AS employee_email,
            a.name AS approver_name
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       LEFT JOIN users a ON a.id = lr.approved_by
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return (r as any).rows;
}

export function canManageLeave(role: string | undefined): boolean {
  return role === 'admin' || role === 'attendance_admin';
}
