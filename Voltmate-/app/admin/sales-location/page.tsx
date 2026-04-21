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
  .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:24px;}
  .field{display:flex;flex-direction:column;gap:4px;}
  .field label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;}
  .sel{background:#111;border:1px solid #333;border-radius:8px;padding:8px 12px;color:#e5e5e5;font-size:13px;outline:none;cursor:pointer;min-width:220px;}
  .sel:focus{border-color:#6366f1;}
  .inp{background:#111;border:1px solid #333;border-radius:8px;padding:8px 12px;color:#e5e5e5;font-size:13px;outline:none;}
  .inp:focus{border-color:#6366f1;}
  .btn{padding:8px 18px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
  .btn-load{background:#6366f1;color:#fff;}
  .btn-load:hover{background:#4f46e5;}
  .btn-load:disabled{opacity:.5;cursor:not-allowed;}
  .btn-approve{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
  .btn-approve:hover{background:rgba(34,197,94,.25);}
  .btn-reject{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);}
  .btn-reject:hover{background:rgba(239,68,68,.25);}
  /* Attendance summary card */
  .att-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px 20px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;}
  .att-field{display:flex;flex-direction:column;gap:4px;min-width:110px;}
  .att-field label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;}
  .att-field span{font-size:14px;font-weight:500;color:#e5e5e5;}
  .att-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:500;text-transform:capitalize;}
  .badge-pending{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.25);}
  .badge-approved{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25);}
  .badge-rejected{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);}
  /* Trail list */
  .trail-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;}
  .trail-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #2a2a2a;}
  .trail-title{font-size:14px;font-weight:600;color:#fff;}
  .trail-count{font-size:12px;color:#6b7280;}
  .ping-row{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;border-bottom:1px solid #1f1f1f;transition:background .12s;}
  .ping-row:last-child{border-bottom:none;}
  .ping-row:hover{background:#1f1f1f;}
  .ping-time{font-size:13px;font-weight:600;color:#fff;min-width:52px;padding-top:2px;}
  .ping-body{flex:1;}
  .ping-coords{font-size:13px;color:#e5e5e5;margin-bottom:4px;}
  .ping-note{font-size:12px;color:#9ca3af;margin-top:2px;}
  .ping-acc{font-size:11px;color:#6b7280;margin-top:2px;}
  .badge-auto{background:rgba(107,114,128,.12);color:#9ca3af;border:1px solid rgba(107,114,128,.25);font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;}
  .badge-manual{background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(59,130,246,.25);font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;}
  .maps-link{font-size:12px;color:#6366f1;text-decoration:none;margin-left:8px;}
  .maps-link:hover{color:#a5b4fc;}
  .empty{text-align:center;padding:60px 20px;color:#6b7280;font-size:14px;}
  .empty-hint{font-size:12px;color:#4b5563;margin-top:8px;}
  .ping-number{font-size:11px;color:#374151;min-width:24px;padding-top:3px;text-align:right;}
  /* Timeline line */
  .trail-list{position:relative;}
`;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDuration(secs: number | null): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtCoords(lat: number, lng: number): string {
  const la = Math.abs(lat).toFixed(5) + '° ' + (lat >= 0 ? 'N' : 'S');
  const lo = Math.abs(lng).toFixed(5) + '° ' + (lng >= 0 ? 'E' : 'W');
  return `${la},  ${lo}`;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SalesLocationPage() {
  const [employees,    setEmployees]    = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [date,         setDate]         = useState(todayStr());
  const [loading,      setLoading]      = useState(false);
  const [pings,        setPings]        = useState<any[]>([]);
  const [attendance,   setAttendance]   = useState<any>(null);
  const [fetched,      setFetched]      = useState(false);
  const [acting,       setActing]       = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Pre-fill from URL query params (when navigated from admin attendance page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('userId');
    const d   = params.get('date');
    if (uid) setSelectedUser(uid);
    if (d)   setDate(d);
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setEmployees(j.employees || j || []);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Auto-load when pre-filled from URL
  useEffect(() => {
    if (selectedUser && date) loadTrail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTrail() {
    if (!selectedUser || !date) return;
    setLoading(true);
    setFetched(false);
    try {
      const res = await fetch(
        `${API}/api/v1/location/day?userId=${encodeURIComponent(selectedUser)}&date=${encodeURIComponent(date)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const j = await res.json();
        setPings(j.pings || []);
        setAttendance(j.attendance || null);
      } else {
        setPings([]);
        setAttendance(null);
      }
    } catch {
      setPings([]);
      setAttendance(null);
    }
    setLoading(false);
    setFetched(true);
  }

  async function handleApprove(approve: boolean) {
    if (!attendance?.id) return;
    setActing(true);
    const res = await fetch(`${API}/api/v1/attendance/admin/${attendance.id}/approve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ approve }),
    });
    if (res.ok) {
      // Refresh the trail to get updated attendance status
      await loadTrail();
    } else {
      alert('Action failed: ' + await res.text());
    }
    setActing(false);
  }

  const selectedEmp = employees.find(e => String(e.id) === String(selectedUser));

  return (
    <div className="root">
      <style>{S}</style>

      <div className="header">
        <div className="title">Sales Rep Location Trail</div>
        <div className="subtitle">Review a representative&apos;s full day trail before approving attendance</div>
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        <div className="field">
          <label>Employee</label>
          <select
            className="sel"
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
          >
            <option value="">— Select employee —</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name || e.email} {e.role ? `(${e.role})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input
            className="inp"
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-load"
          onClick={loadTrail}
          disabled={!selectedUser || !date || loading}
        >
          {loading ? 'Loading…' : 'Load Trail'}
        </button>
      </div>

      {/* ── Attendance summary ── */}
      {fetched && attendance && (
        <div className="att-card">
          <div className="att-field">
            <label>Employee</label>
            <span>{attendance.employee_name || selectedEmp?.name || `User #${attendance.user_id}`}</span>
          </div>
          <div className="att-field">
            <label>Date</label>
            <span>{date}</span>
          </div>
          <div className="att-field">
            <label>Clock In</label>
            <span>{attendance.clock_in_at ? fmtDateTime(attendance.clock_in_at) : '—'}</span>
          </div>
          <div className="att-field">
            <label>Clock Out</label>
            <span>{attendance.clock_out_at ? fmtDateTime(attendance.clock_out_at) : 'Still clocked in'}</span>
          </div>
          <div className="att-field">
            <label>Duration</label>
            <span>{fmtDuration(attendance.duration_seconds)}</span>
          </div>
          <div className="att-field">
            <label>Status</label>
            <span><span className={`badge badge-${attendance.status || 'pending'}`}>{attendance.status || 'pending'}</span></span>
          </div>
          <div className="att-actions">
            {attendance.status !== 'approved' && (
              <button className="btn btn-approve" onClick={() => handleApprove(true)} disabled={acting}>
                {acting ? '…' : 'Approve'}
              </button>
            )}
            {attendance.status !== 'rejected' && (
              <button className="btn btn-reject" onClick={() => handleApprove(false)} disabled={acting}>
                {acting ? '…' : 'Reject'}
              </button>
            )}
          </div>
        </div>
      )}

      {fetched && !attendance && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 18px', marginBottom: 20, color: '#6b7280', fontSize: 13 }}>
          No attendance record found for this employee on {date}.
        </div>
      )}

      {/* ── Location trail ── */}
      {fetched && (
        <div className="trail-card">
          <div className="trail-header">
            <div className="trail-title">Location Trail</div>
            <div className="trail-count">
              {pings.length === 0
                ? 'No pings recorded'
                : `${pings.length} ping${pings.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {pings.length === 0 ? (
            <div className="empty">
              No location data for this employee on {date}.
              <div className="empty-hint">
                The employee must grant browser location permission on the Attendance page.
              </div>
            </div>
          ) : (
            <div className="trail-list">
              {pings.map((p: any, i: number) => (
                <div key={p.id} className="ping-row">
                  <div className="ping-number">{i + 1}</div>
                  <div className="ping-time">{fmtTime(p.pinged_at)}</div>
                  <div className="ping-body">
                    <div className="ping-coords">
                      <span className={p.type === 'manual' ? 'badge-manual' : 'badge-auto'}>{p.type}</span>
                      &nbsp;&nbsp;
                      {fmtCoords(p.lat, p.lng)}
                      <a
                        className="maps-link"
                        href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Maps ↗
                      </a>
                    </div>
                    {p.note && <div className="ping-note">{p.note}</div>}
                    {p.accuracy_m != null && (
                      <div className="ping-acc">Accuracy: ±{Math.round(p.accuracy_m)} m</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
