import { query } from '../db';

export interface TargetVisit {
  id: number;
  cust_name?: string;
  lead_cust_code?: string;
  salesperson_name?: string;
  vehicle?: string;
  status?: string;
  next_action?: string;
  next_action_date?: string;
  updated_at?: string;
  lead_location?: string;
}

export interface SalespersonDigest {
  name: string;
  targets: TargetVisit[];
  updated: TargetVisit[];
  pending: TargetVisit[];
  today: TargetVisit[];
  todayPending: TargetVisit[];
}

export interface DailyTargetDigest {
  botName: string;
  weekStart: string;
  weekEnd: string;
  today: string;
  weekLabel: string;
  totalTargets: number;
  totalUpdated: number;
  totalPending: number;
  activeSalespeople: number;
  salespeople: SalespersonDigest[];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWeekRange(weekOffset = 0): { startStr: string; endStr: string; label: string } {
  const d = new Date();
  const dow = d.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return {
    startStr: toDateStr(mon),
    endStr: toDateStr(sun),
    label: `${fmt(mon)} – ${fmt(sun)}`,
  };
}

function isInRange(dateStr: string | null | undefined, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
}

const PIPELINE_STATUSES = [
  'New Lead', 'Attempted Contact', 'Connected', 'Requirement Identified', 'Qualified Lead',
  'Demo Scheduled', 'Demo Completed', 'Quotation Shared', 'Catalogue Shared', 'Demo Follow Up',
  'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed',
];

export async function buildDailyTargetDigest(weekOffset = 0): Promise<DailyTargetDigest> {
  const week = getWeekRange(weekOffset);
  const today = toDateStr(new Date());
  const botName = process.env.WHATSAPP_BOT_NAME || 'SalesPulse';

  const statusList = PIPELINE_STATUSES.map(s => `'${s.replace(/'/g, "''")}'`).join(', ');

  const r = await query(
    `SELECT v.id, v.lead_cust_code, v.vehicle, v.status, v.next_action, v.next_action_date,
            v.updated_at, l.cust_name, l.location AS lead_location, u.name AS salesperson_name
     FROM visits v
     LEFT JOIN leads l ON l.id = v.lead_id
     LEFT JOIN users u ON u.id = v.salesperson_id
     WHERE v.next_action_date >= $1 AND v.next_action_date <= $2
       AND (v.status IS NULL OR v.status IN (${statusList}))
       AND (v.next_action IS NULL OR v.next_action NOT ILIKE 'Lost%')
       AND (v.status IS NULL OR v.status NOT ILIKE 'Lost%')
     ORDER BY u.name NULLS LAST, v.next_action_date ASC`,
    [week.startStr, week.endStr],
  );

  const visits: TargetVisit[] = (r as any).rows;
  const byName = new Map<string, TargetVisit[]>();

  for (const v of visits) {
    const name = (v.salesperson_name || 'Unassigned').trim();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(v);
  }

  const salespeople: SalespersonDigest[] = Array.from(byName.entries())
    .map(([name, targets]) => {
      const updated = targets.filter(t => isInRange(t.updated_at, week.startStr, week.endStr));
      const pending = targets.filter(t => !isInRange(t.updated_at, week.startStr, week.endStr));
      const todayVisits = targets.filter(t => (t.next_action_date || '').slice(0, 10) === today);
      const todayPending = todayVisits.filter(t => !isInRange(t.updated_at, week.startStr, week.endStr));
      return { name, targets, updated, pending, today: todayVisits, todayPending };
    })
    .sort((a, b) => b.targets.length - a.targets.length || b.pending.length - a.pending.length);

  const totalTargets = visits.length;
  const totalUpdated = visits.filter(v => isInRange(v.updated_at, week.startStr, week.endStr)).length;

  return {
    botName,
    weekStart: week.startStr,
    weekEnd: week.endStr,
    today,
    weekLabel: week.label,
    totalTargets,
    totalUpdated,
    totalPending: totalTargets - totalUpdated,
    activeSalespeople: salespeople.filter(s => s.targets.length > 0).length,
    salespeople,
  };
}

export function findSalesperson(digest: DailyTargetDigest, queryText: string): SalespersonDigest | null {
  const q = queryText.trim().toLowerCase();
  if (!q) return null;
  const exact = digest.salespeople.find(s => s.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = digest.salespeople.filter(s => s.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  return null;
}

export function listSalespersonNames(digest: DailyTargetDigest): string[] {
  return digest.salespeople.map(s => s.name);
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const plain = d.slice(0, 10);
  return new Date(`${plain}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}

function visitLine(v: TargetVisit, showPending = false): string {
  const cust = v.cust_name || v.lead_cust_code || 'Lead';
  const vehicle = v.vehicle ? ` · ${v.vehicle}` : '';
  const status = v.status || '—';
  const action = v.next_action ? ` → ${v.next_action}` : '';
  const pending = showPending ? ' ⏳' : '';
  return `• ${cust}${vehicle} (${status}${action})${pending}`;
}

export function formatTeamDigest(digest: DailyTargetDigest): string {
  const todayLabel = new Date(`${digest.today}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'short',
  });

  let msg = `📊 *${digest.botName} — Daily Target*\n`;
  msg += `📅 ${todayLabel} · Week ${digest.weekLabel}\n\n`;
  msg += `*Team summary*\n`;
  msg += `Targets: *${digest.totalTargets}* · Updated: *${digest.totalUpdated}* · Pending: *${digest.totalPending}*\n`;
  msg += `Active reps: *${digest.activeSalespeople}*\n\n`;
  msg += `*By salesperson*\n`;

  const top = digest.salespeople.slice(0, 15);
  for (const sp of top) {
    const todayCount = sp.today.length;
    const todayPending = sp.todayPending.length;
    msg += `\n*${sp.name}* — ${sp.targets.length} targets | ${sp.updated.length} done | ${sp.pending.length} pending`;
    if (todayCount > 0) {
      msg += `\n  Today: ${todayCount} follow-up${todayCount > 1 ? 's' : ''}`;
      if (todayPending > 0) msg += ` (${todayPending} pending)`;
    }
  }

  if (digest.salespeople.length > 15) {
    msg += `\n\n_+${digest.salespeople.length - 15} more reps…_`;
  }

  msg += `\n\n_Reply with a salesperson name for their full list._`;
  msg += `\n_Send *help* for all names._`;
  return msg;
}

export function formatSalespersonDetail(digest: DailyTargetDigest, sp: SalespersonDigest): string {
  let msg = `👤 *${sp.name}*\n`;
  msg += `Week ${digest.weekLabel}\n\n`;
  msg += `Targets: *${sp.targets.length}* · Updated: *${sp.updated.length}* · Pending: *${sp.pending.length}*\n`;

  if (sp.today.length > 0) {
    msg += `\n*Today (${fmtDate(digest.today)})*\n`;
    for (const v of sp.today.slice(0, 12)) {
      const pending = !isInRange(v.updated_at, digest.weekStart, digest.weekEnd);
      msg += visitLine(v, pending) + '\n';
    }
    if (sp.today.length > 12) msg += `_+${sp.today.length - 12} more today…_\n`;
  }

  if (sp.pending.length > 0) {
    msg += `\n*Pending this week*\n`;
    for (const v of sp.pending.slice(0, 10)) {
      msg += `• ${v.cust_name || v.lead_cust_code || 'Lead'} — due ${fmtDate(v.next_action_date)}\n`;
    }
    if (sp.pending.length > 10) msg += `_+${sp.pending.length - 10} more pending…_\n`;
  }

  if (sp.targets.length === 0) {
    msg += `\nNo targets scheduled this week.`;
  }

  return msg.trim();
}

export function formatHelpMessage(digest: DailyTargetDigest): string {
  const names = listSalespersonNames(digest);
  let msg = `🤖 *${digest.botName}* helps track weekly sales targets.\n\n`;
  msg += `*Commands*\n`;
  msg += `• Send a *salesperson name* for their update\n`;
  msg += `• *summary* — team digest\n`;
  msg += `• *help* — this message\n\n`;
  msg += `*Sales team (${names.length})*\n`;
  msg += names.slice(0, 30).map(n => `• ${n}`).join('\n');
  if (names.length > 30) msg += `\n_+${names.length - 30} more…_`;
  return msg;
}

export async function handleBotMessage(incomingText: string): Promise<string> {
  const text = incomingText.trim();
  const digest = await buildDailyTargetDigest(0);

  if (!text || /^hi$|^hello$|^hey$/i.test(text)) {
    return formatTeamDigest(digest);
  }

  if (/^help$|^menu$|^names$|^list$/i.test(text)) {
    return formatHelpMessage(digest);
  }

  if (/^summary$|^team$|^digest$|^daily$/i.test(text)) {
    return formatTeamDigest(digest);
  }

  const sp = findSalesperson(digest, text);
  if (sp) return formatSalespersonDetail(digest, sp);

  const matches = digest.salespeople.filter(s =>
    s.name.toLowerCase().includes(text.toLowerCase()),
  );
  if (matches.length > 1) {
    return `Multiple matches:\n${matches.map(m => `• ${m.name}`).join('\n')}\n\nReply with the full name.`;
  }

  return `No salesperson found for "*${text}*".\n\nSend *help* to see all names, or *summary* for the team digest.`;
}
