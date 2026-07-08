'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@/types/api';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
type TaskStatus     = 'Just Assigned' | 'Under Process' | 'Completed';

const TASK_STATUSES: TaskStatus[]     = ['Just Assigned', 'Under Process', 'Completed'];
const APPROVAL_FILTERS                = ['All', 'Pending', 'Approved', 'Rejected'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function tok() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}
function hdr(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${tok()}`, ...extra };
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Style helpers ────────────────────────────────────────────────────────────
function approvalBadge(s: string): React.CSSProperties {
  if (s === 'Approved') return { background: 'rgba(34,197,94,.13)', color: '#22c55e', borderColor: 'rgba(34,197,94,.3)' };
  if (s === 'Rejected') return { background: 'rgba(239,68,68,.12)', color: '#ef4444', borderColor: 'rgba(239,68,68,.28)' };
  return                       { background: 'rgba(251,191,36,.12)', color: '#fbbf24', borderColor: 'rgba(251,191,36,.28)' };
}
function taskBadge(s: string): React.CSSProperties {
  if (s === 'Completed')     return { background: 'rgba(34,197,94,.1)',  color: '#22c55e', borderColor: 'rgba(34,197,94,.25)' };
  if (s === 'Under Process') return { background: 'rgba(251,191,36,.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,.25)' };
  return                            { background: 'rgba(96,165,250,.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,.25)' };
}

// ─── Component ────────────────────────────────────────────────────────────────
type TaskHistoryEntry = {
  id?: number;
  edited_by_name?: string;
  edited_at?: string;
  created_at?: string;
  status?: string;
  description?: string;
  old_description?: string;
  new_description?: string;
  old_status?: string;
  new_status?: string;
};

export default function AdminTaskManagerPage() {
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [approvalFilter,setApprovalFilter]= useState<string>('All');
  const [acting,        setActing]        = useState<number | null>(null);

  // History modal
  const [histTask,      setHistTask]      = useState<Task | null>(null);
  const [history,       setHistory]       = useState<TaskHistoryEntry[]>([]);
  const [histLoading,   setHistLoading]   = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);

  function showToast(msg: string, type = 'success') {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/tasks?limit=500`, { headers: hdr() });
      if (r.ok) { const j = await r.json(); setTasks(j.tasks || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Approve / Reject ───────────────────────────────────────────────────────
  async function setApproval(taskId: number, approval_status: ApprovalStatus) {
    setActing(taskId);
    try {
      const r = await fetch(`${API}/api/v1/tasks/${taskId}/approval`, {
        method: 'PATCH',
        headers: hdr({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ approval_status }),
      });
      if (r.ok) {
        showToast(`Task ${approval_status.toLowerCase()} successfully`, 'success');
        await fetchTasks();
      } else {
        showToast('Action failed — please try again', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally { setActing(null); }
  }

  // ── History modal ──────────────────────────────────────────────────────────
  async function openHistory(task: Task) {
    setHistTask(task); setHistLoading(true); setHistory([]);
    try {
      const r = await fetch(`${API}/api/v1/tasks/${task.id}/history`, { headers: hdr() });
      if (r.ok) { const j = await r.json(); setHistory(j.history || []); }
    } finally { setHistLoading(false); }
  }

  // ── Stats (derived) ────────────────────────────────────────────────────────
  const stats = {
    total:    tasks.length,
    pending:  tasks.filter(t => t.approval_status === 'Pending').length,
    approved: tasks.filter(t => t.approval_status === 'Approved').length,
    rejected: tasks.filter(t => t.approval_status === 'Rejected').length,
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    if (approvalFilter !== 'All' && t.approval_status !== approvalFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.description      || '').toLowerCase().includes(q) ||
           (t.employee_name    || '').toLowerCase().includes(q) ||
           (t.employee_email   || '').toLowerCase().includes(q) ||
           (t.task_date        || '').includes(q);
  });

  return (
    <div className="font-sans min-h-screen bg-[#080a10] text-[#dde3f0] p-4 sm:p-6 lg:p-7">

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[clamp(20px,3vw,26px)] font-bold text-white">Admin Task Manager</div>
        <div className="text-[13px] text-zinc-500 mt-1">Review, approve and reject employee daily tasks</div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0e1118] border border-[#1e2236] rounded-xl p-4 px-5">
          <div className="text-[11px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Total Tasks</div>
          <div className="text-[28px] font-extrabold font-mono text-[#dde3f0]">{stats.total}</div>
        </div>
        <div className="bg-[#0e1118] border border-[#1e2236] rounded-xl p-4 px-5">
          <div className="text-[11px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Pending Review</div>
          <div className="text-[28px] font-extrabold font-mono text-amber-500">{stats.pending}</div>
        </div>
        <div className="bg-[#0e1118] border border-[#1e2236] rounded-xl p-4 px-5">
          <div className="text-[11px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Approved</div>
          <div className="text-[28px] font-extrabold font-mono text-green-500">{stats.approved}</div>
        </div>
        <div className="bg-[#0e1118] border border-[#1e2236] rounded-xl p-4 px-5">
          <div className="text-[11px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Rejected</div>
          <div className="text-[28px] font-extrabold font-mono text-red-500">{stats.rejected}</div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-[#0e1118] border border-[#1e2236] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2236] flex-wrap gap-3">
          <div>
            <div className="text-[15px] font-bold text-white">All Employee Tasks</div>
            <div className="text-[12px] text-[#4b5268] mt-0.5">
              {approvalFilter !== 'All'
                ? `${filtered.length} ${approvalFilter.toLowerCase()} tasks`
                : `${filtered.length} of ${tasks.length} tasks`}
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <input
              className="w-[220px] bg-[#141720] border border-[#1e2236] rounded-lg px-3 py-2 text-[#dde3f0] text-[13px] outline-none focus:border-[#00c9b1] placeholder-[#4b5268] transition-colors"
              placeholder="Search employee, task…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="cursor-pointer min-w-[140px] bg-[#141720] border border-[#1e2236] rounded-lg px-3 py-2 text-[#dde3f0] text-[13px] outline-none focus:border-[#00c9b1] transition-colors"
              value={approvalFilter}
              onChange={e => setApprovalFilter(e.target.value)}
            >
              {APPROVAL_FILTERS.map(f => (
                <option key={f} value={f}>{f === 'All' ? 'All Statuses' : f}</option>
              ))}
            </select>
            <button
              className="px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed bg-transparent text-[#8b93a8] border border-[#1e2236] hover:border-[#2c2f42] hover:text-[#dde3f0]"
              onClick={fetchTasks}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-14 px-5 text-[#4b5268] text-[14px]">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 px-5 text-[#4b5268] text-[14px]">
              {search || approvalFilter !== 'All'
                ? 'No tasks match your filters.'
                : 'No tasks submitted yet.'}
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#141720] border-b border-[#1e2236]">
                  {['#', 'Date', 'Employee', 'Task Description', 'Task Status', 'Approval', 'Reviewed By', 'Submitted', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[#4b5268] text-[10.5px] font-semibold uppercase tracking-[0.9px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const isActing = acting === t.id;
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.018]">
                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px] text-[#4b5268] text-[12px] font-mono">
                        {String(i + 1).padStart(2, '0')}
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px] text-[#8b93a8] text-[12px] font-mono whitespace-nowrap">
                        {fmtDate(t.task_date)}
                        {t.task_date === todayISO() && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-[rgba(0,201,177,0.12)] text-[#00c9b1] rounded border border-[rgba(0,201,177,0.25)]">
                            TODAY
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        <div className="font-semibold text-[#dde3f0]">{t.employee_name || '—'}</div>
                        <div className="text-[11px] text-[#4b5268] mt-0.5">{t.employee_email || ''}</div>
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        <div className="text-[#c9cfe0] whitespace-pre-wrap break-words max-w-[280px]">{t.description}</div>
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap" style={taskBadge(t.status)}>{t.status}</span>
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap" style={approvalBadge(t.approval_status ?? '')}>
                          {t.approval_status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        {t.approved_by_name ? (
                          <>
                            <div className="text-[12px] text-[#dde3f0]">{t.approved_by_name}</div>
                            <div className="text-[11px] text-[#4b5268]">{t.approved_at ? fmtTs(t.approved_at) : ''}</div>
                          </>
                        ) : (
                          <span className="text-[#4b5268] text-[12px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px] text-[#8b93a8] text-[12px] font-mono whitespace-nowrap">
                        {fmtTs(t.created_at ?? '')}
                      </td>

                      <td className="px-4 py-3.5 border-b border-[#141720] align-middle text-[13px]">
                        <div className="flex gap-[7px] items-center">
                          {t.approval_status !== 'Approved' && (
                            <button
                              className="px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed bg-green-500/[0.14] text-green-500 border border-green-500/[0.28] hover:bg-green-500/[0.22]"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Approved')}
                            >
                              {isActing ? '…' : 'Approve'}
                            </button>
                          )}
                          {t.approval_status !== 'Rejected' && (
                            <button
                              className="px-4 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed bg-red-500/[0.13] text-red-500 border border-red-500/[0.28] hover:bg-red-500/[0.22]"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Rejected')}
                            >
                              {isActing ? '…' : 'Reject'}
                            </button>
                          )}
                          {t.approval_status !== 'Pending' && (
                            <button
                              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed bg-amber-400/[0.12] text-amber-400 border border-amber-400/[0.28]"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Pending')}
                              title="Reset to Pending"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-opacity bg-violet-500/[0.12] text-violet-400 border border-violet-500/[0.25]"
                            onClick={() => openHistory(t)}
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── History Modal ── */}
      {histTask && (
        <div
          className="fixed inset-0 bg-black/[0.78] backdrop-blur-[5px] z-[200] flex items-start justify-center p-4 overflow-y-auto"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) setHistTask(null); }}
        >
          <div className="bg-[#0e1118] border border-[#1e2236] rounded-2xl p-6 w-full max-w-[600px] my-auto" role="dialog" aria-modal="true">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-[15px] font-bold text-white">Edit History</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">{fmtDate(histTask.task_date)} · {histTask.employee_name}</div>
              </div>
              <button
                onClick={() => setHistTask(null)}
                className="bg-transparent border-none text-zinc-500 cursor-pointer text-[17px] px-1.5 py-0.5"
              >Close</button>
            </div>

            {histLoading ? (
              <div className="text-center p-7 text-zinc-500">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-center p-7 text-[#4b5268] text-[14px]">
                No edits recorded for this task.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto flex flex-col gap-2.5">
                {history.map((h, idx) => (
                  <div key={h.id} className="bg-[#141720] border border-[#1e2236] rounded-xl px-4 py-3.5">
                    <div className="flex justify-between mb-2.5">
                      <span className="text-[12px] text-[#8b93a8]">
                        Edit #{history.length - idx} by{' '}
                        <strong className="text-[#dde3f0]">{h.edited_by_name || 'Unknown'}</strong>
                      </span>
                      <span className="text-[11px] text-[#4b5268]">{h.edited_at ? fmtTs(h.edited_at) : '—'}</span>
                    </div>
                    {h.old_description !== h.new_description && (
                      <div className="mb-2">
                        <div className="text-[10px] text-[#4b5268] uppercase tracking-[0.8px] mb-1.5">Description</div>
                        <div className="text-[12px] text-red-500 bg-red-500/[0.07] px-2.5 py-1.5 rounded-md mb-1">
                          <span className="text-zinc-500">Before: </span>{h.old_description}
                        </div>
                        <div className="text-[12px] text-green-500 bg-green-500/[0.07] px-2.5 py-1.5 rounded-md">
                          <span className="text-zinc-500">After: </span>{h.new_description}
                        </div>
                      </div>
                    )}
                    {h.old_status !== h.new_status && (
                      <div>
                        <div className="text-[10px] text-[#4b5268] uppercase tracking-[0.8px] mb-1.5">Status</div>
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap" style={taskBadge(h.old_status ?? '')}>{h.old_status}</span>
                          <span className="text-[#4b5268]">→</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap" style={taskBadge(h.new_status ?? '')}>{h.new_status}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className="fixed bottom-5 right-5 z-[500] flex flex-col gap-2" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-[9px] text-[13px] font-semibold border max-w-[300px] ${
              t.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-500'
                : 'bg-red-500/10 border-red-500/30 text-red-500'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
