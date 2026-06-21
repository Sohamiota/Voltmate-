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
  if (maxDays >= 14) return 'border-red-500/40 hover:border-red-500/70 hover:shadow-[0_8px_24px_rgba(239,68,68,.12)]';
  if (maxDays >= 7)  return 'border-orange-500/40 hover:border-orange-500/70 hover:shadow-[0_8px_24px_rgba(249,115,22,.12)]';
  if (maxDays >= 3)  return 'border-amber-400/40 hover:border-amber-400/70 hover:shadow-[0_8px_24px_rgba(251,191,36,.12)]';
  return 'border-zinc-800';
}

const STATUS_COLORS: Record<string, string> = {
  'New Lead':                  '#6b7280',
  'Follow-Up':                 '#3b82f6',
  'Demo Scheduled':            '#a78bfa',
  'Demo Completed':            '#8b5cf6',
  'Quotation Shared':          '#0ea5e9',
  'Catalogue Shared':          '#38bdf8',
  'Negotiation':               '#f59e0b',
  'Booking Date Confirmed':    '#14b8a6',
  'Booking Amount Received':   '#22c55e',
  'Lost \u2013 Not Interested':    '#ef4444',
  'Lost \u2013 Competitor':        '#ef4444',
  'Lost \u2013 Price Issue':       '#ef4444',
  'Lost \u2013 No Response':       '#ef4444',
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
    if ((v.status || '').toLowerCase().startsWith('lost')) return false;
    if ((v.next_action || '').toLowerCase().startsWith('lost')) return false;
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-sans">
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 font-sans">
        <div className="text-red-500 font-bold text-lg">Access Denied</div>
        <div className="text-zinc-400 text-sm">Only Admins can view the Overdue Visits panel.</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-5 py-2 bg-zinc-900 border border-[#333] rounded-lg text-zinc-200 cursor-pointer text-[13px]"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-[clamp(14px,4vw,28px)]">

      {/* ── Header ── */}
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[clamp(18px,4vw,24px)] font-bold text-white">Overdue Visits</div>
          <div className="text-[13px] text-red-500 font-semibold mt-[3px]">As of {fmtDate(today)}</div>
          <div className="text-zinc-400 text-[13px] mt-[3px]">
            {selected
              ? `${selected.name} — visits that crossed next action date without an update`
              : 'Visits whose next action date has passed without the salesperson updating the report'}
          </div>
        </div>
        <button
          className="bg-transparent text-zinc-400 border border-zinc-800 px-3.5 py-[7px] rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 hover:border-[#555] hover:text-zinc-200"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {/* ── Alert banner ── */}
      {!loading && overdueVisits.length > 0 && (
        <div className="bg-red-500/[.08] border border-red-500/25 rounded-[10px] px-4 py-3 mb-5 text-[13px] text-red-300 flex items-center gap-2.5 flex-wrap">
          ⚠️
          <span>
            <b className="text-red-500">{overdueVisits.length} visit{overdueVisits.length !== 1 ? 's' : ''}</b> across{' '}
            <b className="text-red-500">{totalSPs} salesperson{totalSPs !== 1 ? 's' : ''}</b> have missed their next action date.
            {worstDays >= 7 && (
              <> The most overdue visit is <b className="text-red-500">{worstDays} days</b> past due.</>
            )}
          </span>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-red-500">{overdueVisits.length}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">Total Overdue</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-zinc-400">{totalSPs}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">Salespersons</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-yellow-500">{counts.due}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">1–2 Days Late</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-amber-400">{counts.overdue}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">3–6 Days Late</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-orange-500">{counts.urgent}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">7–13 Days Late</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5">
          <div className="text-[clamp(20px,4vw,26px)] font-bold mb-0.5 text-red-500">{counts.critical}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">14+ Days Late</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 px-5 text-zinc-500 text-sm">Loading overdue visits…</div>
      ) : selectedName === null ? (

        /* ════════════════ SALESPERSON GRID ════════════════ */
        <div>
          {/* Filter + search bar */}
          <div className="flex gap-2 flex-wrap items-center mb-[18px]">
            {([
              { key: 'all',      label: `All (${counts.all})`,            activeCls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/40' },
              { key: 'due',      label: `1–2 Days (${counts.due})`,       activeCls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' },
              { key: 'overdue',  label: `3–6 Days (${counts.overdue})`,   activeCls: 'bg-amber-400/10 text-amber-400 border-amber-400/30' },
              { key: 'urgent',   label: `7–13 Days (${counts.urgent})`,   activeCls: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
              { key: 'critical', label: `14+ Days (${counts.critical})`,  activeCls: 'bg-red-500/10 text-red-500 border-red-500/30' },
            ] as { key: UrgencyFilter; label: string; activeCls: string }[]).map(f => (
              <div
                key={f.key}
                className={`bg-zinc-900 border border-[#232323] rounded-lg px-3.5 py-1.5 text-xs cursor-pointer transition-all duration-150 whitespace-nowrap hover:border-[#444] hover:text-zinc-200${urgFilter === f.key ? ` font-semibold ${f.activeCls}` : ' text-zinc-400'}`}
                onClick={() => setUrgFilter(f.key)}
              >
                {f.label}
              </div>
            ))}
            <input
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-[7px] text-zinc-200 text-[13px] outline-none ml-auto min-w-[180px] focus:border-red-500"
              placeholder="Search salesperson…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {overdueVisits.length === 0 ? (
            <div className="text-center py-[60px] px-5 text-gray-600">
              <div className="text-5xl mb-3.5"></div>
              <div className="text-base font-semibold text-green-500 mb-1.5">All caught up!</div>
              <div className="text-[13px] text-gray-600">No overdue visits — every action date has been updated.</div>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="text-center py-[60px] px-5 text-gray-600">
              <div className="text-5xl mb-3.5"></div>
              <div className="text-base font-semibold text-zinc-500 mb-1.5">No match found</div>
              <div className="text-[13px] text-gray-600">Try a different search or filter.</div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2.5 mb-3.5 flex-wrap">
                <div className="text-[15px] font-semibold text-white">
                  Salespersons with overdue visits ({visibleRows.length})
                </div>
                <div className="flex gap-1.5 flex-wrap items-center mb-3.5">
                  <span className="text-xs text-zinc-500">Sort:</span>
                  {([
                    { k: 'days',  l: 'Worst first' },
                    { k: 'count', l: 'Most visits' },
                    { k: 'name',  l: 'Name A–Z' },
                  ] as { k: SortKey; l: string }[]).map(s => (
                    <button
                      key={s.k}
                      className={`bg-zinc-900 border rounded-md px-3 py-[5px] text-xs cursor-pointer transition-all duration-150 hover:text-zinc-200${sortKey === s.k ? ' border-red-500/40 text-red-500 bg-red-500/[.06]' : ' border-[#232323] text-zinc-400'}`}
                      onClick={() => setSortKey(s.k)}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
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
                      className={`bg-zinc-900 border rounded-2xl p-[18px] cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-0.5 ${cardBorderClass(sp.maxDays)}`}
                      onClick={() => setSelectedName(sp.name)}
                    >
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-[15px] font-bold text-white mb-3">
                        {getInitials(sp.name)}
                      </div>
                      <div className="text-[15px] font-semibold text-white mb-2">{sp.name}</div>

                      {/* Urgency pills */}
                      <div className="flex gap-[5px] flex-wrap mb-2.5">
                        {buckets.critical > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-[5px] font-semibold border bg-red-500/10 text-red-500 border-red-500/30">
                            {buckets.critical} critical
                          </span>
                        )}
                        {buckets.urgent > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-[5px] font-semibold border bg-orange-500/10 text-orange-500 border-orange-500/30">
                            {buckets.urgent} urgent
                          </span>
                        )}
                        {buckets.overdue > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-[5px] font-semibold border bg-amber-400/10 text-amber-400 border-amber-400/30">
                            {buckets.overdue} overdue
                          </span>
                        )}
                        {buckets.due > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-[5px] font-semibold border bg-yellow-500/10 text-yellow-500 border-yellow-500/25">
                            {buckets.due} due
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#252525]">
                        <span
                          className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-semibold border"
                          style={{ background: urg.bg, color: urg.text, borderColor: urg.border }}
                        >
                          {sp.visits.length} visit{sp.visits.length !== 1 ? 's' : ''} · up to {sp.maxDays}d late
                        </span>
                        <span className="text-gray-600 text-base">›</span>
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
          <button
            className="inline-flex items-center gap-1.5 text-zinc-400 text-[13px] cursor-pointer bg-transparent border-none py-1.5 mb-4 transition-colors duration-150 hover:text-zinc-200"
            onClick={() => setSelectedName(null)}
          >
            All Salespersons
          </button>

          {/* Header card */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4 flex-wrap">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xl font-bold text-white shrink-0">
              {getInitials(selected!.name)}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{selected!.name}</div>
              <div className="text-[13px] text-zinc-400 mt-0.5">Overdue visits — action date passed, report not updated</div>
            </div>
            <div className="flex gap-5 ml-auto flex-wrap">
              <div className="text-center">
                <div className="text-xl font-bold text-red-500">{selected!.visits.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">Overdue</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-500">{selected!.maxDays}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">Max Days Late</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">
                  {Math.round(
                    selected!.visits.reduce((s, v) => s + daysOverdue(v.next_action_date!), 0) /
                    selected!.visits.length
                  )}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[.5px]">Avg Days Late</div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-900 border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Customer</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Status</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Next Action</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Action Date</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Days Late</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Vehicle</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Phone</th>
                  <th className="px-3.5 py-[11px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Last Updated</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {detailVisits.length === 0 ? (
                  <tr>
                    <td className="text-center py-9 px-3.5 text-zinc-600 text-[13px]" colSpan={8}>No overdue visits for {selected!.name}</td>
                  </tr>
                ) : detailVisits.map(v => {
                  const days = daysOverdue(v.next_action_date!);
                  const urg  = urgencyColor(days);
                  const sCol = statusColor(v.status);
                  return (
                    <tr key={v.id} className="group">
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">
                        <div className="font-semibold text-white">{v.cust_name || '—'}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {[v.lead_cust_code, v.lead_location].filter(Boolean).join(' · ')}
                        </div>
                        {v.note && (
                          <div className="text-[11px] text-zinc-400 mt-1 italic">
                            Note: {v.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">
                        {v.status ? (
                          <span className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-semibold border" style={{ background: sCol + '22', color: sCol, borderColor: sCol + '55' }}>
                            {v.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">{v.next_action || '—'}</td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">
                        <span className="text-red-500 font-semibold text-xs">
                          {fmtDate(v.next_action_date)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">
                        <span
                          className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-semibold border"
                          style={{ background: urg.bg, color: urg.text, borderColor: urg.border }}
                        >
                          {days}d — {urg.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">{v.vehicle || '—'}</td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">{v.phone_no || '—'}</td>
                      <td className="px-3.5 py-3 text-[13px] text-zinc-200 border-b border-zinc-900 align-top group-hover:bg-zinc-900">
                        {v.updated_at ? (
                          <div className="text-zinc-500 text-xs">
                            <div>{new Date(v.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            {v.updated_by_name && (
                              <div className="text-[11px] mt-0.5">{v.updated_by_name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">Never updated</span>
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
