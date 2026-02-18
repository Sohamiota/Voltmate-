'use client'

import { useEffect, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

export default function AttendancePage() {
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

  useEffect(() => {
    fetchCurrent();
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  async function fetchCurrent() {
    if (!token) return setLoading(false);
    setLoading(true);
    const res = await fetch(`${API}/api/v1/attendance/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) {
      setCurrent(null);
    } else {
      setCurrent(await res.json());
    }
    setLoading(false);
  }

  async function fetchHistory() {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    setHistory(j.attendance || []);
  }

  async function clockIn() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ location: 'Office', note: 'Clock in via UI' }),
    });
    if (res.ok) {
      await fetchCurrent();
      await fetchHistory();
    } else {
      const txt = await res.text();
      alert('Clock in failed: ' + txt);
    }
    setBusy(false);
  }

  async function clockOut() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: 'Clock out via UI' }),
    });
    if (res.ok) {
      await fetchCurrent();
      await fetchHistory();
    } else {
      const txt = await res.text();
      alert('Clock out failed: ' + txt);
    }
    setBusy(false);
  }

  async function refreshData() {
    setLoading(true);
    await fetchCurrent();
    await fetchHistory();
    setLoading(false);
  }

  return (
    <div className="container">
      <style>{`
        /* Paste condensed CSS from design */
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; background:#0a0a0a; color:#e5e5e5; }
        .container { max-width:1400px; margin:0 auto; padding:30px; }
        .header { padding:0 0 30px 0; margin-bottom:30px; }
        .header h1 { color:#fff; font-size:32px; font-weight:600; margin-bottom:8px; }
        .header p { color:#9ca3af; font-size:15px; }
        .clock-in-section, .attendance-table, .stat-card { background:#1a1a1a; padding:24px; border-radius:12px; border:1px solid #2a2a2a; }
        .button-group { display:flex; gap:12px; flex-wrap:wrap; }
        .btn { padding:10px 20px; border:none; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .btn-primary { background:#00d9ff; color:#0a0a0a; box-shadow:0 0 20px rgba(0,217,255,0.3); }
        .btn-secondary { background:#7c3aed; color:#fff; }
        .btn-outline { background:transparent; color:#9ca3af; border:1px solid #374151; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:20px; margin-bottom:24px; }
        .stat-card .icon { font-size:28px; margin-bottom:12px; width:48px; height:48px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
        .attendance-table { margin-top:20px; }
        table { width:100%; border-collapse:collapse; }
        thead th { padding:12px 16px; text-align:left; color:#9ca3af; font-weight:500; font-size:13px; text-transform:uppercase; }
        tbody td { padding:16px; color:#e5e5e5; font-size:14px; }
        .status-badge { display:inline-block; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:500; text-transform:capitalize; }
        .status-pending { background:rgba(251,191,36,0.15); color:#fbbf24; border:1px solid rgba(251,191,36,0.3); }
        .status-approved { background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
        .status-rejected { background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
        .current-time { color:#9ca3af; margin-bottom:16px; display:inline-block; }
      `}</style>

      <div className="header">
        <h1>Attendance</h1>
        <p>Track and manage your attendance records efficiently</p>
      </div>

      <div className="clock-in-section">
        <h2>Clock In / Out</h2>
        <div className="current-time">{loading ? 'Loading...' : (current ? new Date(current.clock_in_at).toLocaleString() : new Date().toLocaleString())}</div>
        <div className="button-group" style={{ marginTop: 12 }}>
          {current ? (
            <button className="btn btn-secondary" onClick={clockOut} disabled={busy}>Clock Out</button>
          ) : (
            <button className="btn btn-primary" onClick={clockIn} disabled={busy}>Clock In</button>
          )}
          <button className="btn btn-outline" onClick={refreshData}>Refresh</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: 24 }}>
        <div className="stat-card"><div className="icon">⏰</div><div className="value">—</div><div className="label">Total Hours</div></div>
        <div className="stat-card"><div className="icon">📅</div><div className="value">—</div><div className="label">Days Present</div></div>
        <div className="stat-card"><div className="icon">⏳</div><div className="value">—</div><div className="label">Pending Approvals</div></div>
        <div className="stat-card"><div className="icon">✓</div><div className="value">—</div><div className="label">Attendance Rate</div></div>
      </div>

      <div className="attendance-table">
        <div className="table-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2>Recent Attendance</h2>
          <div className="search-box">
            <input id="searchInput" placeholder="Search by date or status..." onChange={() => {}} />
            <button className="btn btn-primary" onClick={() => {}}>Search</button>
          </div>
        </div>
        <table id="attendanceTable">
          <thead>
            <tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Status</th></tr>
          </thead>
          <tbody>
            {history.map(a => (
              <tr key={a.id}>
                <td><strong>{a.date}</strong></td>
                <td>{a.clock_in_at ? new Date(a.clock_in_at).toLocaleString() : ''}</td>
                <td>{a.clock_out_at ? new Date(a.clock_out_at).toLocaleString() : ''}</td>
                <td>{a.duration_seconds ? `${a.duration_seconds} s` : ''}</td>
                <td><span className={`status-badge ${a.status==='approved'?'status-approved':a.status==='rejected'?'status-rejected':'status-pending'}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

