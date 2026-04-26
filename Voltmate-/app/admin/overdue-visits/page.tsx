'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

// ── Helpers ───────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysOverdue(next_action_date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(next_action_date + 'T00:00:00');
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** Returns amber / orange / red based on days overdue */
function urgencyColor(days: number): { bg: string; text: string; border: string; label: string } {
  if (days >= 14) return { bg: 'rgba(239,68,68,.12)',   text: '#ef4444', border: 'rgba(239,68,68,.3)',   label: 'Critical' };
  if (days >= 7)  return { bg: 'rgba(249,115,22,.12)',  text: '#f97316', border: 'rgba(249,115,22,.3)',  label: 'Urgent' };
  if (days >= 3)  return { bg: 'rgba(251,191,36,.12)',  text: '#fbbf24', border: 'rgba(251,191,36,.3)',  label: 'Overdue' };
  return            { bg: 'rgba(234,179,8,.1)',   text: '#eab308', border: 'rgba(234,179,8,.25)',  label: 'Due' };
}

function cardBorderClass(maxDays: number): string {
  if (maxDays >= 14) return ' emp-card-critical';
  if (maxDays >= 7)  return ' emp-card-urgent';
  if (maxDays >= 3)  return ' emp-card-overdue';
  return '';
}

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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  note?: string;
  updated_by_name?: string;
  updated_at?: string;
  created_at?: string;
}

