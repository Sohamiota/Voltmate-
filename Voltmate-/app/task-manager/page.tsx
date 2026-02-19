'use client'

import { useCallback, useEffect, useRef, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const STATUSES = ['Just Assigned', 'Under Process', 'Completed'] as const;
type Status = typeof STATUSES[number];

const STATUS_COLOR: Record<Status, string> = {
  'Just Assigned': 'bg-blue-500/12 text-blue-400 border-blue-500/25',
  'Under Process': 'bg-yellow-500/12 text-yellow-400 border-yellow-500/25',
  'Completed':     'bg-green-500/12 text-green-400 border-green-500/25',
};

function tok() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
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

export default function TaskManagerPage() {
  const [me,           setMe]           = useState<{ name: string; email: string } | null>(null);
  const [todayTask,    setTodayTask]    = useState<any>(null);
  const [tasks,        setTasks]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [description,  setDescription]  = useState('');
  const [status,       setStatus]       = useState<Status>('Just Assigned');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');

  // Edit modal
  const [editTask,     setEditTask]     = useState<any>(null);
  const [editDesc,     setEditDesc]     = useState('');
  const [editStatus,   setEditStatus]   = useState<Status>('Just Assigned');
  const [editSaving,   setEditSaving]   = useState(false);

  // History modal
  const [histTask,     setHistTask]     = useState<any>(null);
  const [history,      setHistory]      = useState<any[]>([]);
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
  async function handleStatusChange(task: any, newStatus: Status) {
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
    const r = await fetch(`${API}/api/v1/tasks/${editTask.id}`, {
      method: 'PATCH',
      headers: authHdr({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ description: editDesc.trim(), status: editStatus }),
    });
    if (r.ok) {
      setEditTask(null);
      await fetchList();
      if (editTask.task_date === todayISO()) await fetchToday();
    }
    setEditSaving(false);
  }

  // ── History modal ──────────────────────────────────────────────────────────
  async function openHistory(task: any) {
    setHistTask(task); setHistLoading(true); setHistory([]);
    const r = await fetch(`${API}/api/v1/tasks/${task.id}/history`, { headers: authHdr() });
    if (r.ok) { const j = await r.json(); setHistory(j.history || []); }
    setHistLoading(false);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.description || '').toLowerCase().includes(q) ||
           (t.task_date   || '').includes(q) ||
           (t.employee_name || '').toLowerCase().includes(q);
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: "'Inter',system-ui,sans-serif", padding: 'clamp(16px, 4vw, 28px) clamp(12px, 4vw, 24px)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Task Manager</div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {me ? `${me.name} · ${me.email} · ` : ''}{today}
        </div>
      </div>

      {/* ── Today's Task Card ── */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: '24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>
              {todayTask ? "Today's Task (already saved — you can update it)" : "Enter Today's Task"}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>One task entry per day. Saving again will update and log the edit.</div>
          </div>
          {todayTask && (
            <span style={{ padding: '3px 12px', borderRadius: 8, fontSize: 12, border: '1px solid', ...badgeInline(todayTask.status) }}>
              {todayTask.status}
            </span>
          )}
        </div>

        <textarea
          ref={textRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what you're working on today…"
          style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '12px 14px', color: '#e5e5e5', fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
          onFocus={e => (e.target.style.borderColor = '#00d9ff')}
          onBlur={e => (e.target.style.borderColor = '#333')}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
              style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 14px', color: '#e5e5e5', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 20, padding: '9px 24px', background: '#00d9ff', color: '#0a0a0a', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : todayTask ? 'Update Task' : 'Save Task'}
          </button>
        </div>

        {successMsg && <div style={{ marginTop: 12, color: '#22c55e', fontSize: 13 }}>{successMsg}</div>}
        {errorMsg   && <div style={{ marginTop: 12, color: '#ef4444', fontSize: 13 }}>{errorMsg}</div>}
      </div>

      {/* ── Task History Table ── */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #2a2a2a', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>Task History</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '7px 13px', color: '#e5e5e5', fontSize: 13, outline: 'none', width: 200 }}
              onFocus={e => (e.target.style.borderColor = '#00d9ff')}
              onBlur={e => (e.target.style.borderColor = '#333')}
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '7px 13px', color: '#e5e5e5', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={fetchAll}
              disabled={loading}
              style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#6b7280' }}>Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#6b7280' }}>No tasks found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  {['#', 'Date', 'Employee', 'Task Description', 'Status', 'Last Updated', 'Edits', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#9ca3af', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1f1f1f', transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1f1f1f')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtDate(t.task_date)}
                      {t.task_date === todayISO() && (
                        <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: 'rgba(0,217,255,.12)', color: '#00d9ff', borderRadius: 4, border: '1px solid rgba(0,217,255,.25)' }}>TODAY</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: '#fff' }}>{t.employee_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{t.employee_email || ''}</div>
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                      <div style={{ fontSize: 13, color: '#e5e5e5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.description}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {/* Inline status dropdown */}
                      <select
                        value={t.status}
                        onChange={e => handleStatusChange(t, e.target.value as Status)}
                        style={{
                          background: 'transparent',
                          border: '1px solid',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          outline: 'none',
                          ...selectInline(t.status),
                        }}
                      >
                        {STATUSES.map(s => <option key={s} value={s} style={{ background: '#1a1a1a', color: '#e5e5e5' }}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {fmtTs(t.updated_at || t.created_at)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => openHistory(t)}
                        style={{ padding: '4px 12px', background: 'rgba(124,58,237,.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,.25)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                      >
                        History
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => { setEditTask(t); setEditDesc(t.description); setEditStatus(t.status as Status); }}
                        style={{ padding: '4px 14px', background: 'rgba(0,217,255,.12)', color: '#00d9ff', border: '1px solid rgba(0,217,255,.25)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
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
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setEditTask(null)}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Edit Task</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{fmtDate(editTask.task_date)} · {editTask.employee_name}</div>
              </div>
              <button onClick={() => setEditTask(null)} style={closeBtnStyle}>✕</button>
            </div>

            <label style={labelStyle}>Task Description</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' as const }}
              onFocus={e => (e.target.style.borderColor = '#00d9ff')}
              onBlur={e => (e.target.style.borderColor = '#333')}
            />

            <label style={{ ...labelStyle, marginTop: 14 }}>Status</label>
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as Status)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditTask(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleEditSave} disabled={editSaving} style={saveBtnStyle}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ── */}
      {histTask && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setHistTask(null)}>
          <div style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Edit History</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{fmtDate(histTask.task_date)} · {histTask.employee_name}</div>
              </div>
              <button onClick={() => setHistTask(null)} style={closeBtnStyle}>✕</button>
            </div>

            {histLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#6b7280', fontSize: 14 }}>No edits recorded for this task.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Edit #{history.length - i} by <strong style={{ color: '#e5e5e5' }}>{h.edited_by_name || 'Unknown'}</strong></span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{fmtTs(h.edited_at)}</span>
                    </div>
                    {h.old_description !== h.new_description && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                        <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.06)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ color: '#6b7280' }}>Before: </span>{h.old_description}
                        </div>
                        <div style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,.06)', padding: '6px 10px', borderRadius: 6 }}>
                          <span style={{ color: '#6b7280' }}>After: </span>{h.new_description}
                        </div>
                      </div>
                    )}
                    {h.old_status !== h.new_status && (
                      <div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid', ...badgeInline(h.old_status) }}>{h.old_status}</span>
                          <span style={{ color: '#6b7280' }}>→</span>
                          <span style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid', ...badgeInline(h.new_status) }}>{h.new_status}</span>
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

// ── Style helpers ─────────────────────────────────────────────────────────────

function badgeInline(s: string) {
  if (s === 'Completed')     return { background: 'rgba(34,197,94,.12)',  color: '#22c55e',  borderColor: 'rgba(34,197,94,.25)' };
  if (s === 'Under Process') return { background: 'rgba(251,191,36,.12)', color: '#fbbf24',  borderColor: 'rgba(251,191,36,.25)' };
  return                            { background: 'rgba(96,165,250,.12)', color: '#60a5fa',  borderColor: 'rgba(96,165,250,.25)' };
}

function selectInline(s: string) {
  if (s === 'Completed')     return { borderColor: 'rgba(34,197,94,.4)',  color: '#22c55e'  };
  if (s === 'Under Process') return { borderColor: 'rgba(251,191,36,.4)', color: '#fbbf24' };
  return                            { borderColor: 'rgba(96,165,250,.4)', color: '#60a5fa' };
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 100,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '16px', overflowY: 'auto',
};
const modalStyle: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14,
  padding: '20px', width: '100%', maxWidth: 520, position: 'relative',
  marginTop: 'auto', marginBottom: 'auto',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#9ca3af',
  cursor: 'pointer', fontSize: 16, padding: '4px 8px',
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#111', border: '1px solid #333',
  borderRadius: 8, padding: '10px 13px', color: '#e5e5e5', fontSize: 13,
  outline: 'none', boxSizing: 'border-box' as const,
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 20px', background: 'transparent', border: '1px solid #374151',
  borderRadius: 8, color: '#9ca3af', fontSize: 13, cursor: 'pointer',
};
const saveBtnStyle: React.CSSProperties = {
  padding: '9px 24px', background: '#00d9ff', border: 'none',
  borderRadius: 8, color: '#0a0a0a', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
