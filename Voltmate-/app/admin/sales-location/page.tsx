'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPing } from '@/types/api';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

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

const BADGE_BASE = 'inline-block px-2.5 py-[3px] rounded-md text-[11px] font-medium capitalize';

function getAttBadge(status: string | null): string {
  if (status === 'approved') return `${BADGE_BASE} bg-green-500/[0.12] text-green-500 border border-green-500/[0.25]`;
  if (status === 'rejected') return `${BADGE_BASE} bg-red-500/[0.12] text-red-500 border border-red-500/[0.25]`;
  return `${BADGE_BASE} bg-amber-400/[0.12] text-amber-400 border border-amber-400/[0.25]`;
}

const TAB_ON =
  'bg-indigo-500/[0.12] border border-indigo-500/[0.45] text-indigo-300 rounded-lg px-4 py-2 text-[13px] font-medium cursor-pointer transition-all duration-150';
const TAB_OFF =
  'bg-[#111] border border-[#333] text-zinc-400 rounded-lg px-4 py-2 text-[13px] font-medium cursor-pointer transition-all duration-150 hover:border-[#555] hover:text-zinc-200';

const BTN_LOAD =
  'px-[18px] py-2 border-none rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed';

const FIELD_LABEL = 'text-[11px] text-zinc-500 uppercase tracking-[0.5px]';
const ATT_FIELD_LABEL = 'text-[10px] text-zinc-500 uppercase tracking-[0.5px]';
const ATT_FIELD_VALUE = 'text-sm font-medium text-zinc-200';

const BADGE_AUTO =
  'bg-zinc-500/[0.12] text-zinc-400 border border-zinc-500/[0.25] text-[10px] px-[7px] py-0.5 rounded font-medium';
const BADGE_MANUAL =
  'bg-blue-500/[0.12] text-blue-400 border border-blue-500/[0.25] text-[10px] px-[7px] py-0.5 rounded font-medium';
const BADGE_CTX =
  'bg-indigo-400/[0.12] text-indigo-300 border border-indigo-400/[0.25] text-[10px] px-[7px] py-0.5 rounded font-medium ml-1.5';
const MAPS_LINK = 'text-xs text-indigo-500 no-underline ml-2 hover:text-indigo-300';

