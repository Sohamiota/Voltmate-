'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

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
  targets: Visit[];
  updated: Visit[];   // updated_at date == today
  pending: Visit[];
}

// A target is "updated today" if its updated_at date equals today
function isUpdatedToday(v: Visit, today: string): boolean {
  return !!v.updated_at && v.updated_at.slice(0, 10) === today;
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

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  /* Header */
  .pg-hdr{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .pg-title{font-size:clamp(18px,4vw,24px);font-weight:700;color:#fff;}
  .pg-date{font-size:13px;color:#00d9ff;font-weight:600;margin-top:3px;}
  .pg-sub{color:#9ca3af;font-size:13px;margin-top:3px;}
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
  .emp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
  .emp-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:18px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;}
  .emp-card:hover{border-color:#00d9ff;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,217,255,.12);}
  .emp-card-pending{border-color:rgba(251,191,36,.4);}
  .emp-card-pending:hover{border-color:rgba(251,191,36,.7) !important;box-shadow:0 8px 24px rgba(251,191,36,.1) !important;}
  .emp-card-done{border-color:rgba(34,197,94,.4);}
  .emp-card-done:hover{border-color:rgba(34,197,94,.7) !important;box-shadow:0 8px 24px rgba(34,197,94,.1) !important;}
  .emp-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#0e7490);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;}
  .emp-nm{font-size:15px;font-weight:600;color:#fff;margin-bottom:8px;}
  .prog-bg{height:5px;background:#2a2a2a;border-radius:3px;margin-bottom:4px;}
  .prog-fill{height:5px;border-radius:3px;transition:width .3s;}
  .prog-label{font-size:11px;color:#6b7280;text-align:right;}
  .emp-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #252525;}
  .badge-pending-card{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:20px;font-size:11px;font-weight:600;padding:3px 10px;}
  .badge-ok-card{background:rgba(34,197,94,.08);color:#86efac;border:1px solid rgba(34,197,94,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .badge-none-card{background:rgba(107,114,128,.08);color:#6b7280;border:1px solid rgba(107,114,128,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .emp-arrow{color:#4b5563;font-size:16px;}
  /* Detail header */
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
  .tabs{display:flex;gap:4px;margin-bottom:16px;background:#141414;border:1px solid #232323;border-radius:10px;padding:4px;}
  .tab{flex:1;padding:7px 8px;border:none;background:transparent;color:#9ca3af;font-size:12px;border-radius:7px;cursor:pointer;transition:all .15s;text-align:center;font-weight:500;}
  .tab.active{background:#0e3a42;color:#00d9ff;font-weight:600;}
  .tab:hover:not(.active){color:#ccc;}
  /* Visit cards */
  .visit-card{background:#141414;border:1px solid #222;border-left:3px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:10px;}
  .visit-card-updated{border-left-color:#22c55e;}
  .visit-card-pending{border-left-color:#fbbf24;}
  .visit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
  .visit-cust{font-size:15px;font-weight:700;color:#fff;}
  .visit-meta{font-size:11px;color:#6b7280;margin-top:2px;}
  .badges{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;border:1px solid;}
  .badge-updated{background:rgba(34,197,94,.1);color:#22c55e;border-color:rgba(34,197,94,.25);}
  .badge-pending-v{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.25);}
  .visit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:8px;}
  .visit-fi label{display:block;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}
  .visit-fi span{font-size:13px;color:#e5e5e5;word-break:break-word;}
  .visit-note{font-size:12px;color:#9ca3af;margin-top:10px;padding-top:10px;border-top:1px solid #1e1e1e;font-style:italic;}
  /* Banners */
  .pm6-banner{background:rgba(0,217,255,.07);border:1px solid rgba(0,217,255,.25);border-radius:10px;padding:11px 16px;margin-bottom:16px;font-size:13px;color:#00d9ff;display:flex;align-items:center;gap:8px;}
  /* Buttons */
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #2a2a2a;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  /* Empty / loading */
  .loading{text-align:center;padding:48px 20px;color:#6b7280;font-size:14px;}
  .empty{text-align:center;padding:48px 20px;color:#4b5563;font-size:14px;}
  .no-targets{text-align:center;padding:60px 20px;color:#4b5563;}
  .no-targets-icon{font-size:42px;margin-bottom:14px;}
  .no-targets-msg{font-size:15px;font-weight:600;color:#6b7280;margin-bottom:6px;}
  .no-targets-sub{font-size:13px;color:#4b5563;}
  @media(max-width:480px){.detail-stats{gap:12px;}.dms-v{font-size:16px;}}
`;

export default function DailyTargetPage() {
  const router = useRouter();
  const [roleChecked,  setRoleChecked]  = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [visits,       setVisits]       = useState<Visit[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [tabFilter,    setTabFilter]    = useState<'all' | 'updated' | 'pending'>('all');
  const [search,       setSearch]       = useState('');
  const [now,          setNow]          = useState(() => new Date());

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const today   = localToday();
  const past6PM = now.getHours() >= 18;

  // ── Role guard: admin only ────────────────────────────────────────────────
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

  // Refresh clock every minute so past-6 PM banner appears automatically
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
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

  // ── Derived: only visits whose next_action_date is today ──────────────────
  const todayTargets = visits.filter(v => v.next_action_date?.slice(0, 10) === today);

  const spMap: Record<string, Visit[]> = {};
  todayTargets.forEach(v => {
    const name = v.salesperson_name?.trim() || 'Unassigned';
    if (!spMap[name]) spMap[name] = [];
    spMap[name].push(v);
  });

  const rows: SalespersonRow[] = Object.entries(spMap)
    .map(([name, targets]) => ({
      name,
      targets,
      updated: targets.filter(v => isUpdatedToday(v, today)),
      pending: targets.filter(v => !isUpdatedToday(v, today)),
    }))
    .sort((a, b) => b.pending.length - a.pending.length);

  const visibleRows = search.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const totalTargets  = todayTargets.length;
  const totalUpdated  = todayTargets.filter(v => isUpdatedToday(v, today)).length;
  const totalPending  = totalTargets - totalUpdated;

  const selected = selectedName ? rows.find(r => r.name === selectedName) ?? null : null;
  const displayVisits =
    tabFilter === 'updated' ? selected?.updated ?? []
    : tabFilter === 'pending' ? selected?.pending ?? []
    : selected?.targets ?? [];

  // ── Access guard renders ──────────────────────────────────────────────────
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
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Only Admins can view the Daily Target panel.</div>
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
          <div className="pg-title">Daily Target</div>
          <div className="pg-date">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div className="pg-sub">
            {selected
              ? `Viewing ${selected.name}'s targets for today`
              : "Today's visit targets — sourced from next action dates in the visit report"}
          </div>
        </div>
        <button className="btn-refresh" onClick={load}>↺ Refresh</button>
      </div>

      {/* ── Stats ── */}
      <div className="stats">
        <div className="stat">
          <div className="stat-v">{rows.length}</div>
          <div className="stat-l">Salespersons</div>
        </div>
        <div className="stat">
          <div className="stat-v">{totalTargets}</div>
          <div className="stat-l">Total Targets</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#22c55e' }}>{totalUpdated}</div>
          <div className="stat-l">Updated Today</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#fbbf24' }}>{totalPending}</div>
          <div className="stat-l">Pending</div>
        </div>
      </div>

      {/* ── After-6 PM banner ── */}
      {past6PM && (
        <div className="pm6-banner">
          ⏰ It&apos;s past 6 PM — visit reports should now be updated. &quot;Updated Today&quot; reflects entries whose visit report was modified today.
        </div>
      )}

      {loading ? (
        <div className="loading">Loading today&apos;s targets…</div>
      ) : selectedName === null ? (

        /* ════════════════ SALESPERSON GRID ════════════════ */
        <div>
          <div className="section-hdr">
            <div className="section-title">
              {visibleRows.length > 0
                ? `Salespersons with targets today (${visibleRows.length})`
                : 'No targets scheduled for today'}
            </div>
            {rows.length > 0 && (
              <input
                className="search"
                placeholder="Search salesperson…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            )}
          </div>

          {visibleRows.length === 0 ? (
            <div className="no-targets">
              <div className="no-targets-icon">🎯</div>
              <div className="no-targets-msg">No targets for today</div>
              <div className="no-targets-sub">
                Visits with a next action date of {fmtDate(today)} will appear here.
              </div>
            </div>
          ) : (
            <div className="emp-grid">
              {visibleRows.map(sp => {
                const pct     = sp.targets.length > 0 ? Math.round((sp.updated.length / sp.targets.length) * 100) : 0;
                const allDone = sp.pending.length === 0 && sp.targets.length > 0;

                return (
                  <div
                    key={sp.name}
                    className={`emp-card${allDone ? ' emp-card-done' : sp.pending.length > 0 ? ' emp-card-pending' : ''}`}
                    onClick={() => { setSelectedName(sp.name); setTabFilter('all'); }}
                  >
                    <div className="emp-av">{getInitials(sp.name)}</div>
                    <div className="emp-nm">{sp.name}</div>

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
                    <div className="prog-label">{sp.updated.length}/{sp.targets.length} updated</div>

                    <div className="emp-footer">
                      {allDone
                        ? <span className="badge-ok-card">✓ All {sp.targets.length} updated</span>
                        : sp.pending.length > 0
                          ? <span className="badge-pending-card">● {sp.pending.length} pending</span>
                          : <span className="badge-none-card">{sp.targets.length} target{sp.targets.length !== 1 ? 's' : ''}</span>
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

          {/* Salesperson header card */}
          <div className="detail-hdr">
            <div className="detail-av">{getInitials(selected!.name)}</div>
            <div>
              <div className="detail-nm">{selected!.name}</div>
              <div className="detail-sub">Today&apos;s visit targets</div>
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
            </div>
          </div>

          {/* Filter tabs */}
          <div className="tabs">
            {(['all', 'updated', 'pending'] as const).map(f => {
              const count = f === 'all'     ? selected!.targets.length
                          : f === 'updated' ? selected!.updated.length
                          : selected!.pending.length;
              return (
                <button
                  key={f}
                  className={`tab${tabFilter === f ? ' active' : ''}`}
                  onClick={() => setTabFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'updated' ? 'Updated' : 'Pending'} ({count})
                </button>
              );
            })}
          </div>

          {/* Visit target cards */}
          {displayVisits.length === 0 ? (
            <div className="empty">
              No {tabFilter === 'all' ? '' : tabFilter + ' '}targets for {selected!.name} today.
            </div>
          ) : (
            displayVisits.map(v => {
              const done = isUpdatedToday(v, today);
              const sColor = statusColor(v.status);
              return (
                <div key={v.id} className={`visit-card ${done ? 'visit-card-updated' : 'visit-card-pending'}`}>
                  <div className="visit-head">
                    <div>
                      <div className="visit-cust">{v.cust_name || '—'}</div>
                      <div className="visit-meta">
                        {[v.lead_cust_code, v.lead_location].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="badges">
                      {done
                        ? <span className="badge badge-updated">✓ Updated today</span>
                        : <span className="badge badge-pending-v">⏳ Pending update</span>
                      }
                      {v.status && (
                        <span className="badge" style={{
                          background: sColor + '22',
                          color: sColor,
                          borderColor: sColor + '55',
                        }}>
                          {v.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="visit-grid">
                    <div className="visit-fi">
                      <label>Next Action</label>
                      <span>{v.next_action || '—'}</span>
                    </div>
                    <div className="visit-fi">
                      <label>Action Date</label>
                      <span>{fmtDate(v.next_action_date)}</span>
                    </div>
                    <div className="visit-fi">
                      <label>Vehicle</label>
                      <span>{v.vehicle || '—'}</span>
                    </div>
                    <div className="visit-fi">
                      <label>Visit Date</label>
                      <span>{fmtDate(v.visit_date)}</span>
                    </div>
                    {v.phone_no && (
                      <div className="visit-fi">
                        <label>Phone</label>
                        <span>{v.phone_no}</span>
                      </div>
                    )}
                    {done && v.updated_at && (
                      <div className="visit-fi">
                        <label>Updated at</label>
                        <span style={{ color: '#22c55e' }}>
                          {new Date(v.updated_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit', hour12: true,
                          })}
                          {v.updated_by_name ? ` by ${v.updated_by_name}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {v.note && (
                    <div className="visit-note">📝 {v.note}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
