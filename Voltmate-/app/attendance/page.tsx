'use client'

import { useCallback, useEffect, useRef, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  approved: { label: 'Present',  color: '#22c55e', bg: 'rgba(34,197,94,.15)',   border: 'rgba(34,197,94,.35)'   },
  pending:  { label: 'Pending',  color: '#fbbf24', bg: 'rgba(251,191,36,.15)',  border: 'rgba(251,191,36,.35)'  },
  rejected: { label: 'Absent',   color: '#ef4444', bg: 'rgba(239,68,68,.15)',   border: 'rgba(239,68,68,.35)'   },
  absent:   { label: 'Absent',   color: '#ef4444', bg: 'rgba(239,68,68,.15)',   border: 'rgba(239,68,68,.35)'   },
  leave:    { label: 'On Leave', color: '#3b82f6', bg: 'rgba(59,130,246,.15)',  border: 'rgba(59,130,246,.35)'  },
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || '?').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(dateStr: string): string {
  // Accept full ISO strings or plain YYYY-MM-DD; always parse as local date
  const plain = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDuration(secs: number | null | undefined): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function elapsedSince(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  .att-root{max-width:900px;margin:0 auto;padding:28px 20px;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;}
  /* Header */
  .att-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap;}
  .att-user{display:flex;align-items:center;gap:12px;}
  .att-avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0;user-select:none;}
  .att-user-name{font-size:17px;font-weight:700;color:#fff;line-height:1.3;}
  .att-user-sub{font-size:12px;color:#9ca3af;margin-top:2px;}
  .att-nav{display:flex;align-items:center;gap:10px;}
  .att-nav-btn{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;font-size:16px;transition:all .15s;line-height:1;}
  .att-nav-btn:hover{border-color:#555;color:#fff;}
  .att-month-label{font-size:15px;font-weight:700;color:#fff;min-width:130px;text-align:center;}
  /* Clock row */
  .att-clock-row{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;}
  .att-timer{font-size:13px;color:#9ca3af;}
  .att-timer strong{color:#00d9ff;font-variant-numeric:tabular-nums;font-size:15px;font-weight:700;}
  .att-btn{padding:8px 20px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s;}
  .att-btn:disabled{opacity:.45;cursor:not-allowed;}
  .att-btn-in{background:#22c55e;color:#fff;}
  .att-btn-out{background:#ef4444;color:#fff;}
  .att-btn-ref{background:transparent;border:1px solid #2a2a2a;color:#9ca3af;}
  .att-btn-ref:hover{border-color:#555;color:#e5e5e5;}
  /* Stats */
  .att-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;}
  .att-stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px 20px;}
  .att-stat-val{font-size:30px;font-weight:700;margin-bottom:4px;line-height:1;}
  .att-stat-lbl{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;font-weight:500;}
  /* Calendar card */
  .att-cal{background:#111;border:1px solid #2a2a2a;border-radius:14px;overflow:hidden;margin-bottom:12px;}
  .att-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);}
  .att-cal-head{background:#161616;border-bottom:1px solid #222;}
  .att-cal-head-cell{padding:10px 4px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.5px;}
  /* Day cells */
  .att-day{min-height:76px;border-right:1px solid #1e1e1e;border-bottom:1px solid #1e1e1e;padding:7px 6px 5px;cursor:pointer;transition:background .12s;position:relative;}
  .att-day:nth-child(7n){border-right:none;}
  .att-day:hover{background:#1a1a1a;}
  .att-day.att-empty{cursor:default;background:transparent !important;}
  .att-day.att-weekend .att-day-num{color:#3d4555;}
  .att-day-num-wrap{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-bottom:5px;}
  .att-day-num{font-size:13px;color:#9ca3af;}
  .att-day.att-today .att-day-num-wrap{background:#3b82f6;border-radius:50%;}
  .att-day.att-today .att-day-num{color:#fff;font-weight:700;}
  .att-day-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;border:1px solid;margin-bottom:3px;white-space:nowrap;}
  .att-day-time{font-size:10px;color:#6b7280;}
  .att-day.att-selected{background:#1a1c2e !important;}
  /* Legend */
  .att-legend{display:flex;flex-wrap:wrap;gap:14px;padding:12px 16px;border-top:1px solid #1e1e1e;}
  .att-legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#9ca3af;}
  .att-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  /* Detail panel */
  .att-detail{background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:18px 20px;min-height:64px;display:flex;align-items:center;}
  .att-detail-empty{color:#4b5563;font-size:13px;}
  .att-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;width:100%;}
  .att-detail-item label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;}
  .att-detail-item span{font-size:14px;color:#e5e5e5;font-weight:500;}
  /* Network badge */
  .att-net-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid;margin-bottom:10px;}
  .att-net-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  /* Location / GPS */
  .att-gps-bar{display:flex;align-items:center;gap:10px;background:#0f1a0f;border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;flex-wrap:wrap;}
  .att-gps-bar-warn{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.25);}
  .att-gps-bar-info{background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.25);}
  .att-gps-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .att-gps-text{font-size:12px;font-weight:500;flex:1;}
  .att-btn-checkin{background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.4);color:#a5b4fc;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;}
  .att-btn-checkin:hover{background:rgba(99,102,241,.28);}
  .att-btn-checkin:disabled{opacity:.45;cursor:not-allowed;}
  .att-ping-count{font-size:11px;color:#6b7280;margin-left:auto;}
  /* Mobile */
  @media(max-width:540px){
    .att-stat{padding:12px 10px;}
    .att-stat-val{font-size:22px;}
    .att-day{min-height:54px;padding:5px 3px;}
    .att-day-time{display:none;}
    .att-month-label{min-width:100px;font-size:13px;}
    .att-day-badge{font-size:9px;padding:1px 5px;}
  }
  @media(max-width:360px){
    .att-cal-head-cell{font-size:9px;padding:8px 2px;}
    .att-day-num{font-size:11px;}
    .att-stats{gap:6px;}
  }
`;

export default function AttendancePage() {
  const [current,     setCurrent]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [history,     setHistory]     = useState<any[]>([]);
  const [busy,        setBusy]        = useState(false);
  const [me,          setMe]          = useState<{ sub?: number; name: string; email: string; role?: string; is_on_probation?: boolean } | null>(null);
  const [elapsed,     setElapsed]     = useState('00:00:00');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [network,     setNetwork]     = useState<{ allowed: boolean; label: string | null; checked: boolean }>({ allowed: false, label: null, checked: false });

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // GPS / location tracking state
  const [gpsStatus,   setGpsStatus]   = useState<'idle' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [pingCount,   setPingCount]   = useState(0);
  const [checkingIn,  setCheckingIn]  = useState(false);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const j = await res.json();
        setMe({
          sub:             j.user?.sub,
          name:            j.user?.name || j.user?.email || '',
          email:           j.user?.email || '',
          role:            j.user?.role,
          is_on_probation: j.user?.is_on_probation ?? false,
        });
      }
    } catch { /* ignore */ }
  }, [token]);

  const fetchNetworkStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/networks/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setNetwork({ allowed: !!j.allowed, label: j.label || null, checked: true });
      } else {
        setNetwork({ allowed: false, label: null, checked: true });
      }
    } catch {
      setNetwork({ allowed: false, label: null, checked: true });
    }
  }, [token]);

  // Post a single location ping to the backend
  const postPing = useCallback(async (
    lat: number, lng: number, accuracyM: number | null,
    type: 'auto' | 'manual', note?: string, attendanceId?: number,
  ) => {
    if (!token) return;
    try {
      await fetch(`${API}/api/v1/location/ping`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ lat, lng, accuracy_m: accuracyM, type, note, attendance_id: attendanceId }),
      });
      setPingCount(c => c + 1);
    } catch { /* silent — non-critical */ }
  }, [token]);

  // Get current GPS position wrapped in a Promise
  const getCurrentPosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }),
    );

  // Request location permission and capture first position
  const requestLocation = useCallback(async (attendanceId?: number, noteStr?: string) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    try {
      const pos = await getCurrentPosition();
      setGpsStatus('granted');
      await postPing(
        pos.coords.latitude, pos.coords.longitude,
        pos.coords.accuracy ?? null,
        noteStr ? 'manual' : 'manual',
        noteStr || 'Clock in',
        attendanceId,
      );
    } catch {
      setGpsStatus('denied');
    }
  }, [postPing]);

  // Start the 30-minute auto-ping interval
  const startLocationInterval = useCallback((attendanceId?: number) => {
    if (locationRef.current) clearInterval(locationRef.current);
    locationRef.current = setInterval(async () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      try {
        const pos = await getCurrentPosition();
        setGpsStatus('granted');
        await postPing(
          pos.coords.latitude, pos.coords.longitude,
          pos.coords.accuracy ?? null,
          'auto', undefined, attendanceId,
        );
      } catch { /* GPS temporarily unavailable — will retry next interval */ }
    }, 30 * 60 * 1000); // 30 minutes
  }, [postPing]);

  const fetchCurrent = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance/current`, { headers: { Authorization: `Bearer ${token}` } });
    setCurrent(res.status === 204 ? null : await res.json());
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    // Always scope to the current user's own records.
    // Without userId, admins would receive all employees' records.
    const jwt   = token ? JSON.parse(atob(token.split('.')[1])) : null;
    const myId  = jwt?.sub;
    const qs    = myId ? `?limit=200&userId=${myId}` : '?limit=200';
    const res   = await fetch(`${API}/api/v1/attendance${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    const j     = await res.json();
    setHistory(j.attendance || []);
  }, [token]);

  const fetchAll = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    await Promise.all([fetchCurrent(), fetchHistory()]);
    setLoading(false);
  }, [token, fetchCurrent, fetchHistory]);

  useEffect(() => { fetchMe(); fetchAll(); fetchNetworkStatus(); }, [fetchMe, fetchAll, fetchNetworkStatus]);

  // Live elapsed timer while clocked in
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (current?.clock_in_at) {
      setElapsed(elapsedSince(current.clock_in_at));
      timerRef.current = setInterval(() => setElapsed(elapsedSince(current.clock_in_at)), 1000);
    } else {
      setElapsed('00:00:00');
      // Clocked out — stop location interval
      if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null; }
    }
    return () => {
      if (timerRef.current)    clearInterval(timerRef.current);
      if (locationRef.current) clearInterval(locationRef.current);
    };
  }, [current]);

  async function clockIn() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ note: 'Clock in via UI' }),
    });
    if (res.ok) {
      const record = await res.json();
      await fetchAll();
      setPingCount(0);
      // Always request + track location — required for off-network attendance review
      await requestLocation(record?.id, 'Clock in');
      startLocationInterval(record?.id);
    } else {
      let msg = 'Clock in failed';
      try {
        const j = await res.json();
        if (j.error === 'network_not_configured') {
          msg = 'Attendance is currently disabled. Please contact your administrator.';
        } else {
          msg = j.message || j.error || msg;
        }
      } catch { msg = await res.text() || msg; }
      alert(msg);
    }
    setBusy(false);
  }

  async function clockOut() {
    setBusy(true);
    // Stop auto-ping interval before clocking out
    if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null; }
    const res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ note: 'Clock out via UI' }),
    });
    if (res.ok) await fetchAll();
    else alert('Clock out failed: ' + await res.text());
    setBusy(false);
  }

  async function handleManualCheckIn() {
    if (!current) return;
    setCheckingIn(true);
    const note = window.prompt('Optional note for this check-in (e.g. "At customer site — Acme Corp")') ?? '';
    try {
      const pos = await getCurrentPosition();
      setGpsStatus('granted');
      await postPing(
        pos.coords.latitude, pos.coords.longitude,
        pos.coords.accuracy ?? null,
        'manual', note || undefined, current?.id,
      );
    } catch {
      alert('Could not get your location. Please allow location access in your browser.');
      setGpsStatus('denied');
    }
    setCheckingIn(false);
  }

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // Normalize any date value (Date object, ISO timestamp, or plain YYYY-MM-DD) → "YYYY-MM-DD"
  function toDateKey(val: unknown): string {
    if (!val) return '';
    const s = String(val);
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // ISO timestamp — take the first 10 chars
    if (s.length >= 10) return s.substring(0, 10);
    return s;
  }

  // Build date → record map for O(1) calendar lookups
  const dayMap: Record<string, any> = {};
  history.forEach(a => {
    const key = toDateKey(a.date);
    if (key) dayMap[key] = { ...a, _dateKey: key };
  });

  // Today as YYYY-MM-DD (local time)
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Has the user already completed a full clock-in/out cycle today?
  const todayRecord      = dayMap[todayStr];
  const hasCompletedToday = !!(todayRecord?.clock_out_at);

  // Stats for the currently viewed month
  const monthPrefix   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthRecords  = history.filter(a => toDateKey(a.date).startsWith(monthPrefix));
  const presentCount  = monthRecords.filter(a => a.status === 'approved').length;
  const absentCount   = monthRecords.filter(a => a.status === 'rejected' || a.status === 'absent').length;
  const leaveCount    = monthRecords.filter(a => a.status === 'leave').length;

  // Calendar geometry
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const selectedRecord = selectedDay ? dayMap[selectedDay] ?? null : null;
  const initials       = me ? getInitials(me.name) : '?';

  const roleLabel = me?.role
    ? me.role.charAt(0).toUpperCase() + me.role.slice(1)
    : '';

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#e5e5e5' }}>
      <style>{CSS}</style>

      <div className="att-root">

        {/* ── Header: avatar + name + month nav ── */}
        <div className="att-header">
          <div className="att-user">
            <div className="att-avatar">{initials}</div>
            <div>
              <div className="att-user-name">{me?.name || '—'}</div>
              <div className="att-user-sub">
                {me?.email || ''}
                {roleLabel ? ` · ${roleLabel}` : ''}
              </div>
            </div>
          </div>
          <div className="att-nav">
            <button className="att-nav-btn" onClick={prevMonth}>Prev</button>
            <span className="att-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button className="att-nav-btn" onClick={nextMonth}>Next</button>
          </div>
        </div>

        {/* ── Network status badge ── */}
        {network.checked && (
          <div
            className="att-net-badge"
            style={network.allowed
              ? { color: '#22c55e', background: 'rgba(34,197,94,.1)', borderColor: 'rgba(34,197,94,.3)' }
              : { color: '#f59e0b', background: 'rgba(245,158,11,.1)', borderColor: 'rgba(245,158,11,.3)' }}
          >
            <span className="att-net-dot" style={{ background: network.allowed ? '#22c55e' : '#f59e0b' }} />
            {network.allowed
              ? `On office network${network.label ? ` · ${network.label}` : ''} — attendance will be auto-approved`
              : 'Outside office network — attendance will be pending; location tracking required for approval'}
          </div>
        )}

        {/* ── Clock In / Out + live timer ── */}
        <div className="att-clock-row">
          {current ? (
            <>
              <div className="att-timer">Clocked in · <strong>{elapsed}</strong></div>
              <button className="att-btn att-btn-out" onClick={clockOut} disabled={busy}>
                {busy ? 'Clocking out…' : 'Clock Out'}
              </button>
            </>
          ) : hasCompletedToday ? (
            <div className="att-timer" style={{ color: '#22c55e' }}>
              Attendance marked for today &nbsp;·&nbsp;
              {fmtTime(todayRecord.clock_in_at)} – {fmtTime(todayRecord.clock_out_at)}
            </div>
          ) : (
            <>
              <div className="att-timer">{loading ? 'Loading…' : 'Not clocked in'}</div>
              <button
                className="att-btn att-btn-in"
                onClick={clockIn}
                disabled={busy || loading}
              >
                {busy ? 'Clocking in…' : 'Clock In'}
              </button>
            </>
          )}
          <button className="att-btn att-btn-ref" onClick={() => { fetchAll(); fetchNetworkStatus(); }} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {/* ── GPS / Location status bar (only while clocked in) ── */}
        {current && (
          <div className={`att-gps-bar${gpsStatus === 'denied' || gpsStatus === 'unavailable' ? ' att-gps-bar-warn' : gpsStatus === 'idle' ? ' att-gps-bar-info' : ''}`}>
            <span
              className="att-gps-dot"
              style={{ background: gpsStatus === 'granted' ? '#22c55e' : gpsStatus === 'denied' || gpsStatus === 'unavailable' ? '#ef4444' : '#6b7280' }}
            />
            <span className="att-gps-text" style={{ color: gpsStatus === 'granted' ? '#86efac' : gpsStatus === 'denied' || gpsStatus === 'unavailable' ? '#fca5a5' : '#9ca3af' }}>
              {gpsStatus === 'granted'     && 'Location tracking active — pinging every 30 min'}
              {gpsStatus === 'denied'      && 'Location access denied — your trail will not be recorded for attendance review'}
              {gpsStatus === 'unavailable' && 'GPS not available on this device'}
              {gpsStatus === 'idle'        && 'Requesting location permission…'}
            </span>
            {gpsStatus !== 'unavailable' && (
              <button
                className="att-btn-checkin"
                onClick={handleManualCheckIn}
                disabled={checkingIn}
                title="Record your current location as a manual check-in"
              >
                {checkingIn ? 'Getting GPS…' : 'Check In Here'}
              </button>
            )}
            {pingCount > 0 && (
              <span className="att-ping-count">{pingCount} ping{pingCount !== 1 ? 's' : ''} recorded</span>
            )}
          </div>
        )}

        {/* ── Probation warning banner ── */}
        {me?.is_on_probation && (
          <div style={{
            background:   'rgba(239,68,68,.08)',
            border:       '1px solid rgba(239,68,68,.3)',
            borderRadius: 10,
            padding:      '12px 16px',
            marginBottom: 16,
            display:      'flex',
            alignItems:   'center',
            gap:          10,
          }}>
            <div>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>You are on probation</div>
              <div style={{ color: '#fca5a5', fontSize: 12, marginTop: 2 }}>
                You have been absent for 3 or more consecutive working days this month.
                Please report to your manager.
              </div>
            </div>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="att-stats">
          <div className="att-stat">
            <div className="att-stat-val" style={{ color: '#22c55e' }}>{loading ? '…' : presentCount}</div>
            <div className="att-stat-lbl">Present</div>
          </div>
          <div className="att-stat">
            <div className="att-stat-val" style={{ color: '#ef4444' }}>{loading ? '…' : absentCount}</div>
            <div className="att-stat-lbl">Absent</div>
          </div>
          <div className="att-stat">
            <div className="att-stat-val" style={{ color: '#3b82f6' }}>{loading ? '…' : leaveCount}</div>
            <div className="att-stat-lbl">Leave</div>
          </div>
        </div>

        {/* ── Monthly calendar ── */}
        <div className="att-cal">

          {/* Day-of-week header */}
          <div className="att-cal-grid att-cal-head">
            {DAY_NAMES.map(d => (
              <div key={d} className="att-cal-head-cell">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="att-cal-grid">
            {/* Leading empty cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="att-day att-empty" />
            ))}

            {/* Actual day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record  = dayMap[dateStr];
              const isToday    = dateStr === todayStr;
              const isFuture   = dateStr > todayStr;
              const dow        = new Date(dateStr + 'T00:00:00').getDay();
              const isWeekend  = dow === 0 || dow === 6;
              const isSelected = dateStr === selectedDay;
              const cfg        = record && !isFuture ? (STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending) : null;

              return (
                <div
                  key={dateStr}
                  className={[
                    'att-day',
                    isToday    ? 'att-today'    : '',
                    isWeekend  ? 'att-weekend'  : '',
                    isSelected ? 'att-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                >
                  <div className="att-day-num-wrap">
                    <span className="att-day-num">{day}</span>
                  </div>
                  {cfg && (
                    <>
                      <div
                        className="att-day-badge"
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                      >
                        {cfg.label}
                      </div>
                      {record.clock_in_at && (
                        <div className="att-day-time">{fmtTime(record.clock_in_at)}</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="att-legend">
            {[
              { label: 'Present',  color: '#22c55e' },
              { label: 'Absent',   color: '#ef4444' },
              { label: 'Leave',    color: '#3b82f6' },
              { label: 'Pending',  color: '#fbbf24' },
              { label: 'Holiday',  color: '#f472b6' },
              { label: 'Half day', color: '#a78bfa' },
              { label: 'Weekend',  color: '#374151' },
            ].map(({ label, color }) => (
              <div key={label} className="att-legend-item">
                <span className="att-legend-dot" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Day detail panel ── */}
        <div className="att-detail">
          {!selectedRecord ? (
            <span className="att-detail-empty">Click on any day to view details</span>
          ) : (
            <div className="att-detail-grid">
              <div className="att-detail-item">
                <label>Date</label>
                <span>{fmtDate(selectedRecord.date)}</span>
              </div>
              <div className="att-detail-item">
                <label>Status</label>
                <span style={{ color: (STATUS_CONFIG[selectedRecord.status] ?? STATUS_CONFIG.pending).color }}>
                  {(STATUS_CONFIG[selectedRecord.status] ?? STATUS_CONFIG.pending).label}
                </span>
              </div>
              <div className="att-detail-item">
                <label>Clock In</label>
                <span>{fmtTime(selectedRecord.clock_in_at) || '—'}</span>
              </div>
              <div className="att-detail-item">
                <label>Clock Out</label>
                <span>{fmtTime(selectedRecord.clock_out_at) || '—'}</span>
              </div>
              <div className="att-detail-item">
                <label>Duration</label>
                <span>{fmtDuration(selectedRecord.duration_seconds)}</span>
              </div>
              {selectedRecord.note && (
                <div className="att-detail-item">
                  <label>Note</label>
                  <span style={{ fontSize: 12 }}>{selectedRecord.note}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
