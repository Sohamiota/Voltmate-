'use client'

import { useCallback, useEffect, useState } from 'react';
import 'react-day-picker/dist/style.css';
import type { AttendanceRecord, Employee } from '@/types/api';
import { useEffectiveSearch } from '@/components/SearchContext';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

type EnrichedEmp = Employee & {
  recs: AttendanceRecord[];
  pending: number;
};

function recStatus(r: AttendanceRecord): string {
  return r.status || 'pending';
}

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1
    ? (p[0][0] || '?').toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(plain + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDuration(secs: number | null): string {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Same as fmtDuration but empty when unknown; treats 0 as "0m" (fmtDuration hides 0 due to !secs). */
function durationForExport(secs: number | null): string {
  if (secs == null || !Number.isFinite(Number(secs))) return '';
  const s = Math.max(0, Math.floor(Number(secs)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDatePlain(d: string | null): string {
  if (!d) return '';
  return d.length > 10 ? d.slice(0, 10) : d;
}

function employeeDisplayName(r: AttendanceRecord): string {
  const n = r.employee_name?.trim();
  if (n) return n;
  if (r.employee_email?.trim()) return r.employee_email.trim();
  return `User #${r.user_id}`;
}

function networkTypeLabel(r: AttendanceRecord): string {
  return r.network_verified ? 'Office Network' : 'Outside Network';
}

function statusDisplay(r: AttendanceRecord): string {
  const s = recStatus(r);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending';
}

function escapeNote(note: string | null | undefined): string {
  if (!note) return '';
  return String(note).replace(/\r?\n/g, ' ').trim();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local calendar date YYYY-MM-DD */
function toYyyyMmDdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAttendanceSheetRows(source: AttendanceRecord[]) {
  const sorted = [...source].sort((a, b) => {
    const da = fmtDatePlain(a.date);
    const db = fmtDatePlain(b.date);
    if (da !== db) return db.localeCompare(da);
    return employeeDisplayName(a).localeCompare(employeeDisplayName(b), undefined, { sensitivity: 'base' });
  });
  return sorted.map(r => ({
    'Employee Name': employeeDisplayName(r),
    'Date':          fmtDatePlain(r.date),
    'Clock In':      r.clock_in_at ? fmtTime(r.clock_in_at) : '',
    'Clock Out':     r.clock_out_at ? fmtTime(r.clock_out_at) : '',
    'Duration':      durationForExport(r.duration_seconds),
    'Network Type':  networkTypeLabel(r),
    'Status':        statusDisplay(r),
    'IP Address':    r.clock_in_ip ?? '',
    'Notes':         escapeNote(r.note),
  }));
}

export default function AdminAttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records,   setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting]  = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [dayExportOpen, setDayExportOpen] = useState(false);
  const [exportDay, setExportDay] = useState<Date | undefined>(() => startOfToday());

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      const [empRes, attRes] = await Promise.all([
        fetch(`${API}/api/v1/auth/employees`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/attendance?limit=2000&startDate=${startDate}&endDate=${endDate}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!empRes.ok || !attRes.ok) {
        console.error('Failed to fetch attendance data');
        return;
      }
      const empData = await empRes.json();
      const attData = await attRes.json();
      setEmployees(empData.employees || []);
      setRecords(attData.attendance   || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id: number, approve: boolean) {
    const res = await fetch(`${API}/api/v1/attendance/admin/${id}/approve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ approve }),
    });
    if (res.ok) loadData();
    else alert('Action failed: ' + await res.text());
  }

  async function writeAttendanceXlsx(source: AttendanceRecord[], filenameSuffix: string): Promise<boolean> {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const sheetRows = buildAttendanceSheetRows(source);
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-export-${filenameSuffix}.xlsx`);
      return true;
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
      return false;
    } finally {
      setExporting(false);
    }
  }

  async function exportAttendanceXlsx() {
    if (records.length === 0) {
      alert('No attendance records to export.');
      return;
    }
    await writeAttendanceXlsx(records, `all-${new Date().toISOString().slice(0, 10)}`);
  }

  async function runDayExport() {
    if (!exportDay) return;
    const dayIso = toYyyyMmDdLocal(exportDay);
    const subset = records.filter(r => fmtDatePlain(r.date) === dayIso);
    if (subset.length === 0) {
      alert(`No attendance records for ${dayIso}.`);
      return;
    }
    const ok = await writeAttendanceXlsx(subset, `day-${dayIso}`);
    if (ok) setDayExportOpen(false);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const recByUser: Record<number, AttendanceRecord[]> = {};
  records.forEach(r => {
    if (!recByUser[r.user_id]) recByUser[r.user_id] = [];
    recByUser[r.user_id].push(r);
  });

  // Enrich known employees
  const enriched: EnrichedEmp[] = employees.map(e => {
    const recs = (recByUser[e.id] || []).sort(
      (a, b) => new Date(b.clock_in_at || 0).getTime() - new Date(a.clock_in_at || 0).getTime(),
    );
    return { ...e, recs, pending: recs.filter(r => recStatus(r) === 'pending').length };
  });

  // Catch records for users not in the employee list (e.g. deactivated)
  const empIds = new Set(employees.map(e => e.id));
  const extras: EnrichedEmp[] = [];
  Object.entries(recByUser).forEach(([uid, recs]) => {
    const id = parseInt(uid, 10);
    if (!empIds.has(id)) {
      const first = recs[0];
      const sorted = [...recs].sort(
        (a, b) => new Date(b.clock_in_at || 0).getTime() - new Date(a.clock_in_at || 0).getTime(),
      );
      extras.push({
        id,
        name:    first.employee_name  || `User #${id}`,
        email:   first.employee_email || '',
        role:    first.employee_role  || 'employee',
        recs:    sorted,
        pending: sorted.filter(r => recStatus(r) === 'pending').length,
      });
    }
  });

  const allEmployees = [...enriched, ...extras].sort((a, b) => b.pending - a.pending);

  const effectiveSearch = useEffectiveSearch(search);
  const filteredEmployees = effectiveSearch
    ? allEmployees.filter(e =>
        e.name.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(effectiveSearch.toLowerCase()),
      )
    : allEmployees;

  const selectedEmp  = selectedId !== null ? allEmployees.find(e => e.id === selectedId) ?? null : null;
  const selectedRecs = selectedEmp?.recs || [];
  const displayRecs  = filter === 'all'
    ? selectedRecs
    : selectedRecs.filter(r => recStatus(r) === filter);

  // Global stats
  const pendingTotal  = records.filter(r => recStatus(r) === 'pending').length;
  const approvedTotal = records.filter(r => recStatus(r) === 'approved').length;
  const rejectedTotal = records.filter(r => recStatus(r) === 'rejected').length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-4 lg:p-7">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold text-white">Attendance Management</div>
          <div className="text-zinc-400 text-sm mt-1">
            {selectedEmp
              ? `Viewing ${selectedEmp.name}'s attendance log`
              : 'Click an employee to view and manage their attendance records'}
          </div>
        </div>
        <div className="flex gap-2.5 flex-wrap items-center flex-shrink-0 justify-end">
          <button
            type="button"
            className="bg-transparent text-green-50 font-bold text-sm py-[11px] px-[18px] rounded-xl cursor-pointer border-2 border-green-200/60 hover:bg-green-500/15 hover:border-green-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || exporting || records.length === 0}
            onClick={() => {
              setExportDay(d => d ?? startOfToday());
              setDayExportOpen(true);
            }}
          >
            Pick date
          </button>
          <button
            type="button"
            className="bg-green-700 text-green-50 border-2 border-green-400 font-bold text-sm py-2 px-4 rounded-lg cursor-pointer transition-all duration-150 hover:bg-green-600 hover:border-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || exporting || records.length === 0}
            onClick={() => void exportAttendanceXlsx()}
          >
            {exporting ? 'Working…' : 'Excel (.xlsx)'}
          </button>
          <button
            type="button"
            className="bg-transparent text-zinc-400 border border-zinc-800 rounded-lg py-[7px] px-3.5 text-xs font-medium cursor-pointer transition-all duration-150 hover:border-zinc-500 hover:text-zinc-200"
            onClick={loadData}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 mb-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-[26px] font-bold text-cyan-400 mb-0.5">{records.length}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Total Records</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-[26px] font-bold text-amber-400 mb-0.5">{pendingTotal}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Pending Review</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-[26px] font-bold text-green-500 mb-0.5">{approvedTotal}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Approved</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-[26px] font-bold text-red-500 mb-0.5">{rejectedTotal}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Rejected</div>
        </div>
      </div>

      {/* Full-width Excel export — impossible to miss vs header-only */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3.5 bg-gradient-to-br from-green-500/10 to-green-600/10 border-2 border-green-400/40 rounded-2xl p-4 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex flex-col gap-[5px] max-w-[520px]">
              <strong className="text-green-100 text-[15px] font-bold">Export attendance to Excel</strong>
              <span className="text-green-200 text-xs opacity-90 leading-[1.35]">
                Full download: every loaded row. Day download: pick one calendar date — only rows whose
                attendance <strong>date</strong> matches (same columns: Name, Date, times, network, status, IP,
                notes). Data is what you already loaded ({records.length} rows).
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 items-center">
              <button
                type="button"
                className="bg-transparent text-green-50 font-bold text-sm py-[11px] px-[18px] rounded-xl cursor-pointer border-2 border-green-200/60 hover:bg-green-500/15 hover:border-green-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={exporting || records.length === 0}
                onClick={() => {
                  setExportDay(d => d ?? startOfToday());
                  setDayExportOpen(true);
                }}
              >
                Pick date &amp; download
              </button>
              <button
                type="button"
                className="bg-green-500 text-green-950 font-extrabold border-0 py-[11px] px-[22px] text-sm rounded-xl cursor-pointer tracking-[0.02em] hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-green-800 disabled:text-green-200"
                disabled={exporting || records.length === 0}
                onClick={() => void exportAttendanceXlsx()}
              >
                {exporting ? 'Building file…' : 'Download all (.xlsx)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {loading ? (
        <div className="text-center py-12 px-5 text-zinc-500 text-sm">Loading attendance data…</div>
      ) : selectedId === null ? (

        // ════════════════════════════ EMPLOYEE LIST ════════════════════════════
        <div>
          <div className="flex items-center justify-between gap-2.5 mb-3.5 flex-wrap">
            <div className="text-[15px] font-semibold text-white">All Employees ({filteredEmployees.length})</div>
            <input
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-zinc-200 text-sm outline-none min-w-[180px] focus:border-indigo-500"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 px-5 text-zinc-600 text-sm">No employees found.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
              {filteredEmployees.map(emp => (
                <div
                  key={emp.id}
                  className={`bg-zinc-900 border rounded-2xl p-[18px] cursor-pointer transition-all duration-200 flex flex-col relative hover:-translate-y-0.5 ${
                    emp.pending > 0
                      ? 'border-amber-400/35 hover:border-amber-400/65 hover:shadow-[0_8px_24px_rgba(251,191,36,0.1)]'
                      : 'border-zinc-800 hover:border-indigo-500 hover:shadow-[0_8px_24px_rgba(99,102,241,0.15)]'
                  }`}
                  onClick={() => { setSelectedId(emp.id); setFilter('all'); }}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[15px] font-bold text-white mb-3">
                    {getInitials(emp.name)}
                  </div>
                  <div className="text-[15px] font-semibold text-white mb-0.5">{emp.name}</div>
                  <div className="text-xs text-zinc-400 mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{emp.email}</div>
                  <span className="inline-block text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5">{emp.role}</span>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/50">
                    {emp.pending > 0
                      ? <span className="bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded-full text-[11px] font-semibold px-2.5 py-0.5">● {emp.pending} pending</span>
                      : emp.recs.length > 0
                        ? <span className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-[11px] px-2.5 py-0.5">{emp.recs.length} record{emp.recs.length !== 1 ? 's' : ''}</span>
                        : <span className="bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 rounded-full text-[11px] px-2.5 py-0.5">No records yet</span>
                    }
                    <span className="text-zinc-600 text-base">›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : !selectedEmp ? (
        <div className="text-center py-12 px-5 text-zinc-600 text-sm">Employee not found.</div>
      ) : (

        // ═══════════════════════════ EMPLOYEE DETAIL ══════════════════════════
        <div>
          <button
            className="inline-flex items-center gap-1.5 text-zinc-400 text-sm cursor-pointer bg-transparent border-0 py-1.5 px-0 mb-4 hover:text-zinc-200 transition-colors duration-150"
            onClick={() => setSelectedId(null)}
          >
            All Employees
          </button>

          {/* Employee header card */}
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4 flex-wrap">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {getInitials(selectedEmp.name)}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{selectedEmp.name}</div>
              <div className="text-sm text-zinc-400 mt-0.5">
                {selectedEmp.email}
                {' · '}
                <span className="text-indigo-300">{selectedEmp.role}</span>
              </div>
            </div>
            <div className="flex gap-5 ml-auto flex-wrap">
              <div className="text-center">
                <div className="text-xl font-bold text-zinc-200">{selectedRecs.length}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">
                  {selectedRecs.filter(r => recStatus(r) === 'pending').length}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-500">
                  {selectedRecs.filter(r => recStatus(r) === 'approved').length}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-500">
                  {selectedRecs.filter(r => recStatus(r) === 'rejected').length}
                </div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">Rejected</div>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
              const count = f === 'all'
                ? selectedRecs.length
                : selectedRecs.filter(r => recStatus(r) === f).length;
              return (
                <button
                  key={f}
                  className={`flex-1 py-[7px] px-2 border-0 text-xs rounded-lg cursor-pointer transition-all duration-150 text-center font-medium ${
                    filter === f
                      ? 'bg-zinc-800 text-zinc-200 font-semibold'
                      : 'bg-transparent text-zinc-400 hover:text-zinc-300'
                  }`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Attendance records */}
          {displayRecs.length === 0 ? (
            <div className="text-center py-12 px-5 text-zinc-600 text-sm">
              No {filter === 'all' ? '' : filter + ' '}records for this employee.
            </div>
          ) : (
            displayRecs.map(r => {
              const s             = recStatus(r);
              const isOffNetwork  = !r.network_verified;
              const needsTrail    = isOffNetwork && s === 'pending';
              return (
                <div
                  key={r.id}
                  className={`bg-zinc-900 border border-zinc-800 border-l-[3px] rounded-xl p-4 mb-2.5 transition-colors duration-150 ${
                    s === 'approved' ? 'border-l-green-500' :
                    s === 'pending'  ? 'border-l-amber-400' :
                    s === 'rejected' ? 'border-l-red-500'   :
                    'border-l-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5 mb-3 flex-wrap">
                    <div className="text-sm font-semibold text-white">{fmtDate(r.date)}</div>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {r.network_verified ? (
                        <span className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border bg-green-500/10 text-green-300 border-green-500/20">
                          Office Network
                        </span>
                      ) : (
                        <span className="inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border bg-amber-400/10 text-amber-200 border-amber-400/20">
                          Outside Network
                        </span>
                      )}
                      <span className={`inline-block px-[9px] py-[3px] rounded-md text-[11px] font-medium border ${
                        s === 'pending'  ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                        s === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/25' :
                        'bg-red-500/10 text-red-500 border-red-500/25'
                      }`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                        {r.network_verified && s === 'approved' && (
                          <span style={{ marginLeft: 4, fontSize: 10, opacity: .75 }}>· auto</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.5px] mb-[3px]">Clock In</label>
                      <span className="text-sm text-zinc-200">{fmtTime(r.clock_in_at)}</span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.5px] mb-[3px]">Clock Out</label>
                      <span className="text-sm text-zinc-200">{fmtTime(r.clock_out_at)}</span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase tracking-[0.5px] mb-[3px]">Duration</label>
                      <span className="text-sm text-zinc-200">{fmtDuration(r.duration_seconds)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center pt-3 border-t border-zinc-800/50">
                    {s !== 'approved' && (
                      <button
                        className="py-[7px] px-3.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 bg-green-500/15 text-green-500 border border-green-500/30 hover:bg-green-500/25"
                        onClick={() => handleApprove(r.id, true)}
                      >
                        Approve
                      </button>
                    )}
                    {s !== 'rejected' && (
                      <button
                        className="py-[7px] px-3.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25"
                        onClick={() => handleApprove(r.id, false)}
                      >
                        Reject
                      </button>
                    )}
                    <a
                      className={`no-underline inline-flex items-center gap-[5px] py-[7px] px-3.5 rounded-lg text-xs transition-all duration-150 ${
                        needsTrail
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/45 font-semibold hover:bg-indigo-500/30'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 font-medium hover:bg-indigo-500/20'
                      }`}
                      href={`/admin/sales-location?userId=${r.user_id}&date=${(r.date || '').slice(0, 10)}`}
                    >
                      View Location Trail
                    </a>
                    {r.clock_in_ip && (
                      <span className="text-[10px] text-zinc-600 ml-auto">IP: {r.clock_in_ip}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Dialog open={dayExportOpen} onOpenChange={setDayExportOpen}>
        <DialogContent className="max-w-md border border-border bg-[hsl(var(--card))] text-foreground shadow-xl">
          <DialogHeader>
            <DialogTitle>Download one day</DialogTitle>
            <DialogDescription>
              Choose a date in the calendar. The Excel file lists only rows whose attendance date matches
              that day (same columns as the full export).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-lg border border-border/50 bg-muted/20 py-2">
            <Calendar
              mode="single"
              selected={exportDay}
              onSelect={setExportDay}
              defaultMonth={exportDay ?? new Date()}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDayExportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!exportDay || exporting || records.length === 0}
              onClick={() => void runDayExport()}
            >
              {exporting ? 'Working…' : 'Download .xlsx'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