interface SpRow {
  name: string;
  visits: Visit[];   // all overdue
  maxDays: number;   // worst overdue in this group
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  /* Header */
  .pg-hdr{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .pg-title{font-size:clamp(18px,4vw,24px);font-weight:700;color:#fff;}
  .pg-sub{color:#9ca3af;font-size:13px;margin-top:3px;}
  .pg-date{font-size:13px;color:#ef4444;font-weight:600;margin-top:3px;}
  /* Alert banner */
  .alert-banner{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#fca5a5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .alert-banner b{color:#ef4444;}
  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:20px;}
  .stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;}
  .stat-v{font-size:clamp(20px,4vw,26px);font-weight:700;margin-bottom:2px;}
  .stat-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Filter bar */
  .filter-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px;}
  .filter-chip{background:#141414;border:1px solid #232323;border-radius:8px;padding:6px 14px;font-size:12px;color:#9ca3af;cursor:pointer;transition:all .15s;white-space:nowrap;}
  .filter-chip:hover{border-color:#444;color:#e5e5e5;}
  .filter-chip.active{font-weight:600;}
  .filter-chip-all.active{background:rgba(107,114,128,.1);color:#9ca3af;border-color:rgba(107,114,128,.4);}
  .filter-chip-due.active{background:rgba(234,179,8,.1);color:#eab308;border-color:rgba(234,179,8,.3);}
  .filter-chip-overdue.active{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.3);}
  .filter-chip-urgent.active{background:rgba(249,115,22,.1);color:#f97316;border-color:rgba(249,115,22,.3);}
  .filter-chip-critical.active{background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.3);}
  .search{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:7px 14px;color:#e5e5e5;font-size:13px;outline:none;margin-left:auto;min-width:180px;}
  .search:focus{border-color:#ef4444;}
  /* Section header */
  .section-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
  .section-title{font-size:15px;font-weight:600;color:#fff;}
  /* Salesperson grid */
  .emp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;}
  .emp-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:18px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;}
  .emp-card:hover{transform:translateY(-2px);}
  .emp-card-critical{border-color:rgba(239,68,68,.4);}
  .emp-card-critical:hover{border-color:rgba(239,68,68,.7) !important;box-shadow:0 8px 24px rgba(239,68,68,.12) !important;}
  .emp-card-urgent{border-color:rgba(249,115,22,.4);}
  .emp-card-urgent:hover{border-color:rgba(249,115,22,.7) !important;box-shadow:0 8px 24px rgba(249,115,22,.12) !important;}
  .emp-card-overdue{border-color:rgba(251,191,36,.4);}
  .emp-card-overdue:hover{border-color:rgba(251,191,36,.7) !important;box-shadow:0 8px 24px rgba(251,191,36,.12) !important;}
  .emp-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;}
  .emp-nm{font-size:15px;font-weight:600;color:#fff;margin-bottom:8px;}
  .emp-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #252525;}
  .emp-arrow{color:#4b5563;font-size:16px;}
  /* Urgency breakdown pills on card */
  .urg-pills{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;}
  .urg-pill{font-size:11px;padding:2px 8px;border-radius:5px;font-weight:600;border:1px solid;}
  /* Back btn */
  .back-btn{display:inline-flex;align-items:center;gap:6px;color:#9ca3af;font-size:13px;cursor:pointer;background:none;border:none;padding:6px 0;margin-bottom:16px;transition:color .15s;}
  .back-btn:hover{color:#e5e5e5;}
  /* Detail header */
  .detail-hdr{display:flex;align-items:center;gap:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px;flex-wrap:wrap;}
  .detail-av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;}
  .detail-nm{font-size:18px;font-weight:700;color:#fff;}
  .detail-sub{font-size:13px;color:#9ca3af;margin-top:2px;}
  .detail-stats{display:flex;gap:20px;margin-left:auto;flex-wrap:wrap;}
  .dms{text-align:center;}
  .dms-v{font-size:20px;font-weight:700;}
  .dms-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Sort bar */
  .sort-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px;}
  .sort-lbl{font-size:12px;color:#6b7280;}
  .sort-btn{background:#141414;border:1px solid #232323;border-radius:6px;padding:5px 12px;font-size:12px;color:#9ca3af;cursor:pointer;transition:all .15s;}
  .sort-btn:hover{color:#e5e5e5;}
  .sort-btn.active{border-color:rgba(239,68,68,.4);color:#ef4444;background:rgba(239,68,68,.06);}
  /* Table */
  .tbl-wrap{background:#141414;border:1px solid #222;border-radius:12px;overflow:hidden;}
  .tbl{width:100%;border-collapse:collapse;}
  .tbl th{padding:11px 14px;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left;background:#111;border-bottom:1px solid #1e1e1e;}
  .tbl td{padding:12px 14px;font-size:13px;color:#e5e5e5;border-bottom:1px solid #1a1a1a;vertical-align:top;}
  .tbl tr:last-child td{border-bottom:none;}
  .tbl tr:hover td{background:#1a1a1a;}
  .tbl-empty{text-align:center;padding:36px 14px !important;color:#4b5563 !important;font-size:13px !important;}
  .badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid;}
  /* Buttons */
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #2a2a2a;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  /* Empty */
  .loading{text-align:center;padding:48px 20px;color:#6b7280;font-size:14px;}
  .no-items{text-align:center;padding:60px 20px;color:#4b5563;}
  .no-items-icon{font-size:48px;margin-bottom:14px;}
  .no-items-msg{font-size:16px;font-weight:600;color:#22c55e;margin-bottom:6px;}
  .no-items-sub{font-size:13px;color:#4b5563;}
  @media(max-width:480px){.detail-stats{gap:12px;}.dms-v{font-size:16px;}.tbl th,.tbl td{padding:9px 10px;}}
`;

// ── Component ──────────────────────────────────────────────────────────────────

type UrgencyFilter = 'all' | 'due' | 'overdue' | 'urgent' | 'critical';
type SortKey = 'days' | 'name' | 'count';

export default function OverdueVisitsPage() {
  const router = useRouter();
  const [roleChecked,  setRoleChecked]  = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [visits,       setVisits]       = useState<Visit[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [urgFilter,    setUrgFilter]    = useState<UrgencyFilter>('all');
  const [search,       setSearch]       = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('days');

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const today = localToday();

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

  // ── Overdue logic ─────────────────────────────────────────────────────────
  // A visit is overdue if:
  //   1. next_action_date exists and is strictly before today
  //   2. updated_at is null OR updated_at.date < next_action_date
  //      (i.e., the salesperson never updated it on/after the due date)
  const overdueVisits = visits.filter(v => {
    if (!v.next_action_date) return false;
    const nad = v.next_action_date.slice(0, 10);
    if (nad >= today) return false; // not yet due / due today
    const updDate = v.updated_at ? v.updated_at.slice(0, 10) : null;
    return !updDate || updDate < nad; // never updated, or last update was before the action date
  });

  // Categorise by urgency bucket
  function urgencyBucket(v: Visit): UrgencyFilter {
    const d = daysOverdue(v.next_action_date!);
    if (d >= 14) return 'critical';
    if (d >= 7)  return 'urgent';
    if (d >= 3)  return 'overdue';
    return 'due';
  }

  const filtered = urgFilter === 'all'
    ? overdueVisits
    : overdueVisits.filter(v => urgencyBucket(v) === urgFilter);

  // Group by salesperson
  const spMap: Record<string, Visit[]> = {};
  filtered.forEach(v => {
    const name = v.salesperson_name?.trim() || 'Unassigned';
    if (!spMap[name]) spMap[name] = [];
    spMap[name].push(v);
  });

  const rows: SpRow[] = Object.entries(spMap).map(([name, vs]) => ({
    name,
    visits: vs.sort((a, b) =>
      daysOverdue(b.next_action_date!) - daysOverdue(a.next_action_date!)
    ),
    maxDays: Math.max(...vs.map(v => daysOverdue(v.next_action_date!))),
  }));

  const sortedRows = [...rows].sort((a, b) => {
    if (sortKey === 'days')  return b.maxDays - a.maxDays;
    if (sortKey === 'count') return b.visits.length - a.visits.length;
    return a.name.localeCompare(b.name);
  });

  const visibleRows = search.trim()
    ? sortedRows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : sortedRows;

  // Bucket counts for filter chips
  const counts = {
    all:      overdueVisits.length,
    due:      overdueVisits.filter(v => urgencyBucket(v) === 'due').length,
    overdue:  overdueVisits.filter(v => urgencyBucket(v) === 'overdue').length,
    urgent:   overdueVisits.filter(v => urgencyBucket(v) === 'urgent').length,
    critical: overdueVisits.filter(v => urgencyBucket(v) === 'critical').length,
  };

  const selected = selectedName ? (rows.find(r => r.name === selectedName) ?? null) : null;
  const detailVisits = selected?.visits ?? [];

  const totalSPs    = rows.length;
  const worstDays   = rows.length ? Math.max(...rows.map(r => r.maxDays)) : 0;

  // ── Access guards ─────────────────────────────────────────────────────────
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
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Access Denied</div>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Only Admins can view the Overdue Visits panel.</div>
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: '8px 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5', cursor: 'pointer', fontSize: 13 }}>
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
          <div className="pg-title">Overdue Visits</div>
          <div className="pg-date">As of {fmtDate(today)}</div>
          <div className="pg-sub">
            {selected
              ? `${selected.name} — visits that crossed next action date without an update`
              : 'Visits whose next action date has passed without the salesperson updating the report'}
          </div>
        </div>
        <button className="btn-refresh" onClick={load}>Refresh</button>
      </div>

      {/* ── Alert banner ── */}
      {!loading && overdueVisits.length > 0 && (
        <div className="alert-banner">
          
          <span>
            <b>{overdueVisits.length} visit{overdueVisits.length !== 1 ? 's' : ''}</b> across{' '}
            <b>{totalSPs} salesperson{totalSPs !== 1 ? 's' : ''}</b> have missed their next action date.
            {worstDays >= 7 && (
              <> The most overdue visit is <b style={{ color: '#ef4444' }}>{worstDays} days</b> past due.</>
            )}
          </span>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="stats">
        <div className="stat">
          <div className="stat-v" style={{ color: '#ef4444' }}>{overdueVisits.length}</div>
          <div className="stat-l">Total Overdue</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#9ca3af' }}>{totalSPs}</div>
          <div className="stat-l">Salespersons</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#eab308' }}>{counts.due}</div>
          <div className="stat-l">1–2 Days Late</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#fbbf24' }}>{counts.overdue}</div>
          <div className="stat-l">3–6 Days Late</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#f97316' }}>{counts.urgent}</div>
          <div className="stat-l">7–13 Days Late</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#ef4444' }}>{counts.critical}</div>
          <div className="stat-l">14+ Days Late</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading overdue visits…</div>
      ) : selectedName === null ? (

        /* ════════════════ SALESPERSON GRID ════════════════ */
        <div>
          {/* Filter + search bar */}
          <div className="filter-bar">
            {([
              { key: 'all',      label: `All (${counts.all})`,            cls: 'filter-chip-all' },
              { key: 'due',      label: `1–2 Days (${counts.due})`,       cls: 'filter-chip-due' },
              { key: 'overdue',  label: `3–6 Days (${counts.overdue})`,   cls: 'filter-chip-overdue' },
              { key: 'urgent',   label: `7–13 Days (${counts.urgent})`,   cls: 'filter-chip-urgent' },
              { key: 'critical', label: `14+ Days (${counts.critical})`,  cls: 'filter-chip-critical' },
            ] as { key: UrgencyFilter; label: string; cls: string }[]).map(f => (
              <div
                key={f.key}
                className={`filter-chip ${f.cls}${urgFilter === f.key ? ' active' : ''}`}
                onClick={() => setUrgFilter(f.key)}
              >
                {f.label}
              </div>
            ))}
            <input
              className="search"
              placeholder="Search salesperson…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {overdueVisits.length === 0 ? (
            <div className="no-items">
              <div className="no-items-icon"></div>
              <div className="no-items-msg">All caught up!</div>
              <div className="no-items-sub">No overdue visits — every action date has been updated.</div>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="no-items">
              <div className="no-items-icon"></div>
              <div className="no-items-msg" style={{ color: '#6b7280' }}>No match found</div>
              <div className="no-items-sub">Try a different search or filter.</div>
            </div>
          ) : (
            <div>
              <div className="section-hdr">
                <div className="section-title">
                  Salespersons with overdue visits ({visibleRows.length})
                </div>
                <div className="sort-bar">
                  <span className="sort-lbl">Sort:</span>
                  {([
                    { k: 'days',  l: 'Worst first' },
                    { k: 'count', l: 'Most visits' },
                    { k: 'name',  l: 'Name A–Z' },
                  ] as { k: SortKey; l: string }[]).map(s => (
                    <button
                      key={s.k}
                      className={`sort-btn${sortKey === s.k ? ' active' : ''}`}
                      onClick={() => setSortKey(s.k)}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="emp-grid">
                {visibleRows.map(sp => {
                  const urg = urgencyColor(sp.maxDays);
                  const buckets = {
                    due:      sp.visits.filter(v => urgencyBucket(v) === 'due').length,
                    overdue:  sp.visits.filter(v => urgencyBucket(v) === 'overdue').length,
                    urgent:   sp.visits.filter(v => urgencyBucket(v) === 'urgent').length,
                    critical: sp.visits.filter(v => urgencyBucket(v) === 'critical').length,
                  };
                  return (
                    <div
                      key={sp.name}
                      className={`emp-card${cardBorderClass(sp.maxDays)}`}
                      onClick={() => setSelectedName(sp.name)}
                    >
                      <div className="emp-av">{getInitials(sp.name)}</div>
                      <div className="emp-nm">{sp.name}</div>

                      {/* Urgency pills */}
                      <div className="urg-pills">
                        {buckets.critical > 0 && (
                          <span className="urg-pill" style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}>
                            {buckets.critical} critical
                          </span>
                        )}
                        {buckets.urgent > 0 && (
                          <span className="urg-pill" style={{ background: 'rgba(249,115,22,.1)', color: '#f97316', borderColor: 'rgba(249,115,22,.3)' }}>
                            {buckets.urgent} urgent
                          </span>
                        )}
                        {buckets.overdue > 0 && (
                          <span className="urg-pill" style={{ background: 'rgba(251,191,36,.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,.3)' }}>
                            {buckets.overdue} overdue
                          </span>
                        )}
                        {buckets.due > 0 && (
                          <span className="urg-pill" style={{ background: 'rgba(234,179,8,.1)', color: '#eab308', borderColor: 'rgba(234,179,8,.25)' }}>
                            {buckets.due} due
                          </span>
                        )}
                      </div>

                      <div className="emp-footer">
                        <span
                          className="badge"
                          style={{ background: urg.bg, color: urg.text, borderColor: urg.border }}
                        >
                          {sp.visits.length} visit{sp.visits.length !== 1 ? 's' : ''} · up to {sp.maxDays}d late
                        </span>
                        <span className="emp-arrow"></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      ) : (

        /* ════════════════ DETAIL VIEW ════════════════ */
        <div>
          <button className="back-btn" onClick={() => setSelectedName(null)}>
            All Salespersons
          </button>

          {/* Header card */}
          <div className="detail-hdr">
            <div className="detail-av">{getInitials(selected!.name)}</div>
            <div>
              <div className="detail-nm">{selected!.name}</div>
              <div className="detail-sub">Overdue visits — action date passed, report not updated</div>
            </div>
            <div className="detail-stats">
              <div className="dms">
                <div className="dms-v" style={{ color: '#ef4444' }}>{selected!.visits.length}</div>
                <div className="dms-l">Overdue</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#f97316' }}>{selected!.maxDays}</div>
                <div className="dms-l">Max Days Late</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#fbbf24' }}>
                  {Math.round(
                    selected!.visits.reduce((s, v) => s + daysOverdue(v.next_action_date!), 0) /
                    selected!.visits.length
                  )}
                </div>
                <div className="dms-l">Avg Days Late</div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Next Action</th>
                  <th>Action Date</th>
                  <th>Days Late</th>
                  <th>Vehicle</th>
                  <th>Phone</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {detailVisits.length === 0 ? (
                  <tr>
                    <td className="tbl-empty" colSpan={8}>No overdue visits for {selected!.name}</td>
                  </tr>
                ) : detailVisits.map(v => {
                  const days = daysOverdue(v.next_action_date!);
                  const urg  = urgencyColor(days);
                  const sCol = statusColor(v.status);
                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{v.cust_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {[v.lead_cust_code, v.lead_location].filter(Boolean).join(' · ')}
                        </div>
                        {v.note && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
                            Note: {v.note}
                          </div>
                        )}
                      </td>
                      <td>
                        {v.status ? (
                          <span className="badge" style={{ background: sCol + '22', color: sCol, borderColor: sCol + '55' }}>
                            {v.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{v.next_action || '—'}</td>
                      <td>
                        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 12 }}>
                          {fmtDate(v.next_action_date)}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: urg.bg, color: urg.text, borderColor: urg.border }}
                        >
                          {days}d — {urg.label}
                        </span>
                      </td>
                      <td>{v.vehicle || '—'}</td>
                      <td>{v.phone_no || '—'}</td>
                      <td>
                        {v.updated_at ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>
                            <div>{new Date(v.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            {v.updated_by_name && (
                              <div style={{ fontSize: 11, marginTop: 2 }}>{v.updated_by_name}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#4b5563', fontSize: 12 }}>Never updated</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
