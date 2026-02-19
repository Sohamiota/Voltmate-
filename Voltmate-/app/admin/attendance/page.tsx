'use client'

import { useCallback, useEffect, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const S = `
  *{margin:0;padding:0;box-sizing:border-box;}
  .root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  .header{margin-bottom:24px;}
  .title{font-size:clamp(20px,5vw,26px);font-weight:700;color:#fff;margin-bottom:6px;}
  .subtitle{color:#9ca3af;font-size:13px;}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;}
  .stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;}
  .stat-val{font-size:clamp(20px,5vw,28px);font-weight:700;color:#00d9ff;margin-bottom:4px;}
  .stat-lbl{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
  .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;}
  .card-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #2a2a2a;flex-wrap:wrap;gap:10px;}
  .card-title{font-size:14px;font-weight:600;color:#fff;}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .search{background:#111;border:1px solid #333;border-radius:8px;padding:7px 12px;color:#e5e5e5;font-size:13px;outline:none;width:clamp(140px,40vw,220px);}
  .search:focus{border-color:#00d9ff;}
  .filter-select{background:#111;border:1px solid #333;border-radius:8px;padding:7px 10px;color:#e5e5e5;font-size:13px;outline:none;cursor:pointer;}
  .btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-refresh{background:transparent;color:#9ca3af;border:1px solid #333;}
  .btn-refresh:hover{border-color:#555;color:#e5e5e5;}
  .btn-approve{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
  .btn-approve:hover{background:rgba(34,197,94,.25);}
  .btn-reject{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
  .btn-reject:hover{background:rgba(239,68,68,.25);}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  table{width:100%;border-collapse:collapse;min-width:680px;}
  thead tr{border-bottom:1px solid #2a2a2a;}
  thead th{padding:12px 16px;text-align:left;color:#9ca3af;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}
  tbody tr{border-bottom:1px solid #1f1f1f;transition:background .15s;}
  tbody tr:hover{background:#1f1f1f;}
  tbody tr:last-child{border-bottom:none;}
  td{padding:14px 16px;font-size:13px;color:#e5e5e5;vertical-align:middle;}
  .emp-name{font-weight:600;color:#fff;margin-bottom:2px;}
  .emp-email{font-size:11px;color:#6b7280;}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:500;text-transform:capitalize;}
  .badge-pending{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.25);}
  .badge-approved{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25);}
  .badge-rejected{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);}
  .actions{display:flex;gap:6px;flex-wrap:wrap;}
  .empty{text-align:center;padding:60px 20px;color:#6b7280;font-size:14px;}
  .duration{color:#9ca3af;font-size:12px;}
`;

function fmt(iso: string | null) {
  if (!iso) return <span style={{ color: '#4b5563' }}>—</span>;
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDuration(secs: number | null) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminAttendancePage() {
  const [list, setList]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('auth_token') || localStorage.getItem('token'))
    : null;

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/attendance?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setList(j.attendance || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleApprove(id: number, approve: boolean) {
    const res = await fetch(`${API}/api/v1/attendance/admin/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    });
    if (res.ok) fetchList();
    else alert('Action failed: ' + await res.text());
  }

  const filtered = list.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.employee_name || '').toLowerCase().includes(q) ||
      (a.employee_email || '').toLowerCase().includes(q) ||
      (a.date || '').includes(q) ||
      (a.status || '').includes(q)
    );
  });

  const total    = list.length;
  const pending  = list.filter(a => a.status === 'pending').length;
  const approved = list.filter(a => a.status === 'approved').length;
  const rejected = list.filter(a => a.status === 'rejected').length;

  return (
    <div className="root">
      <style>{S}</style>

      <div className="header">
        <div className="title">Admin — Attendance Records</div>
        <div className="subtitle">View, approve and manage attendance for all employees</div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat"><div className="stat-val">{total}</div><div className="stat-lbl">Total Records</div></div>
        <div className="stat"><div className="stat-val" style={{ color: '#fbbf24' }}>{pending}</div><div className="stat-lbl">Pending</div></div>
        <div className="stat"><div className="stat-val" style={{ color: '#22c55e' }}>{approved}</div><div className="stat-lbl">Approved</div></div>
        <div className="stat"><div className="stat-val" style={{ color: '#ef4444' }}>{rejected}</div><div className="stat-lbl">Rejected</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">All Employee Attendance</div>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search name, email, date..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="btn btn-refresh" onClick={fetchList}>Refresh</button>
          </div>
        </div>

        <div className="tbl-wrap">
          {loading ? (
            <div className="empty">Loading attendance records...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">No records found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ color: '#6b7280' }}>{i + 1}</td>
                    <td>
                      <div className="emp-name">{a.employee_name || `User #${a.user_id}`}</div>
                      <div className="emp-email">{a.employee_email || '—'}</div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{fmtDate(a.date)}</td>
                    <td>{fmt(a.clock_in_at)}</td>
                    <td>{fmt(a.clock_out_at)}</td>
                    <td><span className="duration">{fmtDuration(a.duration_seconds)}</span></td>
                    <td>
                      <span className={`badge badge-${a.status || 'pending'}`}>
                        {a.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        {a.status !== 'approved' && (
                          <button className="btn btn-approve" onClick={() => handleApprove(a.id, true)}>
                            Approve
                          </button>
                        )}
                        {a.status !== 'rejected' && (
                          <button className="btn btn-reject" onClick={() => handleApprove(a.id, false)}>
                            Reject
                          </button>
                        )}
                        {a.status === 'approved' && a.status === 'rejected' && (
                          <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
