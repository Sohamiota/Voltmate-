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
  connect_date?: string;
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

  // Targets for this week = visits whose next_action_date falls in [start, end],
  // excluding any visit already marked Lost (by status or next_action).
  const weekTargets = visits.filter(v =>
    isInRange(v.next_action_date, week.startStr, week.endStr)
    && !(v.status || '').toLowerCase().startsWith('lost')
    && !(v.next_action || '').toLowerCase().startsWith('lost')
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-sans">
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 font-sans">
        <div className="text-red-500 font-bold text-[18px]">Access Denied</div>
        <div className="text-zinc-400 text-[14px]">Only Admins can view the Weekly Target panel.</div>
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
          <div className="text-[clamp(18px,4vw,24px)] font-bold text-white">Weekly Team Report</div>
          <div className="text-zinc-400 text-[13px] mt-[3px]">
            {selected
              ? `Viewing ${selected.name}'s targets for the week`
              : 'Team-wide visit targets — grouped by salesperson across the full week'}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className="bg-transparent text-zinc-400 border border-zinc-800 px-[14px] py-[7px] rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-150 hover:border-[#555] hover:text-zinc-200"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div className="flex items-center gap-[10px] bg-zinc-900 border border-[#232323] rounded-[10px] px-[14px] py-2 flex-wrap mb-4">
        <button
          className="bg-transparent border border-zinc-800 text-zinc-400 rounded-[7px] w-[30px] h-[30px] flex items-center justify-center cursor-pointer text-base transition-all duration-150 hover:border-[#555] hover:text-zinc-200"
          onClick={() => setWeekOffset(o => o - 1)}
        >
          Prev
        </button>
        <span className="text-[13px] font-semibold text-cyan-400 whitespace-nowrap">
          {fmtDateFull(week.start)} – {fmtDateFull(week.end)}
        </span>
        <button
          className="bg-transparent border border-zinc-800 text-zinc-400 rounded-[7px] w-[30px] h-[30px] flex items-center justify-center cursor-pointer text-base transition-all duration-150 hover:border-[#555] hover:text-zinc-200"
          onClick={() => setWeekOffset(o => o + 1)}
        >
          Next
        </button>
        <button
          className={`bg-transparent border px-[10px] py-1 text-[11px] cursor-pointer transition-all duration-150 rounded-[7px] ${
            isCurrentWeek
              ? 'border-cyan-400/40 text-cyan-400 bg-cyan-400/[0.07]'
              : 'border-zinc-800 text-zinc-400 hover:border-cyan-400 hover:text-cyan-400'
          }`}
          onClick={() => setWeekOffset(0)}
        >
          This Week
        </button>
      </div>

      {/* ── Day filter strip (grid level) ── */}
      <div className="flex gap-[6px] mb-5 overflow-x-auto pb-1">
        <div
          className={`flex-shrink-0 border rounded-lg px-[14px] py-[7px] text-[12px] cursor-pointer transition-all duration-150 text-center ${
            dayFilter === null
              ? 'bg-[#0e3a42] border-cyan-400/40 text-cyan-400 font-semibold'
              : 'bg-zinc-900 border-[#232323] text-zinc-400 hover:border-[#444] hover:text-zinc-200'
          }`}
          onClick={() => setDayFilter(null)}
        >
          All Days
        </div>
        {weekDays.map(wd => (
          <div
            key={wd.dateStr}
            className={`flex-shrink-0 border rounded-lg px-[14px] py-[7px] text-[12px] cursor-pointer transition-all duration-150 text-center ${
              dayFilter === wd.dateStr
                ? wd.isToday
                  ? 'bg-amber-400/10 border-amber-400/55 text-amber-400 font-semibold'
                  : 'bg-[#0e3a42] border-cyan-400/40 text-cyan-400 font-semibold'
                : wd.isToday
                  ? 'bg-zinc-900 border-amber-400/35 text-amber-400 hover:border-[#444]'
                  : 'bg-zinc-900 border-[#232323] text-zinc-400 hover:border-[#444] hover:text-zinc-200'
            }`}
            onClick={() => setDayFilter(prev => prev === wd.dateStr ? null : wd.dateStr)}
          >
            {wd.label}{wd.isToday ? ' (Today)' : ''}
          </div>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-[14px]">
          <div className="text-[clamp(20px,4vw,26px)] font-bold text-cyan-400 mb-[2px]">{activeCount}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Active Salespersons</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-[14px]">
          <div className="text-[clamp(20px,4vw,26px)] font-bold text-cyan-400 mb-[2px]">{totalTargets}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">
            {dayFilter ? 'Targets (Day)' : 'Targets (Week)'}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-[14px]">
          <div className="text-[clamp(20px,4vw,26px)] font-bold text-green-500 mb-[2px]">{totalUpdated}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Updated</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-[14px]">
          <div className="text-[clamp(20px,4vw,26px)] font-bold text-amber-400 mb-[2px]">{totalPending}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Pending</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-[14px]">
          <div className="text-[clamp(20px,4vw,26px)] font-bold text-violet-400 mb-[2px]">
            {totalTargets > 0 ? Math.round((totalUpdated / totalTargets) * 100) : 0}%
          </div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Completion</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 px-5 text-zinc-500 text-[14px]">Loading weekly targets…</div>
      ) : selectedName === null ? (

        /* ════════════════ SALESPERSON GRID ════════════════ */
        <div>
          <div className="flex items-center justify-between gap-[10px] mb-[14px] flex-wrap">
            <div className="text-[15px] font-semibold text-white">
              All Salespersons ({visibleRows.length})
              {totalTargets > 0 && (
                <span className="text-zinc-500 font-normal ml-2 text-[13px]">
                  — {totalTargets} target{totalTargets !== 1 ? 's' : ''} {dayFilter ? 'on selected day' : 'this week'}
                </span>
              )}
            </div>
            <input
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-[14px] py-2 text-zinc-200 text-[13px] outline-none min-w-[180px] focus:border-cyan-400"
              placeholder="Search salesperson…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {visibleRows.length === 0 ? (
            <div className="text-center py-[60px] px-5 text-[#4b5563]">
              <div className="text-[42px] mb-[14px]">🔍</div>
              <div className="text-[15px] font-semibold text-zinc-500 mb-[6px]">No salesperson found</div>
              <div className="text-[13px] text-[#4b5563]">Try a different search term.</div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[14px]">
              {visibleRows.map(sp => {
                const hasTargets = sp.targets.length > 0;
                const pct        = hasTargets ? Math.round((sp.updated.length / sp.targets.length) * 100) : 0;
                const allDone    = hasTargets && sp.pending.length === 0;

                return (
                  <div
                    key={sp.name}
                    className={`bg-zinc-900 border rounded-[14px] p-[18px] cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-0.5 ${
                      allDone
                        ? 'border-green-500/40 hover:border-green-500/70 hover:shadow-[0_8px_24px_rgba(34,197,94,0.1)]'
                        : sp.pending.length > 0
                          ? 'border-amber-400/40 hover:border-amber-400/70 hover:shadow-[0_8px_24px_rgba(251,191,36,0.1)]'
                          : 'border-zinc-800 hover:border-cyan-400 hover:shadow-[0_8px_24px_rgba(0,217,255,0.12)]'
                    }`}
                    onClick={() => { setSelectedName(sp.name); setTabFilter('all'); }}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-[15px] font-bold text-white mb-3">
                      {getInitials(sp.name)}
                    </div>
                    <div className="text-[15px] font-semibold text-white mb-2">{sp.name}</div>

                    {/* Day activity pills */}
                    {!dayFilter && (
                      <div className="flex gap-1 flex-wrap mb-[10px]">
                        {weekDays.map(wd => {
                          const cnt = (sp.byDay[wd.dateStr] ?? []).length;
                          const updCnt = (sp.byDay[wd.dateStr] ?? []).filter(v =>
                            isInRange(v.updated_at, week.startStr, week.endStr)
                          ).length;
                          const allUpdated = cnt > 0 && updCnt === cnt;
                          return (
                            <span
                              key={wd.dateStr}
                              className={`text-[10px] px-[7px] py-[2px] rounded-[5px] font-semibold border ${
                                cnt === 0
                                  ? 'bg-transparent text-[#374151] border-[#1e1e1e]'
                                  : allUpdated
                                    ? 'bg-green-500/[0.08] text-green-500 border-green-500/20'
                                    : 'bg-cyan-400/[0.08] text-cyan-400 border-cyan-400/25'
                              }`}
                              title={`${wd.label}: ${cnt} target${cnt !== 1 ? 's' : ''}${cnt > 0 ? `, ${updCnt} updated` : ''}`}
                            >
                              {DAY_KEYS[weekDays.indexOf(wd)]}
                              {cnt > 0 && <sup className="text-[8px] ml-[1px]">{cnt}</sup>}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="h-[5px] bg-zinc-800 rounded-[3px] mb-1">
                      <div
                        className="h-[5px] rounded-[3px] transition-[width] duration-300"
                        style={{
                          width: `${pct}%`,
                          background: allDone ? '#22c55e' : pct > 0 ? '#00d9ff' : '#2a2a2a',
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-zinc-500 text-right">
                      {hasTargets ? `${sp.updated.length}/${sp.targets.length} updated` : 'No targets this week'}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-[10px] border-t border-[#252525]">
                      {!hasTargets
                        ? <span className="bg-zinc-500/[0.08] text-zinc-500 border border-zinc-500/[0.18] rounded-full text-[11px] px-[10px] py-[3px]">No targets</span>
                        : allDone
                          ? <span className="bg-green-500/[0.08] text-[#86efac] border border-green-500/[0.18] rounded-full text-[11px] px-[10px] py-[3px]">All {sp.targets.length} updated</span>
                          : <span className="bg-amber-400/[0.12] text-amber-400 border border-amber-400/30 rounded-full text-[11px] font-semibold px-[10px] py-[3px]">● {sp.pending.length} pending</span>
                      }
                      <span className="text-[#4b5563] text-base">›</span>
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
          <button
            className="inline-flex items-center gap-[6px] text-zinc-400 text-[13px] cursor-pointer bg-transparent border-0 py-[6px] mb-4 transition-colors duration-150 hover:text-zinc-200"
            onClick={() => setSelectedName(null)}
          >
            ← All Salespersons
          </button>

          {/* Salesperson header */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-[14px] p-5 mb-4 flex-wrap">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0">
              {getInitials(selected!.name)}
            </div>
            <div>
              <div className="text-[18px] font-bold text-white">{selected!.name}</div>
              <div className="text-[13px] text-zinc-400 mt-[2px]">
                {fmtDateFull(week.start)} – {fmtDateFull(week.end)}
              </div>
            </div>
            <div className="flex gap-5 max-[480px]:gap-3 ml-auto flex-wrap">
              <div className="text-center">
                <div className="text-[20px] max-[480px]:text-[16px] font-bold">{selected!.targets.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Total</div>
              </div>
              <div className="text-center">
                <div className="text-[20px] max-[480px]:text-[16px] font-bold text-green-500">{selected!.updated.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-[20px] max-[480px]:text-[16px] font-bold text-amber-400">{selected!.pending.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-[20px] max-[480px]:text-[16px] font-bold text-violet-400">
                  {selected!.targets.length > 0
                    ? Math.round((selected!.updated.length / selected!.targets.length) * 100)
                    : 0}%
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Done</div>
              </div>
            </div>
          </div>

          {/* Filter tabs: All, each day with targets, Updated, Pending */}
          <div className="flex gap-1 mb-4 bg-zinc-900 border border-[#232323] rounded-[10px] p-1 overflow-x-auto">
            {(['all', 'updated', 'pending'] as const).map(f => {
              const count = f === 'all'     ? selected!.targets.length
                          : f === 'updated' ? selected!.updated.length
                          : selected!.pending.length;
              return (
                <button
                  key={f}
                  className={`flex-shrink-0 px-[10px] py-[7px] border-0 text-[12px] rounded-[7px] cursor-pointer transition-all duration-150 text-center font-medium whitespace-nowrap ${
                    tabFilter === f
                      ? 'bg-[#0e3a42] text-cyan-400 font-semibold'
                      : 'bg-transparent text-zinc-400 hover:text-[#ccc]'
                  }`}
                  onClick={() => setTabFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'updated' ? 'Updated' : 'Pending'} ({count})
                </button>
              );
            })}
            <div className="w-px bg-[#232323] my-1 mx-1" />
            {weekDays.map(wd => {
              const cnt = (selected!.byDay[wd.dateStr] ?? []).length;
              if (cnt === 0) return null;
              const shortDay = new Date(wd.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
              return (
                <button
                  key={wd.dateStr}
                  className={`flex-shrink-0 px-[10px] py-[7px] border-0 text-[12px] rounded-[7px] cursor-pointer transition-all duration-150 text-center font-medium whitespace-nowrap ${
                    tabFilter === wd.dateStr
                      ? 'bg-[#0e3a42] text-cyan-400 font-semibold'
                      : wd.isToday
                        ? 'bg-transparent text-amber-400 hover:text-[#ccc]'
                        : 'bg-transparent text-zinc-400 hover:text-[#ccc]'
                  }`}
                  onClick={() => setTabFilter(wd.dateStr)}
                >
                  {shortDay}{wd.isToday ? ' (Today)' : ''} ({cnt})
                </button>
              );
            })}
          </div>

          {/* Visit table grouped by day */}
          {detailVisits.length === 0 ? (
            <div className="bg-zinc-900 border border-[#222] rounded-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Customer</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Day</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Status</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Next Action</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Connect Date</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Target Date</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Vehicle</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Phone</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Updated</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center py-9 px-[14px] text-[#4b5563] text-[13px]" colSpan={10}>
                      No targets for {selected!.name} in this view
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-[#222] rounded-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Customer</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Day</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Status</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Next Action</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Connect Date</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Target Date</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Vehicle</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Phone</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Updated</th>
                    <th className="px-[14px] py-[11px] max-[480px]:px-[10px] max-[480px]:py-[9px] text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.5px] text-left bg-[#111] border-b border-[#1e1e1e]">Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tabFilter === 'all' || weekDays.some(w => w.dateStr === tabFilter)
                    ? detailByDay.flatMap(group => [
                        <tr key={`hdr-${group.dateStr}`}>
                          <td colSpan={10} className="p-0 bg-transparent">
                            <div className="flex items-center gap-[10px] px-[14px] py-[10px] bg-[#111] border-b border-[#1e1e1e]">
                              <span className={`text-[11px] font-bold uppercase tracking-[0.5px] ${group.isToday ? 'text-amber-400' : 'text-zinc-400'}`}>
                                {group.label}{group.isToday ? ' — Today' : ''}
                              </span>
                              <span className="text-[11px] text-[#4b5563] ml-auto">
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
    <tr key={v.id} className="group">
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">
        <div className="font-semibold text-white">{v.cust_name || '—'}</div>
        <div className="text-[11px] text-zinc-500 mt-[2px]">
          {[v.lead_cust_code, v.lead_location].filter(Boolean).join(' · ')}
        </div>
        {v.note && (
          <div className="text-[11px] text-zinc-400 mt-1 italic">
            Note: {v.note}
          </div>
        )}
      </td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">
        <span className={`text-[11px] font-semibold ${
          isActionToday
            ? 'text-amber-400 bg-amber-400/[0.08] px-[6px] py-[2px] rounded-[5px] border border-amber-400/20'
            : 'text-zinc-400'
        }`}>
          {getDayLabel(v.next_action_date)}{isActionToday ? ' (Today)' : ''}
        </span>
      </td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">
        {v.status ? (
          <span
            className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border"
            style={{ background: sColor + '22', color: sColor, borderColor: sColor + '55' }}
          >
            {v.status}
          </span>
        ) : '—'}
      </td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">{v.next_action || '—'}</td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">{fmtDate(v.connect_date)}</td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">{fmtDate(v.next_action_date)}</td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">{v.vehicle || '—'}</td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">{v.phone_no || '—'}</td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">
        {done && v.updated_at ? (
          <div>
            <div className="text-green-500 text-[12px]">
              {new Date(v.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
              {new Date(v.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
            {v.updated_by_name && (
              <div className="text-[11px] text-zinc-500">{v.updated_by_name}</div>
            )}
          </div>
        ) : '—'}
      </td>
      <td className="px-[14px] py-3 max-[480px]:px-[10px] max-[480px]:py-[9px] text-[13px] text-zinc-200 border-b border-zinc-900 align-top last:border-b-0 group-hover:bg-zinc-900">
        {done
          ? <span className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border bg-green-500/10 text-green-500 border-green-500/25">Updated</span>
          : <span className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border bg-amber-400/10 text-amber-400 border-amber-400/25">Pending</span>
        }
      </td>
    </tr>
  );
}
