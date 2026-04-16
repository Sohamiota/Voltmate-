import cron from 'node-cron';
import { query } from '../db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the last N Mon–Sat dates (YYYY-MM-DD) at or before `fromDate` in the same month. */
function lastWorkingDays(fromDate: Date, n: number): string[] {
  const result: string[] = [];
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);

  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);

  while (result.length < n && d >= monthStart) {
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 6) {
      result.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
    d.setDate(d.getDate() - 1);
  }

  return result;
}

// ─── Core job logic (exported so it can be triggered manually / in tests) ─────

export async function runAutoAbsent(): Promise<void> {
  const now = new Date();
  console.log(`[autoAbsent] running at ${now.toISOString()}`);

  // 1. Fetch all active users
  const usersResult = await query(
    `SELECT id FROM users WHERE is_approved = true AND is_verified = true`,
  );
  const users: { id: number }[] = (usersResult as any).rows;

  if (users.length === 0) {
    console.log('[autoAbsent] no active users found, skipping');
    return;
  }

  const todayIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // shift to IST
  const todayStr = `${todayIST.getFullYear()}-${String(todayIST.getMonth() + 1).padStart(2, '0')}-${String(todayIST.getDate()).padStart(2, '0')}`;

  let markedAbsent = 0;
  let markedProbation = 0;
  let clearedProbation = 0;

  for (const user of users) {
    try {
      // 2. Check if the user already has any attendance record for today
      const existing = await query(
        `SELECT id FROM attendance WHERE user_id = $1 AND date = $2`,
        [user.id, todayStr],
      );

      if ((existing as any).rowCount === 0) {
        // 3. No record → insert absent (idempotent via unique index on user_id+date would
        //    also protect, but the check above is explicit and sufficient)
        await query(
          `INSERT INTO attendance (user_id, clock_in_at, date, status, needs_approval, created_at, updated_at)
           VALUES ($1, now(), $2, 'absent', false, now(), now())`,
          [user.id, todayStr],
        );
        markedAbsent++;
      }

      // 4. Probation check: look at the last 3 Mon–Sat dates (incl. today) in this month
      const workingDays = lastWorkingDays(todayIST, 3);

      if (workingDays.length < 3) {
        // Not enough working days in the month yet to trigger probation
        continue;
      }

      const recentResult = await query(
        `SELECT date, status FROM attendance
          WHERE user_id = $1
            AND date = ANY($2::date[])
          ORDER BY date DESC`,
        [user.id, workingDays],
      );
      const recentRows: { date: string; status: string }[] = (recentResult as any).rows;

      // Build a map for quick lookup
      const statusByDate: Record<string, string> = {};
      recentRows.forEach(r => {
        statusByDate[r.date] = r.status;
      });

      // All 3 days must exist and be 'absent'
      const allAbsent = workingDays.every(
        d => statusByDate[d] === 'absent',
      );

      if (allAbsent) {
        await query(`UPDATE users SET is_on_probation = true  WHERE id = $1`, [user.id]);
        markedProbation++;
      } else {
        // Clear probation once streak is broken
        await query(`UPDATE users SET is_on_probation = false WHERE id = $1`, [user.id]);
        clearedProbation++;
      }
    } catch (err) {
      console.error(`[autoAbsent] error processing user ${user.id}:`, err);
    }
  }

  console.log(
    `[autoAbsent] done — absent: ${markedAbsent}, probation set: ${markedProbation}, probation cleared: ${clearedProbation}`,
  );
}

// ─── Cron schedule ────────────────────────────────────────────────────────────
// 6:00 PM IST = 12:30 UTC.  Pattern: minute hour * * day-of-week(1-6 = Mon-Sat)

export function startAutoAbsentJob(): void {
  cron.schedule(
    '30 12 * * 1-6',
    () => {
      runAutoAbsent().catch(err => console.error('[autoAbsent] unhandled error:', err));
    },
    { timezone: 'UTC' },
  );
  console.log('[autoAbsent] cron job scheduled — fires at 12:30 UTC (18:00 IST) Mon–Sat');
}
