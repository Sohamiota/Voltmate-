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

interface AnalyticsData {
  pipeline_funnel:    FunnelRow[];
  salesperson_stats:  SpRow[];
  stage_aging:        AgingRow[];
  vehicle_breakdown:  VehicleRow[];
  location_breakdown: LocationRow[];
  daily_trend:        TrendRow[];
  at_risk_summary:    AtRiskSummary;
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
  'Qualified Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared',
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

// ── Inline styles ─────────────────────────────────────────────────────────────

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  .pg-hdr{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .pg-title{font-size:clamp(18px,4vw,24px);font-weight:700;color:#fff;}
  .pg-sub{color:#9ca3af;font-size:13px;margin-top:4px;}
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #2a2a2a;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  /* KPI bar */
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;}
  .kpi{background:#1a1a1a;border:1px solid #222;border-radius:14px;padding:18px 20px;}
  .kpi-v{font-size:clamp(26px,5vw,34px);font-weight:800;line-height:1;margin-bottom:4px;}
  .kpi-l{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;}
  .kpi-sub{font-size:11px;margin-top:5px;}
  /* Panels */
  .panel{background:#141414;border:1px solid #222;border-radius:14px;padding:20px;margin-bottom:20px;}
  .panel-title{font-size:14px;font-weight:600;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
  .panel-title span{font-size:11px;color:#9ca3af;font-weight:400;}
  /* Two-col */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
  @media(max-width:680px){.two-col{grid-template-columns:1fr;}}
  /* Funnel */
  .funnel-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .funnel-label{width:180px;font-size:12px;color:#9ca3af;flex-shrink:0;text-align:right;}
  .funnel-bar-wrap{flex:1;background:#1e1e1e;border-radius:6px;height:24px;overflow:hidden;}
  .funnel-bar{height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px;font-size:11px;font-weight:600;color:#fff;transition:width .5s;}
  .funnel-count{font-size:12px;color:#9ca3af;width:40px;text-align:right;flex-shrink:0;}
  /* Table */
  .tbl-wrap{overflow-x:auto;border-radius:10px;border:1px solid #1e1e1e;}
  .tbl{width:100%;border-collapse:collapse;}
  .tbl th{padding:10px 14px;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:left;background:#111;border-bottom:1px solid #1e1e1e;white-space:nowrap;}
  .tbl td{padding:11px 14px;font-size:13px;color:#e5e5e5;border-bottom:1px solid #181818;vertical-align:middle;}
  .tbl tr:last-child td{border-bottom:none;}
  .tbl tr:hover td{background:#1a1a1a;}
  .tbl-empty{text-align:center;padding:32px 14px !important;color:#4b5563 !important;font-size:13px !important;}
  /* Badges */
  .badge{display:inline-flex;align-items:center;justify-content:center;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid;}
  .badge-red{background:rgba(239,68,68,.12);color:#ef4444;border-color:rgba(239,68,68,.3);}
  .badge-amber{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.25);}
  .badge-orange{background:rgba(249,115,22,.1);color:#f97316;border-color:rgba(249,115,22,.25);}
  .badge-green{background:rgba(34,197,94,.1);color:#22c55e;border-color:rgba(34,197,94,.25);}
  .badge-gray{background:rgba(107,114,128,.1);color:#9ca3af;border-color:rgba(107,114,128,.25);}
  /* Tabs */
  .tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
  .tab{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:6px 14px;font-size:12px;color:#9ca3af;cursor:pointer;transition:all .15s;}
  .tab:hover{color:#e5e5e5;}
  .tab.active{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35);color:#ef4444;font-weight:600;}
  /* Bar chart */
  .bar-chart{display:flex;flex-direction:column;gap:8px;}
  .bar-row{display:flex;align-items:center;gap:10px;}
  .bar-lbl{font-size:11px;color:#9ca3af;width:120px;flex-shrink:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;}
  .bar-wrap{flex:1;background:#1e1e1e;border-radius:5px;height:20px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:5px;transition:width .4s;}
  .bar-val{font-size:11px;color:#9ca3af;width:32px;text-align:right;flex-shrink:0;}
  /* Trend chart */
  .trend-wrap{overflow-x:auto;}
  .trend-svg{display:block;}
  /* Aging heatmap */
  .aging-grid{overflow-x:auto;}
  .aging-tbl{width:100%;border-collapse:collapse;}
  .aging-tbl th{padding:8px 12px;font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;text-align:center;background:#111;border:1px solid #1e1e1e;}
  .aging-tbl td{padding:8px 12px;font-size:12px;text-align:center;border:1px solid #1e1e1e;font-weight:600;}
  .aging-tbl .row-label{text-align:left;color:#9ca3af;font-size:11px;font-weight:400;white-space:nowrap;}
  /* Sort btn */
  .sort-btn{background:none;border:none;color:#6b7280;font-size:10px;cursor:pointer;padding:0 4px;}
  .sort-btn.active{color:#ef4444;}
  /* Loading / empty */
  .loading{text-align:center;padding:60px 20px;color:#6b7280;font-size:14px;}
  .health-pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid;}
`;

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
        fetch(`${API}/api/v1/visits/report?limit=100000`, { headers: { Authorization: `Bearer ${token}` } }),
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
            : dir * ((a as any)[spSort] - (b as any)[spSort]);
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
      className={`sort-btn${spSort === k ? ' active' : ''}`}
      onClick={() => { if (spSort === k) setSpAsc(p => !p); else { setSpSort(k); setSpAsc(false); } }}
    >
      {label} {spSort === k ? (spAsc ? 'ASC' : 'DESC') : '-'}
    </button>
  );

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!roleChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'system-ui' }}>
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui' }}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Access Denied</div>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Only Admins can view Sales Analytics.</div>
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
          <div className="pg-title">Sales Analytics</div>
          <div className="pg-sub">Deep-dive pipeline health — every lead, every salesperson, every risk</div>
        </div>
        <button className="btn-refresh" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading analytics data…</div>
      ) : (
        <>
          {/* ══ SECTION 1: KPI Alert Bar ══ */}
          <div className="kpi-grid">
            <div className="kpi" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
              <div className="kpi-v" style={{ color: '#22c55e' }}>{funnelTotal}</div>
              <div className="kpi-l">Active Pipeline</div>
              <div className="kpi-sub" style={{ color: '#22c55e' }}>Leads in progress</div>
            </div>
            <div className="kpi" style={{ borderColor: 'rgba(239,68,68,.35)' }}>
              <div className="kpi-v" style={{ color: '#ef4444' }}>{data?.at_risk_summary?.overdue ?? 0}</div>
              <div className="kpi-l">Overdue</div>
              <div className="kpi-sub" style={{ color: '#ef4444' }}>Past next action date</div>
            </div>
            <div className="kpi" style={{ borderColor: 'rgba(251,191,36,.3)' }}>
              <div className="kpi-v" style={{ color: '#fbbf24' }}>{data?.at_risk_summary?.no_date ?? 0}</div>
              <div className="kpi-l">No Date Set</div>
              <div className="kpi-sub" style={{ color: '#fbbf24' }}>No follow-up scheduled</div>
            </div>
            <div className="kpi" style={{ borderColor: 'rgba(249,115,22,.3)' }}>
              <div className="kpi-v" style={{ color: '#f97316' }}>{data?.at_risk_summary?.stale_7d ?? 0}</div>
              <div className="kpi-l">Stale 7d+</div>
              <div className="kpi-sub" style={{ color: '#f97316' }}>Not updated in 7+ days</div>
            </div>
          </div>

          {/* ══ SECTION 2: Pipeline Funnel ══ */}
          <div className="panel">
            <div className="panel-title">
              Pipeline Funnel
              <span>{funnelTotal} total active leads</span>
            </div>
            {funnelRows.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No active pipeline data</div>
            ) : (
              funnelRows.map(row => {
                const pct   = funnelTotal > 0 ? Math.round((Number(row.count) / funnelTotal) * 100) : 0;
                const color = STATUS_COLORS[row.status] || '#6b7280';
                return (
                  <div key={row.status} className="funnel-row">
                    <div className="funnel-label">{row.status}</div>
                    <div className="funnel-bar-wrap">
                      <div
                        className="funnel-bar"
                        style={{ width: `${Math.max(pct, 2)}%`, background: color + 'cc' }}
                      >
                        {pct >= 8 ? `${pct}%` : ''}
                      </div>
                    </div>
                    <div className="funnel-count">{row.count}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* ══ SECTION 3: Salesperson Scorecard ══ */}
          <div className="panel">
            <div className="panel-title">Salesperson Scorecard</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th><SortBtn k="total"    label="Total" /></th>
                    <th><SortBtn k="overdue"  label="Overdue" /></th>
                    <th><SortBtn k="no_date"  label="No Date" /></th>
                    <th><SortBtn k="stale_7d" label="Stale 7d+" /></th>
                    <th>Lost (month)</th>
                    <th><SortBtn k="health"   label="Health" /></th>
                  </tr>
                </thead>
                <tbody>
                  {spRows.length === 0 ? (
                    <tr><td className="tbl-empty" colSpan={7}>No data</td></tr>
                  ) : spRows.map(sp => (
                    <tr key={sp.name}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{sp.name}</td>
                      <td>{sp.total}</td>
                      <td>
                        {sp.overdue > 0
                          ? <span className="badge badge-red">{sp.overdue}</span>
                          : <span style={{ color: '#4b5563' }}>0</span>}
                      </td>
                      <td>
                        {sp.no_date > 0
                          ? <span className="badge badge-amber">{sp.no_date}</span>
                          : <span style={{ color: '#4b5563' }}>0</span>}
                      </td>
                      <td>
                        {sp.stale_7d > 0
                          ? <span className="badge badge-orange">{sp.stale_7d}</span>
                          : <span style={{ color: '#4b5563' }}>0</span>}
                      </td>
                      <td style={{ color: sp.lost_month > 0 ? '#ef4444' : '#4b5563' }}>{sp.lost_month}</td>
                      <td>
                        <span
                          className="health-pill"
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
            <div style={{ marginTop: 10, fontSize: 11, color: '#4b5563' }}>
              Health = (Total – Overdue – No Date – Stale) / Total. Higher is better.
            </div>
          </div>

          {/* ══ SECTION 4: At-Risk Lead Safety Net ══ */}
          <div className="panel">
            <div className="panel-title">
              At-Risk Lead Safety Net
              <span>No lead falls through the cracks</span>
            </div>
            <div className="tabs">
              <div
                className={`tab${atRiskTab === 'overdue' ? ' active' : ''}`}
                onClick={() => setAtRiskTab('overdue')}
              >
                Overdue ({overdueVisits.length})
              </div>
              <div
                className={`tab${atRiskTab === 'no_date' ? ' active' : ''}`}
                onClick={() => setAtRiskTab('no_date')}
              >
                No Date Set ({noDateVisits.length})
              </div>
              <div
                className={`tab${atRiskTab === 'stale' ? ' active' : ''}`}
                onClick={() => setAtRiskTab('stale')}
              >
                Stale 7d+ ({staleVisits.length})
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Salesperson</th>
                    <th>Status</th>
                    <th>{atRiskTab === 'overdue' ? 'Days Overdue' : atRiskTab === 'stale' ? 'Days Stale' : 'Next Action'}</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskList.length === 0 ? (
                    <tr>
                      <td className="tbl-empty" colSpan={5}>
                        {atRiskTab === 'overdue' ? 'No overdue leads' : atRiskTab === 'no_date' ? 'All leads have a follow-up date' : 'No stale leads'}
                      </td>
                    </tr>
                  ) : atRiskList.slice(0, 50).map(v => {
                    const days = atRiskTab === 'overdue'
                      ? daysSince(v.next_action_date)
                      : daysSince(v.updated_at);
                    const badgeCls = days >= 14 ? 'badge-red' : days >= 7 ? 'badge-orange' : 'badge-amber';
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{v.cust_name || '—'}</td>
                        <td style={{ color: '#9ca3af' }}>{v.salesperson_name || '—'}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: (STATUS_COLORS[v.status || ''] || '#6b7280') + '22',
                              color: STATUS_COLORS[v.status || ''] || '#6b7280',
                              borderColor: (STATUS_COLORS[v.status || ''] || '#6b7280') + '55',
                            }}
                          >
                            {v.status || 'New Lead'}
                          </span>
                        </td>
                        <td>
                          {atRiskTab === 'no_date'
                            ? <span style={{ color: '#fbbf24', fontSize: 12 }}>{v.next_action || 'Not set'}</span>
                            : <span className={`badge ${badgeCls}`}>{days}d</span>
                          }
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 12 }}>
                          {v.updated_at ? fmtDate(v.updated_at) : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {atRiskList.length > 50 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#4b5563', textAlign: 'right' }}>
                Showing top 50 of {atRiskList.length}
              </div>
            )}
          </div>

          {/* ══ SECTION 5: Stage Aging Heatmap ══ */}
          <div className="panel">
            <div className="panel-title">Stage Aging Heatmap <span>How long leads sit in each stage</span></div>
            <div className="aging-grid">
              <table className="aging-tbl">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Stage</th>
                    {agingBuckets.map(b => <th key={b}>{agingBucketLabel[b]}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingStatuses.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#4b5563', fontSize: 13 }}>No data</td></tr>
                  ) : agingStatuses.map(status => {
                    const rowTotal = agingBuckets.reduce((s, b) => s + agingCell(status, b), 0);
                    return (
                      <tr key={status}>
                        <td className="row-label">{status}</td>
                        {agingBuckets.map(b => {
                          const val = agingCell(status, b);
                          return (
                            <td
                              key={b}
                              style={{
                                background: val > 0 ? agingBucketColor(b) : 'transparent',
                                color: val > 0 ? agingBucketText(b) : '#2a2a2a',
                              }}
                            >
                              {val > 0 ? val : '—'}
                            </td>
                          );
                        })}
                        <td style={{ color: '#9ca3af' }}>{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ SECTIONS 6 & 7: Vehicle + Location ══ */}
          <div className="two-col">
            {/* Vehicle breakdown */}
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-title">Vehicle Interest</div>
              {vehicleRows.length === 0
                ? <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No data</div>
                : (
                  <div className="bar-chart">
                    {vehicleRows.map(r => (
                      <div key={r.vehicle} className="bar-row">
                        <div className="bar-lbl" title={r.vehicle}>{r.vehicle}</div>
                        <div className="bar-wrap">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.round((Number(r.count) / vehicleMax) * 100)}%`, background: '#8b5cf6cc' }}
                          />
                        </div>
                        <div className="bar-val">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Location breakdown */}
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-title">Territory / Location</div>
              {locationRows.length === 0
                ? <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No data</div>
                : (
                  <div className="bar-chart">
                    {locationRows.map(r => (
                      <div key={r.location} className="bar-row">
                        <div className="bar-lbl" title={r.location}>{r.location}</div>
                        <div className="bar-wrap">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.round((Number(r.count) / locationMax) * 100)}%`, background: '#0ea5e9cc' }}
                          />
                        </div>
                        <div className="bar-val">{r.count}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* ══ SECTION 8: 30-day Activity Trend ══ */}
          <div className="panel">
            <div className="panel-title">30-Day Visit Activity Trend <span>New visits per day</span></div>
            {trendRows.length === 0
              ? <div style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No visit data in last 30 days</div>
              : (
                <div className="trend-wrap">
                  <svg
                    className="trend-svg"
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
