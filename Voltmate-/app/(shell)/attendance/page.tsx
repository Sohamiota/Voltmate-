'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttendanceRecord, LeaveBalance, LeaveRequest } from '@/types/api';

/** Returns an AbortSignal that fires after `ms` milliseconds. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && (AbortSignal as any).timeout) {
    return (AbortSignal as any).timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

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
  if (secs == null || !Number.isFinite(secs)) return '—';
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

/** Shared base classes for action buttons */
const btnBase = 'px-5 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-opacity duration-150 disabled:opacity-45 disabled:cursor-not-allowed';

export default function AttendancePage() {
  const [current,     setCurrent]     = useState<AttendanceRecord | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [history,     setHistory]     = useState<AttendanceRecord[]>([]);
  const [busy,        setBusy]        = useState(false);
  const [me,          setMe]          = useState<{ sub?: number; name: string; email: string; role?: string; is_on_probation?: boolean } | null>(null);
  const [elapsed,     setElapsed]     = useState('00:00:00');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [network,     setNetwork]     = useState<{
    allowed: boolean;
    label: string | null;
    checked: boolean;
    ip?: string | null;
    no_network_rules?: boolean;
  }>({ allowed: false, label: null, checked: false });

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

  // Leave management
  const [leaveBalance,     setLeaveBalance]     = useState<LeaveBalance | null>(null);
  const [leaveRequests,    setLeaveRequests]    = useState<LeaveRequest[]>([]);
  const [holidays,         setHolidays]         = useState<{ date: string; name: string }[]>([]);
  const [leaveType,        setLeaveType]        = useState<'CL' | 'SL'>('CL');
  const [leaveStart,       setLeaveStart]       = useState('');
  const [leaveEnd,         setLeaveEnd]         = useState('');
  const [leaveReason,      setLeaveReason]      = useState('');
  const [leaveDaysPreview, setLeaveDaysPreview] = useState<number | null>(null);
  const [leaveNeedsProof,  setLeaveNeedsProof]  = useState(false);
  const [minClStart,       setMinClStart]       = useState('');
  const [proofFile,        setProofFile]        = useState<File | null>(null);
  const [leaveBusy,        setLeaveBusy]        = useState(false);

  function minClStartLocal(): string {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  async function fileToProof(file: File) {
    return new Promise<{ filename: string; mime_type: string; data_base64: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ filename: file.name, mime_type: file.type || 'application/octet-stream', data_base64: base64 });
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

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
        signal:  timeoutSignal(12_000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setNetwork({
          allowed:          !!j.allowed,
          label:            j.label ?? null,
          checked:          true,
          ip:               typeof j.ip === 'string' ? j.ip : null,
          no_network_rules: !!j.no_network_rules,
        });
      } else {
        // Non-OK response — treat as "status unknown, allow clock-in anyway"
        setNetwork({ allowed: true, label: null, checked: true, ip: null, no_network_rules: true });
      }
    } catch {
      // Network / timeout error — don't block employees by showing "outside office"
      setNetwork({ allowed: true, label: null, checked: true, ip: null, no_network_rules: true });
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
        body:    JSON.stringify({
          lat, lng, accuracy_m: accuracyM, type, note, attendance_id: attendanceId,
          context: 'attendance',
        }),
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
    try {
      const res = await fetch(`${API}/api/v1/attendance/current`, {
        signal:  timeoutSignal(10_000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) { setCurrent(null); return; }
      if (!res.ok) { setCurrent(null); return; }
      const j = await res.json();
      // Only accept a valid open session (must have clock_in_at but no clock_out_at)
      setCurrent(j?.clock_in_at && !j?.clock_out_at ? j : null);
    } catch {
      setCurrent(null);
    }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      // Always scope to the current user's own records.
      // Without userId, admins would receive all employees' records.
      let myId: string | number | null = null;
      try {
        const jwt = JSON.parse(atob(token.split('.')[1]));
        myId = jwt?.sub ?? null;
      } catch { /* malformed token — fall back to no userId filter */ }
      const qs  = myId ? `?limit=300&userId=${myId}` : '?limit=300';
      const res = await fetch(`${API}/api/v1/attendance${qs}`, {
        signal:  timeoutSignal(12_000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const j = await res.json();
      setHistory(j.attendance || []);
    } catch {
      setHistory([]);
    }
  }, [token]);

  const fetchLeaveData = useCallback(async () => {
    if (!token) return;
    // Leave data is non-critical — use a generous timeout so a slow/cold backend
    // never blocks the main attendance UI.
    const sig = timeoutSignal(15_000);
    try {
      const [balRes, reqRes, holRes] = await Promise.all([
        fetch(`${API}/api/v1/leave/balance`,              { signal: sig, headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/leave`,                      { signal: sig, headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/leave/holidays?year=${viewYear}`, { signal: sig, headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (balRes.ok) setLeaveBalance((await balRes.json()).balance);
      if (reqRes.ok) setLeaveRequests((await reqRes.json()).requests || []);
      if (holRes.ok) {
        const hj = await holRes.json();
        setHolidays(
          (hj.holidays || []).map((h: { holiday_date: string; name: string }) => ({
            date: h.holiday_date.slice(0, 10),
            name: h.name,
          })),
        );
      }
    } catch { /* timeout or network error — leave panel shows gracefully degraded state */ }
  }, [token, viewYear]);

  const fetchAll = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    // Leave data (balance, requests, holidays) is non-critical — fetch it in the
    // background so a slow / cold backend never stalls the attendance UI.
    fetchLeaveData();
    try {
      await Promise.all([fetchCurrent(), fetchHistory()]);
    } catch {
      /* individual fetches handle their own errors */
    } finally {
      setLoading(false);
    }
  }, [token, fetchCurrent, fetchHistory, fetchLeaveData]);

  useEffect(() => { fetchMe(); fetchAll(); fetchNetworkStatus(); }, [fetchMe, fetchAll, fetchNetworkStatus]);

  useEffect(() => {
    if (!leaveStart || !leaveEnd || !token) {
      setLeaveDaysPreview(null);
      setLeaveNeedsProof(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API}/api/v1/leave/preview-days?start_date=${leaveStart}&end_date=${leaveEnd}&leave_type=${leaveType}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const j = await res.json();
          setLeaveDaysPreview(j.days ?? null);
          setLeaveNeedsProof(!!j.requires_proof);
          if (j.min_cl_start) setMinClStart(j.min_cl_start);
        }
      } catch {
        setLeaveDaysPreview(null);
        setLeaveNeedsProof(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [leaveStart, leaveEnd, leaveType, token]);

  useEffect(() => {
    setMinClStart(minClStartLocal());
  }, []);

  async function submitLeave() {
    if (!token || !leaveStart || !leaveEnd) return;
    if (leaveType === 'CL' && leaveStart < (minClStart || minClStartLocal())) {
      alert(`Casual leave must be applied at least 2 days in advance. Earliest start: ${minClStart || minClStartLocal()}`);
      return;
    }
    setLeaveBusy(true);
    try {
      const body: Record<string, unknown> = {
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason,
      };
      if (leaveNeedsProof && proofFile) {
        body.proof = await fileToProof(proofFile);
      }

      const res = await fetch(`${API}/api/v1/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.message || j.error || 'Could not submit leave');
        return;
      }
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      setProofFile(null);
      setLeaveDaysPreview(null);
      setLeaveNeedsProof(false);
      await fetchLeaveData();
      alert(j.message || 'Leave request submitted for admin approval.');
    } finally {
      setLeaveBusy(false);
    }
  }

  async function uploadProofForRequest(requestId: number, file: File) {
    if (!token) return;
    setLeaveBusy(true);
    try {
      const proof = await fileToProof(file);
      const res = await fetch(`${API}/api/v1/leave/${requestId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ proof }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.message || j.error || 'Upload failed');
        return;
      }
      await fetchLeaveData();
      alert('Medical document uploaded. Admin can now review your request.');
    } finally {
      setLeaveBusy(false);
    }
  }

  async function cancelLeave(id: number) {
    if (!token || !confirm('Cancel this pending leave request?')) return;
    const res = await fetch(`${API}/api/v1/leave/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await fetchLeaveData();
    else alert('Could not cancel request');
  }

  // Live elapsed timer while clocked in
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (current?.clock_in_at) {
      setElapsed(elapsedSince(current.clock_in_at));
      timerRef.current = setInterval(() => setElapsed(elapsedSince(current.clock_in_at!)), 1000);
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
    try {
      const res = await fetch(`${API}/api/v1/attendance/clockin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ note: 'Clock in via UI' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchAll();
        setPingCount(0);
        // Always request + track location — required for off-network attendance review
        await requestLocation(body?.id, 'Clock in');
        startLocationInterval(body?.id);
      } else {
        alert(body?.message || body?.error || 'Clock in failed');
      }
    } catch {
      alert('Clock in failed — check your connection');
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    // Stop auto-ping interval before clocking out
    if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null; }
    try {
      const res  = await fetch(`${API}/api/v1/attendance/clockout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ note: 'Clock out via UI' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) await fetchAll();
      else alert(body?.message || body?.error || 'Clock out failed');
    } catch {
      alert('Clock out failed — check your connection');
    } finally {
      setBusy(false);
    }
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

  // Build date → record map for O(1) calendar lookups.
  // History arrives newest-first (DESC created_at). Iterate oldest-first so that
  // newer records (e.g. a 'leave' entry inserted when leave was approved) always
  // overwrite older ones (e.g. the original clock-in record for the same date).
  const dayMap: Record<string, AttendanceRecord & { _dateKey: string }> = {};
  [...history].reverse().forEach(a => {
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

  const selectedRecord  = selectedDay ? dayMap[selectedDay] ?? null : null;
  const selectedHoliday = selectedDay ? holidays.find(h => h.date === selectedDay) ?? null : null;
  const initials        = me ? getInitials(me.name) : '?';

  const roleLabel = me?.role
    ? me.role.charAt(0).toUpperCase() + me.role.slice(1)
    : '';

  const fieldInputCls = 'w-full bg-zinc-900 border border-[#333] rounded-lg px-2.5 py-2 text-zinc-200 text-[13px] font-sans';
  const detailLabelCls = 'text-[10px] text-zinc-500 uppercase tracking-[0.5px] block mb-1';
  const detailValueCls = 'text-[14px] text-zinc-200 font-medium';

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-200 font-sans">
      <div className="max-w-[900px] mx-auto px-5 py-7">

        {/* ── Header: avatar + name + month nav ── */}
        <div className="flex justify-between items-center mb-[18px] gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-base font-bold text-white shrink-0 select-none">
              {initials}
            </div>
            <div>
              <div className="text-[17px] font-bold text-white leading-[1.3]">{me?.name || '—'}</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {me?.email || ''}
                {roleLabel ? ` · ${roleLabel}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              className="bg-zinc-900 border border-zinc-800 rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer text-zinc-400 text-base transition-all duration-150 leading-none hover:border-zinc-500 hover:text-white"
              onClick={prevMonth}
            >
              Prev
            </button>
            <span className="text-[15px] font-bold text-white min-w-[130px] text-center max-[540px]:min-w-[100px] max-[540px]:text-[13px]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              className="bg-zinc-900 border border-zinc-800 rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer text-zinc-400 text-base transition-all duration-150 leading-none hover:border-zinc-500 hover:text-white"
              onClick={nextMonth}
            >
              Next
            </button>
          </div>
        </div>

        {/* ── Network status badge ── */}
        {network.checked && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-[20px] text-xs font-medium border mb-2.5"
            style={network.allowed
              ? { color: '#22c55e', background: 'rgba(34,197,94,.1)', borderColor: 'rgba(34,197,94,.3)' }
              : { color: '#f59e0b', background: 'rgba(245,158,11,.1)', borderColor: 'rgba(245,158,11,.3)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: network.allowed ? '#22c55e' : '#f59e0b' }} />
            {network.no_network_rules
              ? 'No office network restriction — attendance will be auto-approved'
              : network.allowed
                ? `On office network${network.label ? ` · ${network.label}` : ''} — attendance will be auto-approved`
                : `Outside office network${network.ip ? ` (${network.ip})` : ''} — you can still clock in, attendance will be sent for admin approval`}
          </div>
        )}

        {/* ── Clock In / Out + live timer ── */}
        <div className="flex items-center gap-2.5 mb-[18px] flex-wrap">
          {current ? (
            <>
              <div className="text-[13px] text-zinc-400">
                Clocked in · <strong className="text-cyan-400 tabular-nums text-[15px] font-bold">{elapsed}</strong>
              </div>
              <button className={`${btnBase} bg-red-500 text-white`} onClick={clockOut} disabled={busy}>
                {busy ? 'Clocking out…' : 'Clock Out'}
              </button>
            </>
          ) : hasCompletedToday ? (
            <div className="text-[13px] text-green-500">
              Attendance marked for today &nbsp;·&nbsp;
              {fmtTime(todayRecord?.clock_in_at)} – {fmtTime(todayRecord?.clock_out_at)}
            </div>
          ) : (
            <>
              <div className="text-[13px] text-zinc-400">
                {loading ? 'Loading…' : 'Not clocked in'}
                {!loading && !network.allowed && network.checked && !network.no_network_rules && (
                  <span className="ml-2 text-amber-400">(remote — will need approval)</span>
                )}
              </div>
              <button
                className={`${btnBase} bg-green-500 text-white`}
                onClick={clockIn}
                disabled={busy || loading}
              >
                {busy ? 'Clocking in…' : 'Clock In'}
              </button>
            </>
          )}
          <button
            className={`${btnBase} bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200`}
            onClick={() => { fetchAll(); fetchNetworkStatus(); }}
            disabled={loading}
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {/* ── GPS / Location status bar (only while clocked in) ── */}
        {current && (
          <div className={[
            'flex items-center gap-2.5 rounded-[10px] px-[14px] py-2.5 mb-[14px] flex-wrap border',
            gpsStatus === 'denied' || gpsStatus === 'unavailable'
              ? 'bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.25)]'
              : gpsStatus === 'idle'
                ? 'bg-[rgba(59,130,246,0.06)] border-[rgba(59,130,246,0.25)]'
                : 'bg-[#0f1a0f] border-[rgba(34,197,94,0.25)]',
          ].join(' ')}>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: gpsStatus === 'granted' ? '#22c55e' : gpsStatus === 'denied' || gpsStatus === 'unavailable' ? '#ef4444' : '#6b7280' }}
            />
            <span
              className="text-xs font-medium flex-1"
              style={{ color: gpsStatus === 'granted' ? '#86efac' : gpsStatus === 'denied' || gpsStatus === 'unavailable' ? '#fca5a5' : '#9ca3af' }}
            >
              {gpsStatus === 'granted'     && 'Location tracking active — pinging every 30 min'}
              {gpsStatus === 'denied'      && 'Location access denied — your trail will not be recorded for attendance review'}
              {gpsStatus === 'unavailable' && 'GPS not available on this device'}
              {gpsStatus === 'idle'        && 'Requesting location permission…'}
            </span>
            {gpsStatus !== 'unavailable' && (
              <button
                className="bg-[rgba(99,102,241,0.18)] border border-[rgba(99,102,241,0.4)] text-[#a5b4fc] px-[14px] py-[6px] rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 hover:bg-[rgba(99,102,241,0.28)] disabled:opacity-45 disabled:cursor-not-allowed"
                onClick={handleManualCheckIn}
                disabled={checkingIn}
                title="Record your current location as a manual check-in"
              >
                {checkingIn ? 'Getting GPS…' : 'Check In Here'}
              </button>
            )}
            {pingCount > 0 && (
              <span className="text-[11px] text-zinc-500 ml-auto">{pingCount} ping{pingCount !== 1 ? 's' : ''} recorded</span>
            )}
          </div>
        )}

        {/* ── Probation warning banner ── */}
        {me?.is_on_probation && (
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-[10px] px-4 py-3 mb-4 flex items-center gap-2.5">
            <div>
              <div className="text-red-500 font-bold text-[13px]">You are on probation</div>
              <div className="text-[#fca5a5] text-xs mt-0.5">
                You have been absent for 3 or more consecutive working days this month.
                Please report to your manager.
              </div>
            </div>
          </div>
        )}

        {/* ── Leave balance & apply ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] px-[18px] py-4 mb-4">
          <div className="text-[14px] font-bold text-white mb-3">Leave balance · FY {leaveBalance?.fy_label || '…'}</div>
          {leaveBalance?.on_probation ? (
            <div className="text-[11px] text-[#fca5a5] leading-[1.45] mb-2.5">
              Probation until {leaveBalance.probation_end}. You can apply for leave after completing 3 months from join date.
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5 mb-[14px] max-[540px]:grid-cols-1">
            <div className="bg-zinc-900 border border-[#333] rounded-[10px] px-[14px] py-3">
              <div className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 font-semibold">Casual leave (CL)</div>
              <div className="text-[26px] font-extrabold mt-1 tabular-nums text-[#93c5fd]">
                {leaveBalance ? leaveBalance.cl_available : '…'}
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 leading-[1.4]">
                Earned {leaveBalance?.cl_earned ?? 0} · Used {leaveBalance?.cl_used ?? 0}
                {leaveBalance?.cl_pending ? ` · Pending ${leaveBalance.cl_pending}` : ''}
              </div>
            </div>
            <div className="bg-zinc-900 border border-[#333] rounded-[10px] px-[14px] py-3">
              <div className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 font-semibold">Sick leave (SL)</div>
              <div className="text-[26px] font-extrabold mt-1 tabular-nums text-[#d8b4fe]">
                {leaveBalance ? leaveBalance.sl_available : '…'}
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 leading-[1.4]">
                Earned {leaveBalance?.sl_earned ?? 0}
                {leaveBalance?.sl_carried_forward ? ` + ${leaveBalance.sl_carried_forward} carried` : ''}
                · Used {leaveBalance?.sl_used ?? 0}
              </div>
            </div>
          </div>
          {leaveBalance?.next_accrual_note && (
            <div className="text-[11px] text-zinc-400 mt-2.5 leading-[1.45]">{leaveBalance.next_accrual_note}</div>
          )}
          {leaveType === 'CL' && (
            <div className="text-[11px] text-[#fcd34d] mt-2 leading-[1.45] px-2.5 py-2 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-lg">
              Casual leave must be applied at least <strong>2 days before</strong> the start date
              (earliest: {minClStart || minClStartLocal()}).
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mt-[14px] max-[540px]:grid-cols-1">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">Leave type</label>
              <select
                className={fieldInputCls}
                value={leaveType}
                onChange={e => setLeaveType(e.target.value as 'CL' | 'SL')}
                disabled={!leaveBalance?.can_apply}
              >
                <option value="CL">Casual leave (CL)</option>
                <option value="SL">Sick leave (SL)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">Working days in range</label>
              <input
                className={fieldInputCls}
                readOnly
                value={leaveDaysPreview != null ? String(leaveDaysPreview) : '—'}
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">From</label>
              <input
                className={fieldInputCls}
                type="date"
                value={leaveStart}
                min={leaveType === 'CL' ? (minClStart || minClStartLocal()) : undefined}
                onChange={e => setLeaveStart(e.target.value)}
                disabled={!leaveBalance?.can_apply}
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">To</label>
              <input
                className={fieldInputCls}
                type="date"
                value={leaveEnd}
                onChange={e => setLeaveEnd(e.target.value)}
                disabled={!leaveBalance?.can_apply}
              />
            </div>
            <div className="col-span-full">
              <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">Reason</label>
              <textarea
                className={`${fieldInputCls} min-h-[56px] resize-y`}
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                placeholder="Brief reason for leave"
                disabled={!leaveBalance?.can_apply}
              />
            </div>
            {leaveNeedsProof && (
              <div className="col-span-full">
                <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.4px] mb-1 font-semibold">Medical proof (required for admin approval)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  className="text-xs text-[#d1d5db]"
                  disabled={!leaveBalance?.can_apply}
                  onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                />
                <div className="text-[11px] text-zinc-400 mt-1.5 leading-[1.45]">
                  Sick leave over 2 days requires a medical certificate (PDF or image, max 3 MB).
                  You can upload now or after submitting the request.
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border bg-[rgba(59,130,246,0.15)] border-[rgba(59,130,246,0.4)] text-[#93c5fd] disabled:opacity-45 disabled:cursor-not-allowed"
              disabled={leaveBusy || !leaveBalance?.can_apply || !leaveStart || !leaveEnd}
              onClick={() => void submitLeave()}
            >
              {leaveBusy ? 'Submitting…' : 'Apply for leave'}
            </button>
          </div>

          {leaveRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <div className="text-xs font-bold text-white mb-2">Pending requests</div>
              {leaveRequests.filter(r => r.status === 'pending').map(r => (
                <div key={r.id} className="text-xs text-[#d1d5db] py-[6px] border-b border-dashed border-zinc-800 last:border-b-0 flex justify-between gap-2 items-center">
                  <span>
                    {r.leave_type} · {r.start_date?.slice(0, 10)} → {r.end_date?.slice(0, 10)} ({r.days}d)
                    {r.requires_proof && !r.proof_path && (
                      <span className="text-[#fcd34d]"> · Proof pending</span>
                    )}
                    {r.proof_path && (
                      <span className="text-[#86efac]"> · Proof uploaded</span>
                    )}
                  </span>
                  <span className="flex gap-1.5 flex-wrap">
                    {r.requires_proof && !r.proof_path && (
                      <label className="text-[11px] py-1 px-2.5 rounded-md border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] text-[#d8b4fe] cursor-pointer">
                        Upload proof
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) void uploadProofForRequest(r.id, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className={`${btnBase} bg-transparent border border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200`}
                      onClick={() => void cancelLeave(r.id)}
                    >
                      Cancel
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3 mb-[18px] max-[360px]:gap-1.5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 max-[540px]:px-2.5 max-[540px]:py-3">
            <div className="text-[30px] font-bold mb-1 leading-none text-green-500 max-[540px]:text-[22px]">
              {loading ? '…' : presentCount}
            </div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-[0.6px] font-medium">Present</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 max-[540px]:px-2.5 max-[540px]:py-3">
            <div className="text-[30px] font-bold mb-1 leading-none text-red-500 max-[540px]:text-[22px]">
              {loading ? '…' : absentCount}
            </div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-[0.6px] font-medium">Absent</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 max-[540px]:px-2.5 max-[540px]:py-3">
            <div className="text-[30px] font-bold mb-1 leading-none text-blue-500 max-[540px]:text-[22px]">
              {loading ? '…' : leaveCount}
            </div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-[0.6px] font-medium">Leave</div>
          </div>
        </div>

        {/* ── Monthly calendar ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] overflow-hidden mb-3">

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 bg-[#161616] border-b border-[#222]">
            {DAY_NAMES.map(d => (
              <div
                key={d}
                className="py-2.5 px-1 text-center text-[11px] font-semibold text-zinc-500 tracking-[0.5px] max-[360px]:text-[9px] max-[360px]:p-[8px_2px]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[76px] border-r border-b border-[#1e1e1e] [&:nth-child(7n)]:border-r-0 max-[540px]:min-h-[54px]"
              />
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
              const holidayObj = holidays.find(h => h.date === dateStr);
              const isHoliday  = !!holidayObj;
              const isSelected = dateStr === selectedDay;
              const cfg        = record && !isFuture ? (STATUS_CONFIG[record.status ?? ''] ?? STATUS_CONFIG.pending) : null;

              return (
                <div
                  key={dateStr}
                  className={[
                    'min-h-[76px] border-r border-b border-[#1e1e1e] p-[7px_6px_5px] cursor-pointer transition-colors duration-[120ms] relative hover:bg-zinc-900 [&:nth-child(7n)]:border-r-0',
                    'max-[540px]:min-h-[54px] max-[540px]:p-[5px_3px]',
                    isHoliday  ? 'bg-[rgba(244,114,182,0.04)] hover:!bg-[rgba(244,114,182,0.09)]' : '',
                    isSelected ? '!bg-[#1a1c2e]' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                >
                  <div className={`inline-flex items-center justify-center w-6 h-6 mb-[5px]${isToday ? ' bg-blue-500 rounded-full' : ''}`}>
                    <span className={[
                      'text-[13px] max-[360px]:text-[11px]',
                      isToday    ? 'text-white font-bold'
                      : isWeekend ? 'text-[#3d4555]'
                      : 'text-zinc-400',
                    ].join(' ')}>
                      {day}
                    </span>
                  </div>
                  {isHoliday && (
                    <div
                      className="inline-block px-[7px] py-0.5 rounded-[20px] text-[9px] font-semibold border border-[rgba(244,114,182,0.35)] text-pink-400 bg-[rgba(244,114,182,0.12)]"
                      title={holidayObj?.name}
                    >
                      {holidayObj?.name || 'Holiday'}
                    </div>
                  )}
                  {cfg && (
                    <>
                      <div
                        className="inline-block px-2 py-0.5 rounded-[20px] text-[10px] font-semibold border mb-[3px] whitespace-nowrap max-[540px]:text-[9px] max-[540px]:px-[5px] max-[540px]:py-px"
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                      >
                        {cfg.label}
                      </div>
                      {record.clock_in_at && (
                        <div className="text-[10px] text-zinc-500 max-[540px]:hidden">{fmtTime(record.clock_in_at)}</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-[14px] px-4 py-3 border-t border-[#1e1e1e]">
            {[
              { label: 'Present',  color: '#22c55e' },
              { label: 'Absent',   color: '#ef4444' },
              { label: 'Leave',    color: '#3b82f6' },
              { label: 'Pending',  color: '#fbbf24' },
              { label: 'Holiday',  color: '#f472b6' },
              { label: 'Half day', color: '#a78bfa' },
              { label: 'Weekend',  color: '#374151' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-[5px] text-[11px] text-zinc-400">
                <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Day detail panel ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-[18px] min-h-16 flex items-center">
          {!selectedDay ? (
            <span className="text-[#4b5563] text-[13px]">Click on any day to view details</span>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4 w-full">
              <div>
                <label className={detailLabelCls}>Date</label>
                <span className={detailValueCls}>{fmtDate(selectedDay)}</span>
              </div>
              {selectedHoliday && (
                <div>
                  <label className={detailLabelCls}>Holiday</label>
                  <span className="text-[14px] text-pink-400 font-medium">{selectedHoliday.name}</span>
                </div>
              )}
              {selectedRecord ? (
                <>
                  <div>
                    <label className={detailLabelCls}>Status</label>
                    <span
                      className="text-[14px] font-medium"
                      style={{ color: (STATUS_CONFIG[selectedRecord.status ?? ''] ?? STATUS_CONFIG.pending).color }}
                    >
                      {(STATUS_CONFIG[selectedRecord.status ?? ''] ?? STATUS_CONFIG.pending).label}
                    </span>
                  </div>
                  <div>
                    <label className={detailLabelCls}>Clock In</label>
                    <span className={detailValueCls}>{fmtTime(selectedRecord.clock_in_at) || '—'}</span>
                  </div>
                  <div>
                    <label className={detailLabelCls}>Clock Out</label>
                    <span className={detailValueCls}>{fmtTime(selectedRecord.clock_out_at) || '—'}</span>
                  </div>
                  <div>
                    <label className={detailLabelCls}>Duration</label>
                    <span className={detailValueCls}>{fmtDuration(selectedRecord.duration_seconds)}</span>
                  </div>
                  {selectedRecord.note && (
                    <div>
                      <label className={detailLabelCls}>Note</label>
                      <span className="text-xs text-zinc-200 font-medium">{selectedRecord.note}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="col-span-full">
                  <label className={detailLabelCls}>Status</label>
                  <span className="text-[14px] text-zinc-500 font-medium">
                    {selectedDay > todayStr ? 'Not yet' : selectedHoliday ? 'Company holiday' : 'No record'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