export default function SalesLocationPage() {
  const init = initialTrailParams();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState(init.userId);
  const [date, setDate] = useState(init.dateStr);
  const [loading, setLoading] = useState(false);
  const [pings, setPings] = useState<LocationPing[]>([]);
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

      const validPings = pings.filter(p => isFinite(p.lat) && isFinite(p.lng));
      if (validPings.length === 0) return;

      const latlngs: LatLngExpression[] = validPings.map(p => [p.lat, p.lng]);
      const map = L.map(trailMapElRef.current).setView(latlngs[0] as [number, number], 14);
      trailMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#6366f1', weight: 4, opacity: 0.88 }).addTo(map);
      }

      validPings.forEach((p, i) => {
        const last = i === validPings.length - 1;
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

      const validSnapshots = snapshots.filter(s => isFinite(s.lat) && isFinite(s.lng));
      if (validSnapshots.length === 0) return;

      const latlngs: LatLngExpression[] = validSnapshots.map(s => [s.lat, s.lng]);
      const map = L.map(teamMapElRef.current).setView(latlngs[0] as [number, number], 8);
      teamMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      validSnapshots.forEach(s => {
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
      ? 'Review location trails and today\u2019s team snapshot (approve/reject attendance stays with attendance admins).'
      : 'Review trails, embedded maps, and attendance \u2014 or see each rep\u2019s latest ping for today.';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-[clamp(14px,4vw,28px)]">

      <div className="mb-6">
        <div className="text-[clamp(20px,5vw,26px)] font-bold text-white mb-1.5">Sales Rep Location</div>
        <div className="text-zinc-400 text-[13px]">{subtitle}</div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          type="button"
          className={viewMode === 'trail' ? TAB_ON : TAB_OFF}
          onClick={() => setViewMode('trail')}
        >
          Day trail (one rep)
        </button>
        <button
          type="button"
          className={viewMode === 'team' ? TAB_ON : TAB_OFF}
          onClick={() => setViewMode('team')}
        >
          Team today (last ping)
        </button>
      </div>

      {viewMode === 'trail' && (
        <div className="flex gap-2.5 flex-wrap items-end mb-6">
          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL}>Employee</label>
            <select
              className="bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-zinc-200 text-[13px] outline-none cursor-pointer min-w-[220px] focus:border-indigo-500"
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
          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL}>Date</label>
            <input
              className="bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-zinc-200 text-[13px] outline-none focus:border-indigo-500"
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <button className={BTN_LOAD} onClick={loadTrail} disabled={!selectedUser || !date || loading}>
            {loading ? 'Loading…' : 'Load Trail'}
          </button>
        </div>
      )}

      {viewMode === 'team' && (
        <div className="flex gap-2.5 flex-wrap items-end mb-6">
          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL}>Snapshot</label>
            <span className="text-[13px] text-zinc-200 pt-1.5">
              Latest ping today per sales / employee · calendar date {snapshotDate || todayStr()}
            </span>
          </div>
          <button type="button" className={BTN_LOAD} onClick={loadTeamSnapshot} disabled={snapshotLoading}>
            {snapshotLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}

      {viewMode === 'trail' && fetched && attendance && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-[18px] mb-5 flex gap-5 flex-wrap items-center">
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Employee</label>
            <span className={ATT_FIELD_VALUE}>{attendance.employee_name || selectedEmp?.name || `User #${attendance.user_id}`}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Date</label>
            <span className={ATT_FIELD_VALUE}>{date}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Clock In</label>
            <span className={ATT_FIELD_VALUE}>{attendance.clock_in_at ? fmtDateTime(attendance.clock_in_at) : '—'}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Clock Out</label>
            <span className={ATT_FIELD_VALUE}>{attendance.clock_out_at ? fmtDateTime(attendance.clock_out_at) : 'Still clocked in'}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Duration</label>
            <span className={ATT_FIELD_VALUE}>{fmtDuration(attendance.duration_seconds)}</span>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className={ATT_FIELD_LABEL}>Status</label>
            <span>
              <span className={getAttBadge(attendance.status || 'pending')}>{attendance.status || 'pending'}</span>
            </span>
          </div>
          {canApproveAttendance && (
            <div className="ml-auto flex gap-2 flex-wrap">
              {attendance.status !== 'approved' && (
                <button
                  className="px-[18px] py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 bg-green-500/[0.15] text-green-500 border border-green-500/[0.3] hover:bg-green-500/[0.25]"
                  onClick={() => handleApprove(true)}
                  disabled={acting}
                >
                  {acting ? '…' : 'Approve'}
                </button>
              )}
              {attendance.status !== 'rejected' && (
                <button
                  className="px-[18px] py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150 bg-red-500/[0.15] text-red-500 border border-red-500/[0.3] hover:bg-red-500/[0.25]"
                  onClick={() => handleApprove(false)}
                  disabled={acting}
                >
                  {acting ? '…' : 'Reject'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'trail' && fetched && !attendance && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-[18px] py-3.5 mb-5 text-zinc-500 text-[13px]">
          No attendance record found for this employee on {date}.
        </div>
      )}

      {viewMode === 'trail' && fetched && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-5">
          <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-zinc-800">
            <div className="text-sm font-semibold text-white">Location Trail</div>
            <div className="text-xs text-zinc-500">
              {pings.length === 0
                ? 'No pings recorded'
                : `${pings.length} ping${pings.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {pings.length > 0 && (
            <div ref={trailMapElRef} className="h-[340px] w-full relative bg-[#111] border-b border-zinc-800" />
          )}

          {pings.length === 0 ? (
            <div className="text-center py-[60px] px-5 text-zinc-500 text-sm">
              No location data for this employee on {date}.
              <div className="text-xs text-[#4b5563] mt-2">
                The employee must grant browser location permission on the Attendance page (or save a visit with GPS).
              </div>
            </div>
          ) : (
            <div className="relative">
              {pings.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3.5 px-[18px] py-3.5 border-b border-[#1f1f1f] transition-colors duration-[120ms] last:border-b-0 hover:bg-[#1f1f1f]"
                >
                  <div className="text-[11px] text-[#374151] min-w-[24px] pt-[3px] text-right">{i + 1}</div>
                  <div className="text-[13px] font-semibold text-white min-w-[52px] pt-0.5">{fmtTime(p.pinged_at)}</div>
                  <div className="flex-1">
                    <div className="text-[13px] text-zinc-200 mb-1">
                      <span className={p.type === 'manual' ? BADGE_MANUAL : BADGE_AUTO}>{p.type}</span>
                      {p.context ? <span className={BADGE_CTX}>{p.context}</span> : null}
                      {p.visit_id != null ? <span className={BADGE_CTX}>visit #{p.visit_id}</span> : null}
                      &nbsp;&nbsp;
                      {fmtCoords(p.lat, p.lng)}
                      <a
                        className={MAPS_LINK}
                        href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Maps ↗
                      </a>
                    </div>
                    {p.note && <div className="text-xs text-zinc-400 mt-0.5">{p.note}</div>}
                    {p.accuracy_m != null && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">Accuracy: ±{Math.round(p.accuracy_m)} m</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'team' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-5">
          <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-zinc-800">
            <div className="text-sm font-semibold text-white">Team map (today)</div>
            <div className="text-xs text-zinc-500">
              {snapshotLoading
                ? 'Loading…'
                : snapshots.length === 0
                  ? 'No pings yet today'
                  : `${snapshots.length} rep${snapshots.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {!snapshotLoading && snapshots.length > 0 && (
            <div ref={teamMapElRef} className="h-[340px] w-full relative bg-[#111] border-b border-zinc-800" />
          )}

          {snapshotLoading ? (
            <div className="text-center py-[60px] px-5 text-zinc-500 text-sm">Loading snapshot…</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-[60px] px-5 text-zinc-500 text-sm">
              No location pings yet for sales / employee roles today.
              <div className="text-xs text-[#4b5563] mt-2">
                Reps need to clock in on Attendance or save a visit with GPS.
              </div>
            </div>
          ) : (
            <div className="relative">
              {snapshots.map(s => (
                <div
                  key={s.user_id}
                  className="flex gap-3.5 px-[18px] py-3 border-b border-[#1f1f1f] text-[13px] items-start last:border-b-0"
                >
                  <div className="font-semibold text-white min-w-[140px]">{s.user_name || `User #${s.user_id}`}</div>
                  <div className="text-zinc-400 flex-1">
                    {fmtDateTime(s.pinged_at)}
                    {s.user_role ? ` · ${s.user_role}` : ''}
                    {s.context ? ` · ${s.context}` : ''}
                    {s.visit_id != null ? ` · visit #${s.visit_id}` : ''}
                    <div className="mt-1">
                      <a
                        className={MAPS_LINK}
                        href={`https://maps.google.com/?q=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Maps ↗
                      </a>
                      {s.accuracy_m != null && (
                        <span className="ml-2.5 text-[11px] text-zinc-500">±{Math.round(s.accuracy_m)} m</span>
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
