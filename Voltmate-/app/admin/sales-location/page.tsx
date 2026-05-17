'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  .tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
  .tab-btn{background:#111;border:1px solid #333;border-radius:8px;padding:8px 16px;color:#9ca3af;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
  .tab-btn:hover{border-color:#555;color:#e5e5e5;}
  .tab-btn.on{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.45);color:#a5b4fc;}
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
  .att-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px 20px;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;}
  .att-field{display:flex;flex-direction:column;gap:4px;min-width:110px;}
  .att-field label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;}
  .att-field span{font-size:14px;font-weight:500;color:#e5e5e5;}
  .att-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:500;text-transform:capitalize;}
  .badge-pending{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.25);}
  .badge-approved{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25);}
  .badge-rejected{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);}
  .trail-card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:20px;}
  .trail-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #2a2a2a;}
  .trail-title{font-size:14px;font-weight:600;color:#fff;}
  .trail-count{font-size:12px;color:#6b7280;}
  .map-shell{height:340px;width:100%;position:relative;background:#111;border-bottom:1px solid #2a2a2a;}
  .leaflet-container{font-family:inherit;background:#111;}
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
  .badge-ctx{background:rgba(129,140,248,.12);color:#a5b4fc;border:1px solid rgba(129,140,248,.25);font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;margin-left:6px;}
  .maps-link{font-size:12px;color:#6366f1;text-decoration:none;margin-left:8px;}
  .maps-link:hover{color:#a5b4fc;}
  .empty{text-align:center;padding:60px 20px;color:#6b7280;font-size:14px;}
  .empty-hint{font-size:12px;color:#4b5563;margin-top:8px;}
  .ping-number{font-size:11px;color:#374151;min-width:24px;padding-top:3px;text-align:right;}
  .trail-list{position:relative;}
  .snap-row{display:flex;gap:14px;padding:12px 18px;border-bottom:1px solid #1f1f1f;font-size:13px;align-items:flex-start;}
  .snap-row:last-child{border-bottom:none;}
  .snap-name{font-weight:600;color:#fff;min-width:140px;}
  .snap-meta{color:#9ca3af;flex:1;}
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

function initialTrailParams(): { userId: string; dateStr: string } {
  if (typeof window === 'undefined') return { userId: '', dateStr: todayStr() };
  const params = new URLSearchParams(window.location.search);
  return {
    userId: params.get('userId') || '',
    dateStr: params.get('date') || todayStr(),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function destroyLeafletMap(map: LeafletMap | null) {
  if (map) map.remove();
}

type SnapshotRow = {
  user_id: number;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  pinged_at: string;
  context?: string | null;
  visit_id?: number | null;
  type?: string | null;
  note?: string | null;
};

export default function SalesLocationPage() {
  const init = initialTrailParams();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState(init.userId);
  const [date, setDate] = useState(init.dateStr);
  const [loading, setLoading] = useState(false);
  const [pings, setPings] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [fetched, setFetched] = useState(false);
  const [acting, setActing] = useState(false);

  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'trail' | 'team'>('trail');
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState('');

  const trailMapElRef = useRef<HTMLDivElement>(null);
  const trailMapRef = useRef<LeafletMap | null>(null);
  const teamMapElRef = useRef<HTMLDivElement>(null);
  const teamMapRef = useRef<LeafletMap | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const canApproveAttendance = viewerRole === 'admin' || viewerRole === 'attendance_admin';

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setViewerRole(j?.user?.role ?? null))
      .catch(() => setViewerRole(null));
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('userId');
    const d = params.get('date');
    if (uid) setSelectedUser(uid);
    if (d) setDate(d);
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

  const loadTeamSnapshot = useCallback(async () => {
    if (!token) return;
    setSnapshotLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/location/today-snapshot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setSnapshots(j.snapshots || []);
        setSnapshotDate(j.date || todayStr());
      } else {
        setSnapshots([]);
      }
    } catch {
      setSnapshots([]);
    }
    setSnapshotLoading(false);
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (viewMode === 'team') loadTeamSnapshot();
  }, [viewMode, loadTeamSnapshot]);

  useEffect(() => {
    if (selectedUser && date && viewMode === 'trail') loadTrail();
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    });
    if (res.ok) await loadTrail();
    else alert('Action failed: ' + await res.text());
    setActing(false);
  }

  useEffect(() => {
    if (viewMode !== 'trail') {
      destroyLeafletMap(trailMapRef.current);
      trailMapRef.current = null;
      return;
    }
    if (!fetched || pings.length === 0) {
      destroyLeafletMap(trailMapRef.current);
      trailMapRef.current = null;
      return;
    }

    let cancelled = false;

    import('leaflet').then(L => {
      if (cancelled || !trailMapElRef.current) return;

      destroyLeafletMap(trailMapRef.current);
      trailMapRef.current = null;

      const latlngs: LatLngExpression[] = pings.map((p: any) => [p.lat, p.lng]);
      const map = L.map(trailMapElRef.current).setView(latlngs[0] as [number, number], 14);
      trailMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#6366f1', weight: 4, opacity: 0.88 }).addTo(map);
      }

      pings.forEach((p: any, i: number) => {
        const last = i === pings.length - 1;
        const first = i === 0;
        L.circleMarker([p.lat, p.lng], {
          radius: last ? 11 : first ? 9 : 6,
          color: '#c7d2fe',
          weight: 2,
          fillColor: last ? '#22c55e' : '#6366f1',
          fillOpacity: 0.92,
        })
          .bindPopup(
            `<strong>${escapeHtml(fmtTime(p.pinged_at))}</strong><br/>${escapeHtml(String(p.type || ''))}` +
              (p.context ? `<br/><span style="opacity:.85">${escapeHtml(String(p.context))}</span>` : '') +
              (p.visit_id != null ? `<br/>Visit #${escapeHtml(String(p.visit_id))}` : ''),
          )
          .addTo(map);
      });

      if (latlngs.length === 1) {
        map.setView(latlngs[0] as [number, number], 14);
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });
      }
    });

    return () => {
      cancelled = true;
      destroyLeafletMap(trailMapRef.current);
      trailMapRef.current = null;
    };
  }, [viewMode, fetched, pings]);

  useEffect(() => {
    if (viewMode !== 'team') {
      destroyLeafletMap(teamMapRef.current);
      teamMapRef.current = null;
      return;
    }
    if (snapshotLoading || snapshots.length === 0) {
      destroyLeafletMap(teamMapRef.current);
      teamMapRef.current = null;
      return;
    }

    let cancelled = false;

    import('leaflet').then(L => {
      if (cancelled || !teamMapElRef.current) return;

      destroyLeafletMap(teamMapRef.current);
      teamMapRef.current = null;

      const latlngs: LatLngExpression[] = snapshots.map(s => [s.lat, s.lng]);
      const map = L.map(teamMapElRef.current).setView(latlngs[0] as [number, number], 8);
      teamMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      snapshots.forEach(s => {
        const nm = escapeHtml(s.user_name || `User ${s.user_id}`);
        L.circleMarker([s.lat, s.lng], {
          radius: 9,
          color: '#fbbf24',
          weight: 2,
          fillColor: '#6366f1',
          fillOpacity: 0.92,
        })
          .bindPopup(
            `<strong>${nm}</strong><br/>${escapeHtml(fmtDateTime(s.pinged_at))}` +
              (s.context ? `<br/>${escapeHtml(String(s.context))}` : '') +
              (s.visit_id != null ? `<br/>Visit #${escapeHtml(String(s.visit_id))}` : ''),
          )
          .addTo(map);
      });

      if (latlngs.length === 1) {
        map.setView(latlngs[0] as [number, number], 12);
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48] });
      }
    });

    return () => {
      cancelled = true;
      destroyLeafletMap(teamMapRef.current);
      teamMapRef.current = null;
    };
  }, [viewMode, snapshots, snapshotLoading]);

  const selectedEmp = employees.find(e => String(e.id) === String(selectedUser));

  const subtitle =
    viewerRole === 'sales_admin'
      ? 'Review location trails and today’s team snapshot (approve/reject attendance stays with attendance admins).'
      : 'Review trails, embedded maps, and attendance — or see each rep’s latest ping for today.';

  return (
    <div className="root">
      <style>{S}</style>

      <div className="header">
        <div className="title">Sales Rep Location</div>
        <div className="subtitle">{subtitle}</div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab-btn ${viewMode === 'trail' ? 'on' : ''}`}
          onClick={() => setViewMode('trail')}
        >
          Day trail (one rep)
        </button>
        <button
          type="button"
          className={`tab-btn ${viewMode === 'team' ? 'on' : ''}`}
          onClick={() => setViewMode('team')}
        >
          Team today (last ping)
        </button>
      </div>

      {viewMode === 'trail' && (
        <div className="controls">
          <div className="field">
            <label>Employee</label>
            <select className="sel" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
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
            <input className="inp" type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
          </div>
          <button className="btn btn-load" onClick={loadTrail} disabled={!selectedUser || !date || loading}>
            {loading ? 'Loading…' : 'Load Trail'}
          </button>
        </div>
      )}

      {viewMode === 'team' && (
        <div className="controls">
          <div className="field">
            <label>Snapshot</label>
            <span style={{ fontSize: 13, color: '#e5e5e5', paddingTop: 6 }}>
              Latest ping today per sales / employee · calendar date {snapshotDate || todayStr()}
            </span>
          </div>
          <button type="button" className="btn btn-load" onClick={loadTeamSnapshot} disabled={snapshotLoading}>
            {snapshotLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      {viewMode === 'trail' && fetched && attendance && (
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
            <span>
              <span className={`badge badge-${attendance.status || 'pending'}`}>{attendance.status || 'pending'}</span>
            </span>
          </div>
          {canApproveAttendance && (
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
          )}
        </div>
      )}

      {viewMode === 'trail' && fetched && !attendance && (
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            color: '#6b7280',
            fontSize: 13,
          }}
        >
          No attendance record found for this employee on {date}.
        </div>
      )}

      {viewMode === 'trail' && fetched && (
        <div className="trail-card">
          <div className="trail-header">
            <div className="trail-title">Location Trail</div>
            <div className="trail-count">
              {pings.length === 0
                ? 'No pings recorded'
                : `${pings.length} ping${pings.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {pings.length > 0 && <div ref={trailMapElRef} className="map-shell" />}

          {pings.length === 0 ? (
            <div className="empty">
              No location data for this employee on {date}.
              <div className="empty-hint">The employee must grant browser location permission on the Attendance page (or save a visit with GPS).</div>
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
                      {p.context ? <span className="badge-ctx">{p.context}</span> : null}
                      {p.visit_id != null ? <span className="badge-ctx">visit #{p.visit_id}</span> : null}
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
                    {p.accuracy_m != null && <div className="ping-acc">Accuracy: ±{Math.round(p.accuracy_m)} m</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'team' && (
        <div className="trail-card">
          <div className="trail-header">
            <div className="trail-title">Team map (today)</div>
            <div className="trail-count">
              {snapshotLoading
                ? 'Loading…'
                : snapshots.length === 0
                  ? 'No pings yet today'
                  : `${snapshots.length} rep${snapshots.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {!snapshotLoading && snapshots.length > 0 && <div ref={teamMapElRef} className="map-shell" />}

          {snapshotLoading ? (
            <div className="empty">Loading snapshot…</div>
          ) : snapshots.length === 0 ? (
            <div className="empty">
              No location pings yet for sales / employee roles today.
              <div className="empty-hint">Reps need to clock in on Attendance or save a visit with GPS.</div>
            </div>
          ) : (
            <div className="trail-list">
              {snapshots.map(s => (
                <div key={s.user_id} className="snap-row">
                  <div className="snap-name">{s.user_name || `User #${s.user_id}`}</div>
                  <div className="snap-meta">
                    {fmtDateTime(s.pinged_at)}
                    {s.user_role ? ` · ${s.user_role}` : ''}
                    {s.context ? ` · ${s.context}` : ''}
                    {s.visit_id != null ? ` · visit #${s.visit_id}` : ''}
                    <div style={{ marginTop: 4 }}>
                      <a className="maps-link" href={`https://maps.google.com/?q=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer">
                        Open in Maps ↗
                      </a>
                      {s.accuracy_m != null && (
                        <span style={{ marginLeft: 10, fontSize: 11, color: '#6b7280' }}>±{Math.round(s.accuracy_m)} m</span>
                      )}
                    </div>
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
