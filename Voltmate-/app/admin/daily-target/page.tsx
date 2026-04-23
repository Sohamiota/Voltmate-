'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localToday(): string {
  return toDateStr(new Date());
}

/** Returns the Monday–Sunday range for the week at `weekOffset` from current. */
function getWeekRange(weekOffset = 0): { start: Date; end: Date; startStr: string; endStr: string } {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun, startStr: toDateStr(mon), endStr: toDateStr(sun) };
}

function isInRange(dateStr: string | null | undefined, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}

function fmtDateFull(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDayLabel(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const plain = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Visit {
  id: number;
  lead_cust_code?: string;
  cust_name?: string;
  lead_location?: string | null;
  lead_type?: string;
  salesperson_name?: string;
  vehicle?: string;
  status?: string;
  visit_date?: string;
  next_action?: string;
  next_action_date?: string;
  phone_no?: string;
  phone_no_2?: string;
  note?: string;
  updated_by_name?: string;
  updated_at?: string;
  created_at?: string;
}

interface SalespersonRow {
  name: string;
  targets: Visit[];   // next_action_date in this week
  updated: Visit[];   // updated_at in this week
  pending: Visit[];   // not updated this week
  byDay: Record<string, Visit[]>; // dateStr -> visits
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_COLORS: Record<string, string> = {
  'New Lead':                  '#6b7280',
  'Follow-Up':                 '#3b82f6',
  'Demo Scheduled':            '#a78bfa',
  'Demo Completed':            '#8b5cf6',
  'Quotation Shared':          '#0ea5e9',
  'Negotiation':               '#f59e0b',
  'Booking Date Confirmed':    '#14b8a6',
  'Booking Amount Received':   '#22c55e',
  'Lost — Not Interested':     '#ef4444',
  'Lost — Bought Competitor':  '#ef4444',
};
function statusColor(s?: string): string {
  return STATUS_COLORS[s || ''] || '#6b7280';
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  /* Header */
  .pg-hdr{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .pg-title{font-size:clamp(18px,4vw,24px);font-weight:700;color:#fff;}
  .pg-sub{color:#9ca3af;font-size:13px;margin-top:3px;}
  /* Week nav */
  .week-nav{display:flex;align-items:center;gap:10px;background:#141414;border:1px solid #232323;border-radius:10px;padding:8px 14px;flex-wrap:wrap;}
  .week-btn{background:transparent;border:1px solid #2a2a2a;color:#9ca3af;border-radius:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:all .15s;}
  .week-btn:hover{border-color:#555;color:#e5e5e5;}
  .week-label{font-size:13px;font-weight:600;color:#00d9ff;white-space:nowrap;}
  .week-today-btn{background:transparent;border:1px solid #2a2a2a;color:#9ca3af;border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;transition:all .15s;}
  .week-today-btn:hover{border-color:#00d9ff;color:#00d9ff;}
  .week-today-btn.active{border-color:rgba(0,217,255,.4);color:#00d9ff;background:rgba(0,217,255,.07);}
  /* Day strip */
  .day-strip{display:flex;gap:6px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;}
  .day-chip{flex-shrink:0;background:#141414;border:1px solid #232323;border-radius:8px;padding:7px 14px;font-size:12px;color:#9ca3af;cursor:pointer;transition:all .15s;text-align:center;}
  .day-chip:hover{border-color:#444;color:#e5e5e5;}
  .day-chip.active{background:#0e3a42;border-color:rgba(0,217,255,.4);color:#00d9ff;font-weight:600;}
  .day-chip.today-chip{border-color:rgba(251,191,36,.35);color:#fbbf24;}
  .day-chip.today-chip.active{background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.55);}
  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:20px;}
  .stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;}
  .stat-v{font-size:clamp(20px,4vw,26px);font-weight:700;color:#00d9ff;margin-bottom:2px;}
  .stat-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Section header */
  .section-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
  .section-title{font-size:15px;font-weight:600;color:#fff;}
  .search{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 14px;color:#e5e5e5;font-size:13px;outline:none;min-width:180px;}
  .search:focus{border-color:#00d9ff;}
  /* Salesperson grid */
  .emp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;}
  .emp-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:18px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;}
  .emp-card:hover{border-color:#00d9ff;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,217,255,.12);}
  .emp-card-pending{border-color:rgba(251,191,36,.4);}
  .emp-card-pending:hover{border-color:rgba(251,191,36,.7) !important;box-shadow:0 8px 24px rgba(251,191,36,.1) !important;}
  .emp-card-done{border-color:rgba(34,197,94,.4);}
  .emp-card-done:hover{border-color:rgba(34,197,94,.7) !important;box-shadow:0 8px 24px rgba(34,197,94,.1) !important;}
  .emp-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#0e7490);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;}
  .emp-nm{font-size:15px;font-weight:600;color:#fff;margin-bottom:8px;}
  /* Day pills on card */
  .day-pills{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;}
  .day-pill{font-size:10px;padding:2px 7px;border-radius:5px;font-weight:600;border:1px solid;}
  .day-pill-active{background:rgba(0,217,255,.08);color:#00d9ff;border-color:rgba(0,217,255,.25);}
  .day-pill-done{background:rgba(34,197,94,.08);color:#22c55e;border-color:rgba(34,197,94,.2);}
  .day-pill-empty{background:transparent;color:#374151;border-color:#1e1e1e;}
  .prog-bg{height:5px;background:#2a2a2a;border-radius:3px;margin-bottom:4px;}
  .prog-fill{height:5px;border-radius:3px;transition:width .3s;}
  .prog-label{font-size:11px;color:#6b7280;text-align:right;}
  .emp-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #252525;}
  .badge-pending-card{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:20px;font-size:11px;font-weight:600;padding:3px 10px;}
  .badge-ok-card{background:rgba(34,197,94,.08);color:#86efac;border:1px solid rgba(34,197,94,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .badge-none-card{background:rgba(107,114,128,.08);color:#6b7280;border:1px solid rgba(107,114,128,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .emp-arrow{color:#4b5563;font-size:16px;}
  /* Detail */
  .back-btn{display:inline-flex;align-items:center;gap:6px;color:#9ca3af;font-size:13px;cursor:pointer;background:none;border:none;padding:6px 0;margin-bottom:16px;transition:color .15s;}
  .back-btn:hover{color:#e5e5e5;}
  .detail-hdr{display:flex;align-items:center;gap:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px;flex-wrap:wrap;}
  .detail-av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#0e7490);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;}
  .detail-nm{font-size:18px;font-weight:700;color:#fff;}
  .detail-sub{font-size:13px;color:#9ca3af;margin-top:2px;}
  .detail-stats{display:flex;gap:20px;margin-left:auto;flex-wrap:wrap;}
  .dms{text-align:center;}
  .dms-v{font-size:20px;font-weight:700;}
  .dms-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Tabs */
  .tabs{display:flex;gap:4px;margin-bottom:16px;background:#141414;border:1px solid #232323;border-radius:10px;padding:4px;overflow-x:auto;}
  .tab{flex-shrink:0;padding:7px 10px;border:none;background:transparent;color:#9ca3af;font-size:12px;border-radius:7px;cursor:pointer;transition:all .15s;text-align:center;font-weight:500;white-space:nowrap;}
  .tab.active{background:#0e3a42;color:#00d9ff;font-weight:600;}
  .tab:hover:not(.active){color:#ccc;}
  /* Day group header */
  .day-group-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111;border-bottom:1px solid #1e1e1e;}
  .day-group-lbl{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  .day-group-today{color:#fbbf24;}
  .day-group-count{font-size:11px;color:#4b5563;margin-left:auto;}
  /* Table */
  .tbl-wrap{background:#141414;border:1px solid #222;border-radius:12px;overflow:hidden;}
  .tbl{width:100%;border-collapse:collapse;}
  .tbl th{padding:11px 14px;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left;background:#111;border-bottom:1px solid #1e1e1e;}
  .tbl td{padding:12px 14px;font-size:13px;color:#e5e5e5;border-bottom:1px solid #1a1a1a;vertical-align:top;}
  .tbl tr:last-child td{border-bottom:none;}
  .tbl tr:hover td{background:#1a1a1a;}
  .tbl-empty{text-align:center;padding:36px 14px !important;color:#4b5563 !important;font-size:13px !important;}
  .badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;border:1px solid;}
  .badge-updated{background:rgba(34,197,94,.1);color:#22c55e;border-color:rgba(34,197,94,.25);}
  .badge-pending-v{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.25);}
  /* Buttons */
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #2a2a2a;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  /* Empty / loading */
  .loading{text-align:center;padding:48px 20px;color:#6b7280;font-size:14px;}
  .no-targets{text-align:center;padding:60px 20px;color:#4b5563;}
  .no-targets-icon{font-size:42px;margin-bottom:14px;}
  .no-targets-msg{font-size:15px;font-weight:600;color:#6b7280;margin-bottom:6px;}
  .no-targets-sub{font-size:13px;color:#4b5563;}
  @media(max-width:480px){.detail-stats{gap:12px;}.dms-v{font-size:16px;}.tbl th,.tbl td{padding:9px 10px;}}
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyTargetPage() {
  const router = useRouter();
  const [roleChecked,  setRoleChecked]  = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [visits,       setVisits]       = useState<Visit[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [tabFilter,    setTabFilter]    = useState<'all' | 'updated' | 'pending' | string>('all');
  const [search,       setSearch]       = useState('');
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [dayFilter,    setDayFilter]    = useState<string | null>(null); // grid-level day filter

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const today = localToday();
  const week  = getWeekRange(weekOffset);

  // Build array of dates for this week (Mon → Sun)
  const weekDays: { dateStr: string; label: string; isToday: boolean }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.start);
    d.setDate(week.start.getDate() + i);
    const ds = toDateStr(d);
    return {
      dateStr: ds,
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
      isToday: ds === today,
    };
  });

  const isCurrentWeek = weekOffset === 0;

  // ── Role guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.user?.role !== 'admin') setAccessDenied(true);
        setRoleChecked(true);
      })
      .catch(() => setRoleChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/visits/report?limit=100000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setVisits(j.visits || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Reset day filter when week changes
  useEffect(() => { setDayFilter(null); }, [weekOffset]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Targets for this week = visits whose next_action_date falls in [start, end]
  const weekTargets = visits.filter(v =>
    isInRange(v.next_action_date, week.startStr, week.endStr)
  );

  // Apply optional day filter (grid level)
  const filteredTargets = dayFilter
    ? weekTargets.filter(v => v.next_action_date?.slice(0, 10) === dayFilter)
    : weekTargets;

  const allSpNames = Array.from(
    new Set(visits.map(v => v.salesperson_name?.trim() || 'Unassigned').filter(Boolean))
  ).sort();

  // Group targets by salesperson
  const weekMap: Record<string, Visit[]> = {};
  filteredTargets.forEach(v => {
    const name = v.salesperson_name?.trim() || 'Unassigned';
    if (!weekMap[name]) weekMap[name] = [];
    weekMap[name].push(v);
  });

  const rows: SalespersonRow[] = allSpNames.map(name => {
    const targets = weekMap[name] ?? [];
    const byDay: Record<string, Visit[]> = {};
    targets.forEach(v => {
      const ds = v.next_action_date?.slice(0, 10) ?? 'unknown';
      if (!byDay[ds]) byDay[ds] = [];
      byDay[ds].push(v);
    });
    return {
      name,
      targets,
      updated: targets.filter(v => isInRange(v.updated_at, week.startStr, week.endStr)),
      pending: targets.filter(v => !isInRange(v.updated_at, week.startStr, week.endStr)),
      byDay,
    };
  }).sort((a, b) => b.targets.length - a.targets.length || b.pending.length - a.pending.length);

  const visibleRows = search.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const totalTargets = filteredTargets.length;
  const totalUpdated = filteredTargets.filter(v => isInRange(v.updated_at, week.startStr, week.endStr)).length;
  const totalPending = totalTargets - totalUpdated;
  const activeCount  = rows.filter(r => r.targets.length > 0).length;

  const selected = selectedName ? (rows.find(r => r.name === selectedName) ?? null) : null;

  // Detail view: tab filter
  const detailVisits = (() => {
    if (!selected) return [];
    if (tabFilter === 'updated') return selected.updated;
    if (tabFilter === 'pending') return selected.pending;
    // Day-specific tab
    if (tabFilter !== 'all') {
      return selected.byDay[tabFilter] ?? [];
    }
    return selected.targets;
  })();

  // Group detail visits by date for display
  const detailByDay: { dateStr: string; label: string; isToday: boolean; visits: Visit[] }[] = weekDays
    .map(wd => ({
      ...wd,
      visits: detailVisits.filter(v => v.next_action_date?.slice(0, 10) === wd.dateStr),
    }))
    .filter(g => g.visits.length > 0);

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!roleChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'system-ui, sans-serif' }}>
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 36 }}>🚫</div>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Access Denied</div>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Only Admins can view the Weekly Target panel.</div>
        <button
          onClick={() => router.back()}
          style={{ marginTop: 16, padding: '8px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5', cursor: 'pointer', fontSize: 13 }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="root">
      <style>{S}</style>

      {/* ── Header ── */}
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Weekly Team Report</div>
          <div className="pg-sub">
            {selected
              ? `Viewing ${selected.name}'s targets for the week`
              : 'Team-wide visit targets — grouped by salesperson across the full week'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-refresh" onClick={load}>↺ Refresh</button>
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div className="week-nav" style={{ marginBottom: 16 }}>
        <button className="week-btn" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
        <span className="week-label">
          {fmtDateFull(week.start)} – {fmtDateFull(week.end)}
        </span>
        <button className="week-btn" onClick={() => setWeekOffset(o => o + 1)}>›</button>
        <button
          className={`week-today-btn${isCurrentWeek ? ' active' : ''}`}
          onClick={() => setWeekOffset(0)}
        >
          This Week
        </button>
      </div>

      {/* ── Day filter strip (grid level) ── */}
      <div className="day-strip">
        <div
          className={`day-chip${dayFilter === null ? ' active' : ''}`}
          onClick={() => setDayFilter(null)}
        >
          All Days
        </div>
        {weekDays.map(wd => (
          <div
            key={wd.dateStr}
            className={`day-chip${wd.isToday ? ' today-chip' : ''}${dayFilter === wd.dateStr ? ' active' : ''}`}
            onClick={() => setDayFilter(prev => prev === wd.dateStr ? null : wd.dateStr)}
          >
            {wd.label}{wd.isToday ? ' ★' : ''}
          </div>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="stats">
        <div className="stat">
          <div className="stat-v">{activeCount}</div>
          <div className="stat-l">Active Salespersons</div>
        </div>
        <div className="stat">
          <div className="stat-v">{totalTargets}</div>
          <div className="stat-l">
            {dayFilter ? 'Targets (Day)' : 'Targets (Week)'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#22c55e' }}>{totalUpdated}</div>
          <div className="stat-l">Updated</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#fbbf24' }}>{totalPending}</div>
          <div className="stat-l">Pending</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#a78bfa' }}>
            {totalTargets > 0 ? Math.round((totalUpdated / totalTargets) * 100) : 0}%
          </div>
          <div className="stat-l">Completion</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading weekly targets…</div>
      ) : selectedName === null ? (

        /* ════════════════ SALESPERSON GRID ════════════════ */
        <div>
          <div className="section-hdr">
            <div className="section-title">
              All Salespersons ({visibleRows.length})
              {totalTargets > 0 && (
                <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
                  — {totalTargets} target{totalTargets !== 1 ? 's' : ''} {dayFilter ? 'on selected day' : 'this week'}
                </span>
              )}
            </div>
            <input
              className="search"
              placeholder="Search salesperson…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {visibleRows.length === 0 ? (
            <div className="no-targets">
              <div className="no-targets-icon">🔍</div>
              <div className="no-targets-msg">No salesperson found</div>
              <div className="no-targets-sub">Try a different search term.</div>
            </div>
          ) : (
            <div className="emp-grid">
              {visibleRows.map(sp => {
                const hasTargets = sp.targets.length > 0;
                const pct        = hasTargets ? Math.round((sp.updated.length / sp.targets.length) * 100) : 0;
                const allDone    = hasTargets && sp.pending.length === 0;

                return (
                  <div
                    key={sp.name}
                    className={`emp-card${allDone ? ' emp-card-done' : sp.pending.length > 0 ? ' emp-card-pending' : ''}`}
                    onClick={() => { setSelectedName(sp.name); setTabFilter('all'); }}
                  >
                    <div className="emp-av">{getInitials(sp.name)}</div>
                    <div className="emp-nm">{sp.name}</div>

                    {/* Day activity pills */}
                    {!dayFilter && (
                      <div className="day-pills">
                        {weekDays.map(wd => {
                          const cnt = (sp.byDay[wd.dateStr] ?? []).length;
                          const updCnt = (sp.byDay[wd.dateStr] ?? []).filter(v =>
                            isInRange(v.updated_at, week.startStr, week.endStr)
                          ).length;
                          const allUpdated = cnt > 0 && updCnt === cnt;
                          return (
                            <span
                              key={wd.dateStr}
                              className={`day-pill ${cnt === 0 ? 'day-pill-empty' : allUpdated ? 'day-pill-done' : 'day-pill-active'}`}
                              title={`${wd.label}: ${cnt} target${cnt !== 1 ? 's' : ''}${cnt > 0 ? `, ${updCnt} updated` : ''}`}
                            >
                              {DAY_KEYS[weekDays.indexOf(wd)]}
                              {cnt > 0 && <sup style={{ fontSize: 8, marginLeft: 1 }}>{cnt}</sup>}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="prog-bg">
                      <div
                        className="prog-fill"
                        style={{
                          width: `${pct}%`,
                          background: allDone ? '#22c55e' : pct > 0 ? '#00d9ff' : '#2a2a2a',
                        }}
                      />
                    </div>
                    <div className="prog-label">
                      {hasTargets ? `${sp.updated.length}/${sp.targets.length} updated` : 'No targets this week'}
                    </div>

                    <div className="emp-footer">
                      {!hasTargets
                        ? <span className="badge-none-card">No targets</span>
                        : allDone
                          ? <span className="badge-ok-card">✓ All {sp.targets.length} updated</span>
                          : <span className="badge-pending-card">● {sp.pending.length} pending</span>
                      }
                      <span className="emp-arrow">›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (

        /* ════════════════ DETAIL VIEW ════════════════ */
        <div>
          <button className="back-btn" onClick={() => setSelectedName(null)}>
            ‹ All Salespersons
          </button>

          {/* Salesperson header */}
          <div className="detail-hdr">
            <div className="detail-av">{getInitials(selected!.name)}</div>
            <div>
              <div className="detail-nm">{selected!.name}</div>
              <div className="detail-sub">
                {fmtDateFull(week.start)} – {fmtDateFull(week.end)}
              </div>
            </div>
            <div className="detail-stats">
              <div className="dms">
                <div className="dms-v">{selected!.targets.length}</div>
                <div className="dms-l">Total</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#22c55e' }}>{selected!.updated.length}</div>
                <div className="dms-l">Updated</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#fbbf24' }}>{selected!.pending.length}</div>
                <div className="dms-l">Pending</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#a78bfa' }}>
                  {selected!.targets.length > 0
                    ? Math.round((selected!.updated.length / selected!.targets.length) * 100)
                    : 0}%
                </div>
                <div className="dms-l">Done</div>
              </div>
            </div>
          </div>

          {/* Filter tabs: All, each day with targets, Updated, Pending */}
          <div className="tabs">
            {(['all', 'updated', 'pending'] as const).map(f => {
              const count = f === 'all'     ? selected!.targets.length
                          : f === 'updated' ? selected!.updated.length
                          : selected!.pending.length;
              return (
                <button key={f} className={`tab${tabFilter === f ? ' active' : ''}`} onClick={() => setTabFilter(f)}>
                  {f === 'all' ? 'All' : f === 'updated' ? 'Updated' : 'Pending'} ({count})
                </button>
              );
            })}
            <div style={{ width: 1, background: '#232323', margin: '4px 4px' }} />
            {weekDays.map(wd => {
              const cnt = (selected!.byDay[wd.dateStr] ?? []).length;
              if (cnt === 0) return null;
              const shortDay = new Date(wd.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
              return (
                <button
                  key={wd.dateStr}
                  className={`tab${tabFilter === wd.dateStr ? ' active' : ''}`}
                  onClick={() => setTabFilter(wd.dateStr)}
                  style={wd.isToday ? { color: tabFilter === wd.dateStr ? undefined : '#fbbf24' } : undefined}
                >
                  {shortDay}{wd.isToday ? ' ★' : ''} ({cnt})
                </button>
              );
            })}
          </div>

          {/* Visit table grouped by day */}
          {detailVisits.length === 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Customer</th><th>Day</th><th>Status</th><th>Next Action</th>
                    <th>Target Date</th><th>Vehicle</th><th>Phone</th><th>Updated</th><th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="tbl-empty" colSpan={9}>
                      No targets for {selected!.name} in this view
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Next Action</th>
                    <th>Target Date</th>
                    <th>Vehicle</th>
                    <th>Phone</th>
                    <th>Updated</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tabFilter === 'all' || weekDays.some(w => w.dateStr === tabFilter)
                    ? detailByDay.flatMap(group => [
                        <tr key={`hdr-${group.dateStr}`}>
                          <td
                            colSpan={9}
                            style={{ padding: 0, background: 'transparent' }}
                          >
                            <div className="day-group-hdr">
                              <span className={`day-group-lbl${group.isToday ? ' day-group-today' : ''}`}>
                                {group.label}{group.isToday ? ' — Today' : ''}
                              </span>
                              <span className="day-group-count">
                                {group.visits.length} target{group.visits.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>,
                        ...group.visits.map(v => renderVisitRow(v, week, today)),
                      ])
                    : detailVisits.map(v => renderVisitRow(v, week, today))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderVisitRow(
  v: Visit,
  week: { startStr: string; endStr: string },
  today: string,
) {
  const done   = isInRange(v.updated_at, week.startStr, week.endStr);
  const sColor = statusColor(v.status);
  const isActionToday = v.next_action_date?.slice(0, 10) === today;

  return (
    <tr key={v.id}>
      <td>
        <div style={{ fontWeight: 600, color: '#fff' }}>{v.cust_name || '—'}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          {[v.lead_cust_code, v.lead_location].filter(Boolean).join(' · ')}
        </div>
        {v.note && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
            📝 {v.note}
          </div>
        )}
      </td>
      <td>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: isActionToday ? '#fbbf24' : '#9ca3af',
          background: isActionToday ? 'rgba(251,191,36,.08)' : 'transparent',
          padding: isActionToday ? '2px 6px' : '0',
          borderRadius: 5,
          border: isActionToday ? '1px solid rgba(251,191,36,.2)' : 'none',
        }}>
          {getDayLabel(v.next_action_date)}{isActionToday ? ' ★' : ''}
        </span>
      </td>
      <td>
        {v.status ? (
          <span
            className="badge"
            style={{ background: sColor + '22', color: sColor, borderColor: sColor + '55' }}
          >
            {v.status}
          </span>
        ) : '—'}
      </td>
      <td>{v.next_action || '—'}</td>
      <td>{fmtDate(v.next_action_date)}</td>
      <td>{v.vehicle || '—'}</td>
      <td>{v.phone_no || '—'}</td>
      <td>
        {done && v.updated_at ? (
          <div>
            <div style={{ color: '#22c55e', fontSize: 12 }}>
              {new Date(v.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
              {new Date(v.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
            {v.updated_by_name && (
              <div style={{ fontSize: 11, color: '#6b7280' }}>{v.updated_by_name}</div>
            )}
          </div>
        ) : '—'}
      </td>
      <td>
        {done
          ? <span className="badge badge-updated">✓ Updated</span>
          : <span className="badge badge-pending-v">⏳ Pending</span>
        }
      </td>
    </tr>
  );
}
