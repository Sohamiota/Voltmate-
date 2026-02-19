'use client'

import { useEffect, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

interface Stats {
  total_hours:     number;
  days_present:    number;
  pending_count:   number;
  attendance_rate: number;
}

export default function AttendancePage() {
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [busy,    setBusy]    = useState(false);
  const [me,      setMe]      = useState<{ name: string; email: string } | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [search,  setSearch]  = useState('');

  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('token') || localStorage.getItem('auth_token'))
    : null;

  useEffect(() => {
    fetchMe();
    fetchAll();
    // eslint-disable-next-line
  }, []);

  async function fetchMe() {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setMe({ name: j.user?.name || j.user?.email || '', email: j.user?.email || '' });
      }
    } catch { /* ignore */ }
  }

  async function fetchAll() {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    await Promise.all([fetchCurrent(), fetchHistory(), fetchStats()]);
    setLoading(false);
  }

  async function fetchCurrent() {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setCurrent(res.status === 204 ? null : await res.json());
  }

  async function fetchHistory() {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    setHistory(j.attendance || []);
  }

  async function fetchStats() {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/attendance/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }

  async function clockIn() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ location: 'Office', note: 'Clock in via UI' }),
    });
    if (res.ok) await fetchAll();
    else alert('Clock in failed: ' + await res.text());
    setBusy(false);
  }

  async function clockOut() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: 'Clock out via UI' }),
    });
    if (res.ok) await fetchAll();
    else alert('Clock out failed: ' + await res.text());
    setBusy(false);
  }

  const filtered = history.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.date || '').includes(q) ||
      (a.status || '').toLowerCase().includes(q) ||
      (a.employee_name || me?.name || '').toLowerCase().includes(q) ||
      (a.employee_email || me?.email || '').toLowerCase().includes(q)
    );
  });

  const statCards = [
    {
      icon: '⏰',
      value: stats ? `${stats.total_hours}h` : '—',
      label: 'Total Hours',
      color: '#00d9ff',
    },
    {
      icon: '📅',
      value: stats ? String(stats.days_present) : '—',
      label: 'Days Present',
      color: '#22c55e',
    },
    {
      icon: '⏳',
      value: stats ? String(stats.pending_count) : '—',
      label: 'Pending Approvals',
      color: '#fbbf24',
    },
    {
      icon: '✓',
      value: stats ? `${stats.attendance_rate}%` : '—',
      label: 'Attendance Rate',
      color: '#7c3aed',
    },
  ];

  return (
    <div className="container">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; background:#0a0a0a; color:#e5e5e5; }
        .container { max-width:1400px; margin:0 auto; padding:30px; }
        .page-header { padding:0 0 28px 0; }
        .page-header h1 { color:#fff; font-size:30px; font-weight:700; margin-bottom:6px; }
        .page-header p  { color:#9ca3af; font-size:14px; }
        .card { background:#1a1a1a; padding:24px; border-radius:12px; border:1px solid #2a2a2a; }
        .btn { padding:10px 22px; border:none; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:opacity .15s; }
        .btn:disabled { opacity:.5; cursor:not-allowed; }
        .btn-primary  { background:#00d9ff; color:#0a0a0a; box-shadow:0 0 20px rgba(0,217,255,.3); }
        .btn-secondary{ background:#7c3aed; color:#fff; }
        .btn-outline  { background:transparent; color:#9ca3af; border:1px solid #374151; }
        .btn-outline:hover { border-color:#555; color:#e5e5e5; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin:24px 0; }
        .stat-card { background:#1a1a1a; padding:20px 24px; border-radius:12px; border:1px solid #2a2a2a; }
        .stat-icon  { font-size:24px; margin-bottom:10px; }
        .stat-value { font-size:28px; font-weight:700; margin-bottom:4px; }
        .stat-label { font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:.5px; }
        .table-card { background:#1a1a1a; border-radius:12px; border:1px solid #2a2a2a; overflow:hidden; margin-top:20px; }
        .table-header { display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid #2a2a2a; flex-wrap:wrap; gap:12px; }
        .table-header h2 { font-size:16px; font-weight:600; color:#fff; }
        .search-row { display:flex; gap:8px; }
        .search-row input { background:#111; border:1px solid #333; border-radius:8px; padding:8px 14px; color:#e5e5e5; font-size:13px; outline:none; width:220px; }
        .search-row input:focus { border-color:#00d9ff; }
        table { width:100%; border-collapse:collapse; }
        thead th { padding:12px 16px; text-align:left; color:#9ca3af; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #2a2a2a; white-space:nowrap; }
        tbody tr { border-bottom:1px solid #1f1f1f; transition:background .12s; }
        tbody tr:hover { background:#1f1f1f; }
        tbody tr:last-child { border-bottom:none; }
        td { padding:14px 16px; font-size:13px; color:#e5e5e5; vertical-align:middle; }
        .emp-name  { font-weight:600; color:#fff; }
        .emp-email { font-size:11px; color:#6b7280; margin-top:2px; }
        .badge { display:inline-block; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:500; text-transform:capitalize; }
        .badge-pending  { background:rgba(251,191,36,.12);  color:#fbbf24; border:1px solid rgba(251,191,36,.25); }
        .badge-approved { background:rgba(34,197,94,.12);   color:#22c55e; border:1px solid rgba(34,197,94,.25); }
        .badge-rejected { background:rgba(239,68,68,.12);   color:#ef4444; border:1px solid rgba(239,68,68,.25); }
        .empty-row td { text-align:center; padding:40px; color:#6b7280; }
        .tbl-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        @media(max-width:480px){ .stats-grid { grid-template-columns:1fr 1fr; } }
        @media(max-width:640px){
          .container { padding:16px; }
          .page-header h1 { font-size:22px; }
          .stat-value { font-size:22px; }
          .search-row input { width:150px; }
        }
      `}</style>

      <div className="page-header">
        <h1>Attendance</h1>
        <p>Track and manage your attendance records for the current month</p>
      </div>

      {/* Clock In / Out card */}
      <div className="card">
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Clock In / Out</h2>
        {me && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#111', borderRadius: 8, border: '1px solid #2a2a2a', display: 'inline-block' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{me.name}</div>
            <div style={{ color: '#9ca3af', fontSize: 12 }}>{me.email}</div>
          </div>
        )}
        <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 14 }}>
          {loading
            ? 'Loading…'
            : current
            ? `Currently clocked in since ${new Date(current.clock_in_at).toLocaleString()}`
            : `Not clocked in · ${new Date().toLocaleString()}`}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {current ? (
            <button className="btn btn-secondary" onClick={clockOut} disabled={busy}>
              {busy ? 'Clocking out…' : 'Clock Out'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={clockIn} disabled={busy}>
              {busy ? 'Clocking in…' : 'Clock In'}
            </button>
          )}
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        {statCards.map(({ icon, value, label, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-value" style={{ color }}>{loading ? '…' : value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Attendance history table */}
      <div className="table-card">
        <div className="table-header">
          <h2>Recent Attendance</h2>
          <div className="search-row">
            <input
              placeholder="Search name, date, status…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr className="empty-row"><td colSpan={6}>No records found.</td></tr>
              ) : filtered.map(a => {
                const dur = a.duration_seconds
                  ? `${Math.floor(a.duration_seconds / 3600)}h ${Math.floor((a.duration_seconds % 3600) / 60)}m`
                  : '—';
                const badge = a.status === 'approved' ? 'badge-approved'
                  : a.status === 'rejected' ? 'badge-rejected'
                  : 'badge-pending';
                return (
                  <tr key={a.id}>
                    <td><strong>{a.date}</strong></td>
                    <td>
                      <div className="emp-name">{a.employee_name || me?.name || '—'}</div>
                      <div className="emp-email">{a.employee_email || me?.email || ''}</div>
                    </td>
                    <td>{a.clock_in_at  ? new Date(a.clock_in_at).toLocaleString()  : '—'}</td>
                    <td>{a.clock_out_at ? new Date(a.clock_out_at).toLocaleString() : '—'}</td>
                    <td>{dur}</td>
                    <td><span className={`badge ${badge}`}>{a.status || 'pending'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
