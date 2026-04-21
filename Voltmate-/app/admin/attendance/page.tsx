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
  .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:24px;}
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
  .btn-danger{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);padding:5px 12px;font-size:12px;}
  .btn-danger:hover{background:rgba(239,68,68,.22);}
  .btn-add{background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.3);}
  .btn-add:hover{background:rgba(99,102,241,.25);}
  .btn-toggle{background:transparent;color:#9ca3af;border:1px solid #333;padding:5px 12px;font-size:12px;}
  .btn-toggle:hover{border-color:#555;color:#e5e5e5;}
  .btn-trail{background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.25);padding:5px 12px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;}
  .btn-trail:hover{background:rgba(99,102,241,.22);}
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
  .badge-active{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25);}
  .badge-inactive{background:rgba(107,114,128,.12);color:#6b7280;border:1px solid rgba(107,114,128,.25);}
  .actions{display:flex;gap:6px;flex-wrap:wrap;}
  .empty{text-align:center;padding:60px 20px;color:#6b7280;font-size:14px;}
  .duration{color:#9ca3af;font-size:12px;}
  .net-form{display:flex;gap:8px;padding:14px 16px;flex-wrap:wrap;align-items:flex-end;border-top:1px solid #2a2a2a;}
  .net-input{background:#111;border:1px solid #333;border-radius:8px;padding:7px 12px;color:#e5e5e5;font-size:13px;outline:none;flex:1;min-width:120px;}
  .net-input:focus{border-color:#6366f1;}
  .net-input-hint{font-size:11px;color:#6b7280;margin-top:3px;}
  .net-field{display:flex;flex-direction:column;gap:3px;flex:1;min-width:120px;}
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

  // Network management state
  const [networks, setNetworks]       = useState<any[]>([]);
  const [netLabel, setNetLabel]       = useState('');
  const [netCidr,  setNetCidr]        = useState('');
  const [netAdding, setNetAdding]     = useState(false);

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('auth_token')
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

  const fetchNetworks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/networks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setNetworks(j.networks || []);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchList(); fetchNetworks(); }, [fetchList, fetchNetworks]);

  async function handleApprove(id: number, approve: boolean) {
    const res = await fetch(`${API}/api/v1/attendance/admin/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    });
    if (res.ok) fetchList();
    else alert('Action failed: ' + await res.text());
  }

  async function handleAddNetwork() {
    if (!netLabel.trim() || !netCidr.trim()) {
      alert('Both label and IP/CIDR are required.');
      return;
    }
    setNetAdding(true);
    const res = await fetch(`${API}/api/v1/networks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: netLabel.trim(), ip_cidr: netCidr.trim() }),
    });
    if (res.ok) {
      setNetLabel('');
      setNetCidr('');
      fetchNetworks();
    } else {
      const j = await res.json().catch(() => ({}));
      alert('Failed to add network: ' + (j.error || 'unknown error'));
    }
    setNetAdding(false);
  }

  async function handleDeleteNetwork(id: number) {
    if (!confirm('Remove this network? Employees connecting from this IP will no longer be able to clock in.')) return;
    const res = await fetch(`${API}/api/v1/networks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchNetworks();
    else alert('Delete failed: ' + await res.text());
  }

  async function handleToggleNetwork(id: number) {
    const res = await fetch(`${API}/api/v1/networks/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchNetworks();
    else alert('Toggle failed: ' + await res.text());
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

      {/* ── Allowed Networks ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Allowed Office Networks</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
              Employees can only clock in when their IP matches an active entry below.
              Leave empty to allow clock-in from any network.
            </div>
          </div>
          <button className="btn btn-refresh" onClick={fetchNetworks}>Refresh</button>
        </div>

        {networks.length === 0 ? (
          <div className="empty" style={{ padding: '24px 20px' }}>
            No networks configured — clock-in is open from any network.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>IP / CIDR</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n: any) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{n.label}</td>
                    <td><code style={{ fontSize: 12, color: '#00d9ff' }}>{n.ip_cidr}</code></td>
                    <td>
                      <span className={`badge badge-${n.is_active ? 'active' : 'inactive'}`}>
                        {n.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>
                      {new Date(n.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-toggle" onClick={() => handleToggleNetwork(n.id)}>
                          {n.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteNetwork(n.id)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add network form */}
        <div className="net-form">
          <div className="net-field">
            <input
              className="net-input"
              placeholder="Label (e.g. Office WiFi)"
              value={netLabel}
              onChange={e => setNetLabel(e.target.value)}
            />
          </div>
          <div className="net-field">
            <input
              className="net-input"
              placeholder="IP or CIDR (e.g. 203.0.113.5/32)"
              value={netCidr}
              onChange={e => setNetCidr(e.target.value)}
            />
            <div className="net-input-hint">Single IP: 1.2.3.4/32 · Range: 192.168.1.0/24</div>
          </div>
          <button className="btn btn-add" onClick={handleAddNetwork} disabled={netAdding}>
            {netAdding ? 'Adding…' : '+ Add Network'}
          </button>
        </div>
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
                        <a
                          className="btn btn-trail"
                          href={`/admin/sales-location?userId=${a.user_id}&date=${(a.date || '').slice(0, 10)}`}
                        >
                          View Trail
                        </a>
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
