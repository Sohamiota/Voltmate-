'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
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

// ─── Inline CSS ───────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .atm-root {
    min-height: 100vh;
    background: #080a10;
    color: #dde3f0;
    font-family: 'Inter', system-ui, sans-serif;
    padding: clamp(16px,4vw,28px) clamp(12px,4vw,26px);
  }

  /* ── Header ── */
  .atm-hd { margin-bottom: 26px; }
  .atm-title { font-size: clamp(20px,3vw,26px); font-weight: 700; color: #fff; }
  .atm-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }

  /* ── Stat cards ── */
  .atm-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 24px; }
  @media(max-width:860px){ .atm-stats { grid-template-columns: repeat(2,1fr); } }
  @media(max-width:480px){ .atm-stats { grid-template-columns: 1fr 1fr; } }
  .atm-stat { background: #0e1118; border: 1px solid #1e2236; border-radius: 12px; padding: 18px 20px; }
  .atm-stat-label { font-size: 11px; font-weight: 600; color: #4b5268; text-transform: uppercase; letter-spacing: .9px; margin-bottom: 8px; }
  .atm-stat-val   { font-size: 28px; font-weight: 800; font-family: 'DM Mono', monospace; }
  .atm-stat-val.amber  { color: #f59e0b; }
  .atm-stat-val.green  { color: #22c55e; }
  .atm-stat-val.red    { color: #ef4444; }
  .atm-stat-val.text   { color: #dde3f0; }

  /* ── Table card ── */
  .atm-card { background: #0e1118; border: 1px solid #1e2236; border-radius: 14px; overflow: hidden; }
  .atm-card-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 22px; border-bottom: 1px solid #1e2236; flex-wrap: wrap; gap: 12px;
  }
  .atm-card-title { font-size: 15px; font-weight: 700; color: #fff; }
  .atm-card-sub   { font-size: 12px; color: #4b5268; margin-top: 2px; }
  .atm-controls { display: flex; gap: 10px; flex-wrap: wrap; }

  .atm-input {
    background: #141720; border: 1px solid #1e2236; border-radius: 8px;
    padding: 8px 13px; color: #dde3f0; font-size: 13px; outline: none;
    transition: border-color .15s;
  }
  .atm-input:focus { border-color: #00c9b1; }
  .atm-input::placeholder { color: #4b5268; }
  select.atm-input { cursor: pointer; min-width: 140px; }

  .atm-btn {
    padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 6px; transition: opacity .15s;
  }
  .atm-btn:disabled { opacity: .45; cursor: not-allowed; }
  .atm-btn-ghost { background: transparent; color: #8b93a8; border: 1px solid #1e2236; }
  .atm-btn-ghost:hover { border-color: #2c2f42; color: #dde3f0; }
  .atm-btn-approve { background: rgba(34,197,94,.14); color: #22c55e; border: 1px solid rgba(34,197,94,.28); }
  .atm-btn-approve:hover { background: rgba(34,197,94,.22); }
  .atm-btn-reject  { background: rgba(239,68,68,.13); color: #ef4444; border: 1px solid rgba(239,68,68,.28); }
  .atm-btn-reject:hover  { background: rgba(239,68,68,.22); }
  .atm-btn-reset   { background: rgba(251,191,36,.12); color: #fbbf24; border: 1px solid rgba(251,191,36,.28); font-size: 12px; padding: 5px 12px; }
  .atm-btn-hist    { background: rgba(124,58,237,.12); color: #a78bfa; border: 1px solid rgba(124,58,237,.25); font-size: 12px; padding: 5px 12px; }

  /* ── Table ── */
  .atm-tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table.atm-tbl { width: 100%; border-collapse: collapse; min-width: 900px; }
  .atm-tbl thead tr { background: #141720; border-bottom: 1px solid #1e2236; }
  .atm-tbl th {
    padding: 11px 16px; text-align: left; color: #4b5268;
    font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .9px; white-space: nowrap;
  }
  .atm-tbl td { padding: 14px 16px; border-bottom: 1px solid #141720; vertical-align: middle; font-size: 13px; }
  .atm-tbl tbody tr:last-child td { border-bottom: none; }
  .atm-tbl tbody tr:hover td { background: rgba(255,255,255,.018); }

  .atm-num  { color: #4b5268; font-size: 12px; font-family: monospace; }
  .atm-date { color: #8b93a8; font-size: 12px; font-family: monospace; white-space: nowrap; }
  .atm-emp-name  { font-weight: 600; color: #dde3f0; }
  .atm-emp-email { font-size: 11px; color: #4b5268; margin-top: 2px; }
  .atm-desc { color: #c9cfe0; white-space: pre-wrap; word-break: break-word; max-width: 280px; }
  .atm-actions { display: flex; gap: 7px; align-items: center; }

  .atm-badge {
    display: inline-flex; align-items: center; padding: 3px 10px;
    border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap;
  }

  /* ── Empty / loading ── */
  .atm-empty { text-align: center; padding: 56px 20px; color: #4b5268; font-size: 14px; }

  /* ── Modal overlay ── */
  .atm-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.78); backdrop-filter: blur(5px);
    z-index: 200; display: flex; align-items: flex-start; justify-content: center;
    padding: 16px; overflow-y: auto;
  }
  .atm-modal {
    background: #0e1118; border: 1px solid #1e2236; border-radius: 14px;
    padding: 22px 24px; width: 100%; max-width: 600px;
    margin-top: auto; margin-bottom: auto; animation: aSlideUp .18s ease;
  }
  @keyframes aSlideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
  .atm-modal-title { font-size: 15px; font-weight: 700; color: #fff; }
  .atm-modal-sub   { font-size: 12px; color: #6b7280; margin-top: 3px; }
  .atm-hist-item {
    background: #141720; border: 1px solid #1e2236; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;
  }

  /* ── Toast ── */
  .atm-toast-wrap { position: fixed; bottom: 22px; right: 22px; z-index: 500; display: flex; flex-direction: column; gap: 8px; }
  .atm-toast { padding: 11px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; border: 1px solid; animation: aSlideUp .2s ease; max-width: 300px; }
  .atm-toast.success { background: rgba(34,197,94,.1);  border-color: rgba(34,197,94,.3);  color: #22c55e; }
  .atm-toast.error   { background: rgba(239,68,68,.1);  border-color: rgba(239,68,68,.3);  color: #ef4444; }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminTaskManagerPage() {
  const [tasks,         setTasks]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [approvalFilter,setApprovalFilter]= useState<string>('All');
  const [acting,        setActing]        = useState<number | null>(null);

  // History modal
  const [histTask,      setHistTask]      = useState<any>(null);
  const [history,       setHistory]       = useState<any[]>([]);
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
  async function openHistory(task: any) {
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
    <div className="atm-root">
      <style>{PAGE_STYLES}</style>

      {/* ── Header ── */}
      <div className="atm-hd">
        <div className="atm-title">Admin Task Manager</div>
        <div className="atm-sub">Review, approve and reject employee daily tasks</div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="atm-stats">
        <div className="atm-stat">
          <div className="atm-stat-label">Total Tasks</div>
          <div className="atm-stat-val text">{stats.total}</div>
        </div>
        <div className="atm-stat">
          <div className="atm-stat-label">Pending Review</div>
          <div className="atm-stat-val amber">{stats.pending}</div>
        </div>
        <div className="atm-stat">
          <div className="atm-stat-label">Approved</div>
          <div className="atm-stat-val green">{stats.approved}</div>
        </div>
        <div className="atm-stat">
          <div className="atm-stat-label">Rejected</div>
          <div className="atm-stat-val red">{stats.rejected}</div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="atm-card">
        <div className="atm-card-head">
          <div>
            <div className="atm-card-title">All Employee Tasks</div>
            <div className="atm-card-sub">
              {approvalFilter !== 'All'
                ? `${filtered.length} ${approvalFilter.toLowerCase()} tasks`
                : `${filtered.length} of ${tasks.length} tasks`}
            </div>
          </div>
          <div className="atm-controls">
            <input
              className="atm-input"
              placeholder="Search employee, task…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <select
              className="atm-input"
              value={approvalFilter}
              onChange={e => setApprovalFilter(e.target.value)}
            >
              {APPROVAL_FILTERS.map(f => (
                <option key={f} value={f}>{f === 'All' ? 'All Statuses' : f}</option>
              ))}
            </select>
            <button className="atm-btn atm-btn-ghost" onClick={fetchTasks} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="atm-tbl-wrap">
          {loading ? (
            <div className="atm-empty">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="atm-empty">
              {search || approvalFilter !== 'All'
                ? 'No tasks match your filters.'
                : 'No tasks submitted yet.'}
            </div>
          ) : (
            <table className="atm-tbl">
              <thead>
                <tr>
                  {['#', 'Date', 'Employee', 'Task Description', 'Task Status', 'Approval', 'Reviewed By', 'Submitted', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const isActing = acting === t.id;
                  return (
                    <tr key={t.id}>
                      <td className="atm-num">{String(i + 1).padStart(2, '0')}</td>

                      <td className="atm-date">
                        {fmtDate(t.task_date)}
                        {t.task_date === todayISO() && (
                          <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', background: 'rgba(0,201,177,.12)', color: '#00c9b1', borderRadius: 4, border: '1px solid rgba(0,201,177,.25)' }}>
                            TODAY
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="atm-emp-name">{t.employee_name || '—'}</div>
                        <div className="atm-emp-email">{t.employee_email || ''}</div>
                      </td>

                      <td>
                        <div className="atm-desc">{t.description}</div>
                      </td>

                      <td>
                        <span className="atm-badge" style={taskBadge(t.status)}>{t.status}</span>
                      </td>

                      <td>
                        <span className="atm-badge" style={approvalBadge(t.approval_status)}>
                          {t.approval_status}
                        </span>
                      </td>

                      <td>
                        {t.approved_by_name ? (
                          <>
                            <div style={{ fontSize: 12, color: '#dde3f0' }}>{t.approved_by_name}</div>
                            <div style={{ fontSize: 11, color: '#4b5268' }}>{t.approved_at ? fmtTs(t.approved_at) : ''}</div>
                          </>
                        ) : (
                          <span style={{ color: '#4b5268', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      <td className="atm-date">{fmtTs(t.created_at)}</td>

                      <td>
                        <div className="atm-actions">
                          {t.approval_status !== 'Approved' && (
                            <button
                              className="atm-btn atm-btn-approve"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Approved')}
                            >
                              {isActing ? '…' : 'Approve'}
                            </button>
                          )}
                          {t.approval_status !== 'Rejected' && (
                            <button
                              className="atm-btn atm-btn-reject"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Rejected')}
                            >
                              {isActing ? '…' : 'Reject'}
                            </button>
                          )}
                          {t.approval_status !== 'Pending' && (
                            <button
                              className="atm-btn atm-btn-reset"
                              disabled={isActing}
                              onClick={() => setApproval(t.id, 'Pending')}
                              title="Reset to Pending"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            className="atm-btn atm-btn-hist"
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
          className="atm-overlay"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) setHistTask(null); }}
        >
          <div className="atm-modal" role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div className="atm-modal-title">Edit History</div>
                <div className="atm-modal-sub">{fmtDate(histTask.task_date)} · {histTask.employee_name}</div>
              </div>
              <button
                onClick={() => setHistTask(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 17, padding: '2px 6px' }}
              >✕</button>
            </div>

            {histLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#4b5268', fontSize: 14 }}>
                No edits recorded for this task.
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((h, idx) => (
                  <div key={h.id} className="atm-hist-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: '#8b93a8' }}>
                        Edit #{history.length - idx} by{' '}
                        <strong style={{ color: '#dde3f0' }}>{h.edited_by_name || 'Unknown'}</strong>
                      </span>
                      <span style={{ fontSize: 11, color: '#4b5268' }}>{fmtTs(h.edited_at)}</span>
                    </div>
                    {h.old_description !== h.new_description && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#4b5268', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 5 }}>Description</div>
                        <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.07)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ color: '#6b7280' }}>Before: </span>{h.old_description}
                        </div>
                        <div style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,.07)', padding: '6px 10px', borderRadius: 6 }}>
                          <span style={{ color: '#6b7280' }}>After: </span>{h.new_description}
                        </div>
                      </div>
                    )}
                    {h.old_status !== h.new_status && (
                      <div>
                        <div style={{ fontSize: 10, color: '#4b5268', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 5 }}>Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span className="atm-badge" style={taskBadge(h.old_status)}>{h.old_status}</span>
                          <span style={{ color: '#4b5268' }}>→</span>
                          <span className="atm-badge" style={taskBadge(h.new_status)}>{h.new_status}</span>
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
      <div className="atm-toast-wrap" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`atm-toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
