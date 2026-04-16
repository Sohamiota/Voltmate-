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
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
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
  const [me,          setMe]          = useState<{ name: string; email: string; role?: string; is_on_probation?: boolean } | null>(null);
  const [elapsed,     setElapsed]     = useState('00:00:00');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const j = await res.json();
        setMe({
          name:            j.user?.name || j.user?.email || '',
          email:           j.user?.email || '',
          role:            j.user?.role,
          is_on_probation: j.user?.is_on_probation ?? false,
        });
      }
    } catch { /* ignore */ }
  }, [token]);

  const fetchCurrent = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance/current`, { headers: { Authorization: `Bearer ${token}` } });
    setCurrent(res.status === 204 ? null : await res.json());
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance?limit=200`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    setHistory(j.attendance || []);
  }, [token]);

  const fetchAll = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    await Promise.all([fetchCurrent(), fetchHistory()]);
    setLoading(false);
  }, [token, fetchCurrent, fetchHistory]);

  useEffect(() => { fetchMe(); fetchAll(); }, [fetchMe, fetchAll]);

  // Live elapsed timer while clocked in
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (current?.clock_in_at) {
      setElapsed(elapsedSince(current.clock_in_at));
      timerRef.current = setInterval(() => setElapsed(elapsedSince(current.clock_in_at)), 1000);
    } else {
      setElapsed('00:00:00');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  async function clockIn() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ location: 'Office', note: 'Clock in via UI' }),
    });
    if (res.ok) await fetchAll();
    else alert('Clock in failed: ' + await res.text());
    setBusy(false);
  }

  async function clockOut() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ note: 'Clock out via UI' }),
    });
    if (res.ok) await fetchAll();
    else alert('Clock out failed: ' + await res.text());
    setBusy(false);
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

  // Build date → record map for O(1) calendar lookups
  const dayMap: Record<string, any> = {};
  history.forEach(a => { if (a.date) dayMap[a.date] = a; });

  // Stats for the currently viewed month
  const monthPrefix   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthRecords  = history.filter(a => (a.date || '').startsWith(monthPrefix));
  const presentCount  = monthRecords.filter(a => a.status === 'approved').length;
  const absentCount   = monthRecords.filter(a => a.status === 'rejected' || a.status === 'absent').length;
  const leaveCount    = monthRecords.filter(a => a.status === 'leave').length;

  // Calendar geometry
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

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
            <button className="att-nav-btn" onClick={prevMonth}>‹</button>
            <span className="att-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button className="att-nav-btn" onClick={nextMonth}>›</button>
          </div>
        </div>

        {/* ── Clock In / Out + live timer ── */}
        <div className="att-clock-row">
          {current ? (
            <>
              <div className="att-timer">Clocked in · <strong>{elapsed}</strong></div>
              <button className="att-btn att-btn-out" onClick={clockOut} disabled={busy}>
                {busy ? 'Clocking out…' : 'Clock Out'}
              </button>
            </>
          ) : (
            <>
              <div className="att-timer">{loading ? 'Loading…' : 'Not clocked in'}</div>
              <button className="att-btn att-btn-in" onClick={clockIn} disabled={busy || loading}>
                {busy ? 'Clocking in…' : 'Clock In'}
              </button>
            </>
          )}
          <button className="att-btn att-btn-ref" onClick={fetchAll} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

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
            <span style={{ fontSize: 18 }}>⚠️</span>
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
