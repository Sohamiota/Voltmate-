'use client'

import { useCallback, useEffect, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

type AttRec = {
  id: number;
  user_id: number;
  date: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  duration_seconds: number | null;
  status: string | null;
  network_verified: boolean;
  clock_in_ip: string | null;
  employee_name: string | null;
  employee_email: string | null;
  employee_role: string | null;
};

type Employee = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type EnrichedEmp = Employee & {
  recs: AttRec[];
  pending: number;
};

function recStatus(r: AttRec): string {
  return r.status || 'pending';
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDuration(secs: number | null): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  /* Header */
  .pg-hdr{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .pg-title{font-size:clamp(18px,4vw,24px);font-weight:700;color:#fff;}
  .pg-sub{color:#9ca3af;font-size:13px;margin-top:4px;}
  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:20px;}
  .stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;}
  .stat-v{font-size:clamp(20px,4vw,26px);font-weight:700;color:#00d9ff;margin-bottom:2px;}
  .stat-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Section header */
  .section-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
  .section-title{font-size:15px;font-weight:600;color:#fff;}
  .search{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 14px;color:#e5e5e5;font-size:13px;outline:none;min-width:180px;}
  .search:focus{border-color:#6366f1;}
  /* Employee grid */
  .emp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
  .emp-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:18px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;position:relative;}
  .emp-card:hover{border-color:#6366f1;transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.15);}
  .emp-card-pending{border-color:rgba(251,191,36,.35);}
  .emp-card-pending:hover{border-color:rgba(251,191,36,.65) !important;box-shadow:0 8px 24px rgba(251,191,36,.1) !important;}
  .emp-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;}
  .emp-nm{font-size:15px;font-weight:600;color:#fff;margin-bottom:2px;}
  .emp-em{font-size:12px;color:#9ca3af;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .emp-rl{display:inline-block;font-size:11px;color:#a5b4fc;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);border-radius:20px;padding:2px 8px;}
  .emp-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #252525;}
  .emp-badge-pending{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:20px;font-size:11px;font-weight:600;padding:3px 10px;}
  .emp-badge-ok{background:rgba(34,197,94,.08);color:#86efac;border:1px solid rgba(34,197,94,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .emp-badge-none{background:rgba(107,114,128,.08);color:#6b7280;border:1px solid rgba(107,114,128,.18);border-radius:20px;font-size:11px;padding:3px 10px;}
  .emp-arrow{color:#4b5563;font-size:16px;}
  /* Detail view */
  .back-btn{display:inline-flex;align-items:center;gap:6px;color:#9ca3af;font-size:13px;cursor:pointer;background:none;border:none;padding:6px 0;margin-bottom:16px;transition:color .15s;}
  .back-btn:hover{color:#e5e5e5;}
  .detail-hdr{display:flex;align-items:center;gap:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px;flex-wrap:wrap;}
  .detail-av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;flex-shrink:0;}
  .detail-nm{font-size:18px;font-weight:700;color:#fff;}
  .detail-sub{font-size:13px;color:#9ca3af;margin-top:2px;}
  .detail-mini-stats{display:flex;gap:20px;margin-left:auto;flex-wrap:wrap;}
  .dms{text-align:center;}
  .dms-v{font-size:20px;font-weight:700;}
  .dms-l{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  /* Filter tabs */
  .tabs{display:flex;gap:4px;margin-bottom:16px;background:#141414;border:1px solid #232323;border-radius:10px;padding:4px;}
  .tab{flex:1;padding:7px 8px;border:none;background:transparent;color:#9ca3af;font-size:12px;border-radius:7px;cursor:pointer;transition:all .15s;text-align:center;font-weight:500;}
  .tab.active{background:#2a2a3a;color:#e5e5e5;font-weight:600;}
  .tab:hover:not(.active){color:#ccc;}
  /* Record cards */
  .rec-card{background:#141414;border:1px solid #222;border-left:3px solid #333;border-radius:12px;padding:16px;margin-bottom:10px;transition:border-color .15s;}
  .rec-approved{border-left-color:#22c55e;}
  .rec-pending{border-left-color:#fbbf24;}
  .rec-rejected{border-left-color:#ef4444;}
  .rec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
  .rec-date{font-size:14px;font-weight:600;color:#fff;}
  .rec-badges{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;border:1px solid;}
  .badge-pending-s{background:rgba(251,191,36,.1);color:#fbbf24;border-color:rgba(251,191,36,.25);}
  .badge-approved-s{background:rgba(34,197,94,.1);color:#22c55e;border-color:rgba(34,197,94,.25);}
  .badge-rejected-s{background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.25);}
  .badge-net-ok{background:rgba(34,197,94,.08);color:#86efac;border-color:rgba(34,197,94,.2);}
  .badge-net-out{background:rgba(251,191,36,.08);color:#fcd34d;border-color:rgba(251,191,36,.2);}
  .rec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;}
  @media(max-width:480px){.rec-grid{grid-template-columns:1fr 1fr;}}
  .rec-fi label{display:block;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}
  .rec-fi span{font-size:14px;color:#e5e5e5;}
  .rec-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:12px;border-top:1px solid #1e1e1e;}
  .rec-ip{font-size:10px;color:#4b5563;margin-left:auto;}
  /* Buttons */
  .btn{padding:7px 14px;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-approve{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
  .btn-approve:hover{background:rgba(34,197,94,.25);}
  .btn-reject{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
  .btn-reject:hover{background:rgba(239,68,68,.25);}
  .btn-trail{background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);text-decoration:none;display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:500;transition:all .15s;}
  .btn-trail:hover{background:rgba(99,102,241,.2);}
  .btn-trail-primary{background:rgba(99,102,241,.2);color:#c7d2fe;border:1px solid rgba(99,102,241,.45);font-weight:600;}
  .btn-trail-primary:hover{background:rgba(99,102,241,.3);}
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #2a2a2a;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  /* Misc */
  .empty{text-align:center;padding:48px 20px;color:#4b5563;font-size:14px;}
  .loading{text-align:center;padding:48px 20px;color:#6b7280;font-size:14px;}
`;

export default function AdminAttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records,   setRecords]   = useState<AttRec[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [empRes, attRes] = await Promise.all([
        fetch(`${API}/api/v1/auth/employees`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/attendance?limit=100000`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const empData = await empRes.json();
      const attData = await attRes.json();
      setEmployees(empData.employees || []);
      setRecords(attData.attendance   || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id: number, approve: boolean) {
    const res = await fetch(`${API}/api/v1/attendance/admin/${id}/approve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ approve }),
    });
    if (res.ok) loadData();
    else alert('Action failed: ' + await res.text());
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const recByUser: Record<number, AttRec[]> = {};
  records.forEach(r => {
    if (!recByUser[r.user_id]) recByUser[r.user_id] = [];
    recByUser[r.user_id].push(r);
  });

  // Enrich known employees
  const enriched: EnrichedEmp[] = employees.map(e => {
    const recs = (recByUser[e.id] || []).sort(
      (a, b) => new Date(b.clock_in_at || 0).getTime() - new Date(a.clock_in_at || 0).getTime(),
    );
    return { ...e, recs, pending: recs.filter(r => recStatus(r) === 'pending').length };
  });

  // Catch records for users not in the employee list (e.g. deactivated)
  const empIds = new Set(employees.map(e => e.id));
  const extras: EnrichedEmp[] = [];
  Object.entries(recByUser).forEach(([uid, recs]) => {
    const id = parseInt(uid, 10);
    if (!empIds.has(id)) {
      const first = recs[0];
      const sorted = [...recs].sort(
        (a, b) => new Date(b.clock_in_at || 0).getTime() - new Date(a.clock_in_at || 0).getTime(),
      );
      extras.push({
        id,
        name:    first.employee_name  || `User #${id}`,
        email:   first.employee_email || '',
        role:    first.employee_role  || 'employee',
        recs:    sorted,
        pending: sorted.filter(r => recStatus(r) === 'pending').length,
      });
    }
  });

  const allEmployees = [...enriched, ...extras].sort((a, b) => b.pending - a.pending);

  const filteredEmployees = search.trim()
    ? allEmployees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()),
      )
    : allEmployees;

  const selectedEmp  = selectedId !== null ? allEmployees.find(e => e.id === selectedId) ?? null : null;
  const selectedRecs = selectedEmp?.recs || [];
  const displayRecs  = filter === 'all'
    ? selectedRecs
    : selectedRecs.filter(r => recStatus(r) === filter);

  // Global stats
  const pendingTotal  = records.filter(r => recStatus(r) === 'pending').length;
  const approvedTotal = records.filter(r => recStatus(r) === 'approved').length;
  const rejectedTotal = records.filter(r => recStatus(r) === 'rejected').length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="root">
      <style>{S}</style>

      {/* Header */}
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Attendance Management</div>
          <div className="pg-sub">
            {selectedEmp
              ? `Viewing ${selectedEmp.name}'s attendance log`
              : 'Click an employee to view and manage their attendance records'}
          </div>
        </div>
        <button className="btn btn-refresh" onClick={loadData}>Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-v">{records.length}</div>
          <div className="stat-l">Total Records</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#fbbf24' }}>{pendingTotal}</div>
          <div className="stat-l">Pending Review</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#22c55e' }}>{approvedTotal}</div>
          <div className="stat-l">Approved</div>
        </div>
        <div className="stat">
          <div className="stat-v" style={{ color: '#ef4444' }}>{rejectedTotal}</div>
          <div className="stat-l">Rejected</div>
        </div>
      </div>

      {/* ── Main content ── */}
      {loading ? (
        <div className="loading">Loading attendance data…</div>
      ) : selectedId === null ? (

        // ════════════════════════════ EMPLOYEE LIST ════════════════════════════
        <div>
          <div className="section-hdr">
            <div className="section-title">All Employees ({filteredEmployees.length})</div>
            <input
              className="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="empty">No employees found.</div>
          ) : (
            <div className="emp-grid">
              {filteredEmployees.map(emp => (
                <div
                  key={emp.id}
                  className={`emp-card${emp.pending > 0 ? ' emp-card-pending' : ''}`}
                  onClick={() => { setSelectedId(emp.id); setFilter('all'); }}
                >
                  <div className="emp-av">{getInitials(emp.name)}</div>
                  <div className="emp-nm">{emp.name}</div>
                  <div className="emp-em">{emp.email}</div>
                  <span className="emp-rl">{emp.role}</span>
                  <div className="emp-footer">
                    {emp.pending > 0
                      ? <span className="emp-badge-pending">● {emp.pending} pending</span>
                      : emp.recs.length > 0
                        ? <span className="emp-badge-ok">{emp.recs.length} record{emp.recs.length !== 1 ? 's' : ''}</span>
                        : <span className="emp-badge-none">No records yet</span>
                    }
                    <span className="emp-arrow"></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (

        // ═══════════════════════════ EMPLOYEE DETAIL ══════════════════════════
        <div>
          <button className="back-btn" onClick={() => setSelectedId(null)}>
            All Employees
          </button>

          {/* Employee header card */}
          <div className="detail-hdr">
            <div className="detail-av">{getInitials(selectedEmp!.name)}</div>
            <div>
              <div className="detail-nm">{selectedEmp!.name}</div>
              <div className="detail-sub">
                {selectedEmp!.email}
                {' · '}
                <span style={{ color: '#a5b4fc' }}>{selectedEmp!.role}</span>
              </div>
            </div>
            <div className="detail-mini-stats">
              <div className="dms">
                <div className="dms-v">{selectedRecs.length}</div>
                <div className="dms-l">Total</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#fbbf24' }}>
                  {selectedRecs.filter(r => recStatus(r) === 'pending').length}
                </div>
                <div className="dms-l">Pending</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#22c55e' }}>
                  {selectedRecs.filter(r => recStatus(r) === 'approved').length}
                </div>
                <div className="dms-l">Approved</div>
              </div>
              <div className="dms">
                <div className="dms-v" style={{ color: '#ef4444' }}>
                  {selectedRecs.filter(r => recStatus(r) === 'rejected').length}
                </div>
                <div className="dms-l">Rejected</div>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="tabs">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
              const count = f === 'all'
                ? selectedRecs.length
                : selectedRecs.filter(r => recStatus(r) === f).length;
              return (
                <button
                  key={f}
                  className={`tab${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Attendance records */}
          {displayRecs.length === 0 ? (
            <div className="empty">
              No {filter === 'all' ? '' : filter + ' '}records for this employee.
            </div>
          ) : (
            displayRecs.map(r => {
              const s             = recStatus(r);
              const isOffNetwork  = !r.network_verified;
              const needsTrail    = isOffNetwork && s === 'pending';
              return (
                <div key={r.id} className={`rec-card rec-${s}`}>
                  <div className="rec-head">
                    <div className="rec-date">{fmtDate(r.date)}</div>
                    <div className="rec-badges">
                      {r.network_verified ? (
                        <span className="badge badge-net-ok">Office Network</span>
                      ) : (
                        <span className="badge badge-net-out">Outside Network</span>
                      )}
                      <span className={`badge badge-${s}-s`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                        {r.network_verified && s === 'approved' && (
                          <span style={{ marginLeft: 4, fontSize: 10, opacity: .75 }}>· auto</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="rec-grid">
                    <div className="rec-fi">
                      <label>Clock In</label>
                      <span>{fmtTime(r.clock_in_at)}</span>
                    </div>
                    <div className="rec-fi">
                      <label>Clock Out</label>
                      <span>{fmtTime(r.clock_out_at)}</span>
                    </div>
                    <div className="rec-fi">
                      <label>Duration</label>
                      <span>{fmtDuration(r.duration_seconds)}</span>
                    </div>
                  </div>

                  <div className="rec-actions">
                    {s !== 'approved' && (
                      <button className="btn btn-approve" onClick={() => handleApprove(r.id, true)}>
                        Approve
                      </button>
                    )}
                    {s !== 'rejected' && (
                      <button className="btn btn-reject" onClick={() => handleApprove(r.id, false)}>
                        Reject
                      </button>
                    )}
                    <a
                      className={`btn-trail${needsTrail ? ' btn-trail-primary' : ''}`}
                      href={`/admin/sales-location?userId=${r.user_id}&date=${(r.date || '').slice(0, 10)}`}
                    >
                      View Location Trail
                    </a>
                    {r.clock_in_ip && (
                      <span className="rec-ip">IP: {r.clock_in_ip}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
