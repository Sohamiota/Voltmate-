'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')
).replace(/\/api\/v1\/?$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelRow       { status: string; count: number }
interface SpRow           { name: string; total: number; overdue: number; no_date: number; stale_7d: number; lost_month: number }
interface AgingRow        { status: string; bucket: string; count: number }
interface VehicleRow      { vehicle: string; count: number }
interface LocationRow     { location: string; count: number }
interface TrendRow        { day: string; count: number }
interface AtRiskSummary   { overdue: number; no_date: number; stale_7d: number }
interface LostNiBreakdownRow { reason: string; count: number }

interface AnalyticsData {
  pipeline_funnel:    FunnelRow[];
  salesperson_stats:  SpRow[];
  stage_aging:        AgingRow[];
  vehicle_breakdown:  VehicleRow[];
  location_breakdown: LocationRow[];
  daily_trend:        TrendRow[];
  at_risk_summary:    AtRiskSummary;
  lost_not_interested_breakdown?: LostNiBreakdownRow[];
}

interface AtRiskVisit {
  id: number;
  cust_name?: string;
  salesperson_name?: string;
  status?: string;
  next_action_date?: string;
  updated_at?: string;
  next_action?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FUNNEL_ORDER = [
  'New Lead', 'Attempted Contact', 'Connected', 'Requirement Identified',
  'Qualified Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared', 'Catalogue Shared',
  'Demo Follow Up', 'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed',
];

const STATUS_COLORS: Record<string, string> = {
  'New Lead':               '#6b7280',
  'Attempted Contact':      '#60a5fa',
  'Connected':              '#34d399',
  'Requirement Identified': '#a78bfa',
  'Qualified Lead':         '#f472b6',
  'Demo Scheduled':         '#818cf8',
  'Demo Completed':         '#8b5cf6',
  'Quotation Shared':       '#0ea5e9',
  'Catalogue Shared':       '#38bdf8',
  'Demo Follow Up':         '#fb923c',
  'Follow-Up 2':            '#fbbf24',
  'Negotiation':            '#f59e0b',
  'Booking Date Confirmed': '#22c55e',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function healthColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function agingBucketColor(bucket: string): string {
  if (bucket === 'lt3d')   return 'rgba(34,197,94,.18)';
  if (bucket === '3to7d')  return 'rgba(251,191,36,.18)';
  if (bucket === '7to14d') return 'rgba(249,115,22,.18)';
  return 'rgba(239,68,68,.22)';
}

function agingBucketText(bucket: string): string {
  if (bucket === 'lt3d')   return '#22c55e';
  if (bucket === '3to7d')  return '#fbbf24';
  if (bucket === '7to14d') return '#f97316';
  return '#ef4444';
}

// ── Component ──────────────────────────────────────────────────────────────────

type AtRiskTab = 'overdue' | 'no_date' | 'stale';
type SpSort = 'total' | 'overdue' | 'no_date' | 'stale_7d' | 'health';

export default function SalesAnalyticsPage() {
  const router = useRouter();
  const [roleChecked,  setRoleChecked]  = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data,         setData]         = useState<AnalyticsData | null>(null);
  const [allVisits,    setAllVisits]    = useState<AtRiskVisit[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [atRiskTab,    setAtRiskTab]    = useState<AtRiskTab>('overdue');
  const [spSort,       setSpSort]       = useState<SpSort>('total');
  const [spAsc,        setSpAsc]        = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Role guard
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
      const [analyticsRes, visitsRes] = await Promise.all([
        fetch(`${API}/api/v1/visits/report/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/visits/report?limit=1000`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (analyticsRes.ok) setData(await analyticsRes.json());
      if (visitsRes.ok)    { const j = await visitsRes.json(); setAllVisits(j.visits || []); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (roleChecked && !accessDenied) load(); }, [roleChecked, accessDenied, load]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const isLost = (v: AtRiskVisit) =>
    (v.status || '').toLowerCase().startsWith('lost') ||
    (v.next_action || '').toLowerCase().startsWith('lost');

  const overdueVisits = allVisits.filter(v =>
    !isLost(v) && v.next_action_date && new Date(v.next_action_date + 'T00:00:00') < today
  ).sort((a, b) => daysSince(a.next_action_date) > daysSince(b.next_action_date) ? -1 : 1);

  const noDateVisits = allVisits.filter(v => !isLost(v) && !v.next_action_date);

  const staleVisits = allVisits.filter(v => {
    if (isLost(v)) return false;
    if (!v.updated_at) return true;
    return (today.getTime() - new Date(v.updated_at).getTime()) / 86_400_000 >= 7;
  }).sort((a, b) => daysSince(a.updated_at) > daysSince(b.updated_at) ? -1 : 1);

  const atRiskList = atRiskTab === 'overdue' ? overdueVisits
    : atRiskTab === 'no_date' ? noDateVisits
    : staleVisits;

  // Funnel sorted by pipeline order
  const funnelRows = data
    ? [...data.pipeline_funnel].sort(
        (a, b) => FUNNEL_ORDER.indexOf(a.status) - FUNNEL_ORDER.indexOf(b.status)
      )
    : [];
  const funnelTotal = funnelRows.reduce((s, r) => s + Number(r.count), 0);

  // Salesperson table sorted
  const spRows = data
    ? [...data.salesperson_stats]
        .map(r => ({
          ...r,
          total:      Number(r.total),
          overdue:    Number(r.overdue),
          no_date:    Number(r.no_date),
          stale_7d:   Number(r.stale_7d),
          lost_month: Number(r.lost_month),
          health: Math.round(
            (Math.max(0, Number(r.total) - Number(r.overdue) - Number(r.no_date) - Number(r.stale_7d))
              / Math.max(1, Number(r.total))) * 100
          ),
        }))
        .sort((a, b) => {
          const dir = spAsc ? 1 : -1;
          return spSort === 'health'
            ? dir * (a.health - b.health)
            : dir * ((Number(a[spSort as keyof typeof a]) || 0) - (Number(b[spSort as keyof typeof b]) || 0));
        })
    : [];

  // Stage aging pivot
  const agingStatuses = FUNNEL_ORDER.filter(s =>
    data?.stage_aging.some(r => r.status === s)
  );
  const agingBuckets = ['lt3d', '3to7d', '7to14d', 'gt14d'];
  const agingBucketLabel: Record<string, string> = {
    lt3d: '< 3 days', '3to7d': '3–7 days', '7to14d': '7–14 days', gt14d: '14+ days',
  };
  function agingCell(status: string, bucket: string): number {
    return Number(data?.stage_aging.find(r => r.status === status && r.bucket === bucket)?.count ?? 0);
  }

  // Vehicle bars
  const vehicleRows = data?.vehicle_breakdown ?? [];
  const vehicleMax  = Math.max(1, ...vehicleRows.map(r => Number(r.count)));

  // Location bars
  const locationRows = data?.location_breakdown ?? [];
  const locationMax  = Math.max(1, ...locationRows.map(r => Number(r.count)));

  // Trend chart (inline SVG)
  const trendRows  = data?.daily_trend ?? [];
  const trendMax   = Math.max(1, ...trendRows.map(r => Number(r.count)));
  const trendW     = Math.max(600, trendRows.length * 24);
  const trendH     = 110;
  const trendPad   = 20;
  function trendX(i: number) { return trendPad + i * ((trendW - trendPad * 2) / Math.max(1, trendRows.length - 1)); }
  function trendY(v: number) { return trendH - trendPad - (v / trendMax) * (trendH - trendPad * 2); }
  const trendPath  = trendRows.length < 2
    ? ''
    : trendRows.map((r, i) => `${i === 0 ? 'M' : 'L'}${trendX(i).toFixed(1)},${trendY(Number(r.count)).toFixed(1)}`).join(' ');

  // Sort header helper
  const SortBtn = ({ k, label }: { k: SpSort; label: string }) => (
    <button
      className={`bg-transparent border-none text-[10px] cursor-pointer px-1 ${spSort === k ? 'text-red-500' : 'text-zinc-500'}`}
      onClick={() => { if (spSort === k) setSpAsc(p => !p); else { setSpSort(k); setSpAsc(false); } }}
    >
      {label} {spSort === k ? (spAsc ? 'ASC' : 'DESC') : '-'}
    </button>
  );

  // ── Shared table class strings ───────────────────────────────────────────────

  const thCls = 'px-3.5 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border-b border-[#1e1e1e] whitespace-nowrap';
  const tdCls = 'px-3.5 py-[11px] text-[13px] text-zinc-200 border-b border-[#181818] align-middle group-hover:bg-zinc-900';

  // ── Guards ──────────────────────────────────────────────────────────────────

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
        <div className="text-zinc-400 text-sm">Only Admins can view Sales Analytics.</div>
        <button
          onClick={() => router.back()}
          className="mt-4 py-2 px-5 bg-zinc-900 border border-[#333] rounded-lg text-zinc-200 cursor-pointer text-[13px]"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-[clamp(14px,4vw,28px)]">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[clamp(18px,4vw,24px)] font-bold text-white">Sales Analytics</div>
          <div className="text-zinc-400 text-[13px] mt-1">Deep-dive pipeline health — every lead, every salesperson, every risk</div>
        </div>
        <button
          className="bg-transparent text-zinc-400 border border-zinc-800 px-3.5 py-[7px] rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 hover:border-[#555] hover:text-zinc-200 disabled:opacity-50"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 px-5 text-zinc-500 text-sm">Loading analytics data…</div>
      ) : (
        <>
          {/* ══ SECTION 1: KPI Alert Bar ══ */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-6">
            <div className="bg-zinc-900 border border-[#222] rounded-2xl px-5 py-[18px]" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
              <div className="text-[clamp(26px,5vw,34px)] font-extrabold leading-none mb-1 text-green-500">{funnelTotal}</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-[.6px]">Active Pipeline</div>
              <div className="text-[11px] mt-[5px] text-green-500">Leads in progress</div>
            </div>
            <div className="bg-zinc-900 border border-[#222] rounded-2xl px-5 py-[18px]" style={{ borderColor: 'rgba(239,68,68,.35)' }}>
              <div className="text-[clamp(26px,5vw,34px)] font-extrabold leading-none mb-1 text-red-500">{data?.at_risk_summary?.overdue ?? 0}</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-[.6px]">Overdue</div>
              <div className="text-[11px] mt-[5px] text-red-500">Past next action date</div>
            </div>
            <div className="bg-zinc-900 border border-[#222] rounded-2xl px-5 py-[18px]" style={{ borderColor: 'rgba(251,191,36,.3)' }}>
              <div className="text-[clamp(26px,5vw,34px)] font-extrabold leading-none mb-1 text-amber-400">{data?.at_risk_summary?.no_date ?? 0}</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-[.6px]">No Date Set</div>
              <div className="text-[11px] mt-[5px] text-amber-400">No follow-up scheduled</div>
            </div>
            <div className="bg-zinc-900 border border-[#222] rounded-2xl px-5 py-[18px]" style={{ borderColor: 'rgba(249,115,22,.3)' }}>
              <div className="text-[clamp(26px,5vw,34px)] font-extrabold leading-none mb-1 text-orange-500">{data?.at_risk_summary?.stale_7d ?? 0}</div>
              <div className="text-[11px] text-zinc-400 uppercase tracking-[.6px]">Stale 7d+</div>
              <div className="text-[11px] mt-[5px] text-orange-500">Not updated in 7+ days</div>
            </div>
          </div>

          {/* ══ SECTION 2: Pipeline Funnel ══ */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              Pipeline Funnel
              <span className="text-[11px] text-zinc-400 font-normal">{funnelTotal} total active leads</span>
            </div>
            {funnelRows.length === 0 ? (
              <div className="text-zinc-600 text-[13px] text-center py-6">No active pipeline data</div>
            ) : (
              funnelRows.map(row => {
                const pct   = funnelTotal > 0 ? Math.round((Number(row.count) / funnelTotal) * 100) : 0;
                const color = STATUS_COLORS[row.status] || '#6b7280';
                return (
                  <div key={row.status} className="flex items-center gap-2.5 mb-2">
                    <div className="w-[180px] text-xs text-zinc-400 shrink-0 text-right">{row.status}</div>
                    <div className="flex-1 bg-[#1e1e1e] rounded-md h-6 overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center pl-2 text-[11px] font-semibold text-white transition-[width] duration-500"
                        style={{ width: `${Math.max(pct, 2)}%`, background: color + 'cc' }}
                      >
                        {pct >= 8 ? `${pct}%` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 w-10 text-right shrink-0">{row.count}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Lost – Not interested (structured reasons) */}
          {data?.lost_not_interested_breakdown && data.lost_not_interested_breakdown.length > 0 && (
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
              <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                Lost – Not interested
                <span className="text-[11px] text-zinc-400 font-normal">Breakdown by recorded reason</span>
              </div>
              <div className="grid gap-2 max-w-[480px]">
                {data.lost_not_interested_breakdown.map(row => (
                  <div key={row.reason} className="flex justify-between text-[13px] text-[#d1d5db]">
                    <span className="text-zinc-400">{row.reason}</span>
                    <span className="font-bold text-[#f87171]">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ SECTION 3: Salesperson Scorecard ══ */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">Salesperson Scorecard</div>
            <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Salesperson</th>
                    <th className={thCls}><SortBtn k="total"    label="Total" /></th>
                    <th className={thCls}><SortBtn k="overdue"  label="Overdue" /></th>
                    <th className={thCls}><SortBtn k="no_date"  label="No Date" /></th>
                    <th className={thCls}><SortBtn k="stale_7d" label="Stale 7d+" /></th>
                    <th className={thCls}>Lost (month)</th>
                    <th className={thCls}><SortBtn k="health"   label="Health" /></th>
                  </tr>
                </thead>
                <tbody>
                  {spRows.length === 0 ? (
                    <tr><td className="text-center py-8 px-3.5 text-zinc-600 text-[13px]" colSpan={7}>No data</td></tr>
                  ) : spRows.map(sp => (
                    <tr key={sp.name} className="group [&:last-child>td]:border-b-0">
                      <td className={tdCls} style={{ fontWeight: 600, color: '#fff' }}>{sp.name}</td>
                      <td className={tdCls}>{sp.total}</td>
                      <td className={tdCls}>
                        {sp.overdue > 0
                          ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border bg-red-500/[.12] text-red-500 border-red-500/30">{sp.overdue}</span>
                          : <span className="text-zinc-600">0</span>}
                      </td>
                      <td className={tdCls}>
                        {sp.no_date > 0
                          ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border bg-amber-400/10 text-amber-400 border-amber-400/25">{sp.no_date}</span>
                          : <span className="text-zinc-600">0</span>}
                      </td>
                      <td className={tdCls}>
                        {sp.stale_7d > 0
                          ? <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border bg-orange-500/10 text-orange-500 border-orange-500/25">{sp.stale_7d}</span>
                          : <span className="text-zinc-600">0</span>}
                      </td>
                      <td className={tdCls} style={{ color: sp.lost_month > 0 ? '#ef4444' : '#4b5563' }}>{sp.lost_month}</td>
                      <td className={tdCls}>
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                          style={{
                            color: healthColor(sp.health),
                            borderColor: healthColor(sp.health) + '55',
                            background: healthColor(sp.health) + '18',
                          }}
                        >
                          {sp.health}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2.5 text-[11px] text-zinc-600">
              Health = (Total – Overdue – No Date – Stale) / Total. Higher is better.
            </div>
          </div>

          {/* ══ SECTION 4: At-Risk Lead Safety Net ══ */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              At-Risk Lead Safety Net
              <span className="text-[11px] text-zinc-400 font-normal">No lead falls through the cracks</span>
            </div>
            <div className="flex gap-1.5 mb-3.5 flex-wrap">
              <div
                className={`bg-zinc-900 border rounded-lg px-3.5 py-1.5 text-xs cursor-pointer transition-all duration-150 hover:text-zinc-200 ${atRiskTab === 'overdue' ? 'bg-red-500/[.08] border-red-500/35 text-red-500 font-semibold' : 'border-zinc-800 text-zinc-400'}`}
                onClick={() => setAtRiskTab('overdue')}
              >
                Overdue ({overdueVisits.length})
              </div>
              <div
                className={`bg-zinc-900 border rounded-lg px-3.5 py-1.5 text-xs cursor-pointer transition-all duration-150 hover:text-zinc-200 ${atRiskTab === 'no_date' ? 'bg-red-500/[.08] border-red-500/35 text-red-500 font-semibold' : 'border-zinc-800 text-zinc-400'}`}
                onClick={() => setAtRiskTab('no_date')}
              >
                No Date Set ({noDateVisits.length})
              </div>
              <div
                className={`bg-zinc-900 border rounded-lg px-3.5 py-1.5 text-xs cursor-pointer transition-all duration-150 hover:text-zinc-200 ${atRiskTab === 'stale' ? 'bg-red-500/[.08] border-red-500/35 text-red-500 font-semibold' : 'border-zinc-800 text-zinc-400'}`}
                onClick={() => setAtRiskTab('stale')}
              >
                Stale 7d+ ({staleVisits.length})
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Salesperson</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>{atRiskTab === 'overdue' ? 'Days Overdue' : atRiskTab === 'stale' ? 'Days Stale' : 'Next Action'}</th>
                    <th className={thCls}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskList.length === 0 ? (
                    <tr>
                      <td className="text-center py-8 px-3.5 text-zinc-600 text-[13px]" colSpan={5}>
                        {atRiskTab === 'overdue' ? 'No overdue leads' : atRiskTab === 'no_date' ? 'All leads have a follow-up date' : 'No stale leads'}
                      </td>
                    </tr>
                  ) : atRiskList.slice(0, 50).map(v => {
                    const days = atRiskTab === 'overdue'
                      ? daysSince(v.next_action_date)
                      : daysSince(v.updated_at);
                    const badgeCls = days >= 14
                      ? 'bg-red-500/[.12] text-red-500 border-red-500/30'
                      : days >= 7
                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/25'
                        : 'bg-amber-400/10 text-amber-400 border-amber-400/25';
                    return (
                      <tr key={v.id} className="group [&:last-child>td]:border-b-0">
                        <td className={tdCls} style={{ fontWeight: 600, color: '#fff' }}>{v.cust_name || '—'}</td>
                        <td className={`${tdCls} text-zinc-400`}>{v.salesperson_name || '—'}</td>
                        <td className={tdCls}>
                          <span
                            className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border"
                            style={{
                              background: (STATUS_COLORS[v.status || ''] || '#6b7280') + '22',
                              color: STATUS_COLORS[v.status || ''] || '#6b7280',
                              borderColor: (STATUS_COLORS[v.status || ''] || '#6b7280') + '55',
                            }}
                          >
                            {v.status || 'New Lead'}
                          </span>
                        </td>
                        <td className={tdCls}>
                          {atRiskTab === 'no_date'
                            ? <span className="text-amber-400 text-xs">{v.next_action || 'Not set'}</span>
                            : <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeCls}`}>{days}d</span>
                          }
                        </td>
                        <td className={`${tdCls} text-zinc-500 text-xs`}>
                          {v.updated_at ? fmtDate(v.updated_at) : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {atRiskList.length > 50 && (
              <div className="mt-2.5 text-[11px] text-zinc-600 text-right">
                Showing top 50 of {atRiskList.length}
              </div>
            )}
          </div>

          {/* ══ SECTION 5: Stage Aging Heatmap ══ */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              Stage Aging Heatmap
              <span className="text-[11px] text-zinc-400 font-normal">How long leads sit in each stage</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-left bg-[#111] border border-[#1e1e1e]">Stage</th>
                    {agingBuckets.map(b => (
                      <th key={b} className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-center bg-[#111] border border-[#1e1e1e]">
                        {agingBucketLabel[b]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-[.5px] text-center bg-[#111] border border-[#1e1e1e]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingStatuses.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-zinc-600 text-[13px] border border-[#1e1e1e]">No data</td></tr>
                  ) : agingStatuses.map(status => {
                    const rowTotal = agingBuckets.reduce((s, b) => s + agingCell(status, b), 0);
                    return (
                      <tr key={status}>
                        <td className="px-3 py-2 text-xs border border-[#1e1e1e] font-semibold text-left text-zinc-400 text-[11px] font-normal whitespace-nowrap">{status}</td>
                        {agingBuckets.map(b => {
                          const val = agingCell(status, b);
                          return (
                            <td
                              key={b}
                              className="px-3 py-2 text-xs text-center border border-[#1e1e1e] font-semibold"
                              style={{
                                background: val > 0 ? agingBucketColor(b) : 'transparent',
                                color: val > 0 ? agingBucketText(b) : '#2a2a2a',
                              }}
                            >
                              {val > 0 ? val : '—'}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-xs text-center border border-[#1e1e1e] font-semibold text-zinc-400">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ SECTIONS 6 & 7: Vehicle + Location ══ */}
          <div className="grid grid-cols-2 gap-4 mb-5 max-[680px]:grid-cols-1">
            {/* Vehicle breakdown */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">Vehicle Interest</div>
              {vehicleRows.length === 0
                ? <div className="text-zinc-600 text-[13px] text-center py-6">No data</div>
                : (
                  <div className="flex flex-col gap-2">
                    {vehicleRows.map(r => (
                      <div key={r.vehicle} className="flex items-center gap-2.5">
                        <div className="text-[11px] text-zinc-400 w-[120px] shrink-0 truncate" title={r.vehicle}>{r.vehicle}</div>
                        <div className="flex-1 bg-[#1e1e1e] rounded-[5px] h-5 overflow-hidden">
                          <div
                            className="h-full rounded-[5px] transition-[width] duration-[400ms]"
                            style={{ width: `${Math.round((Number(r.count) / vehicleMax) * 100)}%`, background: '#8b5cf6cc' }}
                          />
                        </div>
                        <div className="text-[11px] text-zinc-400 w-8 text-right shrink-0">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Location breakdown */}
            <div className="bg-[#141414] border border-[#222] rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">Territory / Location</div>
              {locationRows.length === 0
                ? <div className="text-zinc-600 text-[13px] text-center py-6">No data</div>
                : (
                  <div className="flex flex-col gap-2">
                    {locationRows.map(r => (
                      <div key={r.location} className="flex items-center gap-2.5">
                        <div className="text-[11px] text-zinc-400 w-[120px] shrink-0 truncate" title={r.location}>{r.location}</div>
                        <div className="flex-1 bg-[#1e1e1e] rounded-[5px] h-5 overflow-hidden">
                          <div
                            className="h-full rounded-[5px] transition-[width] duration-[400ms]"
                            style={{ width: `${Math.round((Number(r.count) / locationMax) * 100)}%`, background: '#0ea5e9cc' }}
                          />
                        </div>
                        <div className="text-[11px] text-zinc-400 w-8 text-right shrink-0">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* ══ SECTION 8: 30-day Activity Trend ══ */}
          <div className="bg-[#141414] border border-[#222] rounded-2xl p-5 mb-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              30-Day Visit Activity Trend
              <span className="text-[11px] text-zinc-400 font-normal">New visits per day</span>
            </div>
            {trendRows.length === 0
              ? <div className="text-zinc-600 text-[13px] text-center py-6">No visit data in last 30 days</div>
              : (
                <div className="overflow-x-auto">
                  <svg
                    className="block"
                    width={trendW}
                    height={trendH + 20}
                    viewBox={`0 0 ${trendW} ${trendH + 20}`}
                  >
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                      const y = trendPad + (1 - pct) * (trendH - trendPad * 2);
                      return (
                        <line key={pct} x1={trendPad} y1={y} x2={trendW - trendPad} y2={y}
                          stroke="#1e1e1e" strokeWidth="1" />
                      );
                    })}
                    {/* Area fill */}
                    {trendRows.length >= 2 && (
                      <path
                        d={`${trendPath} L${trendX(trendRows.length - 1).toFixed(1)},${trendH - trendPad} L${trendX(0).toFixed(1)},${trendH - trendPad} Z`}
                        fill="rgba(239,68,68,.08)"
                      />
                    )}
                    {/* Line */}
                    {trendRows.length >= 2 && (
                      <path d={trendPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    {/* Dots + labels */}
                    {trendRows.map((r, i) => {
                      const x = trendX(i);
                      const y = trendY(Number(r.count));
                      const showLabel = trendRows.length <= 15 || i % Math.ceil(trendRows.length / 10) === 0;
                      return (
                        <g key={r.day}>
                          <circle cx={x} cy={y} r="3" fill="#ef4444" />
                          {Number(r.count) > 0 && (
                            <text x={x} y={y - 7} textAnchor="middle" fontSize="9" fill="#9ca3af">{r.count}</text>
                          )}
                          {showLabel && (
                            <text x={x} y={trendH + 14} textAnchor="middle" fontSize="8" fill="#4b5563">
                              {r.day.slice(5)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
