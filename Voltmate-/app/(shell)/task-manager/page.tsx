'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@/types/api';
import { useEffectiveSearch } from '@/components/SearchContext';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const STATUSES = ['Just Assigned', 'Under Process', 'Completed'] as const;
type Status = typeof STATUSES[number];

function badgeClass(s: string): string {
  if (s === 'Completed')     return 'bg-green-500/[.12] text-green-500 border-green-500/25';
  if (s === 'Under Process') return 'bg-amber-400/[.12] text-amber-400 border-amber-400/25';
  return                            'bg-blue-400/[.12] text-blue-400 border-blue-400/25';
}

function approvalClass(s: string): string {
  if (s === 'Approved') return 'bg-green-500/[.13] text-green-500 border-green-500/30';
  if (s === 'Rejected') return 'bg-red-500/[.12] text-red-500 border-red-500/[.28]';
  return                       'bg-amber-400/[.12] text-amber-400 border-amber-400/[.28]';
}

function selectClass(s: string): string {
  if (s === 'Completed')     return 'border-green-500/40 text-green-500';
  if (s === 'Under Process') return 'border-amber-400/40 text-amber-400';
  return                            'border-blue-400/40 text-blue-400';
}

function tok() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}
function authHdr(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${tok()}`, ...extra };
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────

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

export default function TaskManagerPage() {
  const [me,           setMe]           = useState<{ name: string; email: string } | null>(null);
  const [todayTask,    setTodayTask]    = useState<Task | null>(null);
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [description,  setDescription]  = useState('');
  const [status,       setStatus]       = useState<Status>('Just Assigned');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');

  // Edit modal
  const [editTask,     setEditTask]     = useState<Task | null>(null);
  const [editDesc,     setEditDesc]     = useState('');
  const [editStatus,   setEditStatus]   = useState<Status>('Just Assigned');
  const [editSaving,   setEditSaving]   = useState(false);

  // History modal
  const [histTask,     setHistTask]     = useState<Task | null>(null);
  const [history,      setHistory]      = useState<TaskHistoryEntry[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    const r = await fetch(`${API}/api/v1/auth/me`, { headers: authHdr() });
    if (r.ok) { const j = await r.json(); setMe({ name: j.user?.name || '', email: j.user?.email || '' }); }
  }, []);

  const fetchToday = useCallback(async () => {
    const r = await fetch(`${API}/api/v1/tasks/today`, { headers: authHdr() });
    if (r.status === 204) { setTodayTask(null); return; }
    if (r.ok) {
      const t = await r.json();
      setTodayTask(t);
      setDescription(t.description);
      setStatus(t.status as Status);
    }
  }, []);

  const fetchList = useCallback(async () => {
    const r = await fetch(`${API}/api/v1/tasks?limit=200`, { headers: authHdr() });
    if (r.ok) { const j = await r.json(); setTasks(j.tasks || []); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchMe(), fetchToday(), fetchList()]);
    setLoading(false);
  }, [fetchMe, fetchToday, fetchList]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Save today's task ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!description.trim()) { setErrorMsg('Please enter a task description.'); return; }
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    const r = await fetch(`${API}/api/v1/tasks`, {
      method: 'POST',
      headers: authHdr({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ description: description.trim(), status }),
    });
    if (r.ok) {
      const t = await r.json();
      setTodayTask(t);
      setSuccessMsg(t.updated ? 'Task updated successfully.' : 'Task saved for today.');
      await fetchList();
    } else {
      setErrorMsg('Failed to save task: ' + await r.text());
    }
    setSaving(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  // ── Inline status change from table ───────────────────────────────────────
  async function handleStatusChange(task: Task, newStatus: Status) {
    const r = await fetch(`${API}/api/v1/tasks/${task.id}`, {
      method: 'PATCH',
      headers: authHdr({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: newStatus }),
    });
    if (r.ok) {
      await fetchList();
      if (task.task_date === todayISO()) await fetchToday();
    }
  }

  // ── Edit modal save ────────────────────────────────────────────────────────
  async function handleEditSave() {
    if (!editDesc.trim()) return;
    setEditSaving(true);
    const r = await fetch(`${API}/api/v1/tasks/${editTask!.id}`, {
      method: 'PATCH',
      headers: authHdr({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ description: editDesc.trim(), status: editStatus }),
    });
    if (r.ok) {
      setEditTask(null);
      await fetchList();
      if (editTask!.task_date === todayISO()) await fetchToday();
    }
    setEditSaving(false);
  }

  // ── History modal ──────────────────────────────────────────────────────────
  async function openHistory(task: Task) {
    setHistTask(task); setHistLoading(true); setHistory([]);
    const r = await fetch(`${API}/api/v1/tasks/${task.id}/history`, { headers: authHdr() });
    if (r.ok) { const j = await r.json(); setHistory(j.history || []); }
    setHistLoading(false);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const effectiveSearch = useEffectiveSearch(search);
  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (!effectiveSearch) return true;
    const q = effectiveSearch.toLowerCase();
    return (t.description || '').toLowerCase().includes(q) ||
           (t.task_date   || '').includes(q) ||
           (t.employee_name || '').toLowerCase().includes(q);
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans p-4 sm:p-6 lg:p-7">

      {/* ── Header ── */}
      <div className="mb-7">
        <div className="text-[26px] font-bold text-white mb-1">Task Manager</div>
        <div className="text-[13px] text-zinc-400">
          {me ? `${me.name} · ${me.email} · ` : ''}{today}
        </div>
      </div>

      {/* ── Today's Task Card ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] p-6 mb-7">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
          <div>
            <div className="font-semibold text-[15px] text-white">
              {todayTask ? "Today's Task (already saved — you can update it)" : "Enter Today's Task"}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">One task entry per day. Saving again will update and log the edit.</div>
          </div>
          {todayTask && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className={`px-3 py-0.5 rounded-lg text-xs border ${badgeClass(todayTask.status)}`}>
                {todayTask.status}
              </span>
              <span className={`px-3 py-0.5 rounded-lg text-xs border font-semibold ${approvalClass(todayTask.approval_status || 'Pending')}`}>
                {todayTask.approval_status || 'Pending'}
              </span>
            </div>
          )}
        </div>

        <textarea
          ref={textRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what you're working on today…"
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3.5 py-3 text-zinc-200 text-sm resize-y outline-none leading-relaxed box-border focus:border-cyan-400 transition-colors"
        />

        <div className="flex gap-3 mt-3.5 flex-wrap items-center">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
              className="bg-[#111] border border-[#333] rounded-lg py-2 px-3.5 text-zinc-200 text-[13px] outline-none cursor-pointer"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`mt-5 px-6 py-2.5 bg-cyan-400 text-zinc-950 border-none rounded-lg font-semibold text-sm ${saving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            {saving ? 'Saving…' : todayTask ? 'Update Task' : 'Save Task'}
          </button>
        </div>

        {successMsg && <div className="mt-3 text-green-500 text-[13px]">{successMsg}</div>}
        {errorMsg   && <div className="mt-3 text-red-500 text-[13px]">{errorMsg}</div>}
      </div>

      {/* ── Task History Table ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] overflow-hidden">
        <div className="flex justify-between items-center px-6 py-[18px] border-b border-zinc-800 flex-wrap gap-3">
          <div className="font-semibold text-[15px] text-white">Task History</div>
          <div className="flex gap-2.5 flex-wrap">
            <input
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#111] border border-[#333] rounded-lg py-1.5 px-3 text-zinc-200 text-[13px] outline-none w-[200px] focus:border-cyan-400 transition-colors"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#111] border border-[#333] rounded-lg py-1.5 px-3 text-zinc-200 text-[13px] outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="py-1.5 px-4 bg-transparent border border-[#333] rounded-lg text-zinc-400 text-[13px] cursor-pointer"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-[50px] px-5 text-zinc-500">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-[50px] px-5 text-zinc-500">No tasks found.</div>
          ) : (
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['#', 'Date', 'Employee', 'Task Description', 'Status', 'Approval', 'Last Updated', 'Edits', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-[11px] text-left text-zinc-400 text-[11px] font-medium uppercase tracking-[0.5px] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className="border-b border-[#1f1f1f] transition-colors duration-[120ms] hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3.5 text-zinc-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-[13px] whitespace-nowrap">
                      {fmtDate(t.task_date)}
                      {t.task_date === todayISO() && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-cyan-400/[.12] text-cyan-400 rounded border border-cyan-400/25">TODAY</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[13px] text-white">{t.employee_name || '—'}</div>
                      <div className="text-[11px] text-zinc-500">{t.employee_email || ''}</div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="text-[13px] text-zinc-200 whitespace-pre-wrap break-words">{t.description}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {/* Inline status dropdown */}
                      <select
                        value={t.status}
                        onChange={e => handleStatusChange(t, e.target.value as Status)}
                        className={`bg-transparent border rounded-md px-2 py-0.5 text-xs cursor-pointer outline-none ${selectClass(t.status)}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s} className="bg-zinc-900 text-zinc-200">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${approvalClass(t.approval_status || 'Pending')}`}>
                        {t.approval_status || 'Pending'}
                      </span>
                      {t.approved_by_name && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">by {t.approved_by_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-400 whitespace-nowrap">
                      {fmtTs(t.updated_at || t.created_at || '')}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => openHistory(t)}
                        className="px-3 py-1 bg-violet-600/[.12] text-violet-400 border border-violet-600/25 rounded-md text-xs cursor-pointer"
                      >
                        History
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => { setEditTask(t); setEditDesc(t.description); setEditStatus(t.status as Status); }}
                        className="px-3.5 py-1 bg-cyan-400/[.12] text-cyan-400 border border-cyan-400/25 rounded-md text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editTask && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setEditTask(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] p-5 w-full max-w-[520px] relative my-auto">
            <div className="flex justify-between items-center mb-[18px]">
              <div>
                <div className="font-bold text-base text-white">Edit Task</div>
                <div className="text-xs text-zinc-400 mt-0.5">{fmtDate(editTask.task_date)} · {editTask.employee_name}</div>
              </div>
              <button onClick={() => setEditTask(null)} className="bg-transparent border-none text-zinc-400 cursor-pointer text-base px-2 py-1">Close</button>
            </div>

            <label className="text-xs text-zinc-400 block mb-1.5">Task Description</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={5}
              className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 px-3 text-zinc-200 text-[13px] outline-none box-border resize-y focus:border-cyan-400 transition-colors"
            />

            <label className="text-xs text-zinc-400 block mb-1.5 mt-3.5">Status</label>
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as Status)}
              className="w-full bg-[#111] border border-[#333] rounded-lg py-2.5 px-3 text-zinc-200 text-[13px] outline-none box-border cursor-pointer"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div className="flex gap-2.5 mt-5 justify-end">
              <button onClick={() => setEditTask(null)} className="py-2.5 px-5 bg-transparent border border-[#374151] rounded-lg text-zinc-400 text-[13px] cursor-pointer">Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} className="py-2.5 px-6 bg-cyan-400 border-none rounded-lg text-zinc-950 font-semibold text-[13px] cursor-pointer">
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ── */}
      {histTask && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-start justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setHistTask(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] p-5 w-full max-w-[640px] relative my-auto">
            <div className="flex justify-between items-center mb-[18px]">
              <div>
                <div className="font-bold text-base text-white">Edit History</div>
                <div className="text-xs text-zinc-400 mt-0.5">{fmtDate(histTask.task_date)} · {histTask.employee_name}</div>
              </div>
              <button onClick={() => setHistTask(null)} className="bg-transparent border-none text-zinc-400 cursor-pointer text-base px-2 py-1">Close</button>
            </div>

            {histLoading ? (
              <div className="text-center p-[30px] text-zinc-400">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-center p-[30px] text-zinc-500 text-sm">No edits recorded for this task.</div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={h.id} className="bg-[#111] border border-zinc-800 rounded-[10px] px-4 py-3.5">
                    <div className="flex justify-between mb-2.5">
                      <span className="text-xs text-zinc-400">Edit #{history.length - i} by <strong className="text-zinc-200">{h.edited_by_name || 'Unknown'}</strong></span>
                      <span className="text-[11px] text-zinc-500">{h.edited_at ? fmtTs(h.edited_at) : '—'}</span>
                    </div>
                    {h.old_description !== h.new_description && (
                      <div className="mb-2">
                        <div className="text-[11px] text-zinc-400 mb-1 uppercase tracking-[0.5px]">Description</div>
                        <div className="text-xs text-red-500 bg-red-500/[.06] px-2.5 py-1.5 rounded-md mb-1">
                          <span className="text-zinc-500">Before: </span>{h.old_description}
                        </div>
                        <div className="text-xs text-green-500 bg-green-500/[.06] px-2.5 py-1.5 rounded-md">
                          <span className="text-zinc-500">After: </span>{h.new_description}
                        </div>
                      </div>
                    )}
                    {h.old_status !== h.new_status && (
                      <div>
                        <div className="text-[11px] text-zinc-400 mb-1 uppercase tracking-[0.5px]">Status</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2.5 py-0.5 rounded-md border ${badgeClass(h.old_status ?? '')}`}>{h.old_status}</span>
                          <span className="text-zinc-500">→</span>
                          <span className={`px-2.5 py-0.5 rounded-md border ${badgeClass(h.new_status ?? '')}`}>{h.new_status}</span>
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
    </div>
  );
}
